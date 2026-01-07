import { Link, useLoaderData, Form, redirect } from "react-router";
import { db } from "~/db";
import { books, chapters, papers, testSessions } from "~/db/schema";
import { desc, eq, asc, isNull } from "drizzle-orm";
import type { Route } from "./+types/dashboard";
import { requireAuth } from "~/lib/require-auth.server";
import { createLogoutCookie } from "~/lib/auth.server";
import { canAccessPaper } from "~/lib/access-control.server";
import { Accordion } from "~/components";

interface PaperWithProgress {
  id: number;
  name: string;
  source: string;
  questionCount: number;
  accessTier: "free" | "premium";
  bookId: number | null;
  chapterId: number | null;
  orderIndex: number;
  hasAccess: boolean;
  latestSession: {
    id: number;
    status: "in_progress" | "completed";
    mode: "test" | "learning";
  } | null;
  completedCount: number;
  bestScore: number | null;
}

interface ChapterWithPapers {
  id: number;
  name: string;
  description: string | null;
  orderIndex: number;
  papers: PaperWithProgress[];
}

interface BookWithContent {
  id: number;
  name: string;
  description: string | null;
  orderIndex: number;
  chapters: ChapterWithPapers[];
  standalonePapers: PaperWithProgress[]; // Papers in book but not in a chapter
  totalQuestions: number;
  totalPapers: number;
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);

  // Fetch all books with ordering
  const allBooks = await db
    .select()
    .from(books)
    .orderBy(asc(books.orderIndex), desc(books.createdAt));

  // Fetch all chapters
  const allChapters = await db
    .select()
    .from(chapters)
    .orderBy(asc(chapters.orderIndex));

  // Fetch all papers
  const allPapers = await db
    .select()
    .from(papers)
    .orderBy(asc(papers.orderIndex), desc(papers.createdAt));

  // Fetch user's sessions
  const userSessions = await db
    .select()
    .from(testSessions)
    .where(eq(testSessions.userId, user.id))
    .orderBy(desc(testSessions.startedAt));

  // Helper to get paper progress
  const getPaperProgress = (paperId: number) => {
    const paperSessions = userSessions.filter((s) => s.paperId === paperId);
    const latestSession = paperSessions[0] || null;
    const completedSessions = paperSessions.filter(
      (s) => s.status === "completed"
    );
    const bestScore =
      completedSessions.length > 0
        ? Math.max(...completedSessions.map((s) => s.score || 0))
        : null;

    return {
      latestSession: latestSession
        ? {
            id: latestSession.id,
            status: latestSession.status,
            mode: latestSession.mode,
          }
        : null,
      completedCount: completedSessions.length,
      bestScore,
    };
  };

  // Build paper with progress
  const buildPaperWithProgress = (paper: typeof allPapers[0]): PaperWithProgress => {
    const progress = getPaperProgress(paper.id);
    return {
      id: paper.id,
      name: paper.name,
      source: paper.source,
      questionCount: paper.questionCount,
      accessTier: paper.accessTier,
      bookId: paper.bookId,
      chapterId: paper.chapterId,
      orderIndex: paper.orderIndex,
      hasAccess: canAccessPaper(user, paper),
      ...progress,
    };
  };

  // Sort papers: for free users, show free papers first
  const sortPapers = (papers: PaperWithProgress[]): PaperWithProgress[] => {
    if (user.subscriptionStatus === "free") {
      return [...papers].sort((a, b) => {
        // Free papers first
        if (a.accessTier === "free" && b.accessTier !== "free") return -1;
        if (a.accessTier !== "free" && b.accessTier === "free") return 1;
        // Then by order index
        return a.orderIndex - b.orderIndex;
      });
    }
    // Subscribed users: just sort by order index
    return [...papers].sort((a, b) => a.orderIndex - b.orderIndex);
  };

  // Build hierarchical structure
  const booksWithContent: BookWithContent[] = allBooks.map((book) => {
    // Get chapters for this book
    const bookChapters = allChapters.filter((c) => c.bookId === book.id);

    // Build chapters with their papers
    const chaptersWithPapers: ChapterWithPapers[] = bookChapters.map(
      (chapter) => {
        const chapterPapers = allPapers
          .filter((p) => p.chapterId === chapter.id)
          .map(buildPaperWithProgress);

        return {
          id: chapter.id,
          name: chapter.name,
          description: chapter.description,
          orderIndex: chapter.orderIndex,
          papers: sortPapers(chapterPapers),
        };
      }
    );

    // Get standalone papers (in book but not in any chapter)
    const bookStandalonePapers = sortPapers(
      allPapers
        .filter((p) => p.bookId === book.id && p.chapterId === null)
        .map(buildPaperWithProgress)
    );

    // Calculate totals
    const allBookPapers = [
      ...chaptersWithPapers.flatMap((c) => c.papers),
      ...bookStandalonePapers,
    ];
    const totalQuestions = allBookPapers.reduce(
      (sum, p) => sum + p.questionCount,
      0
    );

    return {
      id: book.id,
      name: book.name,
      description: book.description,
      orderIndex: book.orderIndex,
      chapters: chaptersWithPapers,
      standalonePapers: bookStandalonePapers,
      totalQuestions,
      totalPapers: allBookPapers.length,
    };
  });

  // Get standalone papers (not in any book)
  const standalonePapers = sortPapers(
    allPapers
      .filter((p) => p.bookId === null)
      .map(buildPaperWithProgress)
  );

  // Calculate stats
  const allPapersWithProgress = [
    ...booksWithContent.flatMap((b) => [
      ...b.chapters.flatMap((c) => c.papers),
      ...b.standalonePapers,
    ]),
    ...standalonePapers,
  ];

  const totalPapers = allPapersWithProgress.length;
  const totalQuestions = allPapersWithProgress.reduce(
    (sum, p) => sum + p.questionCount,
    0
  );
  const accessiblePapers = allPapersWithProgress.filter((p) => p.hasAccess);
  const completedPapers = accessiblePapers.filter((p) => p.completedCount > 0);
  const inProgressPapers = accessiblePapers.filter(
    (p) => p.latestSession?.status === "in_progress"
  );

  return {
    books: booksWithContent,
    standalonePapers,
    user,
    stats: {
      totalPapers,
      totalQuestions,
      completedCount: completedPapers.length,
      inProgressCount: inProgressPapers.length,
    },
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("_action");

  if (actionType === "logout") {
    return redirect("/login", {
      headers: {
        "Set-Cookie": createLogoutCookie(),
      },
    });
  }

  return null;
}

export function meta() {
  return [
    { title: "Dashboard - FCPS Study" },
    { name: "description", content: "Practice for FCPS Part I examinations" },
  ];
}

// Paper card component
function PaperCard({ paper }: { paper: PaperWithProgress }) {
  return (
    <Link
      to={`/paper/${paper.id}`}
      className={`block px-4 py-3 mx-2 mb-2 rounded-xl transition-all ${
        paper.hasAccess
          ? "bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 hover:shadow-sm"
          : "bg-slate-50/50 dark:bg-slate-800/30 opacity-75"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-sm font-medium ${
                paper.hasAccess
                  ? "text-slate-900 dark:text-white"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {paper.name}
            </span>
            {!paper.hasAccess && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded">
                🔒 Premium
              </span>
            )}
            {paper.hasAccess && paper.accessTier === "free" && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-success-100 dark:bg-success-900/40 text-success-700 dark:text-success-400 rounded">
                Free
              </span>
            )}
            {paper.hasAccess && paper.latestSession?.status === "in_progress" && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-warning-100 dark:bg-warning-900/40 text-warning-700 dark:text-warning-400 rounded">
                In Progress
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span>{paper.questionCount} Qs</span>
            {paper.hasAccess && paper.bestScore !== null && (
              <span className="text-success-600 dark:text-success-400">
                Best: {Math.round((paper.bestScore / paper.questionCount) * 100)}%
              </span>
            )}
          </div>
        </div>
        <svg
          className={`w-4 h-4 shrink-0 ${
            paper.hasAccess
              ? "text-slate-400"
              : "text-amber-500"
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { books, standalonePapers, user, stats } =
    useLoaderData<typeof loader>();

  const isSubscribed = user.subscriptionStatus === "subscribed";

  // Check if user needs to verify email
  const needsEmailVerification = !user.emailVerified;
  const createdAt = new Date(user.createdAt);
  const sevenDaysFromCreation = new Date(
    createdAt.getTime() + 7 * 24 * 60 * 60 * 1000
  );
  const daysRemaining = Math.max(
    0,
    Math.ceil(
      (sevenDaysFromCreation.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    )
  );

  return (
    <div className="min-h-screen">
      {/* Email Verification Banner */}
      {needsEmailVerification && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800">
          <div className="max-w-5xl mx-auto px-4 py-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="shrink-0 w-8 h-8 bg-amber-100 dark:bg-amber-800/50 rounded-full flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-amber-600 dark:text-amber-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Please verify your email to keep access to your account
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  {daysRemaining > 0 ? (
                    <>
                      You have{" "}
                      <strong>
                        {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}
                      </strong>{" "}
                      remaining to verify your email ({user.email}).
                    </>
                  ) : (
                    <>Your verification period has expired.</>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact Banner */}
      <div className="bg-primary-50 dark:bg-primary-900/20 border-b border-primary-200 dark:border-primary-800">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="shrink-0 w-8 h-8 bg-primary-100 dark:bg-primary-800/50 rounded-full flex items-center justify-center">
              <svg
                className="w-4 h-4 text-primary-600 dark:text-primary-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <p className="text-sm text-primary-800 dark:text-primary-200">
              Have a request?{" "}
              <a
                href="mailto:ishaqibrahimbss@gmail.com"
                className="font-medium underline"
              >
                Email
              </a>{" "}
              or{" "}
              <a
                href="https://wa.me/923416110684"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline"
              >
                WhatsApp
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shrink-0">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  FCPS Study
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Practice Makes Perfect
                </p>
              </div>
            </Link>

            {/* User menu */}
            <div className="flex items-center gap-2 sm:gap-3">
              {!isSubscribed && (
                <Link
                  to="/upgrade"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-amber-800/30 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50 rounded-lg hover:from-amber-200 hover:to-amber-100 transition-all"
                >
                  <span>👑</span>
                  Upgrade
                </Link>
              )}
              <div className="text-right hidden sm:block">
                <div className="flex items-center gap-2 justify-end">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {user.name || "User"}
                  </p>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      isSubscribed
                        ? "bg-gradient-to-r from-amber-400 to-amber-500 text-amber-900"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {isSubscribed ? "Premium" : "Free"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {user.email}
                </p>
              </div>
              <Form method="post">
                <input type="hidden" name="_action" value="logout" />
                <button
                  type="submit"
                  className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title="Sign out"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                </button>
              </Form>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-5 sm:py-8">
        {/* Upgrade Banner for Free Users */}
        {!isSubscribed && (
          <Link
            to="/upgrade"
            className="block mb-6 sm:mb-8 bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white hover:from-amber-600 hover:to-amber-700 transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-bl-xl text-xs sm:text-sm font-semibold">
              🎁 First 10 users get FREE lifetime access!
            </div>
            <div className="flex items-center justify-between gap-4 mt-4 sm:mt-2">
              <div className="flex items-center gap-3 sm:gap-4">
                <span className="text-3xl sm:text-4xl">👑</span>
                <div>
                  <h3 className="font-bold text-lg sm:text-xl">
                    Upgrade to Premium
                  </h3>
                  <p className="text-amber-100 text-sm sm:text-base">
                    Unlock all books and papers with detailed explanations
                  </p>
                </div>
              </div>
              <div className="shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </Link>
        )}

        {/* Stats summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800">
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {stats.totalPapers}
            </p>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Total Papers
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800">
            <p className="text-2xl sm:text-3xl font-bold text-primary-500">
              {stats.totalQuestions}
            </p>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Total Questions
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800">
            <p className="text-2xl sm:text-3xl font-bold text-success-500">
              {stats.completedCount}
            </p>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Completed
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800">
            <p className="text-2xl sm:text-3xl font-bold text-warning-500">
              {stats.inProgressCount}
            </p>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              In Progress
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
            Study Materials
          </h2>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
              <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-pulse"></span>
              More SK & AA papers coming soon
            </span>
          </div>
        </div>

        {books.length === 0 && standalonePapers.length === 0 ? (
          <div className="text-center py-12 sm:py-16 bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-7 h-7 sm:w-8 sm:h-8 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg font-medium text-slate-900 dark:text-white mb-2">
              No content yet
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 px-4">
              Books and papers will appear here once they are imported.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Books */}
            {books.map((book) => (
              <div
                key={book.id}
                className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
              >
                <Accordion
                  title={
                    <div>
                      <span className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                        {book.name}
                      </span>
                      {book.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {book.description}
                        </p>
                      )}
                    </div>
                  }
                  icon={
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        />
                      </svg>
                    </div>
                  }
                  badge={
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {book.totalPapers} papers • {book.totalQuestions} Qs
                    </span>
                  }
                >
                  <div className="px-2">
                    {/* Chapters */}
                    {book.chapters.map((chapter) => (
                      <div
                        key={chapter.id}
                        className="border-l-2 border-slate-200 dark:border-slate-700 ml-5"
                      >
                        <Accordion
                          title={
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                              {chapter.name}
                            </span>
                          }
                          badge={
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {chapter.papers.length} papers
                            </span>
                          }
                          className="pl-4"
                        >
                          <div className="pl-4">
                            {chapter.papers.map((paper) => (
                              <PaperCard key={paper.id} paper={paper} />
                            ))}
                          </div>
                        </Accordion>
                      </div>
                    ))}

                    {/* Standalone papers in book */}
                    {book.standalonePapers.length > 0 && (
                      <div className="ml-5 mt-2">
                        {book.standalonePapers.map((paper) => (
                          <PaperCard key={paper.id} paper={paper} />
                        ))}
                      </div>
                    )}
                  </div>
                </Accordion>
              </div>
            ))}

            {/* Standalone papers (not in any book) */}
            {standalonePapers.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <Accordion
                  title={
                    <span className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                      Other Papers
                    </span>
                  }
                  icon={
                    <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-slate-600 dark:text-slate-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                  }
                  badge={
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {standalonePapers.length} papers
                    </span>
                  }
                  defaultOpen={books.length === 0}
                >
                  <div className="px-2">
                    {standalonePapers.map((paper) => (
                      <PaperCard key={paper.id} paper={paper} />
                    ))}
                  </div>
                </Accordion>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

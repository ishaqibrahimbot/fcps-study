import { Link, useLoaderData, Form, redirect } from "react-router";
import { db } from "~/db";
import { papers, testSessions } from "~/db/schema";
import { desc, eq } from "drizzle-orm";
import type { Route } from "./+types/home";
import { requireAuth } from "~/lib/require-auth.server";
import { createLogoutCookie } from "~/lib/auth.server";
import { canAccessPaper } from "~/lib/access-control.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);

  // Fetch ALL papers (global, not per-user)
  const allPapers = await db
    .select()
    .from(papers)
    .orderBy(desc(papers.createdAt));

  // Get latest session for each paper (scoped to current user)
  const papersWithProgress = await Promise.all(
    allPapers.map(async (paper) => {
      const sessions = await db
        .select()
        .from(testSessions)
        .where(eq(testSessions.paperId, paper.id))
        .orderBy(desc(testSessions.startedAt));

      // Filter sessions to only current user's sessions
      const userSessions = sessions.filter((s) => s.userId === user.id);
      const latestSession = userSessions[0];
      const completedSessions = userSessions.filter(
        (s) => s.status === "completed"
      );
      const bestScore =
        completedSessions.length > 0
          ? Math.max(...completedSessions.map((s) => s.score || 0))
          : null;

      // Check if user can access this paper
      const hasAccess = canAccessPaper(user, paper);

      return {
        ...paper,
        latestSession: latestSession || null,
        completedCount: completedSessions.length,
        bestScore,
        hasAccess,
      };
    })
  );

  return { papers: papersWithProgress, user };
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
    { title: "FCPS Study App" },
    { name: "description", content: "Practice for FCPS Part I examinations" },
  ];
}

export default function Home() {
  const { papers, user } = useLoaderData<typeof loader>();

  const accessiblePapers = papers.filter((p) => p.hasAccess);
  const isSubscribed = user.subscriptionStatus === "subscribed";

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center flex-shrink-0">
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
            </div>

            {/* User menu */}
            <div className="flex items-center gap-3">
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
        {/* Stats summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800">
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {papers.length}
            </p>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Total Papers
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800">
            <p className="text-2xl sm:text-3xl font-bold text-primary-500">
              {papers.reduce((acc, p) => acc + p.questionCount, 0)}
            </p>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Total Questions
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800">
            <p className="text-2xl sm:text-3xl font-bold text-success-500">
              {accessiblePapers.filter((p) => p.completedCount > 0).length}
            </p>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Completed
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800">
            <p className="text-2xl sm:text-3xl font-bold text-warning-500">
              {
                accessiblePapers.filter(
                  (p) => p.latestSession?.status === "in_progress"
                ).length
              }
            </p>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              In Progress
            </p>
          </div>
        </div>

        {/* Papers list */}
        <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-3 sm:mb-4">
          Available Papers
        </h2>

        {papers.length === 0 ? (
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg font-medium text-slate-900 dark:text-white mb-2">
              No papers yet
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 px-4">
              Papers will appear here once they are imported.
            </p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {papers.map((paper) => (
              <Link
                key={paper.id}
                to={`/paper/${paper.id}`}
                className={`block bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 border transition-all duration-200 group touch-manipulation ${
                  paper.hasAccess
                    ? "border-slate-200 dark:border-slate-800 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-lg hover:shadow-primary-500/5"
                    : "border-slate-200/50 dark:border-slate-800/50 opacity-75"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5 sm:mb-2">
                      <h3
                        className={`text-base sm:text-lg font-semibold transition-colors ${
                          paper.hasAccess
                            ? "text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400"
                            : "text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {paper.name}
                      </h3>
                      {!paper.hasAccess && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-gradient-to-r from-amber-400 to-amber-500 text-amber-900 rounded-full flex items-center gap-1">
                          <svg
                            className="w-3 h-3"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Premium
                        </span>
                      )}
                      {paper.hasAccess && paper.accessTier === "free" && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-success-500/10 text-success-600 dark:text-success-400 rounded-full">
                          Free
                        </span>
                      )}
                      {paper.hasAccess &&
                        paper.latestSession?.status === "in_progress" && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-warning-500/10 text-warning-500 rounded-full">
                            In Progress
                          </span>
                        )}
                      {paper.hasAccess && paper.completedCount > 0 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-success-500/10 text-success-500 rounded-full">
                          Completed
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-2 sm:mb-3">
                      Source: {paper.source}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-xs sm:text-sm">
                      <span className="text-slate-600 dark:text-slate-300">
                        <span className="font-medium">
                          {paper.questionCount}
                        </span>{" "}
                        questions
                      </span>
                      {paper.hasAccess && paper.bestScore !== null && (
                        <span className="text-success-500">
                          Best:{" "}
                          {Math.round(
                            (paper.bestScore / paper.questionCount) * 100
                          )}
                          %
                        </span>
                      )}
                      {paper.hasAccess && paper.completedCount > 0 && (
                        <span className="text-slate-500 dark:text-slate-400">
                          {paper.completedCount} attempts
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className={`flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors ${
                      paper.hasAccess
                        ? "bg-slate-100 dark:bg-slate-800 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/40"
                        : "bg-amber-100 dark:bg-amber-900/30"
                    }`}
                  >
                    {paper.hasAccess ? (
                      <svg
                        className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-primary-500 transition-colors"
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
                    ) : (
                      <svg
                        className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

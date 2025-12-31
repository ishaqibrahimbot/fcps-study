import { Link, useLoaderData, Form, redirect } from "react-router";
import { db } from "~/db";
import { papers, questions, testSessions } from "~/db/schema";
import { eq, desc, and } from "drizzle-orm";
import type { Route } from "./+types/paper";
import { requireAuth } from "~/lib/require-auth.server";
import { canAccessPaper } from "~/lib/access-control.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  const paperId = parseInt(params.paperId);

  // Fetch paper (papers are global now)
  const [paper] = await db.select().from(papers).where(eq(papers.id, paperId));

  if (!paper) {
    throw new Response("Paper not found", { status: 404 });
  }

  // Check if user has access
  const hasAccess = canAccessPaper(user, paper);

  const questionList = await db
    .select()
    .from(questions)
    .where(eq(questions.paperId, paperId))
    .orderBy(questions.orderIndex);

  // Count incomplete questions (empty choices or invalid correct choice)
  const incompleteCount = questionList.filter(
    (q) =>
      q.choices.length === 0 ||
      q.correctChoice === null ||
      q.correctChoice < 0 ||
      q.correctChoice >= q.choices.length
  ).length;

  // Get sessions for this user only
  const sessions = await db
    .select()
    .from(testSessions)
    .where(
      and(eq(testSessions.paperId, paperId), eq(testSessions.userId, user.id))
    )
    .orderBy(desc(testSessions.startedAt));

  const inProgressSession = sessions.find((s) => s.status === "in_progress");
  const completedSessions = sessions.filter((s) => s.status === "completed");

  return {
    paper,
    hasAccess,
    questionCount: questionList.length,
    incompleteCount,
    inProgressSession,
    completedSessions,
    user,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireAuth(request);
  const formData = await request.formData();
  const mode = formData.get("mode") as "test" | "learning";
  const paperId = parseInt(params.paperId);
  const resumeSessionId = formData.get("resumeSessionId");

  // Fetch paper and verify access
  const [paper] = await db.select().from(papers).where(eq(papers.id, paperId));

  if (!paper) {
    throw new Response("Paper not found", { status: 404 });
  }

  if (!canAccessPaper(user, paper)) {
    throw new Response(
      "Access denied. Upgrade to premium to access this paper.",
      { status: 403 }
    );
  }

  // If resuming an existing session
  if (resumeSessionId) {
    const sessionId = parseInt(resumeSessionId as string);
    const [session] = await db
      .select()
      .from(testSessions)
      .where(
        and(eq(testSessions.id, sessionId), eq(testSessions.userId, user.id))
      );

    if (session) {
      const routePath = session.mode === "learning" ? "learn" : session.mode;
      return redirect(`/${routePath}/${session.id}`);
    }
  }

  // Default time: 1 minute per question for test mode
  const timeRemaining = mode === "test" ? paper.questionCount * 60 : null;

  const [newSession] = await db
    .insert(testSessions)
    .values({
      paperId,
      userId: user.id,
      mode,
      status: "in_progress",
      currentQuestionIndex: 0,
      answers: {},
      timeRemaining,
    })
    .returning();

  // Map mode to route path (learning -> learn)
  const routePath = mode === "learning" ? "learn" : mode;
  return redirect(`/${routePath}/${newSession.id}`);
}

export function meta({ data }: Route.MetaArgs) {
  return [
    {
      title: data?.paper
        ? `${data.paper.name} - FCPS Study`
        : "Paper - FCPS Study",
    },
  ];
}

export default function Paper() {
  const {
    paper,
    hasAccess,
    questionCount,
    incompleteCount,
    inProgressSession,
    completedSessions,
  } = useLoaderData<typeof loader>();

  const bestScore =
    completedSessions.length > 0
      ? Math.max(...completedSessions.map((s) => s.score || 0))
      : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Papers
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Paper info */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 mb-8">
          <div className="flex items-start justify-between mb-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {paper.name}
            </h1>
            {paper.accessTier === "premium" && (
              <span className="px-3 py-1 text-xs font-medium bg-gradient-to-r from-amber-400 to-amber-500 text-amber-900 rounded-full flex items-center gap-1">
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
            {paper.accessTier === "free" && (
              <span className="px-3 py-1 text-xs font-medium bg-success-500/10 text-success-600 dark:text-success-400 rounded-full">
                Free
              </span>
            )}
          </div>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Source: {paper.source}
          </p>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {questionCount}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Questions
              </p>
            </div>
            <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {completedSessions.length}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Attempts
              </p>
            </div>
            <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <p className="text-2xl font-bold text-success-500">
                {bestScore !== null
                  ? `${Math.round((bestScore / questionCount) * 100)}%`
                  : "—"}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Best Score
              </p>
            </div>
          </div>
        </div>

        {/* No access - Premium upgrade prompt */}
        {!hasAccess && (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-8 mb-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-amber-900"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Premium Content
            </h2>
            <p className="text-slate-600 dark:text-slate-300 mb-6 max-w-md mx-auto">
              This paper is available exclusively for premium members. Upgrade
              your account to access all papers and unlock your full study
              potential.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                disabled
                className="px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 text-amber-900 font-semibold rounded-xl opacity-75 cursor-not-allowed"
              >
                Upgrade to Premium
              </button>
              <Link
                to="/"
                className="px-6 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Browse Free Papers
              </Link>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
              Contact your administrator to upgrade your account.
            </p>
          </div>
        )}

        {/* Only show the following if user has access */}
        {hasAccess && (
          <>
            {/* Incomplete questions warning */}
            {incompleteCount > 0 && (
              <div className="bg-error-50 dark:bg-error-900/20 border border-error-500/30 rounded-2xl p-6 mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-error-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-error-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                      {incompleteCount} Incomplete Question
                      {incompleteCount > 1 ? "s" : ""}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                      Some questions are missing choices or have invalid answers
                      due to OCR issues. You can fix them manually.
                    </p>
                    <Link
                      to={`/paper/${paper.id}/fix`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-error-500 hover:bg-error-600 text-white font-medium rounded-xl transition-colors text-sm"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      Fix Manually
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Resume in-progress session */}
            {inProgressSession && (
              <div className="bg-warning-500/10 border border-warning-500/20 rounded-2xl p-6 mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-warning-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-warning-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                      Continue where you left off
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                      You have an in-progress{" "}
                      <span className="font-medium capitalize">
                        {inProgressSession.mode}
                      </span>{" "}
                      session. Question{" "}
                      {inProgressSession.currentQuestionIndex + 1} of{" "}
                      {questionCount}
                      {inProgressSession.mode === "test" &&
                        inProgressSession.timeRemaining && (
                          <span>
                            {" "}
                            • {Math.floor(
                              inProgressSession.timeRemaining / 60
                            )}{" "}
                            min remaining
                          </span>
                        )}
                    </p>
                    <Form method="post">
                      <input
                        type="hidden"
                        name="resumeSessionId"
                        value={inProgressSession.id}
                      />
                      <button
                        type="submit"
                        className="px-6 py-2 bg-warning-500 hover:bg-warning-600 text-white font-medium rounded-xl transition-colors"
                      >
                        Resume Session
                      </button>
                    </Form>
                  </div>
                </div>
              </div>
            )}

            {/* Mode selection */}
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Start New Session
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Test Mode */}
              <Form method="post">
                <input type="hidden" name="mode" value="test" />
                <button
                  type="submit"
                  className="w-full text-left bg-white dark:bg-slate-900 rounded-2xl p-6 border-2 border-slate-200 dark:border-slate-800 hover:border-primary-400 dark:hover:border-primary-600 transition-all duration-200 group"
                >
                  <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/40 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary-200 dark:group-hover:bg-primary-900/60 transition-colors">
                    <svg
                      className="w-6 h-6 text-primary-600 dark:text-primary-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    Test Mode
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    Timed examination. See your results at the end and review
                    explanations after completion.
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-600 dark:text-slate-300">
                      ⏱ {questionCount} min
                    </span>
                    <span className="text-slate-600 dark:text-slate-300">
                      📝 {questionCount} questions
                    </span>
                  </div>
                </button>
              </Form>

              {/* Learning Mode */}
              <Form method="post">
                <input type="hidden" name="mode" value="learning" />
                <button
                  type="submit"
                  className="w-full text-left bg-white dark:bg-slate-900 rounded-2xl p-6 border-2 border-slate-200 dark:border-slate-800 hover:border-success-400 dark:hover:border-success-600 transition-all duration-200 group"
                >
                  <div className="w-12 h-12 bg-success-100 dark:bg-success-900/40 rounded-xl flex items-center justify-center mb-4 group-hover:bg-success-200 dark:group-hover:bg-success-900/60 transition-colors">
                    <svg
                      className="w-6 h-6 text-success-600 dark:text-success-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    Learning Mode
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    No time pressure. Get immediate feedback and see
                    explanations after each question.
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-600 dark:text-slate-300">
                      📚 Self-paced
                    </span>
                    <span className="text-slate-600 dark:text-slate-300">
                      💡 Instant feedback
                    </span>
                  </div>
                </button>
              </Form>
            </div>

            {/* Previous attempts */}
            {completedSessions.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Previous Attempts
                </h2>
                <div className="space-y-3">
                  {completedSessions.slice(0, 5).map((session) => (
                    <Link
                      key={session.id}
                      to={`/review/${session.id}`}
                      className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            (session.score || 0) / questionCount >= 0.7
                              ? "bg-success-100 dark:bg-success-900/40 text-success-600 dark:text-success-400"
                              : "bg-error-100 dark:bg-error-900/40 text-error-600 dark:text-error-400"
                          }`}
                        >
                          {Math.round(
                            ((session.score || 0) / questionCount) * 100
                          )}
                          %
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white capitalize">
                            {session.mode} Mode
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {new Date(
                              session.completedAt!
                            ).toLocaleDateString()}{" "}
                            • {session.score}/{questionCount} correct
                          </p>
                        </div>
                      </div>
                      <span className="text-sm text-primary-500 font-medium">
                        Review →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

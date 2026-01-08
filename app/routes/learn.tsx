import { useState, useEffect, useCallback, useRef } from "react";
import { useLoaderData, useNavigate, useFetcher, Link } from "react-router";
import { db } from "~/db";
import { papers, questions, testSessions, userUnlockedPapers } from "~/db/schema";
import { eq, and } from "drizzle-orm";
import { QuestionCard, ProgressBar } from "~/components";
import type { Route } from "./+types/learn";
import { requireAuth } from "~/lib/require-auth.server";
import { canAccessPaper } from "~/lib/access-control.server";
import { sendFlaggedQuestionNotification } from "~/lib/email.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  const sessionId = parseInt(params.sessionId);

  const [session] = await db
    .select()
    .from(testSessions)
    .where(
      and(eq(testSessions.id, sessionId), eq(testSessions.userId, user.id))
    );

  if (!session) {
    throw new Response("Session not found", { status: 404 });
  }

  const [paper] = await db
    .select()
    .from(papers)
    .where(eq(papers.id, session.paperId));

  if (!paper) {
    throw new Response("Paper not found", { status: 404 });
  }

  // Fetch user's unlocked papers
  const unlockedPapersResult = await db
    .select({ paperId: userUnlockedPapers.paperId })
    .from(userUnlockedPapers)
    .where(eq(userUnlockedPapers.userId, user.id));
  const unlockedPaperIds = new Set(unlockedPapersResult.map((r) => r.paperId));

  // Verify user has access to this paper
  if (!canAccessPaper(user, paper, unlockedPaperIds)) {
    throw new Response(
      "Access denied. Unlock this paper with credits first.",
      { status: 403 }
    );
  }

  const questionList = await db
    .select()
    .from(questions)
    .where(eq(questions.paperId, session.paperId))
    .orderBy(questions.orderIndex);

  // Filter out incomplete questions
  const completeQuestions = questionList.filter(
    (q) =>
      q.choices.length > 0 &&
      q.correctChoice !== null &&
      q.correctChoice >= 0 &&
      q.correctChoice < q.choices.length
  );

  return {
    session,
    paper,
    questions: completeQuestions,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireAuth(request);
  const sessionId = parseInt(params.sessionId);
  const formData = await request.formData();
  const actionType = formData.get("_action");

  const [session] = await db
    .select()
    .from(testSessions)
    .where(
      and(eq(testSessions.id, sessionId), eq(testSessions.userId, user.id))
    );

  if (!session) {
    throw new Response("Session not found", { status: 404 });
  }

  if (actionType === "save") {
    const currentQuestionIndex = parseInt(
      formData.get("currentQuestionIndex") as string
    );
    const answers = JSON.parse(formData.get("answers") as string);

    await db
      .update(testSessions)
      .set({
        currentQuestionIndex,
        answers,
      })
      .where(eq(testSessions.id, sessionId));

    return { success: true };
  }

  if (actionType === "complete") {
    const answers = JSON.parse(formData.get("answers") as string);

    // Calculate score
    const questionList = await db
      .select()
      .from(questions)
      .where(eq(questions.paperId, session.paperId));

    let score = 0;
    for (const question of questionList) {
      if (answers[question.id] === question.correctChoice) {
        score++;
      }
    }

    await db
      .update(testSessions)
      .set({
        status: "completed",
        answers,
        score,
        completedAt: new Date(),
      })
      .where(eq(testSessions.id, sessionId));

    return { success: true, completed: true, score };
  }

  if (actionType === "flag") {
    const questionId = parseInt(formData.get("questionId") as string);
    const reason = formData.get("reason") as string | null;

    // Get the question and paper details for the email
    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId));

    const [paper] = await db
      .select()
      .from(papers)
      .where(eq(papers.id, session.paperId));

    // Flag the question
    await db
      .update(questions)
      .set({ flagged: true })
      .where(eq(questions.id, questionId));

    // Send notification email to admin
    if (question && paper) {
      await sendFlaggedQuestionNotification(
        user.email,
        user.name,
        questionId,
        question.questionText,
        paper.name,
        reason || undefined
      );
    }

    return { success: true, flagged: true };
  }

  return { success: false };
}

export function meta({ data }: Route.MetaArgs) {
  return [
    {
      title: data?.paper
        ? `Learn: ${data.paper.name} - FCPS Study`
        : "Learn - FCPS Study",
    },
  ];
}

export default function LearnMode() {
  const {
    session,
    paper,
    questions: questionList,
  } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [currentIndex, setCurrentIndex] = useState(
    session.currentQuestionIndex
  );
  const [answers, setAnswers] = useState<Record<number, number>>(
    (session.answers as Record<number, number>) || {}
  );
  const [isCompleted, setIsCompleted] = useState(
    session.status === "completed"
  );

  const currentQuestion = questionList[currentIndex];
  const answeredQuestions = new Set(
    Object.keys(answers).map((id) =>
      questionList.findIndex((q) => q.id === parseInt(id))
    )
  );

  // Track the latest values for saving on unmount
  const latestStateRef = useRef({ currentIndex, answers, isCompleted });
  latestStateRef.current = { currentIndex, answers, isCompleted };

  // Auto-save progress when answers change (debounced)
  useEffect(() => {
    if (isCompleted) return;

    const saveTimeout = setTimeout(() => {
      fetcher.submit(
        {
          _action: "save",
          currentQuestionIndex: currentIndex.toString(),
          answers: JSON.stringify(answers),
        },
        { method: "post" }
      );
    }, 1000);

    return () => clearTimeout(saveTimeout);
  }, [currentIndex, answers]);

  // Save immediately when navigating away from the page
  useEffect(() => {
    const saveProgress = () => {
      const {
        currentIndex: idx,
        answers: ans,
        isCompleted: done,
      } = latestStateRef.current;
      if (done) return;

      // Use sendBeacon for reliable save on page unload
      const formData = new FormData();
      formData.append("_action", "save");
      formData.append("currentQuestionIndex", idx.toString());
      formData.append("answers", JSON.stringify(ans));

      navigator.sendBeacon(window.location.pathname, formData);
    };

    // Handle tab/browser close
    const handleBeforeUnload = () => {
      saveProgress();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // Save on component unmount (navigation within app)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // For in-app navigation, save immediately
      const {
        currentIndex: idx,
        answers: ans,
        isCompleted: done,
      } = latestStateRef.current;
      if (!done) {
        fetcher.submit(
          {
            _action: "save",
            currentQuestionIndex: idx.toString(),
            answers: JSON.stringify(ans),
          },
          { method: "post" }
        );
      }
    };
  }, []);

  const handleSelectAnswer = (choiceIndex: number) => {
    if (answers[currentQuestion.id] !== undefined) return; // Already answered
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: choiceIndex,
    }));
  };

  const handleNavigate = (index: number) => {
    if (index >= 0 && index < questionList.length) {
      setCurrentIndex(index);
    }
  };

  const handleComplete = () => {
    fetcher.submit(
      {
        _action: "complete",
        answers: JSON.stringify(answers),
      },
      { method: "post" }
    );
    setIsCompleted(true);
    navigate(`/review/${session.id}`);
  };

  const handleFlagQuestion = useCallback(
    (questionId: number, reason?: string) => {
      fetcher.submit(
        {
          _action: "flag",
          questionId: questionId.toString(),
          reason: reason || "",
        },
        { method: "post" }
      );
    },
    [fetcher]
  );

  // Calculate current stats
  const correctCount = Object.entries(answers).filter(
    ([questionId, answer]) => {
      const question = questionList.find((q) => q.id === parseInt(questionId));
      return question && answer === question.correctChoice;
    }
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <Link
                to={`/paper/${paper.id}`}
                className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </Link>
              <div className="min-w-0">
                <h1 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                  {paper.name}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Learning Mode
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <div className="text-right">
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Score
                </p>
                <p className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white">
                  <span className="text-success-500">{correctCount}</span>
                  <span className="text-slate-400">/</span>
                  <span>{Object.keys(answers).length}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
        {/* Progress */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 mb-3 sm:mb-4">
          <ProgressBar
            current={currentIndex + 1}
            total={questionList.length}
            answeredQuestions={answeredQuestions}
            onQuestionClick={handleNavigate}
          />
        </div>

        {/* Question */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 mb-4 sm:mb-6">
          <QuestionCard
            key={currentQuestion.id}
            question={currentQuestion}
            questionNumber={currentIndex + 1}
            totalQuestions={questionList.length}
            selectedAnswer={answers[currentQuestion.id]}
            onSelectAnswer={handleSelectAnswer}
            showResult={answers[currentQuestion.id] !== undefined}
            mode="learning"
            onFlagQuestion={handleFlagQuestion}
          />
        </div>

        {/* Navigation - stacks on mobile */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0">
          <button
            onClick={() => handleNavigate(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="px-5 sm:px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 dark:active:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 touch-manipulation"
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
            Previous
          </button>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {Object.keys(answers).length === questionList.length && (
              <button
                onClick={handleComplete}
                className="px-5 sm:px-6 py-3 bg-success-500 hover:bg-success-600 active:bg-success-700 text-white font-medium rounded-xl transition-colors text-center touch-manipulation"
              >
                Complete & Review
              </button>
            )}

            {currentIndex < questionList.length - 1 && (
              <button
                onClick={() => handleNavigate(currentIndex + 1)}
                className="px-5 sm:px-6 py-3 bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 touch-manipulation"
              >
                Next
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

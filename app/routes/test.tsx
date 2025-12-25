import { useState, useEffect, useCallback } from "react";
import {
  useLoaderData,
  useNavigate,
  useFetcher,
  Link,
} from "react-router";
import { db } from "~/db";
import { papers, questions, testSessions } from "~/db/schema";
import { eq } from "drizzle-orm";
import { QuestionCard, Timer, ProgressBar, ScoreCard } from "~/components";
import type { Route } from "./+types/test";

export async function loader({ params }: Route.LoaderArgs) {
  const sessionId = parseInt(params.sessionId);

  const [session] = await db
    .select()
    .from(testSessions)
    .where(eq(testSessions.id, sessionId));

  if (!session) {
    throw new Response("Session not found", { status: 404 });
  }

  const [paper] = await db
    .select()
    .from(papers)
    .where(eq(papers.id, session.paperId));

  const questionList = await db
    .select()
    .from(questions)
    .where(eq(questions.paperId, session.paperId))
    .orderBy(questions.orderIndex);

  return {
    session,
    paper,
    questions: questionList,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const sessionId = parseInt(params.sessionId);
  const formData = await request.formData();
  const actionType = formData.get("_action");

  const [session] = await db
    .select()
    .from(testSessions)
    .where(eq(testSessions.id, sessionId));

  if (!session) {
    throw new Response("Session not found", { status: 404 });
  }

  if (actionType === "save") {
    const currentQuestionIndex = parseInt(
      formData.get("currentQuestionIndex") as string
    );
    const answers = JSON.parse(formData.get("answers") as string);
    const timeRemaining = parseInt(formData.get("timeRemaining") as string);

    await db
      .update(testSessions)
      .set({
        currentQuestionIndex,
        answers,
        timeRemaining,
      })
      .where(eq(testSessions.id, sessionId));

    return { success: true };
  }

  if (actionType === "submit") {
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

  return { success: false };
}

export function meta({ data }: Route.MetaArgs) {
  return [
    {
      title: data?.paper
        ? `Test: ${data.paper.name} - FCPS Study`
        : "Test - FCPS Study",
    },
  ];
}

export default function TestMode() {
  const { session, paper, questions: questionList } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [currentIndex, setCurrentIndex] = useState(
    session.currentQuestionIndex
  );
  const [answers, setAnswers] = useState<Record<number, number>>(
    (session.answers as Record<number, number>) || {}
  );
  const [timeRemaining, setTimeRemaining] = useState(
    session.timeRemaining || 0
  );
  const [isCompleted, setIsCompleted] = useState(
    session.status === "completed"
  );
  const [isPaused, setIsPaused] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [finalScore, setFinalScore] = useState(session.score || 0);

  const currentQuestion = questionList[currentIndex];
  const answeredQuestions = new Set(
    Object.keys(answers).map((id) =>
      questionList.findIndex((q) => q.id === parseInt(id))
    )
  );

  // Auto-save progress periodically
  useEffect(() => {
    if (isCompleted || isPaused) return;

    const saveInterval = setInterval(() => {
      fetcher.submit(
        {
          _action: "save",
          currentQuestionIndex: currentIndex.toString(),
          answers: JSON.stringify(answers),
          timeRemaining: timeRemaining.toString(),
        },
        { method: "post" }
      );
    }, 30000); // Save every 30 seconds

    return () => clearInterval(saveInterval);
  }, [currentIndex, answers, timeRemaining, isCompleted, isPaused]);

  const handleTimeUp = useCallback(() => {
    handleSubmit();
  }, [answers]);

  const handleSubmit = async () => {
    // Calculate score locally for immediate display
    let score = 0;
    for (const question of questionList) {
      if (answers[question.id] === question.correctChoice) {
        score++;
      }
    }

    fetcher.submit(
      {
        _action: "submit",
        answers: JSON.stringify(answers),
      },
      { method: "post" }
    );

    setFinalScore(score);
    setIsCompleted(true);
    setShowResults(true);
  };

  const handlePause = () => {
    setIsPaused(true);
    fetcher.submit(
      {
        _action: "save",
        currentQuestionIndex: currentIndex.toString(),
        answers: JSON.stringify(answers),
        timeRemaining: timeRemaining.toString(),
      },
      { method: "post" }
    );
  };

  const handleSelectAnswer = (choiceIndex: number) => {
    if (isCompleted) return;
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

  // Show results screen
  if (showResults) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4">
        <ScoreCard
          score={finalScore}
          total={questionList.length}
          timeTaken={
            session.timeRemaining
              ? (session.timeRemaining || 0) - timeRemaining
              : undefined
          }
          onReviewWrong={() =>
            navigate(`/review/${session.id}?filter=wrong`)
          }
          onReviewAll={() => navigate(`/review/${session.id}`)}
          onBackToHome={() => navigate("/")}
        />
      </div>
    );
  }

  // Show pause screen
  if (isPaused) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-primary-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Test Paused
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">
            Your progress has been saved. You can resume anytime from the paper
            page.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => setIsPaused(false)}
              className="w-full py-3 px-6 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors"
            >
              Resume Test
            </button>
            <Link
              to={`/paper/${paper.id}`}
              className="block w-full py-3 px-6 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-xl transition-colors text-center"
            >
              Exit to Paper
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handlePause}
                className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Pause test"
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
                    d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
              <div>
                <h1 className="font-semibold text-slate-900 dark:text-white">
                  {paper.name}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Test Mode
                </p>
              </div>
            </div>
            <Timer
              initialSeconds={timeRemaining}
              onTimeUp={handleTimeUp}
              isPaused={isPaused}
              onTick={(secs) => setTimeRemaining(secs)}
            />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
        {/* Progress */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 mb-4">
          <ProgressBar
            current={currentIndex + 1}
            total={questionList.length}
            answeredQuestions={answeredQuestions}
            onQuestionClick={handleNavigate}
          />
        </div>

        {/* Question */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 mb-6">
          <QuestionCard
            key={currentQuestion.id}
            question={currentQuestion}
            questionNumber={currentIndex + 1}
            totalQuestions={questionList.length}
            selectedAnswer={answers[currentQuestion.id]}
            onSelectAnswer={handleSelectAnswer}
            showResult={false}
            mode="test"
          />
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => handleNavigate(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 font-medium rounded-xl transition-colors flex items-center gap-2"
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

          {currentIndex === questionList.length - 1 ? (
            <button
              onClick={handleSubmit}
              className="px-8 py-3 bg-success-500 hover:bg-success-600 text-white font-medium rounded-xl transition-colors"
            >
              Submit Test
            </button>
          ) : (
            <button
              onClick={() => handleNavigate(currentIndex + 1)}
              className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
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
      </main>
    </div>
  );
}


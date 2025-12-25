import { useState } from "react";
import { useLoaderData, useSearchParams, Link } from "react-router";
import { db } from "~/db";
import { papers, questions, testSessions } from "~/db/schema";
import { eq } from "drizzle-orm";
import { QuestionCard } from "~/components";
import type { Route } from "./+types/review";

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

export function meta({ data }: Route.MetaArgs) {
  return [
    {
      title: data?.paper
        ? `Review: ${data.paper.name} - FCPS Study`
        : "Review - FCPS Study",
    },
  ];
}

type FilterType = "all" | "correct" | "wrong";

export default function ReviewMode() {
  const { session, paper, questions: questionList } =
    useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  const initialFilter = (searchParams.get("filter") as FilterType) || "all";
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [currentIndex, setCurrentIndex] = useState(0);

  const answers = (session.answers as Record<number, number>) || {};

  // Filter questions based on selected filter
  const filteredQuestions = questionList.filter((question) => {
    const userAnswer = answers[question.id];
    const isCorrect = userAnswer === question.correctChoice;

    if (filter === "correct") return isCorrect;
    if (filter === "wrong") return !isCorrect && userAnswer !== undefined;
    return true;
  });

  // Calculate stats
  const correctCount = questionList.filter(
    (q) => answers[q.id] === q.correctChoice
  ).length;
  const wrongCount = questionList.filter(
    (q) => answers[q.id] !== undefined && answers[q.id] !== q.correctChoice
  ).length;
  const unansweredCount = questionList.filter(
    (q) => answers[q.id] === undefined
  ).length;

  const currentQuestion = filteredQuestions[currentIndex];

  const handleNavigate = (index: number) => {
    if (index >= 0 && index < filteredQuestions.length) {
      setCurrentIndex(index);
    }
  };

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    setCurrentIndex(0);
  };

  if (filteredQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Link
                to={`/paper/${paper.id}`}
                className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
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
              <div>
                <h1 className="font-semibold text-slate-900 dark:text-white">
                  {paper.name}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Review
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-16 text-center">
          <div className="w-20 h-20 bg-success-100 dark:bg-success-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-success-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            {filter === "wrong" ? "No Wrong Answers!" : "No Questions"}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">
            {filter === "wrong"
              ? "Congratulations! You got all questions correct."
              : "There are no questions matching this filter."}
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => handleFilterChange("all")}
              className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors"
            >
              View All Questions
            </button>
            <Link
              to="/"
              className="px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-xl transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </main>
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
              <Link
                to={`/paper/${paper.id}`}
                className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
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
              <div>
                <h1 className="font-semibold text-slate-900 dark:text-white">
                  {paper.name}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Review Mode
                </p>
              </div>
            </div>

            {/* Score summary */}
            <div className="flex items-center gap-4 text-sm">
              <span className="text-success-500 font-medium">
                {correctCount} correct
              </span>
              <span className="text-error-500 font-medium">
                {wrongCount} wrong
              </span>
              {unansweredCount > 0 && (
                <span className="text-slate-500 font-medium">
                  {unansweredCount} skipped
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
        {/* Filter tabs */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-2 border border-slate-200 dark:border-slate-800 mb-8 inline-flex gap-2">
          <button
            onClick={() => handleFilterChange("all")}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
              filter === "all"
                ? "bg-primary-500 text-white"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            All ({questionList.length})
          </button>
          <button
            onClick={() => handleFilterChange("correct")}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
              filter === "correct"
                ? "bg-success-500 text-white"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Correct ({correctCount})
          </button>
          <button
            onClick={() => handleFilterChange("wrong")}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
              filter === "wrong"
                ? "bg-error-500 text-white"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Wrong ({wrongCount})
          </button>
        </div>

        {/* Question navigation pills */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 mb-4">
          <div className="flex flex-wrap gap-2">
            {filteredQuestions.map((question, index) => {
              const userAnswer = answers[question.id];
              const isCorrect = userAnswer === question.correctChoice;
              const isCurrent = index === currentIndex;

              return (
                <button
                  key={question.id}
                  onClick={() => handleNavigate(index)}
                  className={`
                    w-10 h-10 rounded-lg text-sm font-medium transition-all duration-200
                    ${
                      isCurrent
                        ? "ring-2 ring-offset-2 dark:ring-offset-slate-900"
                        : ""
                    }
                    ${
                      isCorrect
                        ? `bg-success-100 dark:bg-success-900/40 text-success-700 dark:text-success-300 ${
                            isCurrent ? "ring-success-500" : ""
                          }`
                        : `bg-error-100 dark:bg-error-900/40 text-error-700 dark:text-error-300 ${
                            isCurrent ? "ring-error-500" : ""
                          }`
                    }
                  `}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Question */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 mb-6">
          <QuestionCard
            key={currentQuestion.id}
            question={currentQuestion}
            questionNumber={currentIndex + 1}
            totalQuestions={filteredQuestions.length}
            selectedAnswer={answers[currentQuestion.id]}
            onSelectAnswer={() => {}} // Read-only in review mode
            showResult={true}
            mode="learning"
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

          <span className="text-sm text-slate-500 dark:text-slate-400">
            {currentIndex + 1} of {filteredQuestions.length}
          </span>

          <button
            onClick={() => handleNavigate(currentIndex + 1)}
            disabled={currentIndex === filteredQuestions.length - 1}
            className="px-6 py-3 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors flex items-center gap-2"
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
        </div>
      </main>
    </div>
  );
}


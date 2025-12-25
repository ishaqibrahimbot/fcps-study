import { useState } from "react";
import { Link, useLoaderData, useFetcher } from "react-router";
import { db } from "~/db";
import { papers, questions } from "~/db/schema";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/fix-questions";

export async function loader({ params }: Route.LoaderArgs) {
  const paperId = parseInt(params.paperId);

  const [paper] = await db.select().from(papers).where(eq(papers.id, paperId));

  if (!paper) {
    throw new Response("Paper not found", { status: 404 });
  }

  // Get incomplete questions: empty choices OR no valid correct choice
  const incompleteQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.paperId, paperId))
    .orderBy(questions.orderIndex);

  // Filter to only incomplete ones
  const incomplete = incompleteQuestions.filter(
    (q) =>
      q.choices.length === 0 ||
      q.correctChoice === null ||
      q.correctChoice < 0 ||
      q.correctChoice >= q.choices.length
  );

  return {
    paper,
    incompleteQuestions: incomplete,
    totalQuestions: incompleteQuestions.length,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("_action");

  if (actionType === "update") {
    const questionId = parseInt(formData.get("questionId") as string);
    const questionText = formData.get("questionText") as string;
    const choicesRaw = formData.get("choices") as string;
    const correctChoice = parseInt(formData.get("correctChoice") as string);

    // Parse choices (one per line)
    const choices = choicesRaw
      .split("\n")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    await db
      .update(questions)
      .set({
        questionText,
        choices,
        correctChoice,
      })
      .where(eq(questions.id, questionId));

    return { success: true, questionId };
  }

  if (actionType === "skip") {
    // Just acknowledge, no DB change
    return { success: true, skipped: true };
  }

  return { success: false };
}

export function meta({ data }: Route.MetaArgs) {
  return [
    {
      title: data?.paper
        ? `Fix Questions: ${data.paper.name}`
        : "Fix Questions",
    },
  ];
}

export default function FixQuestions() {
  const { paper, incompleteQuestions, totalQuestions } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentQuestion = incompleteQuestions[currentIndex];
  const isLastQuestion = currentIndex >= incompleteQuestions.length - 1;
  const allDone =
    incompleteQuestions.length === 0 ||
    currentIndex >= incompleteQuestions.length;

  // Form state
  const [questionText, setQuestionText] = useState(
    currentQuestion?.questionText || ""
  );
  const [choices, setChoices] = useState(
    currentQuestion?.choices.join("\n") || ""
  );
  const [correctChoice, setCorrectChoice] = useState(
    currentQuestion?.correctChoice ?? 0
  );

  // Update form when navigating
  const loadQuestion = (index: number) => {
    const q = incompleteQuestions[index];
    if (q) {
      setQuestionText(q.questionText);
      setChoices(q.choices.join("\n"));
      setCorrectChoice(q.correctChoice ?? 0);
      setCurrentIndex(index);
    }
  };

  const handleSaveAndNext = () => {
    fetcher.submit(
      {
        _action: "update",
        questionId: currentQuestion.id.toString(),
        questionText,
        choices,
        correctChoice: correctChoice.toString(),
      },
      { method: "post" }
    );

    if (!isLastQuestion) {
      loadQuestion(currentIndex + 1);
    } else {
      setCurrentIndex(incompleteQuestions.length); // Mark as done
    }
  };

  const handleSkip = () => {
    if (!isLastQuestion) {
      loadQuestion(currentIndex + 1);
    } else {
      setCurrentIndex(incompleteQuestions.length);
    }
  };

  const choiceLines = choices
    .split("\n")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  if (allDone) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
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
            All Done!
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">
            {incompleteQuestions.length === 0
              ? "This paper has no incomplete questions."
              : "You've reviewed all incomplete questions."}
          </p>
          <Link
            to={`/paper/${paper.id}`}
            className="inline-block px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors"
          >
            Back to Paper
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
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
                  Fix Incomplete Questions
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {paper.name}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Progress
              </p>
              <p className="font-semibold text-slate-900 dark:text-white">
                {currentIndex + 1} / {incompleteQuestions.length}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Warning banner */}
        <div className="bg-warning-100 dark:bg-warning-500/10 border border-warning-400/30 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-warning-500 flex-shrink-0 mt-0.5"
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
            <div>
              <p className="font-medium text-warning-600 dark:text-warning-400">
                Incomplete Question (#{currentQuestion.orderIndex + 1})
              </p>
              <p className="text-sm text-warning-600/80 dark:text-warning-400/80 mt-1">
                This question has{" "}
                {currentQuestion.choices.length === 0
                  ? "no choices"
                  : "an invalid correct answer"}
                . Please fix it below.
              </p>
            </div>
          </div>
        </div>

        {/* Edit form */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="space-y-5">
            {/* Question text */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Question Text
              </label>
              <textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                placeholder="Enter the question text..."
              />
            </div>

            {/* Choices */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Choices (one per line)
              </label>
              <textarea
                value={choices}
                onChange={(e) => setChoices(e.target.value)}
                rows={6}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none font-mono text-sm"
                placeholder="Option A&#10;Option B&#10;Option C&#10;Option D"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {choiceLines.length} choice(s) detected
              </p>
            </div>

            {/* Correct choice */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Correct Answer
              </label>
              {choiceLines.length > 0 ? (
                <div className="space-y-2">
                  {choiceLines.map((choice, idx) => (
                    <label
                      key={idx}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        correctChoice === idx
                          ? "border-success-500 bg-success-50 dark:bg-success-900/20"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="correctChoice"
                        checked={correctChoice === idx}
                        onChange={() => setCorrectChoice(idx)}
                        className="w-4 h-4 text-success-500"
                      />
                      <span className="font-medium text-slate-600 dark:text-slate-400 w-6">
                        {String.fromCharCode(65 + idx)}.
                      </span>
                      <span className="flex-1 text-slate-800 dark:text-slate-200">
                        {choice}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                  Add choices above to select the correct answer
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={handleSkip}
              className="px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-xl transition-colors"
            >
              Skip for Now
            </button>
            <button
              onClick={handleSaveAndNext}
              disabled={choiceLines.length === 0}
              className="flex-1 px-6 py-3 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
            >
              {isLastQuestion ? "Save & Finish" : "Save & Next"}
            </button>
          </div>
        </div>

        {/* Question navigator */}
        <div className="mt-6">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            Jump to question:
          </p>
          <div className="flex flex-wrap gap-2">
            {incompleteQuestions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => loadQuestion(idx)}
                className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                  idx === currentIndex
                    ? "bg-primary-500 text-white"
                    : idx < currentIndex
                      ? "bg-success-100 dark:bg-success-900/40 text-success-700 dark:text-success-300"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {q.orderIndex + 1}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

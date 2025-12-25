import { useState } from "react";
import Markdown from "react-markdown";
import type { Question } from "~/db/schema";

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  selectedAnswer?: number;
  onSelectAnswer: (choiceIndex: number) => void;
  showResult?: boolean;
  mode: "test" | "learning";
  onFlagQuestion?: (questionId: number) => void;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  selectedAnswer,
  onSelectAnswer,
  showResult = false,
  mode,
  onFlagQuestion,
}: QuestionCardProps) {
  const [hasAnswered, setHasAnswered] = useState(
    selectedAnswer !== undefined && mode === "learning"
  );
  const [justFlagged, setJustFlagged] = useState(false);

  const handleFlag = () => {
    if (onFlagQuestion) {
      onFlagQuestion(question.id);
      setJustFlagged(true);
    }
  };

  const handleSelect = (index: number) => {
    if (mode === "learning" && hasAnswered) return;
    onSelectAnswer(index);
    if (mode === "learning") {
      setHasAnswered(true);
    }
  };

  const shouldShowResult = mode === "learning" ? hasAnswered : showResult;
  const isCorrect = selectedAnswer === question.correctChoice;

  const getChoiceStyles = (index: number) => {
    const baseStyles =
      "w-full py-3 sm:py-2.5 px-3 sm:px-3 rounded-xl sm:rounded-lg border text-left transition-all duration-150 flex items-start sm:items-center gap-3 sm:gap-2.5 text-sm touch-manipulation active:scale-[0.98]";

    if (!shouldShowResult) {
      if (selectedAnswer === index) {
        return `${baseStyles} border-primary-500 bg-primary-50 dark:bg-primary-950/30`;
      }
      return `${baseStyles} border-slate-200 dark:border-slate-700 hover:border-primary-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 active:bg-slate-100 dark:active:bg-slate-800`;
    }

    // Show results
    if (index === question.correctChoice) {
      return `${baseStyles} border-success-500 bg-emerald-50 dark:bg-emerald-950/30`;
    }
    if (selectedAnswer === index && index !== question.correctChoice) {
      return `${baseStyles} border-error-500 bg-red-50 dark:bg-red-950/30`;
    }
    return `${baseStyles} border-slate-200 dark:border-slate-700 opacity-50`;
  };

  const getChoiceLabel = (index: number) => {
    return String.fromCharCode(65 + index); // A, B, C, D...
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Flagged warning */}
      {(question.flagged || justFlagged) && (
        <div className="mb-4 p-3 rounded-lg bg-warning-100 dark:bg-warning-500/10 border border-warning-400/30 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-warning-500 flex-shrink-0"
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
          <span className="text-sm text-warning-600 dark:text-warning-400">
            This question was flagged as potentially inaccurate
          </span>
        </div>
      )}

      {/* Question header */}
      <div className="mb-4 sm:mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs sm:text-sm font-medium text-primary-600 dark:text-primary-400">
            Q{questionNumber}/{totalQuestions}
          </span>
        </div>
        <p className="text-base sm:text-lg font-medium text-slate-800 dark:text-slate-100 leading-relaxed sm:leading-snug">
          {question.questionText}
        </p>
      </div>

      {/* Choices */}
      <div className="space-y-2 sm:space-y-1.5">
        {question.choices.map((choice, index) => (
          <button
            key={index}
            onClick={() => handleSelect(index)}
            disabled={mode === "learning" && hasAnswered}
            className={getChoiceStyles(index)}
          >
            <span
              className={`flex-shrink-0 w-7 h-7 sm:w-6 sm:h-6 rounded-lg sm:rounded flex items-center justify-center font-semibold text-xs mt-0.5 sm:mt-0
              ${
                shouldShowResult && index === question.correctChoice
                  ? "bg-success-500 text-white"
                  : shouldShowResult &&
                      selectedAnswer === index &&
                      index !== question.correctChoice
                    ? "bg-error-500 text-white"
                    : selectedAnswer === index
                      ? "bg-primary-500 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              }`}
            >
              {getChoiceLabel(index)}
            </span>
            <span className="flex-1 leading-relaxed">{choice}</span>
            {shouldShowResult && index === question.correctChoice && (
              <span className="text-success-500 flex-shrink-0 text-base sm:text-sm">
                ✓
              </span>
            )}
            {shouldShowResult &&
              selectedAnswer === index &&
              index !== question.correctChoice && (
                <span className="text-error-500 flex-shrink-0 text-base sm:text-sm">
                  ✗
                </span>
              )}
          </button>
        ))}
      </div>

      {/* Explanation - show after answering in learning mode or in review */}
      {shouldShowResult && question.explanation && (
        <div
          className={`mt-4 sm:mt-5 p-4 sm:p-3 rounded-xl sm:rounded-lg border text-sm ${
            isCorrect
              ? "border-success-500/30 bg-emerald-50/50 dark:bg-emerald-950/20"
              : "border-error-500/30 bg-red-50/50 dark:bg-red-950/20"
          }`}
        >
          <div className="flex items-center gap-2 sm:gap-1.5 mb-3 sm:mb-2">
            <span
              className={`text-lg sm:text-base ${
                isCorrect ? "text-success-500" : "text-error-500"
              }`}
            >
              {isCorrect ? "✓" : "✗"}
            </span>
            <span
              className={`font-semibold text-base sm:text-sm ${
                isCorrect
                  ? "text-success-600 dark:text-success-500"
                  : "text-error-600 dark:text-error-500"
              }`}
            >
              {isCorrect ? "Correct" : "Incorrect"}
            </span>
          </div>
          <div className="prose prose-sm prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 leading-relaxed [&>p]:my-2 [&>ul]:my-2 [&>ol]:my-2 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&_strong]:text-slate-800 dark:[&_strong]:text-slate-100 [&_li]:my-0.5 [&_ul]:pl-4 [&_ol]:pl-4">
            <Markdown>{question.explanation}</Markdown>
          </div>
        </div>
      )}

      {/* Flag button - show after answering if not already flagged */}
      {shouldShowResult &&
        !question.flagged &&
        !justFlagged &&
        onFlagQuestion && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleFlag}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 hover:text-warning-600 dark:hover:text-warning-400 hover:bg-warning-50 dark:hover:bg-warning-500/10 rounded-lg transition-colors"
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
                  d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
                />
              </svg>
              Flag as inaccurate
            </button>
          </div>
        )}
    </div>
  );
}

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
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  selectedAnswer,
  onSelectAnswer,
  showResult = false,
  mode,
}: QuestionCardProps) {
  const [hasAnswered, setHasAnswered] = useState(
    selectedAnswer !== undefined && mode === "learning"
  );

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
      "w-full py-2.5 px-3 rounded-lg border text-left transition-all duration-150 flex items-center gap-2.5 text-sm";

    if (!shouldShowResult) {
      if (selectedAnswer === index) {
        return `${baseStyles} border-primary-500 bg-primary-50 dark:bg-primary-950/30`;
      }
      return `${baseStyles} border-slate-200 dark:border-slate-700 hover:border-primary-300 hover:bg-slate-50 dark:hover:bg-slate-800/50`;
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
      {/* Question header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
            Q{questionNumber}/{totalQuestions}
          </span>
        </div>
        <p className="text-base font-medium text-slate-800 dark:text-slate-100 leading-snug">
          {question.questionText}
        </p>
      </div>

      {/* Choices */}
      <div className="space-y-1.5">
        {question.choices.map((choice, index) => (
          <button
            key={index}
            onClick={() => handleSelect(index)}
            disabled={mode === "learning" && hasAnswered}
            className={getChoiceStyles(index)}
          >
            <span
              className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center font-semibold text-xs
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
            <span className="flex-1">{choice}</span>
            {shouldShowResult && index === question.correctChoice && (
              <span className="text-success-500 flex-shrink-0 text-sm">✓</span>
            )}
            {shouldShowResult &&
              selectedAnswer === index &&
              index !== question.correctChoice && (
                <span className="text-error-500 flex-shrink-0 text-sm">✗</span>
              )}
          </button>
        ))}
      </div>

      {/* Explanation - show after answering in learning mode or in review */}
      {shouldShowResult && question.explanation && (
        <div
          className={`mt-4 p-3 rounded-lg border text-sm ${
            isCorrect
              ? "border-success-500/30 bg-emerald-50/50 dark:bg-emerald-950/20"
              : "border-error-500/30 bg-red-50/50 dark:bg-red-950/20"
          }`}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <span
              className={`text-base ${
                isCorrect ? "text-success-500" : "text-error-500"
              }`}
            >
              {isCorrect ? "✓" : "✗"}
            </span>
            <span
              className={`font-semibold text-sm ${
                isCorrect
                  ? "text-success-600 dark:text-success-500"
                  : "text-error-600 dark:text-error-500"
              }`}
            >
              {isCorrect ? "Correct" : "Incorrect"}
            </span>
          </div>
          <div className="prose prose-sm prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 leading-relaxed [&>p]:my-2 [&>ul]:my-2 [&>ol]:my-2 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&_strong]:text-slate-800 dark:[&_strong]:text-slate-100 [&_li]:my-0.5">
            <Markdown>{question.explanation}</Markdown>
          </div>
        </div>
      )}
    </div>
  );
}

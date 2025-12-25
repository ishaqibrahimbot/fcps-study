interface ProgressBarProps {
  current: number;
  total: number;
  answeredQuestions?: Set<number>;
  onQuestionClick?: (index: number) => void;
  showQuestionMap?: boolean;
}

export function ProgressBar({
  current,
  total,
  answeredQuestions = new Set(),
  onQuestionClick,
  showQuestionMap = true,
}: ProgressBarProps) {
  const progress = (current / total) * 100;
  const answeredCount = answeredQuestions.size;

  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 transition-all duration-300 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
          {current}/{total}
        </span>
      </div>

      {/* Question map */}
      {showQuestionMap && (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: total }, (_, i) => {
            const questionNum = i + 1;
            const isAnswered = answeredQuestions.has(i);
            const isCurrent = i === current - 1;

            return (
              <button
                key={i}
                onClick={() => onQuestionClick?.(i)}
                className={`
                  w-9 h-9 rounded-lg text-sm font-medium transition-all duration-200
                  ${
                    isCurrent
                      ? "bg-primary-500 text-white ring-2 ring-primary-300 ring-offset-2 dark:ring-offset-slate-900"
                      : isAnswered
                      ? "bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }
                `}
              >
                {questionNum}
              </button>
            );
          })}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 mt-4 text-sm text-slate-500 dark:text-slate-400">
        <span>
          <span className="font-medium text-primary-600 dark:text-primary-400">
            {answeredCount}
          </span>{" "}
          answered
        </span>
        <span>
          <span className="font-medium text-slate-600 dark:text-slate-300">
            {total - answeredCount}
          </span>{" "}
          remaining
        </span>
      </div>
    </div>
  );
}


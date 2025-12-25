interface ScoreCardProps {
  score: number;
  total: number;
  timeTaken?: number; // in seconds
  onReviewWrong: () => void;
  onReviewAll: () => void;
  onBackToHome: () => void;
}

export function ScoreCard({
  score,
  total,
  timeTaken,
  onReviewWrong,
  onReviewAll,
  onBackToHome,
}: ScoreCardProps) {
  const percentage = Math.round((score / total) * 100);
  const wrong = total - score;

  const getGrade = () => {
    if (percentage >= 90) return { label: "Excellent!", color: "text-success-500" };
    if (percentage >= 80) return { label: "Great Job!", color: "text-success-500" };
    if (percentage >= 70) return { label: "Good", color: "text-primary-500" };
    if (percentage >= 60) return { label: "Needs Improvement", color: "text-warning-500" };
    return { label: "Keep Practicing", color: "text-error-500" };
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const grade = getGrade();

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Score circle */}
      <div className="relative w-48 h-48 mx-auto mb-8">
        <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 100 100">
          <circle
            className="text-slate-200 dark:text-slate-700"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            cx="50"
            cy="50"
            r="42"
          />
          <circle
            className={`${
              percentage >= 70
                ? "text-success-500"
                : percentage >= 50
                ? "text-warning-500"
                : "text-error-500"
            } transition-all duration-1000 ease-out`}
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
            cx="50"
            cy="50"
            r="42"
            strokeDasharray={`${percentage * 2.64} 264`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold text-slate-800 dark:text-slate-100">
            {percentage}%
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {score}/{total}
          </span>
        </div>
      </div>

      {/* Grade label */}
      <h2 className={`text-2xl font-bold text-center mb-6 ${grade.color}`}>
        {grade.label}
      </h2>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="text-center p-4 bg-success-500/10 rounded-xl">
          <p className="text-2xl font-bold text-success-500">{score}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">Correct</p>
        </div>
        <div className="text-center p-4 bg-error-500/10 rounded-xl">
          <p className="text-2xl font-bold text-error-500">{wrong}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">Wrong</p>
        </div>
        {timeTaken && (
          <div className="text-center p-4 bg-primary-500/10 rounded-xl">
            <p className="text-2xl font-bold text-primary-500">
              {formatTime(timeTaken)}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Time</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {wrong > 0 && (
          <button
            onClick={onReviewWrong}
            className="w-full py-3 px-6 bg-error-500 hover:bg-error-600 text-white font-medium rounded-xl transition-colors"
          >
            Review Wrong Answers ({wrong})
          </button>
        )}
        <button
          onClick={onReviewAll}
          className="w-full py-3 px-6 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors"
        >
          Review All Questions
        </button>
        <button
          onClick={onBackToHome}
          className="w-full py-3 px-6 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-xl transition-colors"
        >
          Back to Papers
        </button>
      </div>
    </div>
  );
}


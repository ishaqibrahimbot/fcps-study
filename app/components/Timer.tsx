import { useEffect, useState } from "react";

interface TimerProps {
  initialSeconds: number;
  onTimeUp: () => void;
  isPaused?: boolean;
  onTick?: (remainingSeconds: number) => void;
}

export function Timer({
  initialSeconds,
  onTimeUp,
  isPaused = false,
  onTick,
}: TimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (isPaused || seconds <= 0) return;

    const interval = setInterval(() => {
      setSeconds((prev) => {
        const newValue = prev - 1;
        if (onTick) onTick(newValue);
        if (newValue <= 0) {
          onTimeUp();
          return 0;
        }
        return newValue;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, seconds, onTimeUp, onTick]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const getTimerColor = () => {
    if (seconds <= 60) return "text-error-500";
    if (seconds <= 300) return "text-warning-500";
    return "text-slate-700 dark:text-slate-200";
  };

  const getProgressPercent = () => {
    return (seconds / initialSeconds) * 100;
  };

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="relative w-10 h-10 sm:w-12 sm:h-12">
        <svg
          className="w-10 h-10 sm:w-12 sm:h-12 transform -rotate-90"
          viewBox="0 0 36 36"
        >
          <path
            className="text-slate-200 dark:text-slate-700"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            className={`${
              seconds <= 60
                ? "text-error-500"
                : seconds <= 300
                  ? "text-warning-500"
                  : "text-primary-500"
            } transition-colors`}
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${getProgressPercent()}, 100`}
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className={`w-4 h-4 sm:w-5 sm:h-5 ${getTimerColor()}`}
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
      </div>
      <div>
        <p
          className={`text-lg sm:text-xl font-mono font-bold ${getTimerColor()}`}
        >
          {formatTime(seconds)}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
          remaining
        </p>
      </div>
    </div>
  );
}

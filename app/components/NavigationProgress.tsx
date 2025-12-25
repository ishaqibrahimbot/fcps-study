import { useNavigation } from "react-router";

export function NavigationProgress() {
  const navigation = useNavigation();
  const isNavigating = navigation.state !== "idle";

  if (!isNavigating) return null;

  return (
    <>
      {/* Progress bar at top of page */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-primary-100 dark:bg-primary-900/30 overflow-hidden">
        <div className="h-full bg-primary-500 animate-progress-bar" />
      </div>

      {/* Subtle overlay */}
      <div className="fixed inset-0 z-40 bg-slate-900/5 dark:bg-slate-900/20 pointer-events-none" />

      {/* Centered spinner for longer loads */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-4 opacity-0 animate-fade-in-delayed">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-primary-500 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Loading...
            </span>
          </div>
        </div>
      </div>
    </>
  );
}


import { useState } from "react";

interface AccordionProps {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function Accordion({
  title,
  children,
  defaultOpen = false,
  badge,
  icon,
  className = "",
  disabled = false,
}: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-left transition-colors ${
          disabled
            ? "cursor-default opacity-75"
            : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {icon && <div className="shrink-0">{icon}</div>}
          <div className="min-w-0 flex-1">
            {typeof title === "string" ? (
              <span className="font-semibold text-slate-900 dark:text-white">
                {title}
              </span>
            ) : (
              title
            )}
          </div>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
        {!disabled && (
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform duration-200 shrink-0 ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
      </button>
      {isOpen && <div className="pb-2">{children}</div>}
    </div>
  );
}


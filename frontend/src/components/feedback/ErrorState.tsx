import { AlertTriangle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { explainError } from "@/lib/txErrors";

interface ErrorStateProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  className?: string;
}

/** Standardized inline error panel with a human message and retry affordance. */
export function ErrorState({ error, title, onRetry, className }: ErrorStateProps) {
  const ex = explainError(error);
  
  // Better messaging for API errors
  let displayTitle = title ?? ex.title;
  let displayMessage = ex.message;
  
  // Special case for API 500 errors
  if (error instanceof Error && error.message.includes("500")) {
    displayTitle = "Server temporarily unavailable";
    displayMessage = "The backend is overloaded or experiencing issues. Please retry in a moment.";
  }
  
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-6 py-10 text-center",
        className,
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger-bg)]">
        <AlertTriangle className="h-6 w-6 text-[var(--danger)]" />
      </div>
      <p className="text-sm font-semibold text-[var(--text-primary)]">{displayTitle}</p>
      <p className="mt-1 max-w-sm text-xs text-[var(--text-muted)]">{displayMessage}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

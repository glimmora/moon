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
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/[0.06] px-6 py-10 text-center",
        className,
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
        <AlertTriangle className="h-6 w-6 text-red-400" />
      </div>
      <p className="text-sm font-semibold text-neutral-200">{title ?? ex.title}</p>
      <p className="mt-1 max-w-sm text-xs text-neutral-500">{ex.message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-white/[0.1] transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

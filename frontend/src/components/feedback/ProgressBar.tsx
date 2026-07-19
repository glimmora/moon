import { cn } from "@/lib/cn";

interface ProgressBarProps {
  /** 0–100. */
  value: number;
  label?: string;
  showValue?: boolean;
  className?: string;
  barClassName?: string;
}

/** Accessible progress bar with an optional label and value readout. */
export function ProgressBar({ value, label, showValue, className, barClassName }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
          {label && <span>{label}</span>}
          {showValue && <span className="tabular">{clamped.toFixed(1)}%</span>}
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]"
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
      >
        <div
          className={cn("h-full rounded-full bg-gradient-to-r from-moon-500 to-moon-400 transition-all duration-500", barClassName)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

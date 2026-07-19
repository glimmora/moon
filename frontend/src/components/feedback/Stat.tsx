import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Tooltip } from "./Tooltip";

interface StatProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: string;
  trend?: "up" | "down" | "neutral";
  loading?: boolean;
  className?: string;
}

/** Compact labelled metric with optional icon, trend colour, and info hint. */
export function Stat({ label, value, icon: Icon, hint, trend, loading, className }: StatProps) {
  return (
    <div className={cn("rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3", className)}>
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        <span>{label}</span>
        {hint && (
          <Tooltip content={hint}>
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[var(--border-default)] text-[8px] text-[var(--text-muted)]">
              ?
            </span>
          </Tooltip>
        )}
      </div>
      {loading ? (
        <div className="mt-1.5 h-5 w-16 animate-pulse rounded bg-[var(--surface-2)]" aria-hidden="true" />
      ) : (
        <p
          className={cn(
            "mt-1 text-sm font-semibold tabular",
            trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-[var(--text-primary)]",
          )}
        >
          {value}
        </p>
      )}
    </div>
  );
}

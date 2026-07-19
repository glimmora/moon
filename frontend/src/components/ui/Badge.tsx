import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type BadgeTone = "moon" | "green" | "red" | "amber" | "blue" | "neutral";

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

const toneClass: Record<BadgeTone, string> = {
  moon: "badge-moon",
  green: "badge-green",
  red: "badge-red",
  amber: "badge-amber",
  blue: "badge-blue",
  neutral: "badge bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border-subtle)]",
};

/** Compact status/label chip. Replaces ad-hoc inline `rounded` spans. */
export function Badge({ tone = "neutral", children, className }: BadgeProps) {
  return <span className={cn(toneClass[tone], className)}>{children}</span>;
}

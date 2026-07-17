import { cn } from "@/lib/cn";

/** Shimmering placeholder block used while content loads. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-white/[0.06]", className)}
      aria-hidden="true"
    />
  );
}

/** A group of skeletons announced to assistive tech as a loading region. */
export function SkeletonGroup({
  children,
  label = "Loading",
  className,
}: {
  children: React.ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <div className={className} role="status" aria-busy="true" aria-label={label}>
      {children}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

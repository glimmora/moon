import { cn } from "@/lib/cn";

interface SpinnerProps {
  className?: string;
  /** Pixel size of the spinner. */
  size?: number;
  label?: string;
}

/** Theme-aware ring spinner used inside buttons and inline loading states. */
export function Spinner({ className, size = 16, label = "Loading" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("spinner", className)}
      style={{ width: size, height: size }}
    />
  );
}

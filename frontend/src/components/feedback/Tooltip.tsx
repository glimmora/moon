import { useId, useState } from "react";
import { cn } from "@/lib/cn";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Lightweight, keyboard- and screen-reader-accessible tooltip. */
export function Tooltip({ content, children, className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} tabIndex={0} className="inline-flex outline-none">
        {children}
      </span>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[var(--border-default)] bg-[var(--bg-elev)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-primary)] shadow-xl backdrop-blur-xl"
        >
          {content}
        </span>
      )}
    </span>
  );
}

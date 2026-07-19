import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ViewMode } from "@/hooks/useListPrefs";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
  className?: string;
}

export function ViewToggle({ value, onChange, className }: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="View mode"
      className={cn(
        "flex gap-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] p-1",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Grid view"
        aria-pressed={value === "grid"}
        onClick={() => onChange("grid")}
        className={cn("tab !flex-none !px-2.5", value === "grid" && "tab-active")}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="List view"
        aria-pressed={value === "list"}
        onClick={() => onChange("list")}
        className={cn("tab !flex-none !px-2.5", value === "list" && "tab-active")}
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  );
}

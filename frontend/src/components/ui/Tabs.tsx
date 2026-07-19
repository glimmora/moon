import { useRef, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface TabItem {
  key: string;
  label: ReactNode;
  icon?: LucideIcon;
}

interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (key: string) => void;
  ariaLabel: string;
  className?: string;
  /** Centered with a max width (used on full-width pages). */
  centered?: boolean;
}

/**
 * Accessible tablist with roving tabindex and arrow-key navigation
 * (WAI-ARIA Tabs pattern). Selection follows focus. Renderers reuse the
 * shared `.tab` / `.tab-active` design tokens so every tab strip in the
 * app looks identical and is keyboard-operable.
 */
export function Tabs({ tabs, value, onChange, ariaLabel, className, centered }: TabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusAndSelect = (idx: number) => {
    const clamped = (idx + tabs.length) % tabs.length;
    onChange(tabs[clamped].key);
    refs.current[clamped]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      focusAndSelect(idx + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      focusAndSelect(idx - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusAndSelect(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusAndSelect(tabs.length - 1);
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex gap-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] p-1",
        centered && "max-w-md mx-auto",
        className,
      )}
    >
      {tabs.map((t, i) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            ref={(el) => (refs.current[i] = el)}
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={active}
            aria-controls={`tabpanel-${t.key}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn("tab flex-1 min-w-0", active && "tab-active")}
          >
            {t.icon && <t.icon className="h-4 w-4" />}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

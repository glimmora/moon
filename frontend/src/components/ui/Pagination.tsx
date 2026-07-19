import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { PAGE_SIZE_OPTIONS, type PageSize } from "@/hooks/useListPrefs";

interface PaginationProps {
  page: number;
  pageSize: PageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }: PaginationProps) {
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        <label htmlFor="page-size" className="whitespace-nowrap">
          Per page
        </label>
        <select
          id="page-size"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
          className="input !w-auto !py-1.5 !px-2 text-xs"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs tabular text-[var(--text-secondary)]">
          {from}–{to} of {total.toLocaleString()}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous page"
            disabled={current <= 1}
            onClick={() => onPageChange(current - 1)}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] transition-colors",
              current <= 1
                ? "opacity-40 cursor-not-allowed"
                : "hover:bg-[var(--surface-3)] text-[var(--text-primary)]",
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-xs tabular text-[var(--text-secondary)] whitespace-nowrap">
            {current} / {totalPages}
          </span>
          <button
            type="button"
            aria-label="Next page"
            disabled={current >= totalPages}
            onClick={() => onPageChange(current + 1)}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] transition-colors",
              current >= totalPages
                ? "opacity-40 cursor-not-allowed"
                : "hover:bg-[var(--surface-3)] text-[var(--text-primary)]",
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}

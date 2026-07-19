import { useSyncExternalStore } from "react";

export type ViewMode = "grid" | "list";
export const PAGE_SIZE_OPTIONS = [10, 30, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

const VIEW_KEY = "Moon.viewMode";
const PAGE_SIZE_KEY = "Moon.pageSize";

function safeRead(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private browsing or quota exceeded — silently ignore.
  }
}

function initialView(): ViewMode {
  return safeRead(VIEW_KEY) === "list" ? "list" : "grid";
}

function initialPageSize(): PageSize {
  const n = Number(safeRead(PAGE_SIZE_KEY));
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? (n as PageSize) : 10;
}

let view: ViewMode = initialView();
let pageSize: PageSize = initialPageSize();

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  listeners.forEach((l) => l());
}

export function setView(next: ViewMode) {
  if (view === next) return;
  view = next;
  safeWrite(VIEW_KEY, next);
  emit();
}

export function setPageSize(next: PageSize) {
  if (pageSize === next) return;
  pageSize = next;
  safeWrite(PAGE_SIZE_KEY, String(next));
  emit();
}

export function useListPrefs() {
  const currentView = useSyncExternalStore(
    subscribe,
    () => view,
    () => "grid" as ViewMode,
  );
  const currentPageSize = useSyncExternalStore(
    subscribe,
    () => pageSize,
    () => 10 as PageSize,
  );
  return { view: currentView, setView, pageSize: currentPageSize, setPageSize };
}

import type { LucideIcon } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { ErrorState } from "./ErrorState";
import { EmptyState } from "./EmptyState";

interface QueryStateProps<T> {
  query: Pick<UseQueryResult<T>, "isLoading" | "isError" | "error" | "data" | "refetch">;
  /** Rendered while loading (skeletons). */
  loading: React.ReactNode;
  /** Determines whether resolved data should be treated as empty. */
  isEmpty?: (data: T) => boolean;
  /** Empty-state configuration. */
  empty?: { icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode };
  errorTitle?: string;
  children: (data: T) => React.ReactNode;
}

/**
 * Renders the correct UI for a react-query result: loading skeletons, an error
 * panel with retry, an empty state, or the success children. Centralizes the
 * four-state pattern so every data view handles all cases consistently.
 */
export function QueryState<T>({
  query,
  loading,
  isEmpty,
  empty,
  errorTitle,
  children,
}: QueryStateProps<T>) {
  if (query.isLoading) return <>{loading}</>;
  if (query.isError) {
    return <ErrorState error={query.error} title={errorTitle} onRetry={() => query.refetch()} />;
  }
  const data = query.data as T;
  if (data === undefined || data === null) {
    return <ErrorState error={new Error("No data returned.")} title={errorTitle} onRetry={() => query.refetch()} />;
  }
  if (isEmpty?.(data) && empty) {
    return <EmptyState {...empty} />;
  }
  return <>{children(data)}</>;
}

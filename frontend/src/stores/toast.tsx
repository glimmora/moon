import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type ToastType = "success" | "error" | "info" | "loading";

export interface ToastAction {
  label: string;
  /** Called when the action is clicked. Return true to keep the toast open. */
  onClick: () => void | boolean;
  /** Optional external link — rendered as an anchor instead of a button. */
  href?: string;
}

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  action?: ToastAction;
}

interface ToastOptions {
  description?: string;
  action?: ToastAction;
  duration?: number;
}

interface ToastContextValue {
  toast: (t: Omit<Toast, "id">) => number;
  dismiss: (id: number) => void;
  update: (id: number, patch: Partial<Omit<Toast, "id">>) => void;
  success: (title: string, opts?: ToastOptions | string) => number;
  error: (title: string, opts?: ToastOptions | string) => number;
  info: (title: string, opts?: ToastOptions | string) => number;
  loading: (title: string, opts?: ToastOptions | string) => number;
}

/** Allow both the legacy `(title, description)` and new `(title, { ... })` call styles. */
function normalizeOpts(opts?: ToastOptions | string): ToastOptions {
  if (typeof opts === "string") return { description: opts };
  return opts ?? {};
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextId = Date.now();

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    const existing = timersRef.current.get(id);
    if (existing) clearTimeout(existing);
    timersRef.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = nextId++;
    const newToast: Toast = { ...t, id };
    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss (except loading toasts)
    if (t.type !== "loading") {
      const duration = t.duration ?? 5000;
      const timer = setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, timer);
    }
    return id;
  }, [dismiss]);

  /** Mutate an existing toast in place (e.g. loading -> success) and reset its timer. */
  const update = useCallback((id: number, patch: Partial<Omit<Toast, "id">>) => {
    setToasts((prev) => {
      const found = prev.find((t) => t.id === id);
      if (!found) return prev;
      const next = { ...found, ...patch };
      const existing = timersRef.current.get(id);
      if (existing) clearTimeout(existing);
      if (next.type !== "loading") {
        const duration = next.duration ?? (next.type === "error" ? 8000 : 5000);
        timersRef.current.set(id, setTimeout(() => dismiss(id), duration));
      }
      return prev.map((t) => (t.id === id ? next : t));
    });
  }, [dismiss]);

  const success = useCallback((title: string, opts?: ToastOptions | string) => {
    const o = normalizeOpts(opts);
    return toast({ type: "success", title, ...o });
  }, [toast]);

  const error = useCallback((title: string, opts?: ToastOptions | string) => {
    const o = normalizeOpts(opts);
    return toast({ type: "error", title, duration: 8000, ...o });
  }, [toast]);

  const info = useCallback((title: string, opts?: ToastOptions | string) => {
    const o = normalizeOpts(opts);
    return toast({ type: "info", title, ...o });
  }, [toast]);

  const loading = useCallback((title: string, opts?: ToastOptions | string) => {
    const o = normalizeOpts(opts);
    return toast({ type: "loading", title, duration: 60000, ...o });
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toast, dismiss, update, success, error, info, loading }}>
      {children}
      {/* Toast container — polite for status, assertive announcements handled per-item. */}
      <div
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none safe-bottom"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const iconMap = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-400" />,
    error: <AlertCircle className="h-5 w-5 text-red-400" />,
    info: <Info className="h-5 w-5 text-moon-400" />,
    loading: <Loader2 className="h-5 w-5 text-moon-400 animate-spin" />,
  };

  const borderMap = {
    success: "border-emerald-500/30",
    error: "border-red-500/30",
    info: "border-moon-500/30",
    loading: "border-moon-500/30",
  };

  const action = toast.action;

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-xl border bg-[var(--bg-elev)] backdrop-blur-xl p-4 shadow-xl animate-slide-up",
        borderMap[toast.type],
      )}
      style={{ willChange: "transform, opacity" }}
      role={toast.type === "error" ? "alert" : "status"}
      aria-live={toast.type === "error" ? "assertive" : "polite"}
    >
      <div className="shrink-0 mt-0.5">{iconMap[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs text-[var(--text-secondary)] break-words">{toast.description}</p>
        )}
        {action && (
          action.href ? (
            <a
              href={action.href}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[var(--surface-2)] px-2.5 py-1 text-xs font-medium text-moon-300 hover:bg-[var(--surface-3)] transition-colors"
            >
              {action.label}
            </a>
          ) : (
            <button
              onClick={() => {
                const keep = action.onClick();
                if (!keep) onDismiss();
              }}
              className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[var(--surface-2)] px-2.5 py-1 text-xs font-medium text-moon-300 hover:bg-[var(--surface-3)] transition-colors"
            >
              {action.label}
            </button>
          )
        )}
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)] transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type ToastType = "success" | "error" | "info" | "loading";

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (t: Omit<Toast, "id">) => number;
  dismiss: (id: number) => void;
  success: (title: string, description?: string) => number;
  error: (title: string, description?: string) => number;
  info: (title: string, description?: string) => number;
  loading: (title: string, description?: string) => number;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = nextId++;
    const newToast: Toast = { ...t, id };
    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss (except loading toasts)
    if (t.type !== "loading") {
      const duration = t.duration ?? 5000;
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  const success = useCallback((title: string, description?: string) =>
    toast({ type: "success", title, description }), [toast]);

  const error = useCallback((title: string, description?: string) =>
    toast({ type: "error", title, description, duration: 7000 }), [toast]);

  const info = useCallback((title: string, description?: string) =>
    toast({ type: "info", title, description }), [toast]);

  const loading = useCallback((title: string, description?: string) =>
    toast({ type: "loading", title, description, duration: 30000 }), [toast]);

  return (
    <ToastContext.Provider value={{ toast, dismiss, success, error, info, loading }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none">
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

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-xl border bg-ink-900/95 backdrop-blur-xl p-4 shadow-xl animate-slide-up",
        borderMap[toast.type],
      )}
      style={{ willChange: "transform, opacity" }}
    >
      <div className="shrink-0 mt-0.5">{iconMap[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-neutral-100">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs text-neutral-400 break-words">{toast.description}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 rounded-lg p-1 text-neutral-500 hover:bg-white/[0.06] hover:text-neutral-300 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

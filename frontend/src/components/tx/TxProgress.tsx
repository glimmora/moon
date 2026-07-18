import { Check, Loader2, X, ExternalLink, Fuel, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { explorerName } from "@/lib/explorer";
import { useTheme } from "@/stores/theme";
import type { TxStage } from "@/hooks/useTxLifecycle";
import type { ExplainedError } from "@/lib/txErrors";

interface TxProgressProps {
  stage: TxStage;
  chainId: number;
  confirmations: number;
  confirmationCount: number;
  explorerUrl?: string;
  gasEstimate?: { gas: bigint; feeEth: string } | null;
  nativeSymbol?: string;
  error?: ExplainedError | null;
  onRetry?: () => void;
  className?: string;
}

const STEPS: { key: TxStage[]; label: string }[] = [
  { key: ["switching-chain", "estimating"], label: "Preparing transaction" },
  { key: ["awaiting-signature"], label: "Waiting for wallet signature" },
  { key: ["broadcasting", "pending"], label: "Confirming on-chain" },
  { key: ["success"], label: "Confirmed" },
];

function stepStatus(stepIndex: number, stage: TxStage): "done" | "active" | "pending" {
  const order: TxStage[] = ["switching-chain", "estimating", "awaiting-signature", "broadcasting", "pending", "success"];
  const currentPos = order.indexOf(stage);
  const stepStart = order.indexOf(STEPS[stepIndex].key[0]);
  const stepEnd = order.indexOf(STEPS[stepIndex].key[STEPS[stepIndex].key.length - 1]);
  if (stage === "success" && stepIndex === STEPS.length - 1) return "active";
  if (currentPos > stepEnd) return "done";
  if (currentPos >= stepStart && currentPos <= stepEnd) return "active";
  return "pending";
}

/** Reusable, accessible transaction lifecycle stepper. */
export function TxProgress({
  stage,
  chainId,
  confirmations,
  confirmationCount,
  explorerUrl,
  gasEstimate,
  nativeSymbol = "ETH",
  error,
  onRetry,
  className,
}: TxProgressProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  if (stage === "idle") return null;

  if (stage === "error") {
    return (
      <div
        role="alert"
        className={cn(
          "rounded-xl border p-4 space-y-2 animate-fade-in",
          isLight ? "border-red-500/30 bg-red-500/10" : "border-red-500/30 bg-red-500/10",
          className,
        )}
      >
        <div className={cn(
          "flex items-center gap-2 text-sm font-semibold",
          isLight ? "text-red-600" : "text-red-300",
        )}>
          <X className="h-4 w-4 shrink-0" />
          {error?.title ?? "Transaction failed"}
        </div>
        {error?.message && (
          <p className={cn("text-xs break-words", isLight ? "text-red-600/80" : "text-red-300/80")}>
            {error.message}
          </p>
        )}
        {error?.recovery && (
          <p className={cn("text-xs", isLight ? "text-neutral-600" : "text-neutral-400")}>
            <span className={cn("font-medium", isLight ? "text-neutral-700" : "text-neutral-300")}>What to do: </span>
            {error.recovery}
          </p>
        )}
        <div className="flex items-center gap-2 pt-1">
          {onRetry && (
            <button
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                isLight ? "bg-neutral-200 text-neutral-700 hover:bg-neutral-300" : "bg-white/[0.06] text-neutral-200 hover:bg-white/[0.1]",
              )}
              onClick={onRetry}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Try again
            </button>
          )}
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                isLight ? "bg-neutral-200 text-moon-700 hover:bg-neutral-300" : "bg-white/[0.06] text-moon-300 hover:bg-white/[0.1]",
              )}
            >
              <ExternalLink className="h-3.5 w-3.5" /> View on {explorerName(chainId)}
            </a>
          )}
        </div>
      </div>
    );
  }

  const isDone = stage === "success";

  return (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-3 animate-fade-in",
        isLight
          ? isDone ? "border-emerald-500/30 bg-emerald-500/10" : "border-moon-500/20 bg-moon-500/5"
          : isDone ? "border-emerald-500/30 bg-emerald-500/10" : "border-moon-500/20 bg-moon-500/5",
        className,
      )}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="space-y-2">
        {STEPS.map((step, i) => {
          const status = stepStatus(i, stage);
          const isConfirmStep = i === 2;
          return (
            <div key={step.label} className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full shrink-0 transition-all",
                  status === "done"
                    ? "bg-emerald-500 text-white"
                    : status === "active"
                      ? "bg-moon-500 text-white"
                      : isLight ? "bg-neutral-200 text-neutral-400" : "bg-white/[0.06] text-neutral-600",
                )}
              >
                {status === "done" ? (
                  <Check className="h-3 w-3" />
                ) : status === "active" && !isDone ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : status === "active" && isDone ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
              </div>
              <span
                className={cn(
                  "text-xs transition-colors",
                  status === "done"
                    ? isLight ? "text-emerald-600" : "text-emerald-400"
                    : status === "active"
                      ? isLight ? "text-moon-700 font-medium" : "text-moon-300 font-medium"
                      : isLight ? "text-neutral-400" : "text-neutral-600",
                )}
              >
                {step.label}
                {isConfirmStep && status === "active" && !isDone && (
                  <span className={cn("ml-1 tabular", isLight ? "text-neutral-500" : "text-neutral-400")}>
                    ({confirmationCount}/{confirmations})
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {(gasEstimate || explorerUrl) && (
        <div className={cn(
          "flex items-center justify-between gap-2 border-t pt-2 text-[11px]",
          isLight ? "border-neutral-200" : "border-white/[0.06]",
        )}>
          {gasEstimate ? (
            <span className={cn(
              "inline-flex items-center gap-1",
              isLight ? "text-neutral-500" : "text-neutral-400",
            )} title="Estimated network fee">
              <Fuel className="h-3 w-3" />~{Number(gasEstimate.feeEth).toFixed(6)} {nativeSymbol}
            </span>
          ) : (
            <span />
          )}
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "inline-flex items-center gap-1 transition-colors",
                isLight ? "text-moon-700 hover:text-moon-600" : "text-moon-300 hover:text-moon-200",
              )}
            >
              <ExternalLink className="h-3 w-3" /> {explorerName(chainId)}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

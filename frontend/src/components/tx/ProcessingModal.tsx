import { Link } from "react-router-dom";
import { CheckCircle2, Loader2, AlertCircle, ExternalLink, Rocket } from "lucide-react";
import { cn } from "@/lib/cn";
import { useTheme } from "@/stores/theme";
import type { IndexingStatus } from "@/hooks/useTokenIndexing";

interface ProcessingModalProps {
  open: boolean;
  status: IndexingStatus;
  tokenName?: string;
  tokenSymbol?: string;
  chainId: number;
  tokenAddress?: string | null;
  chainLabel?: string;
  explorerUrl?: string | null;
  onClose: () => void;
  onKeepWaiting: () => void;
  onCreateAnother: () => void;
}

type Step = { key: string; label: string; state: "done" | "active" | "pending" };

/**
 * Post-launch overlay showing the token's journey from on-chain confirmation to
 * being indexed and ready to view. Replaces the inline indexing card in Create.
 */
export function ProcessingModal({
  open,
  status,
  tokenName,
  tokenSymbol,
  chainId,
  tokenAddress,
  chainLabel,
  explorerUrl,
  onClose,
  onKeepWaiting,
  onCreateAnother,
}: ProcessingModalProps) {
  const { theme } = useTheme();
  if (!open) return null;

  const steps: Step[] = [
    { key: "confirmed", label: "Confirmed on-chain", state: "done" },
    {
      key: "indexing",
      label: "Indexing",
      state: status === "done" ? "done" : status === "timeout" ? "active" : "active",
    },
    {
      key: "ready",
      label: "Ready to view",
      state: status === "done" ? "done" : "pending",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Token launch progress"
    >
      <div
        className={cn(
          "absolute inset-0 backdrop-blur-sm",
          theme === "light" ? "bg-neutral-900/40" : "bg-ink-950/80",
        )}
        onClick={status === "waiting" ? undefined : onClose}
      />

      <div
        className={cn(
          "relative w-full max-w-md p-6 animate-scale-in rounded-2xl border shadow-2xl",
          theme === "light" ? "bg-white border-neutral-200" : "bg-ink-900 border-white/[0.08]",
        )}
      >
        {/* Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div
              className={cn(
                "absolute inset-0 rounded-full blur-md opacity-40",
                status === "done" ? "bg-emerald-500" : status === "timeout" ? "bg-amber-500" : "bg-moon-gradient",
              )}
            />
            <div
              className={cn(
                "relative flex h-16 w-16 items-center justify-center rounded-full border",
                status === "done"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : status === "timeout"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    : "border-moon-500/40 bg-moon-500/10 text-moon-300",
              )}
            >
              {status === "done" ? (
                <CheckCircle2 className="h-8 w-8" />
              ) : status === "timeout" ? (
                <AlertCircle className="h-8 w-8" />
              ) : (
                <Loader2 className="h-8 w-8 animate-spin" />
              )}
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="mt-4 text-center">
          <h2 className="text-xl font-bold font-display">
            {status === "done"
              ? "Token launched!"
              : status === "timeout"
                ? "Still indexing…"
                : "Launching your token"}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {status === "done" ? (
              <>
                <span className="font-semibold">{tokenName}</span>
                {tokenSymbol ? ` ($${tokenSymbol})` : ""} is live on {chainLabel ?? "the network"}.
              </>
            ) : status === "timeout" ? (
              "Your token is on-chain but the indexer is taking longer than usual."
            ) : (
              "Confirmed on-chain. Waiting for the indexer to pick it up…"
            )}
          </p>
        </div>

        {/* Steps */}
        <ol className="mt-5 space-y-3">
          {steps.map((step) => (
            <li key={step.key} className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs",
                  step.state === "done"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : step.state === "active"
                      ? "border-moon-500/40 bg-moon-500/10 text-moon-300"
                      : "border-[var(--border-subtle)] text-[var(--text-muted)]",
                )}
              >
                {step.state === "done" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : step.state === "active" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
              </span>
              <span
                className={cn(
                  "text-sm",
                  step.state === "pending" ? "text-[var(--text-muted)]" : "text-[var(--text-primary)]",
                )}
              >
                {step.label}
              </span>
            </li>
          ))}
        </ol>

        {/* Actions */}
        <div className="mt-6 space-y-2">
          {status === "done" && (
            <>
              <Link
                to={`/token/${chainId}/${tokenAddress ?? ""}`}
                className="btn-success w-full !py-2.5 text-sm inline-flex items-center justify-center gap-1.5"
                onClick={onClose}
              >
                <ExternalLink className="h-4 w-4" /> View Token
              </Link>
              <button onClick={onCreateAnother} className="btn-ghost w-full !py-2 text-sm inline-flex items-center justify-center gap-1.5">
                <Rocket className="h-4 w-4" /> Create another
              </button>
            </>
          )}

          {status === "timeout" && (
            <>
              <button onClick={onKeepWaiting} className="btn-primary w-full !py-2.5 text-sm inline-flex items-center justify-center gap-1.5">
                <Loader2 className="h-4 w-4" /> Keep waiting
              </button>
              <div className="flex gap-2">
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost flex-1 !py-2 text-xs inline-flex items-center justify-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" /> Explorer
                  </a>
                )}
                {tokenAddress && (
                  <Link
                    to={`/token/${chainId}/${tokenAddress}`}
                    className="btn-ghost flex-1 !py-2 text-xs inline-flex items-center justify-center"
                    onClick={onClose}
                  >
                    Open anyway
                  </Link>
                )}
              </div>
            </>
          )}

          {status === "waiting" && (
            <p className="text-center text-[11px] text-[var(--text-muted)]">
              This usually takes a few seconds.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

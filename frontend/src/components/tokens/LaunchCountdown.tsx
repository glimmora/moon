import { useMemo, useEffect, useState } from "react";
import { Rocket, TrendingUp, Timer } from "lucide-react";
import { cn } from "@/lib/cn";
import { useTheme } from "@/stores/theme";
import { GRADUATION_THRESHOLDS } from "@/lib/curve";

interface LaunchCountdownProps {
  /** Current progress 0..100 (volume / threshold * 100). */
  progress: number;
  /** Whether the token has already graduated. */
  graduated?: boolean;
  /** Optional ISO timestamp / ms-epoch when launched — used to compute velocity. */
  createdAt?: number;
  /** Optional current volume (24h). */
  volume24h?: number;
  /** Supply tier (0=1B, 1=10B, 2=100B) — used to determine graduation threshold. */
  supplyTier?: number;
  /** Compact mode (used inside cards). */
  compact?: boolean;
}

/**
 * Visual countdown to graduation. Shows a progress bar with a "T-minus" ETA
 * computed from the current volume velocity. When graduated, shows a celebratory
 * "LAUNCHED" state.
 */
export function LaunchCountdown({
  progress,
  graduated,
  createdAt,
  volume24h,
  supplyTier,
  compact,
}: LaunchCountdownProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (graduated || !createdAt) return;
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, [graduated, createdAt]);

  const { eta } = useMemo(() => {
    if (graduated || !createdAt || !volume24h || volume24h <= 0) {
      return { eta: null };
    }
    const elapsedSec = Math.max(1, (now - createdAt) / 1000);
    const volPerSec = volume24h / elapsedSec;
    const remaining = Math.max(0, 100 - progress);
    // Tier-dependent graduation threshold (ETH): 0→50, 1→500, 2→5000
    const threshold = GRADUATION_THRESHOLDS[supplyTier ?? 0] ?? 50;
    const remainingVol = (remaining / 100) * threshold;
    const secLeft = volPerSec > 0 ? remainingVol / volPerSec : Infinity;
    return { eta: secLeft };
  }, [graduated, createdAt, volume24h, progress, supplyTier, now]);

  if (graduated) {
    return (
      <div className={cn(
        "flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 font-semibold",
        compact ? "text-[10px] px-2 py-1" : "text-xs px-3 py-1.5",
      )}>
        <Rocket className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
        LAUNCHED
      </div>
    );
  }

  const pct = Math.min(100, Math.max(0, progress));

  return (
    <div className={cn(compact ? "space-y-1" : "space-y-2")}>
      <div className={cn("flex items-center justify-between text-[10px]", isLight ? "text-neutral-500" : "text-neutral-500")}>
        <span className="flex items-center gap-1">
          <TrendingUp className="h-2.5 w-2.5" />
          Graduation
        </span>
        <div className="flex items-center gap-2 tabular">
          {eta !== null && Number.isFinite(eta) && eta > 0 && (
            <span className="flex items-center gap-0.5 text-amber-400">
              <Timer className="h-2.5 w-2.5" />
              {formatEta(eta)}
            </span>
          )}
          <span className={cn("font-medium", pct >= 80 ? (isLight ? "text-moon-600" : "text-moon-300") : (isLight ? "text-neutral-600" : "text-neutral-400"))}>
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="Graduation progress"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "progress-fill",
            pct >= 80 && "bg-gradient-to-r from-amber-500 to-moon-500 animate-glow-pulse",
            pct >= 95 && "bg-gradient-to-r from-amber-400 via-pink-500 to-moon-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function formatEta(secLeft: number): string {
  if (secLeft < 60) return `${Math.floor(secLeft)}s`;
  if (secLeft < 3600) return `${Math.floor(secLeft / 60)}m`;
  if (secLeft < 86400) return `${Math.floor(secLeft / 3600)}h`;
  return `${Math.floor(secLeft / 86400)}d`;
}

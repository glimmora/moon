import { useEffect, useRef } from "react";
import { createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Loader2, Activity, LineChart as LineChartIcon, AlertTriangle } from "lucide-react";

interface PriceChartProps {
  chainId: number;
  tokenAddress: string;
}

export function PriceChart({ chainId, tokenAddress }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["price-history", chainId, tokenAddress],
    queryFn: () => api.getPriceHistory(chainId, tokenAddress),
    enabled: Boolean(tokenAddress),
    refetchInterval: 15_000,
  });

  const isEmpty = !isLoading && !isError && (!data || data.length === 0);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 320,
      layout: {
        background: { color: "transparent" },
        textColor: "#71717a",
        fontFamily: "Inter, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.025)" },
        horzLines: { color: "rgba(255,255,255,0.025)" },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.06)",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.06)" },
      crosshair: {
        mode: 0,
        vertLine: { color: "rgba(168, 85, 247, 0.3)", width: 1, style: 2, labelBackgroundColor: "#a855f7" },
        horzLine: { color: "rgba(168, 85, 247, 0.3)", width: 1, style: 2, labelBackgroundColor: "#a855f7" },
      },
    });

    const series = chart.addAreaSeries({
      lineColor: "#a855f7",
      topColor: "rgba(168, 85, 247, 0.35)",
      bottomColor: "rgba(168, 85, 247, 0)",
      lineWidth: 2,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: "#ec4899",
      crosshairMarkerBackgroundColor: "#a855f7",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // Track the container's actual size (handles sidebar toggles / layout shifts,
    // not just window resizes) so the chart never overflows or leaves gaps.
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width && chartRef.current) {
        chartRef.current.applyOptions({ width: Math.floor(width) });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !data) return;
    // p.time is in milliseconds (Date.getTime() from the backend API) — convert to seconds for lightweight-charts.
    const points = data.map((p) => ({
      time: Math.floor(p.time / 1000) as UTCTimestamp,
      value: p.priceUsd,
    }));
    seriesRef.current.setData(points);
  }, [data]);

  return (
    <div className="card-elevated p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-moon-400" />
          Price
        </h3>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />}
      </div>
      <div className="relative min-h-80">
        <div
          ref={containerRef}
          className="w-full"
          role="img"
          aria-label={`Price history chart with ${data?.length ?? 0} data points`}
        />
        {/* Overlays for non-happy states — the chart container stays mounted so the
            lightweight-charts instance is never torn down/recreated. */}
        {(isLoading || isError || isEmpty) && (
          <div className="absolute inset-0 flex h-80 flex-col items-center justify-center gap-2 text-center">
            {isLoading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-moon-400" />
                <p className="text-xs text-neutral-500">Loading price history…</p>
              </>
            ) : isError ? (
              <>
                <AlertTriangle className="h-7 w-7 text-red-400" />
                <p className="text-sm text-neutral-300">Couldn't load the chart</p>
                <button
                  onClick={() => refetch()}
                  className="mt-1 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-white/[0.1] transition-colors"
                >
                  Retry
                </button>
              </>
            ) : (
              <>
                <LineChartIcon className="h-7 w-7 text-neutral-600" />
                <p className="text-sm text-neutral-400">No trades yet</p>
                <p className="text-xs text-neutral-600">The price chart appears after the first trade.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

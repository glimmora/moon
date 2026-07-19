import { useEffect, useRef, useState } from "react";
import { ChevronDown, CandlestickChart, AreaChart } from "lucide-react";
import { createChart, type IChartApi, type ISeriesApi, type UTCTimestamp, type DeepPartial, type ChartOptions } from "lightweight-charts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useTheme } from "@/stores/theme";
import { Loader2, Activity, LineChart as LineChartIcon, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/stores/i18n";

interface PriceChartProps {
  chainId: number;
  tokenAddress: string;
}

const TIMEFRAMES = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
  { label: "7D", value: "7d" },
] as const;

type Timeframe = (typeof TIMEFRAMES)[number]["value"];
type ChartType = "area" | "candles";

/** Theme-aware chart colors so the chart matches light/dark surfaces. */
function chartOptions(isLight: boolean): DeepPartial<ChartOptions> {
  return {
    layout: {
      background: { color: "transparent" },
      textColor: isLight ? "#525252" : "#a3a3a3",
      fontFamily: "Inter, system-ui, sans-serif",
    },
    grid: {
      vertLines: { color: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.04)" },
      horzLines: { color: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.04)" },
    },
    timeScale: {
      borderColor: isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.08)",
      timeVisible: true,
      secondsVisible: false,
    },
    rightPriceScale: { borderColor: isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.08)" },
    crosshair: {
      mode: 0,
      vertLine: { color: "rgba(168, 85, 247, 0.4)", width: 1, style: 2, labelBackgroundColor: "#a855f7" },
      horzLine: { color: "rgba(168, 85, 247, 0.4)", width: 1, style: 2, labelBackgroundColor: "#a855f7" },
    },
  };
}

export function PriceChart({ chainId, tokenAddress }: PriceChartProps) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const areaRef = useRef<ISeriesApi<"Area"> | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [timeframe, setTimeframe] = useState<Timeframe>("1d");
  const [tfOpen, setTfOpen] = useState(false);
  const [chartType, setChartType] = useState<ChartType>("area");
  const tfRef = useRef<HTMLDivElement>(null);

  const isCandles = chartType === "candles";

  const areaQuery = useQuery({
    queryKey: ["price-history", chainId, tokenAddress, timeframe],
    queryFn: () => api.getPriceHistory(chainId, tokenAddress, timeframe),
    enabled: Boolean(tokenAddress) && !isCandles,
    refetchInterval: 15_000,
  });

  const candleQuery = useQuery({
    queryKey: ["ohlc-history", chainId, tokenAddress, timeframe],
    queryFn: () => api.getOhlc(chainId, tokenAddress, timeframe),
    enabled: Boolean(tokenAddress) && isCandles,
    refetchInterval: 15_000,
  });

  const active = isCandles ? candleQuery : areaQuery;
  const { isLoading, isError, refetch } = active;
  const dataLength = isCandles ? candleQuery.data?.length ?? 0 : areaQuery.data?.length ?? 0;
  const isEmpty = !isLoading && !isError && dataLength === 0;

  useEffect(() => {
    if (!containerRef.current) return;

    let chart: IChartApi;
    try {
      chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 320,
        ...chartOptions(isLight),
      });
    } catch {
      return; // DOM node detached before mount — silently skip
    }

    const area = chart.addAreaSeries({
      lineColor: "#a855f7",
      topColor: "rgba(168, 85, 247, 0.35)",
      bottomColor: "rgba(168, 85, 247, 0)",
      lineWidth: 2,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: "#ec4899",
      crosshairMarkerBackgroundColor: "#a855f7",
    });

    const candles = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      visible: false,
    });

    const volume = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      color: "rgba(168, 85, 247, 0.4)",
      visible: false,
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    areaRef.current = area;
    candleRef.current = candles;
    volumeRef.current = volume;

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
      areaRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-apply theme colors when the theme changes (chart is created once).
  useEffect(() => {
    chartRef.current?.applyOptions(chartOptions(isLight));
  }, [isLight]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (tfRef.current && !tfRef.current.contains(e.target as Node)) setTfOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTfOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Toggle series visibility when the chart type changes.
  useEffect(() => {
    areaRef.current?.applyOptions({ visible: !isCandles });
    candleRef.current?.applyOptions({ visible: isCandles });
    volumeRef.current?.applyOptions({ visible: isCandles });
  }, [isCandles]);

  // Area series data.
  useEffect(() => {
    if (!areaRef.current || !areaQuery.data) return;
    // p.time is in milliseconds (Date.getTime() from the backend API) — convert to seconds for lightweight-charts.
    const points = areaQuery.data.map((p) => ({
      time: Math.floor(p.time / 1000) as UTCTimestamp,
      value: p.priceUsd,
    }));
    areaRef.current.setData(points);
  }, [areaQuery.data]);

  // Candlestick + volume series data.
  useEffect(() => {
    if (!candleRef.current || !volumeRef.current || !candleQuery.data) return;
    const candles = candleQuery.data.map((c) => ({
      time: Math.floor(c.time / 1000) as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    const volume = candleQuery.data.map((c) => ({
      time: Math.floor(c.time / 1000) as UTCTimestamp,
      value: c.volume,
      color: c.close >= c.open ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)",
    }));
    candleRef.current.setData(candles);
    volumeRef.current.setData(volume);
  }, [candleQuery.data]);

  return (
    <div className="card-elevated p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-semibold flex items-center gap-2 min-w-0">
          <Activity className="h-4 w-4 text-moon-400 shrink-0" />
          <span className="truncate">{t("chart.price")}</span>
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--text-secondary)] shrink-0" />}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
        <div className="inline-flex rounded-lg bg-[var(--surface-2)] p-0.5" role="group" aria-label="Chart type">
          <button
            onClick={() => setChartType("area")}
            aria-pressed={!isCandles}
            aria-label={t("chart.areaChart")}
            className={cn(
              "flex items-center justify-center rounded-md p-1.5 transition-colors",
              !isCandles ? "bg-moon-500/20 text-moon-300" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            )}
          >
            <AreaChart className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setChartType("candles")}
            aria-pressed={isCandles}
            aria-label={t("chart.candlestickChart")}
            className={cn(
              "flex items-center justify-center rounded-md p-1.5 transition-colors",
              isCandles ? "bg-moon-500/20 text-moon-300" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            )}
          >
            <CandlestickChart className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="relative" ref={tfRef}>
          <button
            onClick={() => setTfOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={tfOpen}
            aria-label="Select timeframe"
            className="flex items-center gap-1.5 rounded-lg bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-colors"
          >
            {TIMEFRAMES.find((tf) => tf.value === timeframe)?.label ?? timeframe}
            <ChevronDown className={cn("h-3 w-3 transition-transform", tfOpen && "rotate-180")} />
          </button>
          {tfOpen && (
            <div
              role="menu"
              aria-label="Timeframes"
              className="absolute top-full right-0 mt-1.5 w-24 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] shadow-xl overflow-hidden animate-scale-in z-20 py-1"
            >
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.value}
                  role="menuitem"
                  onClick={() => {
                    setTimeframe(tf.value);
                    setTfOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-1.5 text-xs font-medium transition-colors text-left",
                    timeframe === tf.value
                      ? "bg-moon-500/15 text-moon-300"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]",
                  )}
                  aria-pressed={timeframe === tf.value}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>
      <div className="relative min-h-80">
        <div
          ref={containerRef}
          className="w-full"
          role="img"
          aria-label={`Price history chart with ${dataLength} data points`}
        />
        {/* Overlays for non-happy states — the chart container stays mounted so the
            lightweight-charts instance is never torn down/recreated. */}
        {(isLoading || isError || isEmpty) && (
          <div className="absolute inset-0 flex h-80 flex-col items-center justify-center gap-2 text-center">
            {isLoading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-moon-400" />
                <p className="text-xs text-[var(--text-muted)]">Loading price history…</p>
              </>
            ) : isError ? (
              <>
                <AlertTriangle className="h-7 w-7 text-red-400" />
                <p className="text-sm text-[var(--text-secondary)]">Couldn't load the chart</p>
                <button
                  onClick={() => refetch()}
                  className="mt-1 rounded-lg bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-colors"
                >
                  Retry
                </button>
              </>
            ) : (
              <>
                <LineChartIcon className="h-7 w-7 text-[var(--text-muted)]" />
                <p className="text-sm text-[var(--text-secondary)]">{t("chart.noTrades")}</p>
                <p className="text-xs text-[var(--text-muted)]">The price chart appears after the first trade.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

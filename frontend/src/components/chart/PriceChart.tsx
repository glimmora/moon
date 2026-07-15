import { useEffect, useRef } from "react";
import { createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Loader2, Activity } from "lucide-react";

interface PriceChartProps {
  chainId: number;
  tokenAddress: string;
}

export function PriceChart({ chainId, tokenAddress }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["price-history", chainId, tokenAddress],
    queryFn: () => api.getPriceHistory(chainId, tokenAddress),
    enabled: Boolean(tokenAddress),
    refetchInterval: 15_000,
  });

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

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !data) return;
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
      <div ref={containerRef} className="w-full" />
    </div>
  );
}

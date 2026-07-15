import { useEffect, useRef } from "react";
import { createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Loader2 } from "lucide-react";

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
      height: 280,
      layout: {
        background: { color: "transparent" },
        textColor: "#a3a3a3",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      timeScale: { borderColor: "rgba(255,255,255,0.1)" },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.1)" },
      crosshair: { mode: 0 },
    });

    const series = chart.addAreaSeries({
      lineColor: "#c026d3",
      topColor: "rgba(192,38,211,0.4)",
      bottomColor: "rgba(192,38,211,0)",
      lineWidth: 2,
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
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">Price</h3>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />}
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  );
}

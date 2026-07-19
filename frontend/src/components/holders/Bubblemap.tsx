import { useBubblemap, type BubblemapNode } from "@/hooks/useHolders";
import { useMemo } from "react";
import { shortenAddress } from "@/lib/format";
import { CircleDot } from "lucide-react";
import { ErrorState } from "@/components/feedback/ErrorState";

interface BubblemapProps {
  chainId: number;
  tokenAddress: string;
}

/**
 * Lightweight SVG bubble-map of token holders. Bubble radius is proportional to
 * holding percentage; contracts are highlighted. Connections (transfers between
 * holders) are drawn as faint lines.
 */
export function Bubblemap({ chainId, tokenAddress }: BubblemapProps) {
  const { data, isLoading, isError, error, refetch } = useBubblemap(chainId, tokenAddress);

  const layout = useMemo(() => {
    if (!data || data.length === 0) return { nodes: [], links: [] };
    const maxPct = Math.max(...data.map((n) => n.percentage), 1);
    const cx = 250;
    const cy = 250;
    const radius = 180;
    const nodes = data.map((n, i) => {
      const angle = (i / data.length) * Math.PI * 2;
      const r = n.percentage > maxPct * 0.5 ? radius * 0.4 : radius;
      return {
        ...n,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        size: 10 + (n.percentage / maxPct) * 40,
      };
    });
    const byAddress = new Map(nodes.map((n) => [n.address.toLowerCase(), n]));
    // Dedupe undirected edges so each pair is drawn once.
    const seen = new Set<string>();
    const links = data.flatMap((n) =>
      n.connections.map((target) => {
        const from = byAddress.get(n.address.toLowerCase());
        const to = byAddress.get(target.toLowerCase());
        if (!from || !to) return null;
        const key = [from.address.toLowerCase(), to.address.toLowerCase()].sort().join("|");
        if (seen.has(key)) return null;
        seen.add(key);
        return { from, to };
      }),
    ).filter((l): l is { from: (typeof nodes)[number]; to: (typeof nodes)[number] } => l !== null);
    return { nodes, links };
  }, [data]);

  if (isLoading) {
    return <div className="card h-80 animate-pulse" role="status" aria-label="Loading holder bubblemap" />;
  }

  if (isError) {
    return <ErrorState error={error} title="Couldn't load bubblemap" onRetry={() => refetch()} />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="card flex h-80 items-center justify-center text-sm text-neutral-500">
        <CircleDot className="mr-2 h-5 w-5" />
        No holder graph yet.
      </div>
    );
  }

  return (
    <div className="card p-4">
      <h3 className="mb-3 font-semibold">Holder Bubblemap</h3>
      <svg
        viewBox="0 0 500 500"
        className="h-80 w-full"
        role="img"
        aria-labelledby="bubblemap-title bubblemap-desc"
      >
        <title id="bubblemap-title">Holder bubblemap</title>
        <desc id="bubblemap-desc">
          {`Distribution of ${data.length} holders. Bubble size is proportional to share of supply; blue bubbles are contracts, magenta bubbles are wallets.`}
        </desc>
        {/* Connections */}
        {layout.links.map((l, i) => (
          <line
            key={i}
            x1={l.from.x}
            y1={l.from.y}
            x2={l.to!.x}
            y2={l.to!.y}
            stroke="rgba(120,120,120,0.15)"
            strokeWidth="1"
          />
        ))}
        {/* Bubbles */}
        {layout.nodes.map((n) => (
          <g key={n.address}>
            <circle
              cx={n.x}
              cy={n.y}
              r={n.size}
              fill={n.isContract ? "rgba(59,130,246,0.35)" : "rgba(192,38,211,0.35)"}
              stroke={n.isContract ? "#3b82f6" : "#c026d3"}
              strokeWidth="1.5"
            />
            <text
              x={n.x}
              y={n.y + n.size + 12}
              textAnchor="middle"
              className="fill-neutral-400 text-[8px]"
            >
              {shortenAddress(n.address, 3)}
            </text>
            <text
              x={n.x}
              y={n.y + 3}
              textAnchor="middle"
              className="fill-neutral-200 text-[9px] font-bold"
            >
              {n.percentage.toFixed(1)}%
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-2 flex gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-moon-500" /> EOA
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-blue-500" /> Contract
        </span>
      </div>
      {/* Accessible fallback: the SVG conveys no data to screen readers, so mirror it as a table. */}
      <table className="sr-only">
        <caption>Holder distribution</caption>
        <thead>
          <tr>
            <th scope="col">Address</th>
            <th scope="col">Share of supply</th>
            <th scope="col">Type</th>
          </tr>
        </thead>
        <tbody>
          {data.map((n) => (
            <tr key={n.address}>
              <td>{shortenAddress(n.address, 3)}</td>
              <td>{n.percentage.toFixed(2)}%</td>
              <td>{n.isContract ? "Contract" : "Wallet"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type { BubblemapNode };

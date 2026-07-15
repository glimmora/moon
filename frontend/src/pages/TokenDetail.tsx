import { useParams } from "react-router-dom";
import { useState } from "react";
import { useTokenDetail } from "@/hooks/useTokenDetail";
import { TradePanel } from "@/components/trading/TradePanel";
import { PriceChart } from "@/components/chart/PriceChart";
import { HolderTable } from "@/components/holders/HolderTable";
import { Bubblemap } from "@/components/holders/Bubblemap";
import { chainMeta } from "@/config/chains";
import { formatMarketCap, shortenAddress, timeAgo, formatToken } from "@/lib/format";
import { ArrowLeft, ExternalLink, Flame, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { type Address } from "viem";

export function TokenDetail() {
  const params = useParams<{ chainId: string; address: string }>();
  const chainId = Number(params.chainId);
  const tokenAddress = params.address as Address;
  const { meta, curveState } = useTokenDetail(chainId, tokenAddress);
  const [tab, setTab] = useState<"chart" | "holders" | "bubblemap">("chart");

  const meta_ = chainMeta[chainId];
  const data = meta.data;

  if (meta.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-moon-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-12 text-center text-neutral-500">
        Token not found.{" "}
        <Link to="/" className="text-moon-400 underline">Back to explore</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-100">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <header className="card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-neutral-800">
            {data.imageUrl ? <img src={data.imageUrl} alt={data.name} className="h-full w-full object-cover" /> : null}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{data.name}</h1>
              <span className="chip bg-neutral-800 text-neutral-400">${data.symbol}</span>
              {data.graduated && (
                <span className="chip bg-moon-600/20 text-moon-300"><Flame className="h-3 w-3" /> Graduated</span>
              )}
              <span className="chip bg-neutral-800 text-neutral-400">{meta_?.shortLabel}</span>
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              Creator: <span className="font-mono">{shortenAddress(data.creator)}</span> ·{" "}
              Created {timeAgo(data.createdAt)} · {data.holders.toLocaleString()} holders
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-right sm:flex sm:gap-6">
            <Stat label="Price" value={`$${data.priceUsd.toFixed(6)}`} />
            <Stat label="Mkt Cap" value={formatMarketCap(data.marketCapUsd)} />
            <Stat label="24h Vol" value={`$${data.volume24h.toLocaleString()}`} />
          </div>
        </div>

        {data.description && <p className="mt-4 text-sm text-neutral-400">{data.description}</p>}

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <a href={`${meta_?.explorer}/address/${tokenAddress}`} target="_blank" rel="noreferrer" className="btn-outline text-xs">
            <ExternalLink className="h-3 w-3" /> Token Contract
          </a>
          {data.curve && (
            <a href={`${meta_?.explorer}/address/${data.curve}`} target="_blank" rel="noreferrer" className="btn-outline text-xs">
              <ExternalLink className="h-3 w-3" /> Bonding Curve
            </a>
          )}
          {data.dexPair && (
            <a href={`${meta_?.explorer}/address/${data.dexPair}`} target="_blank" rel="noreferrer" className="btn-outline text-xs">
              <ExternalLink className="h-3 w-3" /> DEX Pair
            </a>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-1 rounded-lg bg-neutral-900 p-1">
            {(["chart", "holders", "bubblemap"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md py-2 text-sm font-medium capitalize transition-colors ${tab === t ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-neutral-100"}`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "chart" && <PriceChart chainId={chainId} tokenAddress={tokenAddress} />}
          {tab === "holders" && <HolderTable chainId={chainId} tokenAddress={tokenAddress} />}
          {tab === "bubblemap" && <Bubblemap chainId={chainId} tokenAddress={tokenAddress} />}
        </div>

        <div className="lg:col-span-1">
          {data.curve && (
            <TradePanel
              chainId={chainId}
              curveAddress={data.curve as Address}
              tokenAddress={tokenAddress}
              tokenSymbol={data.symbol}
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Supply Tier" value={["1B", "10B", "100B"][data.supplyTier] ?? "-"} />
        <Stat label="Curve Shape" value={["Linear", "Exponential", "Logarithmic"][data.curveShape] ?? "-"} />
        <Stat label="Total Supply" value={formatToken(BigInt(data.totalSupply))} />
        <Stat label="Curve Price" value={curveState.data ? `$${Number(curveState.data) / 1e18}` : "-"} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

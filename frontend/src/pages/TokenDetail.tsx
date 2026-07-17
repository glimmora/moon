import { useParams } from "react-router-dom";
import { useState } from "react";
import { useTokenDetail } from "@/hooks/useTokenDetail";
import { TradePanel } from "@/components/trading/TradePanel";
import { PriceChart } from "@/components/chart/PriceChart";
import { HolderTable } from "@/components/holders/HolderTable";
import { Bubblemap } from "@/components/holders/Bubblemap";
import { chainMeta } from "@/config/chains";
import { formatMarketCap, shortenAddress, timeAgo, formatToken, graduationProgress } from "@/lib/format";
import { ArrowLeft, ExternalLink, Flame, Loader2, LineChart, Users, Share2, SearchX } from "lucide-react";
import { Link } from "react-router-dom";
import { isAddress, type Address } from "viem";
import { cn } from "@/lib/cn";
import { LaunchCountdown } from "@/components/tokens/LaunchCountdown";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EmptyState } from "@/components/feedback/EmptyState";
import { addressUrl, tokenUrl } from "@/lib/explorer";

export function TokenDetail() {
  const params = useParams<{ chainId: string; address: string }>();
  const chainId = Number(params.chainId);
  const addressValid = isAddress(params.address ?? "");
  const tokenAddress = (addressValid ? params.address : "0x0000000000000000000000000000000000000000") as Address;
  const { meta, curveState } = useTokenDetail(chainId, tokenAddress);
  const [tab, setTab] = useState<"chart" | "holders" | "bubblemap">("chart");

  const meta_ = chainMeta[chainId];
  const data = meta.data;

  // Malformed URL — the address isn't a valid contract address.
  if (!addressValid || Number.isNaN(chainId)) {
    return (
      <div className="py-16">
        <EmptyState
          icon={SearchX}
          title="Invalid token link"
          description="This address or network isn't valid. Double-check the link and try again."
          action={<Link to="/" className="btn-primary inline-flex">Back to explore</Link>}
        />
      </div>
    );
  }

  if (meta.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center" role="status" aria-label="Loading token">
        <Loader2 className="h-8 w-8 animate-spin text-moon-400" />
      </div>
    );
  }

  // Distinguish a real fetch failure (retryable) from a token that doesn't exist.
  if (meta.isError) {
    return (
      <div className="py-16">
        <ErrorState
          error={meta.error}
          title="Couldn't load this token"
          onRetry={() => meta.refetch()}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-16">
        <EmptyState
          icon={SearchX}
          title="Token not found"
          description="We couldn't find a token at this address on this network. It may not exist or hasn't been indexed yet."
          action={<Link to="/" className="btn-primary inline-flex">Back to explore</Link>}
        />
      </div>
    );
  }

  const tabs = [
    { key: "chart" as const, label: "Chart", icon: LineChart },
    { key: "holders" as const, label: "Holders", icon: Users },
    { key: "bubblemap" as const, label: "Bubblemap", icon: Share2 },
  ];

  return (
    <div className="space-y-6 py-4 animate-fade-in-up">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-100 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      {/* Token header */}
      <header className="card-elevated p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-2xl bg-moon-gradient opacity-30 blur-lg" />
            <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/[0.1] bg-ink-900">
              {data.imageUrl ? (
                <img src={data.imageUrl} alt={data.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-gradient">
                  {data.symbol.slice(0, 2)}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold font-display truncate">{data.name}</h1>
              <span className="chip-neutral">${data.symbol}</span>
              {data.graduated && (
                <span className="chip-moon">
                  <Flame className="h-3 w-3" /> Graduated
                </span>
              )}
              <span className="chip-neutral">{meta_?.shortLabel}</span>
            </div>
            <p className="mt-1.5 text-sm text-neutral-500 flex flex-wrap items-center gap-1.5">
              <span>Creator</span>
              <a href={addressUrl(chainId, data.creator)} target="_blank" rel="noreferrer" className="font-mono text-moon-400 hover:underline">
                {shortenAddress(data.creator)}
              </a>
              <span className="text-neutral-700">·</span>
              <span>{timeAgo(data.createdAt)}</span>
              <span className="text-neutral-700">·</span>
              <span className="tabular">{data.holderCount.toLocaleString()} holders</span>
            </p>
            {data.description && (
              <p className="mt-3 text-sm text-neutral-400 leading-relaxed max-w-2xl">{data.description}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={tokenUrl(chainId, tokenAddress)} target="_blank" rel="noreferrer" className="btn-ghost text-xs !py-1.5">
                <ExternalLink className="h-3 w-3" /> Token
              </a>
              {data.curve && (
                <a href={addressUrl(chainId, data.curve)} target="_blank" rel="noreferrer" className="btn-ghost text-xs !py-1.5">
                  <ExternalLink className="h-3 w-3" /> Curve
                </a>
              )}
              {data.dexPair && (
                <a href={addressUrl(chainId, data.dexPair)} target="_blank" rel="noreferrer" className="btn-ghost text-xs !py-1.5">
                  <ExternalLink className="h-3 w-3" /> DEX Pair
                </a>
              )}
            </div>
          </div>

          {/* Stats column */}
          <div className="grid grid-cols-3 gap-3 sm:flex sm:flex-col sm:gap-2 sm:text-right sm:min-w-[140px]">
            <Stat label="Price" value={`$${data.priceUsd.toFixed(6)}`} />
            <Stat label="Mkt Cap" value={formatMarketCap(data.marketCapUsd)} />
            <Stat label="24h Vol" value={`$${data.volume24h.toLocaleString()}`} />
          </div>
        </div>
      </header>

      {/* Graduation countdown banner */}
      {!data.graduated && (
        <div className="card-elevated p-4 sm:p-5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-moon-700/10 via-pink-600/5 to-transparent pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Graduation Progress</p>
              <LaunchCountdown
                progress={graduationProgress(data.volume24h, data.supplyTier)}
                graduated={data.graduated}
                createdAt={data.createdAt}
                volume24h={data.volume24h}
                supplyTier={data.supplyTier}
              />
            </div>
            <div className="hidden sm:block w-px h-12 bg-white/[0.08]" />
            <div className="text-sm">
              <p className="text-xs text-neutral-500">Threshold</p>
              <p className="font-semibold tabular">
                {["793.1M", "7.93B", "79.3B"][data.supplyTier] ?? "-"} tokens
              </p>
              <p className="text-[10px] text-neutral-600 mt-0.5">then auto-graduation to DEX</p>
            </div>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: chart + tabs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tab switcher */}
          <div role="tablist" aria-label="Token views" className="flex gap-1 rounded-xl bg-white/[0.04] border border-white/[0.06] p-1">
            {tabs.map((t) => {
              const active = tab === t.key;
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  role="tab"
                  id={`tab-${t.key}`}
                  aria-selected={active}
                  aria-controls={`tabpanel-${t.key}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all",
                    active ? "bg-white/[0.08] text-white shadow-inner-glow" : "text-neutral-400 hover:text-neutral-200",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === "chart" && <PriceChart chainId={chainId} tokenAddress={tokenAddress} />}
            {tab === "holders" && <HolderTable chainId={chainId} tokenAddress={tokenAddress} />}
            {tab === "bubblemap" && <Bubblemap chainId={chainId} tokenAddress={tokenAddress} />}
          </div>
        </div>

        {/* Right: trade panel */}
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

      {/* Token details strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DetailCard label="Supply Tier" value={["1B", "10B", "100B"][data.supplyTier] ?? "-"} />
        <DetailCard label="Curve Shape" value={["Linear", "Exponential", "Logarithmic"][data.curveShape] ?? "-"} />
        <DetailCard label="Total Supply" value={formatToken(BigInt(data.totalSupply))} />
        <DetailCard
          label="Curve Price"
          value={curveState.data ? `$${Number(curveState.data) / 1e18}` : "-"}
          highlight
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-2.5 sm:p-3">
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-0.5 font-semibold tabular text-sm sm:text-base">{value}</p>
    </div>
  );
}

function DetailCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={cn("mt-1 font-semibold tabular", highlight && "text-gradient")}>{value}</p>
    </div>
  );
}

import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useTokenDetail } from "@/hooks/useTokenDetail";
import { TradePanel } from "@/components/trading/TradePanel";
import { PriceChart } from "@/components/chart/PriceChart";
import { HolderTable } from "@/components/holders/HolderTable";
import { Bubblemap } from "@/components/holders/Bubblemap";
import { chainMeta } from "@/config/chains";
import { formatMarketCap, shortenAddress, timeAgo, formatToken, graduationProgress, graduationProgressByReserves, formatPrice, formatPriceUsd } from "@/lib/format";
import { useReadContracts } from "wagmi";
import { bondingCurveAbi } from "@/abi/BondingCurve";
import { formatTokenAmountCompact } from "@/lib/format";
import { ArrowLeft, ExternalLink, Flame, Loader2, LineChart, Users, Share2, SearchX } from "lucide-react";
import { Link } from "react-router-dom";
import { isAddress, type Address } from "viem";
import { cn } from "@/lib/cn";
import { LaunchCountdown } from "@/components/tokens/LaunchCountdown";
import { Avatar } from "@/components/ui/Avatar";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EmptyState } from "@/components/feedback/EmptyState";
import { addressUrl, tokenUrl } from "@/lib/explorer";
import { Tabs } from "@/components/ui/Tabs";

export function TokenDetail() {
  const params = useParams<{ chainId: string; address: string }>();
  const chainId = Number(params.chainId);
  const addressValid = isAddress(params.address ?? "");
  const tokenAddress = (addressValid ? params.address : "0x0000000000000000000000000000000000000000") as Address;
  const { meta, curveState } = useTokenDetail(chainId, tokenAddress);
  const { isError: metaIsError, refetch: metaRefetch } = meta;
  const [tab, setTab] = useState<"chart" | "holders" | "bubblemap">("chart");

  const meta_ = chainMeta[chainId];
  const data = meta.data;

  // Accurate graduation state straight from the curve: tokens sold vs the on-chain threshold.
  // This is correct on both mainnet and testnet (where the threshold is a tiny fraction).
  const curveAddress = data?.curve as Address | undefined;
  const gradReads = useReadContracts({
    contracts: [
      { abi: bondingCurveAbi, address: curveAddress, functionName: "s_realTokenReserves", chainId },
      { abi: bondingCurveAbi, address: curveAddress, functionName: "s_realReservesInit", chainId },
    ],
    query: { enabled: Boolean(curveAddress), refetchInterval: 10_000 },
  });
  const realTokenReserves = gradReads.data?.[0]?.result as bigint | undefined;
  const realReservesInit = gradReads.data?.[1]?.result as bigint | undefined;
  const hasOnChainGrad =
    typeof realTokenReserves === "bigint" &&
    typeof realReservesInit === "bigint" &&
    realReservesInit > 0n;

  // Auto-retry for unindexed tokens (backend 404 but address is valid).
  // Polls every 3s for ~120s to cover the backend confirmation lag before a
  // freshly launched token is indexed.
  const [indexAttempts, setIndexAttempts] = useState(0);
  const MAX_INDEX_RETRIES = 40;
  const RETRY_INTERVAL = 3000;

  useEffect(() => {
    if (!metaIsError || !addressValid || indexAttempts >= MAX_INDEX_RETRIES) return;
    const timer = setTimeout(() => {
      setIndexAttempts((n) => n + 1);
      metaRefetch();
    }, RETRY_INTERVAL);
    return () => clearTimeout(timer);
  }, [metaIsError, addressValid, indexAttempts, metaRefetch]);

  // Manual "keep waiting" — reset the retry budget and poll again.
  const retryIndexing = () => {
    setIndexAttempts(0);
    metaRefetch();
  };

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

  // Show indexing-in-progress when backend 404 but address is valid
  if (meta.isError && addressValid && indexAttempts < MAX_INDEX_RETRIES) {
    return (
      <div className="py-16 flex flex-col items-center text-center animate-fade-in-up">
        <div className="relative mb-4">
          <div className="absolute inset-0 rounded-full bg-moon-gradient opacity-30 blur-2xl animate-glow-pulse" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-moon-gradient shadow-glow">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        </div>
        <h2 className="text-xl font-bold font-display">Token is being indexed</h2>
        <p className="mt-2 max-w-sm text-sm text-[var(--text-secondary)]">
          The transaction is confirmed on-chain. The indexer is processing it — this usually takes a few seconds.
        </p>
        <div className="flex items-center gap-1.5 mt-4 text-xs text-neutral-500">
          <div className="h-1.5 w-1.5 rounded-full bg-moon-400 animate-pulse" />
          <div className="h-1.5 w-1.5 rounded-full bg-moon-400 animate-pulse" style={{ animationDelay: "300ms" }} />
          <div className="h-1.5 w-1.5 rounded-full bg-moon-400 animate-pulse" style={{ animationDelay: "600ms" }} />
          <span className="ml-1">Retrying ({indexAttempts + 1}/{MAX_INDEX_RETRIES})</span>
        </div>
      </div>
    );
  }

  if (meta.isError) {
    return (
      <div className="py-16">
        <ErrorState
          error={meta.error}
          title="Couldn't load this token"
          onRetry={retryIndexing}
        />
        <p className="mt-3 text-center text-xs text-[var(--text-muted)]">
          Just launched? It may still be indexing — retry to keep waiting.
        </p>
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
             <Avatar src={data.imageUrl} alt={data.name} size={80} className="rounded-2xl border border-[var(--border-subtle)]" />
           </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
               <h1 className="text-2xl sm:text-3xl font-bold font-display truncate">{data.name}</h1>
              <span className="chip-neutral shrink-0">${data.symbol}</span>
              {data.graduated && (
                <span className="chip-moon">
                  <Flame className="h-3 w-3" /> Graduated
                </span>
              )}
              <span className="chip-neutral">{meta_?.shortLabel}</span>
            </div>
            <p className="mt-1.5 text-sm text-[var(--text-muted)] flex flex-wrap items-center gap-1.5">
              <span>Creator</span>
              <a href={addressUrl(chainId, data.creator)} target="_blank" rel="noreferrer" className="font-mono text-moon-400 hover:underline">
                {shortenAddress(data.creator)}
              </a>
              <span className="text-[var(--text-muted)] opacity-60">·</span>
              <span>{timeAgo(data.createdAt)}</span>
              <span className="text-[var(--text-muted)] opacity-60">·</span>
              <span className="tabular">{data.holderCount.toLocaleString()} holders</span>
            </p>
            {data.description && (
              <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed max-w-2xl">{data.description}</p>
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
            <Stat label="Price" value={formatPriceUsd(data.priceUsd)} />
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
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">Graduation Progress</p>
              <LaunchCountdown
                progress={
                  hasOnChainGrad
                    ? graduationProgressByReserves(realTokenReserves!, realReservesInit!)
                    : graduationProgress(data.volume24h, data.supplyTier)
                }
                graduated={data.graduated}
                createdAt={data.createdAt}
                volume24h={data.volume24h}
                supplyTier={data.supplyTier}
              />
            </div>
            <div className="hidden sm:block w-px h-12 bg-[var(--border-subtle)]" />
            <div className="text-sm">
              <p className="text-xs text-[var(--text-muted)]">Threshold</p>
              <p className="font-semibold tabular">
                {hasOnChainGrad
                  ? formatTokenAmountCompact(realReservesInit!)
                  : (["793.1M", "7.93B", "79.3B"][data.supplyTier] ?? "-")}{" "}
                tokens
              </p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">then auto-graduation to DEX</p>
            </div>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: chart + tabs */}
        <div className="lg:col-span-2 space-y-4 min-w-0">
          {/* Tab switcher */}
          <Tabs tabs={tabs} value={tab} onChange={(k) => setTab(k as "chart" | "holders" | "bubblemap")} ariaLabel="Token views" />

          <div role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === "chart" && <PriceChart chainId={chainId} tokenAddress={tokenAddress} />}
            {tab === "holders" && <HolderTable chainId={chainId} tokenAddress={tokenAddress} />}
            {tab === "bubblemap" && <Bubblemap chainId={chainId} tokenAddress={tokenAddress} />}
          </div>
        </div>

        {/* Right: trade panel */}
        <div className="lg:col-span-1 min-w-0">
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
          value={curveState.data ? formatPrice(BigInt(curveState.data)) : "-"}
          highlight
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--surface-2)] border border-[var(--border-subtle)] p-2.5 sm:p-3">
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 font-semibold tabular text-sm sm:text-base text-[var(--text-primary)] truncate">{value}</p>
    </div>
  );
}

function DetailCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className={cn("mt-1 font-semibold tabular", highlight && "text-gradient")}>{value}</p>
    </div>
  );
}

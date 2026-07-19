import { useCallback, useEffect, useMemo, useState } from "react";
import { useTokenDetail, useCurveState } from "@/hooks/useTokenDetail";
import { useTrade } from "@/hooks/useTrade";
import { useReferrer } from "@/hooks/useReferrer";
import { useAccount, useBalance, useReadContract, useBlockNumber } from "wagmi";
import { moonTokenAbi } from "@/abi/MoonToken";
import { formatEther, parseEther, type Address } from "viem";
import { getBuyOut, getSellOut, type CurveReserves, CurveShape } from "@/lib/curve";
import { formatToken, formatPrice, shortenAddress, formatCompactToken } from "@/lib/format";
import { cn } from "@/lib/cn";
import { chainMeta } from "@/config/chains";
import { useTheme } from "@/stores/theme";
import { TxProgress } from "@/components/tx/TxProgress";
import { Badge } from "@/components/ui/Badge";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, AlertCircle, AlertTriangle, Settings2 } from "lucide-react";

interface TradePanelProps {
  chainId: number;
  curveAddress: Address;
  tokenAddress: Address;
  tokenSymbol: string;
}

const SLIPPAGE_PRESETS = [0.5, 1, 2, 5];

export function TradePanel({ chainId, curveAddress, tokenAddress, tokenSymbol }: TradePanelProps) {
  const { address } = useAccount();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const { meta } = useTokenDetail(chainId, tokenAddress);
  const reads = useCurveState(chainId, curveAddress);
  const trade = useTrade({ chainId, curveAddress });
  const referrer = useReferrer();

  const { data: currentBlockNumber } = useBlockNumber({ chainId });

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [sliderValue, setSliderValue] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [slippage, setSlippage] = useState(1);

  const {
    data: tokenBalance,
    isLoading: tokenBalLoading,
    error: tokenBalError,
  } = useReadContract({
    abi: moonTokenAbi,
    address: tokenAddress,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: Boolean(address) },
  });

  const { data: nativeBalance } = useBalance({
    address,
    chainId,
    query: { enabled: Boolean(address) },
  });

  // The balance that the percentage slider is expressed against: the user's
  // native (ETH) balance when buying, the token balance when selling.
  const maxBalance: bigint | undefined = useMemo(() => {
    if (!address) return undefined;
    if (side === "buy") return nativeBalance?.value;
    return tokenBalance as bigint | undefined;
  }, [address, side, nativeBalance, tokenBalance]);

  // Slider → amount: pct % of the available balance.
  const handleSliderChange = useCallback(
    (pct: number) => {
      setSliderValue(pct);
      if (!maxBalance || maxBalance <= 0n) {
        if (pct === 0) setAmount("");
        return;
      }
      const raw = (maxBalance * BigInt(pct)) / 100n;
      setAmount(raw > 0n ? formatEther(raw) : "");
    },
    [maxBalance],
  );

  // Amount input → slider: position the slider to match the typed amount.
  const handleAmountChange = useCallback(
    (value: string) => {
      setAmount(value);
      if (!maxBalance || !value) {
        setSliderValue(0);
        return;
      }
      try {
        const amt = parseEther(value);
        if (amt > 0n && maxBalance > 0n) {
          const pct = Number((amt * 100n) / maxBalance);
          setSliderValue(Math.min(100, Math.max(0, pct)));
        } else {
          setSliderValue(0);
        }
      } catch {
        setSliderValue(0);
      }
    },
    [maxBalance],
  );

  const setMax = useCallback(() => {
    if (!maxBalance) return;
    setSliderValue(100);
    setAmount(formatEther(maxBalance));
  }, [maxBalance]);

  // Reset the slider when switching sides, since the balance source changes.
  useEffect(() => {
    setSliderValue(0);
  }, [side, address]);

  const reserves: CurveReserves | undefined = useMemo(() => {
    if (!reads.data || reads.data.some((r) => r.status !== "success")) return undefined;
    const results = reads.data.map((r) => r.result);
    const [rt, rq, vt, vq, tsInit, cBlock] = results as [bigint, bigint, bigint, bigint, bigint, bigint];
    return {
      realToken: rt,
      realQuote: rq,
      virtualToken: vt,
      virtualQuote: vq,
      totalSupplyInit: tsInit,
      creationBlock: cBlock,
      currentBlock: currentBlockNumber ?? cBlock + 10n,
      curveShape: (meta.data?.curveShape ?? 0) as CurveShape,
    };
  }, [reads.data, meta.data, currentBlockNumber]);

  const quote = useMemo(() => {
    if (!reserves || !amount) return null;
    try {
      const amt = parseEther(amount);
      if (amt <= 0n) return null;
      if (side === "buy") {
        const { tokensOut, fee } = getBuyOut(reserves, amt);
        const minOut = (tokensOut * BigInt(Math.floor((100 - slippage) * 100))) / 10000n;
        return {
          out: tokensOut,
          minOut,
          fee,
          outLabel: `${formatToken(tokensOut)} ${tokenSymbol}`,
          minOutLabel: `${formatToken(minOut)} ${tokenSymbol}`,
        };
      }
      const { netQuoteOut, fee } = getSellOut(reserves, amt);
      const minOut = (netQuoteOut * BigInt(Math.floor((100 - slippage) * 100))) / 10000n;
      return {
        out: netQuoteOut,
        minOut,
        fee,
        outLabel: `${formatPrice(netQuoteOut)}`,
        minOutLabel: `${formatPrice(minOut)}`,
      };
    } catch {
      return null;
    }
  }, [reserves, amount, side, tokenSymbol, slippage]);

  const currentPrice = reserves
    ? Number(formatEther((reserves.virtualQuote * 10n ** 18n) / (reserves.virtualToken || 1n)))
    : 0;

  // On sell, block the trade when the entered amount exceeds the wallet balance so
  // the user gets an inline message instead of an on-chain revert.
  const insufficientBalance = useMemo(() => {
    if (side !== "sell" || !amount || tokenBalance === undefined || tokenBalance === null) return false;
    try {
      return parseEther(amount) > (tokenBalance as bigint);
    } catch {
      return false;
    }
  }, [side, amount, tokenBalance]);

  const nativeGasWarning = useMemo(() => {
    if (side !== "sell" || !address) return false;
    return nativeBalance !== undefined && nativeBalance.value === 0n;
  }, [side, address, nativeBalance]);

  function submit() {
    if (!quote || !amount || insufficientBalance || nativeGasWarning) return;
    // Don't self-refer — pass the referrer only when it differs from the trader.
    const ref =
      referrer && address && referrer.toLowerCase() !== address.toLowerCase() ? referrer : undefined;
    if (side === "buy") {
      trade.buy(amount, quote.minOut, ref);
    } else {
      trade.sell(parseEther(amount), quote.minOut, ref);
    }
  }

  return (
    <div className="card-elevated p-4 space-y-4 w-full min-w-0 lg:sticky lg:top-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold font-display">Trade</h3>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className={cn(
            "rounded-lg p-1.5 text-neutral-500 hover:bg-white/[0.06] hover:text-neutral-300 transition-colors",
            showSettings && "bg-white/[0.06] text-moon-300",
          )}
          aria-label="Trade settings"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      {/* Buy/Sell toggle */}
      <div className={cn(
        "flex rounded-xl border p-1",
        isLight ? "bg-neutral-200/70 border-neutral-300" : "bg-ink-950/60 border-white/[0.04]",
      )}>
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            aria-pressed={side === s}
            className={cn(
              "flex-1 rounded-lg py-2.5 text-sm font-semibold capitalize transition-all duration-200 ease-smooth",
              side === s
                ? s === "buy"
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-glow-green"
                  : "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-glow-red"
                : isLight ? "text-neutral-500 hover:text-neutral-900" : "text-neutral-400 hover:text-neutral-200",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Slippage settings */}
      {showSettings && (
        <div className={cn(
          "rounded-xl border p-3 space-y-2 animate-fade-in",
          isLight ? "border-neutral-200 bg-neutral-100" : "border-white/[0.06] bg-ink-950/40",
        )}>
          <p className="text-xs text-neutral-500">Slippage Tolerance</p>
          <div className="flex gap-1.5">
            {SLIPPAGE_PRESETS.map((s) => (
              <button
                key={s}
                onClick={() => setSlippage(s)}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors",
                  slippage === s
                    ? "bg-moon-500/20 text-moon-300 border border-moon-500/30"
                    : isLight
                      ? "bg-neutral-200 text-neutral-600 hover:text-neutral-900 border border-transparent"
                      : "bg-white/[0.04] text-neutral-400 hover:text-neutral-200 border border-transparent",
                )}
              >
                {s}%
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Amount input */}
      <div>
        <label className="mb-1.5 block text-xs text-neutral-500 flex items-center justify-between">
          <span>{side === "buy" ? "You pay" : "You sell"}</span>
          <span className="flex items-center gap-2 min-w-0 max-w-full">
            {address && side === "buy" && maxBalance !== undefined && maxBalance > 0n && (
              <span className="truncate text-[11px]">Bal: {formatEther(maxBalance)} ETH</span>
            )}
            {address && side === "sell" && (
              <span className="truncate text-[11px]">
                {tokenBalLoading ? (
                  <span className="text-neutral-600">Loading...</span>
                  ) : tokenBalError ? (
                    <span className="text-red-400">Error</span>
                  ) : maxBalance !== undefined ? (
                    <span>
                      Bal: {formatCompactToken(maxBalance)} {tokenSymbol}
                      {nativeBalance !== undefined && (
                        <span className="ml-1 text-neutral-600">
                          / {formatEther(nativeBalance.value)} ETH
                        </span>
                      )}
                    </span>
                  ) : null}
              </span>
            )}
            {address && maxBalance !== undefined && maxBalance > 0n && (
              <button
                type="button"
                className="text-moon-400 hover:text-moon-300 text-[10px] font-medium"
                onClick={setMax}
              >
                MAX
              </button>
            )}
          </span>
        </label>
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="0.0"
            className="input w-full pr-20 !text-lg font-semibold tabular"
          />
          <span className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium",
            isLight ? "text-neutral-500" : "text-neutral-400",
          )}>
            {side === "buy" ? "ETH" : tokenSymbol}
          </span>
        </div>
        {address && maxBalance !== undefined && maxBalance > 0n && (
          <div className="mt-3 space-y-1.5">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={sliderValue}
              onChange={(e) => handleSliderChange(Number(e.target.value))}
              className="slider w-full"
              style={{ ["--slider-progress" as string]: `${sliderValue}%` } as React.CSSProperties}
              aria-label="Percentage of balance"
            />
            <div className={cn(
              "flex justify-between text-[10px] tabular px-0.5",
              isLight ? "text-neutral-400" : "text-neutral-600",
            )}>
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>
        )}
      </div>

      {/* Quote */}
      {quote && (
        <div className={cn(
          "space-y-2 rounded-xl border p-3 text-xs animate-fade-in",
          isLight ? "bg-neutral-100 border-neutral-200" : "bg-ink-950/40 border-white/[0.04]",
        )}>
          <Row label="You receive" value={quote.outLabel} highlight />
          <Row label="Price" value={formatPrice(currentPrice ? BigInt(Math.floor(currentPrice * 1e18)) : 0n)} />
          <Row
            label="Fee"
            value={`${(Number(quote.fee) / 1e18 * 100).toFixed(2)}%`}
            badge={Number(quote.fee) / 1e18 > 0.5 ? "anti-sniper" : undefined}
          />
          <div className={cn("h-px my-1", isLight ? "bg-neutral-200" : "bg-white/[0.04]")} />
          <Row label="Min received" value={quote.minOutLabel} muted />
          <Row label="Slippage" value={`${slippage}%`} muted />
        </div>
      )}

      {/* Curve read error */}
      {reads.isError && (
        <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-300 animate-fade-in">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Failed to load curve state. The RPC may be unavailable.</span>
        </div>
      )}

      {/* Insufficient balance warning */}
      {insufficientBalance && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300 animate-fade-in">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Amount exceeds your {tokenSymbol} balance.</span>
        </div>
      )}

      {/* Insufficient gas warning */}
      {nativeGasWarning && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300 animate-fade-in">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Insufficient {chainMeta[chainId]?.nativeSymbol ?? "ETH"} for gas. You need a small amount to pay the network fee.</span>
        </div>
      )}

      {/* Transaction lifecycle: preparing / signature / confirming / success / error */}
      <TxProgress
        stage={trade.lifecycle.stage}
        chainId={chainId}
        confirmations={trade.lifecycle.confirmations}
        confirmationCount={trade.lifecycle.confirmationCount}
        explorerUrl={trade.lifecycle.explorerUrl}
        gasEstimate={trade.lifecycle.gasEstimate}
        nativeSymbol={chainMeta[chainId]?.nativeSymbol ?? "ETH"}
        error={trade.lifecycle.error}
        onRetry={trade.lifecycle.retry}
      />

      {/* Submit */}
      <button
        onClick={submit}
        disabled={!quote || !amount || trade.pending || !address || insufficientBalance || nativeGasWarning}
        className={cn(
          "btn w-full !py-3 text-base",
          side === "buy" ? "btn-success" : "btn-danger",
        )}
      >
        {trade.pending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : side === "buy" ? (
          <ArrowDownToLine className="h-5 w-5" />
        ) : (
          <ArrowUpFromLine className="h-5 w-5" />
        )}
        {!address ? "Connect Wallet" : side === "buy" ? "Buy" : "Sell"}
      </button>

      {address && (
        <p className={cn(
          "text-center text-[10px] font-mono",
          isLight ? "text-neutral-400" : "text-neutral-600",
        )}>{shortenAddress(address)}</p>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  highlight,
  badge,
}: {
  label: string;
  value: string;
  muted?: boolean;
  highlight?: boolean;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 overflow-hidden">
      <span className="text-neutral-500 flex items-center gap-1.5 min-w-0">
        <span className="truncate">{label}</span>
        {badge && (
          <Badge tone="amber">{badge}</Badge>
        )}
      </span>
      <span
        className={cn(
          "tabular truncate shrink-0",
          muted ? "text-neutral-500" : highlight ? "font-semibold text-neutral-100" : "font-medium text-neutral-200",
        )}
      >
        {value}
      </span>
    </div>
  );
}

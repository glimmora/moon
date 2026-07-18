import { useMemo, useState } from "react";
import { useTokenDetail, useCurveState } from "@/hooks/useTokenDetail";
import { useTrade } from "@/hooks/useTrade";
import { useReferrer } from "@/hooks/useReferrer";
import { useAccount, useReadContract, useBlockNumber } from "wagmi";
import { moonTokenAbi } from "@/abi/MoonToken";
import { formatEther, parseEther, type Address } from "viem";
import { getBuyOut, getSellOut, type CurveReserves, CurveShape } from "@/lib/curve";
import { formatToken, formatPrice, shortenAddress } from "@/lib/format";
import { cn } from "@/lib/cn";
import { chainMeta } from "@/config/chains";
import { TxProgress } from "@/components/tx/TxProgress";
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
  const { meta } = useTokenDetail(chainId, tokenAddress);
  const reads = useCurveState(chainId, curveAddress);
  const trade = useTrade({ chainId, curveAddress });
  const referrer = useReferrer();

  const { data: currentBlockNumber } = useBlockNumber({ chainId });

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [slippage, setSlippage] = useState(1);

  const { data: tokenBalance } = useReadContract({
    abi: moonTokenAbi,
    address: tokenAddress,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: Boolean(address) && side === "sell" },
  });

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

  function submit() {
    if (!quote || !amount || insufficientBalance) return;
    // Don't self-refer — pass the referrer only when it differs from the trader.
    const ref =
      referrer && address && referrer.toLowerCase() !== address.toLowerCase() ? referrer : undefined;
    if (side === "buy") {
      trade.buy(amount, quote.minOut, ref);
    } else {
      trade.sell(parseEther(amount), quote.minOut, ref);
    }
  }

  const quickAmounts = ["0.01", "0.05", "0.1", "0.5"];

  return (
    <div className="card-elevated p-4 space-y-4 sticky top-20">
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
      <div className="flex rounded-xl bg-ink-950/60 border border-white/[0.04] p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={cn(
              "flex-1 rounded-lg py-2.5 text-sm font-semibold capitalize transition-all duration-200",
              side === s
                ? s === "buy"
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-glow-green"
                  : "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-glow-red"
                : "text-neutral-400 hover:text-neutral-200",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Slippage settings */}
      {showSettings && (
        <div className="rounded-xl border border-white/[0.06] bg-ink-950/40 p-3 space-y-2 animate-fade-in">
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
          {address && side === "sell" && tokenBalance !== undefined && tokenBalance !== null && (
            <button
              type="button"
              className="text-moon-400 hover:text-moon-300 text-[10px] font-medium"
              onClick={() => setAmount(formatToken(tokenBalance as bigint))}
            >
              MAX
            </button>
          )}
        </label>
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="input pr-24 !text-lg font-semibold tabular"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-neutral-400">
            {side === "buy" ? "ETH" : tokenSymbol}
          </span>
        </div>
        {side === "buy" && (
          <div className="mt-2 flex gap-1.5">
            {quickAmounts.map((a) => (
              <button
                key={a}
                onClick={() => setAmount(a)}
                className="flex-1 rounded-lg bg-white/[0.04] border border-white/[0.04] py-1.5 text-xs text-neutral-300 hover:bg-white/[0.08] hover:border-white/[0.08] transition-colors tabular"
              >
                {a}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quote */}
      {quote && (
        <div className="space-y-2 rounded-xl bg-ink-950/40 border border-white/[0.04] p-3 text-xs animate-fade-in">
          <Row label="You receive" value={quote.outLabel} highlight />
          <Row label="Price" value={formatPrice(currentPrice ? BigInt(Math.floor(currentPrice * 1e18)) : 0n)} />
          <Row
            label="Fee"
            value={`${(Number(quote.fee) / 1e18 * 100).toFixed(2)}%`}
            badge={Number(quote.fee) / 1e18 > 0.5 ? "anti-sniper" : undefined}
          />
          <div className="h-px bg-white/[0.04] my-1" />
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
        disabled={!quote || !amount || trade.pending || !address || insufficientBalance}
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
        <p className="text-center text-[10px] text-neutral-600 font-mono">{shortenAddress(address)}</p>
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
    <div className="flex items-center justify-between">
      <span className="text-neutral-500 flex items-center gap-1.5">
        {label}
        {badge && (
          <span className="rounded bg-amber-500/15 text-amber-300 px-1.5 py-0.5 text-[9px] font-medium">
            {badge}
          </span>
        )}
      </span>
      <span
        className={cn(
          "tabular",
          muted ? "text-neutral-500" : highlight ? "font-semibold text-neutral-100" : "font-medium text-neutral-200",
        )}
      >
        {value}
      </span>
    </div>
  );
}

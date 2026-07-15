import { useMemo, useState } from "react";
import { useTokenDetail, useCurveState } from "@/hooks/useTokenDetail";
import { useTrade } from "@/hooks/useTrade";
import { useAccount } from "wagmi";
import { formatEther, parseEther, type Address } from "viem";
import { getBuyOut, getSellOut, type CurveReserves, CurveShape } from "@/lib/curve";
import { formatToken, formatPrice, shortenAddress } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, AlertCircle } from "lucide-react";

interface TradePanelProps {
  chainId: number;
  curveAddress: Address;
  tokenAddress: Address;
  tokenSymbol: string;
}

export function TradePanel({ chainId, curveAddress, tokenAddress, tokenSymbol }: TradePanelProps) {
  const { address } = useAccount();
  const { meta } = useTokenDetail(chainId, tokenAddress);
  const reads = useCurveState(chainId, curveAddress);
  const trade = useTrade({ chainId, curveAddress });

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");

  const reserves: CurveReserves | undefined = useMemo(() => {
    if (!reads.data || reads.data.some((r) => r.status !== "success")) return undefined;
    const [price, rt, rq, vt, vq, tsInit, cBlock] = reads.data.map((r) => r.result) as bigint[];
    return {
      realToken: rt,
      realQuote: rq,
      virtualToken: vt,
      virtualQuote: vq,
      totalSupplyInit: tsInit,
      creationBlock: cBlock,
      currentBlock: cBlock + 10n, // optimistic: assume a few blocks elapsed
      curveShape: (meta.data?.curveShape ?? 0) as CurveShape,
    };
  }, [reads.data, meta.data]);

  const quote = useMemo(() => {
    if (!reserves || !amount) return null;
    try {
      if (side === "buy") {
        const { tokensOut, fee } = getBuyOut(reserves, parseEther(amount));
        return { out: tokensOut, fee, outLabel: `${formatToken(tokensOut)} ${tokenSymbol}` };
      }
      const { netQuoteOut, fee } = getSellOut(reserves, parseEther(amount));
      return { out: netQuoteOut, fee, outLabel: `${formatPrice(netQuoteOut)}` };
    } catch {
      return null;
    }
  }, [reserves, amount, side, tokenSymbol]);

  const currentPrice = reserves ? Number(formatEther(reserves.virtualQuote * 10n ** 18n / (reserves.virtualToken || 1n))) : 0;

  function submit() {
    if (!quote || !amount) return;
    if (side === "buy") {
      trade.buy(amount, quote.out);
    } else {
      trade.sell(parseEther(amount), quote.out);
    }
  }

  const quickAmounts = ["0.01", "0.05", "0.1", "0.5"];

  return (
    <div className="card p-4 space-y-4">
      <div className="flex rounded-lg bg-neutral-900 p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={cn(
              "flex-1 rounded-md py-2 text-sm font-semibold capitalize transition-colors",
              side === s
                ? s === "buy"
                  ? "bg-green-600 text-white"
                  : "bg-red-600 text-white"
                : "text-neutral-400 hover:text-neutral-100",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div>
        <label className="mb-1 block text-xs text-neutral-500">
          {side === "buy" ? "Amount (ETH)" : `Amount (${tokenSymbol})`}
        </label>
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="input pr-20"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
            {side === "buy" ? "ETH" : tokenSymbol}
          </span>
        </div>
        {side === "buy" && (
          <div className="mt-2 flex gap-1.5">
            {quickAmounts.map((a) => (
              <button
                key={a}
                onClick={() => setAmount(a)}
                className="flex-1 rounded-md bg-neutral-800 py-1 text-xs text-neutral-300 hover:bg-neutral-700"
              >
                {a}
              </button>
            ))}
          </div>
        )}
      </div>

      {quote && (
        <div className="space-y-1.5 rounded-lg bg-neutral-900 p-3 text-xs">
          <Row label="You receive" value={quote.outLabel} />
          <Row label="Price" value={formatPrice(currentPrice ? BigInt(Math.floor(currentPrice * 1e18)) : 0n)} />
          <Row label="Fee (X-Mode)" value={`${(Number(quote.fee) / 1e18 * 100).toFixed(2)}%`} />
          <Row label="Min received" value={quote.outLabel} muted />
        </div>
      )}

      {trade.error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-950/50 p-3 text-xs text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="break-words">{trade.error}</span>
        </div>
      )}

      <button
        onClick={submit}
        disabled={!quote || !amount || trade.pending || !address}
        className={cn(
          "btn w-full",
          side === "buy" ? "btn-primary" : "bg-red-600 text-white hover:bg-red-500",
        )}
      >
        {trade.pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : side === "buy" ? (
          <ArrowDownToLine className="h-4 w-4" />
        ) : (
          <ArrowUpFromLine className="h-4 w-4" />
        )}
        {!address ? "Connect Wallet" : side === "buy" ? "Buy" : "Sell"}
      </button>

      {trade.confirmed && (
        <p className="text-center text-xs text-green-400">Transaction confirmed!</p>
      )}

      {address && (
        <p className="text-center text-xs text-neutral-600">Wallet: {shortenAddress(address)}</p>
      )}
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-500">{label}</span>
      <span className={muted ? "text-neutral-500" : "font-medium text-neutral-100"}>{value}</span>
    </div>
  );
}

import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { ReferralLink } from "@/components/referral/ReferralLink";
import { Users, Loader2, TrendingUp, Award } from "lucide-react";
import { formatUsd, shortenAddress } from "@/lib/format";

export function Referral() {
  const { address } = useAccount();

  const { data, isLoading } = useQuery({
    queryKey: ["referral-stats", address],
    queryFn: () => (address ? api.getReferralStats(address) : Promise.resolve(null)),
    enabled: Boolean(address),
    refetchInterval: 30_000,
  });

  return (
    <div className="mx-auto max-w-2xl py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6 text-moon-400" />
        <h1 className="text-2xl font-bold">Referral Program</h1>
      </div>

      <ReferralLink />

      {address && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            icon={Users}
            label="Referrals"
            value={isLoading ? "…" : String(data?.count ?? 0)}
          />
          <Stat
            icon={TrendingUp}
            label="Total Volume"
            value={isLoading ? "…" : formatUsd(Number(data?.volume ?? 0) / 1e18)}
          />
          <Stat
            icon={Award}
            label="Rewards Earned"
            value={isLoading ? "…" : formatUsd(Number(data?.rewards ?? 0) / 1e18)}
          />
        </div>
      )}

      <div className="card p-5">
        <h3 className="font-semibold">How it works</h3>
        <ol className="mt-3 space-y-2 text-sm text-neutral-400">
          <li>
            <span className="text-moon-400">1.</span> Share your referral link. When a trader
            clicks it, they permanently link their wallet to you via{" "}
            <code className="rounded bg-neutral-800 px-1 text-xs">ReferralRegistry.setReferrer</code>.
          </li>
          <li>
            <span className="text-moon-400">2.</span> Every trade they make accrues{" "}
            <span className="text-moon-300">10% of the fee</span> to you — pull-payment, claimable
            anytime.
          </li>
          <li>
            <span className="text-moon-400">3.</span> Referrer links are <span className="text-moon-300">permanent</span>{" "}
            (anti-abuse) — once set, they cannot be changed.
          </li>
        </ol>
      </div>

      {address && (
        <p className="text-center text-xs text-neutral-600">
          Connected as {shortenAddress(address)}
        </p>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="card p-4">
      <Icon className="mb-1 h-5 w-5 text-moon-400" />
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold">{value}</p>
    </div>
  );
}

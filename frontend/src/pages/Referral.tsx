import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { ReferralLink } from "@/components/referral/ReferralLink";
import { Users, TrendingUp, Award, Sparkles } from "lucide-react";
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
    <div className="mx-auto max-w-3xl py-8 space-y-6 animate-fade-in-up">
      <div className="text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-moon-gradient shadow-glow mb-3">
          <Users className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold font-display">Referral Program</h1>
        <p className="mt-2 text-neutral-400">Earn 10% of every trade fee from traders you refer — permanently.</p>
      </div>

      <ReferralLink />

      {address && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={Users}
            label="Referrals"
            value={isLoading ? "…" : String(data?.count ?? 0)}
            accent="purple"
          />
          <StatCard
            icon={TrendingUp}
            label="Total Volume"
            value={isLoading ? "…" : formatUsd(Number(data?.volume ?? 0) / 1e18)}
            accent="cyan"
          />
          <StatCard
            icon={Award}
            label="Rewards Earned"
            value={isLoading ? "…" : formatUsd(Number(data?.rewards ?? 0) / 1e18)}
            accent="amber"
          />
        </div>
      )}

      {/* How it works */}
      <div className="card-elevated p-6">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-moon-400" />
          How it works
        </h3>
        <ol className="mt-4 space-y-3 text-sm text-neutral-400">
          <Step n={1}>
            Share your referral link. When a trader clicks it, they permanently link their wallet to you via{" "}
            <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-xs font-mono text-moon-300">ReferralRegistry.setReferrer</code>.
          </Step>
          <Step n={2}>
            Every trade they make accrues{" "}
            <span className="text-moon-300 font-medium">10% of the fee</span> to you — pull-payment, claimable anytime.
          </Step>
          <Step n={3}>
            Referrer links are <span className="text-moon-300 font-medium">permanent</span> (anti-abuse) — once set, they cannot be changed.
          </Step>
        </ol>
      </div>

      {address && (
        <p className="text-center text-xs text-neutral-600 font-mono">
          Connected as {shortenAddress(address)}
        </p>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  accent: "purple" | "cyan" | "amber";
}) {
  const accentMap = {
    purple: "text-moon-300 bg-moon-500/15 border-moon-500/20",
    cyan: "text-cyan-300 bg-cyan-500/15 border-cyan-500/20",
    amber: "text-amber-300 bg-amber-500/15 border-amber-500/20",
  };
  return (
    <div className="card p-5">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${accentMap[accent]} mb-3`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular">{value}</p>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-moon-500/20 text-xs font-bold text-moon-300">
        {n}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

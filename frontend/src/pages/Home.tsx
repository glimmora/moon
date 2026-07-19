import { Link } from "react-router-dom";
import { Rocket, TrendingUp, Shield, Zap, Flame, ArrowRight, Sparkles } from "lucide-react";
import { TokenFeed } from "@/components/tokens/TokenFeed";
import { useTokens } from "@/hooks/useTokens";
import { chainMeta } from "@/config/chains";
import { formatUsd } from "@/lib/format";
import { useSelectedChainId } from "@/stores/networkMode";

export function Home() {
  const selectedChainId = useSelectedChainId();
  const { data: tokens, isLoading } = useTokens({ chainId: selectedChainId });

  // Live protocol stats derived from the indexed token list.
  const chainCount = Object.keys(chainMeta).length;
  const tokenCount = tokens?.length ?? 0;
  const volume24h = (tokens ?? []).reduce((sum, t) => sum + (t.volume24h ?? 0), 0);
  const graduatedCount = (tokens ?? []).filter((t) => t.graduated).length;

  return (
    <div className="space-y-12 py-6 animate-fade-in-up">
      {/* Hero */}
      <section className="relative text-center space-y-6 pt-6 sm:pt-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-moon-500/20 bg-moon-500/10 px-4 py-1.5 text-xs text-moon-300 backdrop-blur-sm animate-fade-in">
          <Sparkles className="h-3 w-3" />
          Multi-chain · 3 curve shapes · Zero pre-mint
        </div>
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight font-display leading-[1.05]">
          Launch the next
          <br />
          <span className="text-gradient">moon</span>
          <span className="inline-block ml-2 animate-float">🌙</span>
        </h1>
        <p className="mx-auto max-w-2xl text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed">
          Permissionless meme-token launchpad with bonding curves, on-chain
          referrals, and a self-sustaining buyback-and-burn flywheel.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/create" className="btn-primary !px-6 !py-3 text-base">
            <Rocket className="h-5 w-5" /> Launch Token
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
          <Link to="/advanced" className="btn-outline !px-6 !py-3 text-base">
            <TrendingUp className="h-5 w-5" /> Explore
          </Link>
        </div>

        {/* Live protocol stats */}
        <div
          className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto"
          role="status"
          aria-live="polite"
          aria-busy={isLoading}
        >
          <StatPill value={isLoading ? "…" : tokenCount.toLocaleString()} label="Tokens" />
          <StatPill value={isLoading ? "…" : formatUsd(volume24h)} label="24h Volume" />
          <StatPill value={isLoading ? "…" : graduatedCount.toLocaleString()} label="Graduated" />
          <StatPill value={String(chainCount)} label="Chains" />
        </div>
      </section>

      {/* Features */}
      <section className="grid gap-4 sm:grid-cols-3">
        <FeatureCard
          icon={Shield}
          title="Tokenomics"
          desc="Mint-on-buy, burn-on-sell. No pre-mint, no rug surface. Total supply grows with real demand."
          accent="purple"
        />
        <FeatureCard
          icon={Zap}
          title="Anti-Sniper"
          desc="99% fee at block 0, linear decay to 1.25% by block 6. Snipers get rekt, fair launches win."
          accent="amber"
        />
        <FeatureCard
          icon={Flame}
          title="Auto-Graduation"
          desc="Tokens graduate to DEX LP at threshold. LP permanently burned — truly community-owned."
          accent="pink"
        />
      </section>

      {/* Token feed */}
      <TokenFeed />
    </div>
  );
}

function StatPill({ value, label, mono }: { value: string; label: string; mono?: boolean }) {
  return (
    <div className="card p-3 text-center">
      <p className={`text-xl font-bold text-gradient truncate ${mono ? "font-mono text-base" : "tabular"}`}>{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
  accent,
}: {
  icon: typeof Rocket;
  title: string;
  desc: string;
  accent: "purple" | "amber" | "pink";
}) {
  const accentMap = {
    purple: "text-moon-300 bg-moon-500/15 border-moon-500/20",
    amber: "text-amber-300 bg-amber-500/15 border-amber-500/20",
    pink: "text-pink-300 bg-pink-500/15 border-pink-500/20",
  };
  return (
    <div className="card-hover group p-6 relative overflow-hidden">
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br from-white/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl border ${accentMap[accent]} mb-4`}>
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-semibold text-lg font-display">{title}</h3>
      <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">{desc}</p>
    </div>
  );
}

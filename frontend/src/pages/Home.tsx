import { Link } from "react-router-dom";
import { Rocket, TrendingUp, Shield, Zap } from "lucide-react";
import { TokenFeed } from "@/components/tokens/TokenFeed";

export function Home() {
  return (
    <div className="space-y-8 py-6">
      <section className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-4 py-1.5 text-xs text-neutral-400">
          <Zap className="h-3 w-3 text-moon-400" />
          Launch a token in seconds — no liquidity required
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          Launch the next <span className="text-moon-400">moon</span>.
        </h1>
        <p className="mx-auto max-w-xl text-neutral-400">
          Permissionless meme-token launchpad with multi-shape bonding curves, on-chain
          referrals, and a self-buyback-and-burn flywheel for $MOON.
        </p>
        <div className="flex justify-center gap-3">
          <Link to="/create" className="btn-primary">
            <Rocket className="h-4 w-4" /> Launch Token
          </Link>
          <Link to="/advanced" className="btn-outline">
            <TrendingUp className="h-4 w-4" /> Advanced View
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Feature
          icon={Shield}
          title="Option B Tokenomics"
          desc="Mint-on-buy, burn-on-sell. No pre-mint, no rug surface."
        />
        <Feature
          icon={Zap}
          title="X-Mode Anti-Sniper"
          desc="99% fee block 0, decays to 1.25% by block 6."
        />
        <Feature
          icon={TrendingUp}
          title="Auto-Graduation"
          desc="Tokens graduate to DEX LP at threshold. LP burned to 0xdEaD."
        />
      </section>

      <TokenFeed />
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: typeof Rocket; title: string; desc: string }) {
  return (
    <div className="card p-5">
      <Icon className="mb-2 h-6 w-6 text-moon-400" />
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-neutral-500">{desc}</p>
    </div>
  );
}

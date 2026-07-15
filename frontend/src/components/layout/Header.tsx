import { Link, useLocation } from "react-router-dom";
import { Rocket, Search, Star, Plus, Gift, Users, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useNetworkMode } from "@/stores/networkMode";

const NAV = [
  { to: "/", label: "Explore", icon: Rocket },
  { to: "/advanced", label: "Advanced", icon: SlidersHorizontal },
  { to: "/create", label: "Launch", icon: Plus },
  { to: "/watchlist", label: "Watchlist", icon: Star },
  { to: "/claim", label: "Claim", icon: Gift },
  { to: "/referral", label: "Referrals", icon: Users },
];

export function Header() {
  const { pathname } = useLocation();
  const { mode, toggle } = useNetworkMode();

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src="/moon.svg" alt="moon.fun" className="h-8 w-8" />
          <span className="text-lg font-bold tracking-tight">
            moon<span className="text-moon-400">.fun</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-neutral-800 text-white"
                    : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:flex flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              type="search"
              placeholder="Search tokens…"
              className="input pl-9"
              aria-label="Search tokens"
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggle}
            className="btn-ghost text-xs"
            aria-label={`Switch to ${mode === "mainnet" ? "testnet" : "mainnet"}`}
            title={`Network: ${mode}`}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                mode === "mainnet" ? "bg-green-500" : "bg-yellow-500",
              )}
            />
            {mode === "mainnet" ? "Mainnet" : "Testnet"}
          </button>
          <ConnectButton showBalance={false} chainStatus="icon" />
        </div>
      </div>
    </header>
  );
}

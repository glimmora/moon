import { Link, useLocation, useNavigate } from "react-router-dom";
import { Rocket, Search, Star, Plus, Gift, Users, Command, Trophy, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useNetworkMode } from "@/stores/networkMode";
import { useEffect, useState } from "react";

const NAV = [
  { to: "/", label: "Explore", icon: Rocket },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/portfolio", label: "Portfolio", icon: Wallet },
  { to: "/create", label: "Launch", icon: Plus, highlight: true },
  { to: "/watchlist", label: "Watchlist", icon: Star },
  { to: "/claim", label: "Claim", icon: Gift },
  { to: "/referral", label: "Referrals", icon: Users },
];

export function Header() {
  const { pathname } = useLocation();
  const { mode, toggle } = useNetworkMode();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 transition-all duration-300 safe-top",
          scrolled ? "header-blur border-b border-white/[0.06]" : "bg-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link to="/" className="group flex items-center gap-2.5 shrink-0">
            <div className="relative h-9 w-9">
              <div className="absolute inset-0 rounded-xl bg-moon-gradient opacity-80 blur-[6px] group-hover:opacity-100 transition-opacity" />
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-moon-gradient shadow-glow">
                <Rocket className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="hidden sm:block">
              <span className="text-lg font-bold tracking-tight font-display">
                moon<span className="text-gradient">.fun</span>
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 ml-2">
            {NAV.map((item) => {
              const active = pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-white/[0.08] text-white shadow-inner-glow"
                      : "text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.04]",
                    item.highlight && !active && "text-moon-300",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Search trigger (desktop) */}
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden lg:flex items-center gap-2 ml-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-300 transition-colors w-56"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search tokens…</span>
            <kbd className="flex items-center gap-0.5 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-neutral-400 font-mono">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>

          {/* Right cluster */}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={toggle}
              className="btn-ghost text-xs !px-3"
              aria-label={`Switch to ${mode === "mainnet" ? "testnet" : "mainnet"}`}
              title={`Network: ${mode}`}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  mode === "mainnet" ? "bg-emerald-400 shadow-glow-green" : "bg-amber-400",
                )}
              />
              {mode === "mainnet" ? "Mainnet" : "Testnet"}
            </button>
            <ConnectButton showBalance={false} chainStatus="icon" />
          </div>
        </div>
      </header>

      {/* Command-style search modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 animate-fade-in"
          onClick={() => setSearchOpen(false)}
        >
          <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-xl card-elevated p-2 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const q = new FormData(e.currentTarget).get("q") as string;
                if (q) {
                  navigate(`/advanced?q=${encodeURIComponent(q)}`);
                  setSearchOpen(false);
                }
              }}
              className="flex items-center gap-2 px-3 py-2"
            >
              <Search className="h-4 w-4 text-neutral-500" />
              <input
                name="q"
                autoFocus
                placeholder="Search by name, symbol, or address…"
                className="flex-1 bg-transparent text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
              />
              <kbd className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-neutral-400 font-mono">ESC</kbd>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

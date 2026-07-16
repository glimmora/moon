import { Link, useLocation, useNavigate } from "react-router-dom";
import { Rocket, Search, Star, Plus, Gift, Users, Command, Trophy, Wallet, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/cn";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useNetworkMode } from "@/stores/networkMode";
import { useTheme } from "@/stores/theme";
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
  const { mode, toggle: toggleMode } = useNetworkMode();
  const { theme, toggle: toggleTheme } = useTheme();
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

  const handleModeToggle = () => {
    toggleMode();
    // Toast is fired by useWalletEvents watcher; no need to duplicate here.
  };

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 transition-all duration-300 safe-top",
          scrolled
            ? theme === "light"
              ? "bg-white/80 backdrop-blur-xl border-b border-neutral-200"
              : "header-blur border-b border-white/[0.06]"
            : "bg-transparent",
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
              <span className={cn(
                "text-lg font-bold tracking-tight font-display",
                theme === "light" ? "text-neutral-900" : "text-neutral-100",
              )}>
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
                      ? theme === "light"
                        ? "bg-neutral-900 text-white shadow-sm"
                        : "bg-white/[0.08] text-white shadow-inner-glow"
                      : theme === "light"
                        ? "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                        : "text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.04]",
                    item.highlight && !active && "text-moon-600",
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
            className={cn(
              "hidden lg:flex items-center gap-2 ml-2 rounded-xl border px-3 py-2 text-sm transition-colors w-56",
              theme === "light"
                ? "border-neutral-200 bg-neutral-50 text-neutral-500 hover:bg-neutral-100"
                : "border-white/[0.06] bg-white/[0.02] text-neutral-500 hover:bg-white/[0.04]",
            )}
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search tokens…</span>
            <kbd className={cn(
              "flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-mono",
              theme === "light" ? "bg-neutral-200 text-neutral-600" : "bg-white/[0.06] text-neutral-400",
            )}>
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>

          {/* Right cluster */}
          <div className="ml-auto flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className={cn(
                "btn-ghost text-xs !px-2.5 !py-2",
                theme === "light" && "hover:bg-neutral-200",
              )}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              title={`Theme: ${theme}`}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Network mode toggle */}
            <button
              onClick={handleModeToggle}
              className={cn(
                "btn-ghost text-xs !px-3",
                mode === "testnet" && "border-amber-500/30 text-amber-600",
              )}
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
          <div className={cn(
            "absolute inset-0 backdrop-blur-sm",
            theme === "light" ? "bg-neutral-900/40" : "bg-ink-950/80",
          )} />
          <div
            className={cn(
              "relative w-full max-w-xl p-2 animate-scale-in rounded-2xl border shadow-2xl",
              theme === "light"
                ? "bg-white border-neutral-200"
                : "bg-ink-900 border-white/[0.08]",
            )}
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
              <Search className={cn("h-4 w-4", theme === "light" ? "text-neutral-400" : "text-neutral-500")} />
              <input
                name="q"
                autoFocus
                placeholder="Search by name, symbol, or address…"
                className={cn(
                  "flex-1 bg-transparent text-sm placeholder:text-neutral-400 focus:outline-none",
                  theme === "light" ? "text-neutral-900" : "text-neutral-100",
                )}
              />
              <kbd className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-mono",
                theme === "light" ? "bg-neutral-200 text-neutral-600" : "bg-white/[0.06] text-neutral-400",
              )}>ESC</kbd>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Rocket, Search, Star, Plus, Command, Trophy, Wallet,
  Sun, Moon, Gift, Users, ChevronDown, LogOut,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect, useChainId } from "wagmi";
import { useNetworkMode } from "@/stores/networkMode";
import { useTheme } from "@/stores/theme";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import { chainMeta } from "@/config/chains";
import { useEffect, useState, useRef } from "react";
import { shortenAddress } from "@/lib/format";

const NAV = [
  { to: "/", label: "Explore", icon: Rocket },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/portfolio", label: "Portfolio", icon: Wallet },
  { to: "/create", label: "Launch", icon: Plus, highlight: true },
  { to: "/watchlist", label: "Watchlist", icon: Star },
];

export function Header() {
  const { pathname } = useLocation();
  const { mode, toggle: toggleMode } = useNetworkMode();
  const { theme, toggle: toggleTheme } = useTheme();
  const { isOnline } = useBackendHealth();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);

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
          "fixed top-0 left-0 right-0 z-50 safe-top transition-all duration-300",
          theme === "light"
            ? "bg-white/80 backdrop-blur-xl border-b border-neutral-200"
            : "header-blur border-b border-white/[0.06]",
        )}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link to="/" className="group flex items-center gap-2.5 shrink-0">
            <div className="relative h-8 w-8">
              <div className="absolute inset-0 rounded-xl bg-moon-gradient opacity-80 blur-[6px] group-hover:opacity-100 transition-opacity" />
              <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-moon-gradient shadow-glow">
                <Rocket className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="hidden sm:block">
              <span className={cn(
                "text-base font-bold tracking-tight font-display",
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
              "hidden lg:flex items-center gap-2 ml-2 rounded-xl border px-3 py-2 text-sm transition-colors w-48",
              theme === "light"
                ? "border-neutral-200 bg-neutral-50 text-neutral-500 hover:bg-neutral-100"
                : "border-white/[0.06] bg-white/[0.02] text-neutral-500 hover:bg-white/[0.04]",
            )}
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className={cn(
              "flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-mono",
              theme === "light" ? "bg-neutral-200 text-neutral-600" : "bg-white/[0.06] text-neutral-400",
            )}>
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>

          {/* Right cluster */}
          <div className="ml-auto flex items-center gap-2">
            {/* Backend health dot */}
            <div
              className={cn(
                "h-2.5 w-2.5 rounded-full transition-colors shrink-0",
                isOnline
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                  : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse",
              )}
              title={isOnline ? "Backend online" : "Backend offline"}
            />

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
              onClick={toggleMode}
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
                  mode === "mainnet" ? "bg-emerald-400" : "bg-amber-400",
                )}
              />
              {mode === "mainnet" ? "Mainnet" : "Testnet"}
            </button>

            {/* Single wallet button — ConnectButton when disconnected,
                custom dropdown when connected (no duplication) */}
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Spacer to offset fixed header */}
      <div className="h-14" />

      {/* Search modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] px-4 animate-fade-in"
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

/**
 * Single wallet button.
 * - When NOT connected: shows RainbowKit ConnectButton (opens modal).
 * - When connected: shows ONE custom button with wallet avatar + address + chevron,
 *   clicking opens dropdown with Claim Fees / Referrals / Disconnect.
 *   No duplication — the RainbowKit ConnectButton is NOT rendered when connected.
 */
function WalletButton() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { pathname } = useLocation();
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Not connected → show RainbowKit ConnectButton only
  if (!isConnected || !address) {
    return <ConnectButton showBalance={false} chainStatus="icon" />;
  }

  const meta = chainMeta[chainId];
  const menuItems = [
    { to: "/claim", label: "Claim Fees", icon: Gift },
    { to: "/referral", label: "Referrals", icon: Users },
  ];

  return (
    <div className="relative" ref={ref}>
      {/* Single button: avatar + address + chevron */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-sm transition-all",
          theme === "light"
            ? "border-neutral-200 bg-white hover:bg-neutral-50"
            : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]",
        )}
      >
        {/* Wallet avatar — gradient circle with first 2 chars of address */}
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-full bg-moon-gradient opacity-40 blur-[3px]" />
          <div className="relative h-7 w-7 rounded-full bg-moon-gradient flex items-center justify-center text-[10px] font-bold text-white">
            {address.slice(2, 4).toUpperCase()}
          </div>
        </div>

        {/* Address (hidden on mobile) */}
        <span className={cn(
          "hidden sm:inline font-mono text-xs",
          theme === "light" ? "text-neutral-700" : "text-neutral-300",
        )}>
          {shortenAddress(address, 4)}
        </span>

        {/* Chain indicator dot */}
        {meta && (
          <span
            className="h-2 w-2 rounded-full shrink-0 bg-moon-400"
            title={meta.label}
          />
        )}

        <ChevronDown className={cn(
          "h-3.5 w-3.5 transition-transform shrink-0",
          theme === "light" ? "text-neutral-400" : "text-neutral-500",
          open && "rotate-180",
        )} />
      </button>

      {/* Dropdown menu */}
      {open && (
        <div
          className={cn(
            "absolute top-full right-0 mt-2 w-56 rounded-xl border shadow-xl overflow-hidden animate-scale-in z-[60]",
            theme === "light"
              ? "bg-white border-neutral-200"
              : "bg-ink-900 border-white/[0.08]",
          )}
        >
          {/* Wallet address header */}
          <div className={cn(
            "px-4 py-3 border-b",
            theme === "light" ? "border-neutral-100" : "border-white/[0.04]",
          )}>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-moon-gradient flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                {address.slice(2, 4).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-neutral-500">Connected</p>
                <p className="text-xs font-mono truncate">
                  {shortenAddress(address, 5)}
                </p>
              </div>
            </div>
            {meta && (
              <p className="mt-1.5 text-[10px] text-neutral-500">
                {meta.label}
              </p>
            )}
          </div>

          {/* Menu items */}
          {menuItems.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors",
                  active
                    ? theme === "light"
                      ? "bg-neutral-100 text-neutral-900"
                      : "bg-white/[0.06] text-white"
                    : theme === "light"
                      ? "text-neutral-700 hover:bg-neutral-50"
                      : "text-neutral-300 hover:bg-white/[0.04]",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          {/* Disconnect */}
          <div className={cn("border-t", theme === "light" ? "border-neutral-100" : "border-white/[0.04]")}>
            <button
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-colors",
                theme === "light"
                  ? "text-red-600 hover:bg-red-50"
                  : "text-red-400 hover:bg-red-500/10",
              )}
            >
              <LogOut className="h-4 w-4" />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

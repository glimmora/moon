import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Rocket, Search, Star, Plus, Command, Trophy, Wallet,
  Sun, Moon, Gift, Users, ChevronDown, LogOut, Globe, Check,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { useNetworkMode } from "@/stores/networkMode";
import { useTheme } from "@/stores/theme";
import { useI18n, LOCALES, type TranslationKey } from "@/stores/i18n";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import { chainMeta } from "@/config/chains";
import { useEffect, useState, useRef } from "react";
import { shortenAddress } from "@/lib/format";

const NAV: { to: string; labelKey: TranslationKey; icon: typeof Rocket; highlight?: boolean }[] = [
  { to: "/", labelKey: "nav.discover", icon: Rocket },
  { to: "/leaderboard", labelKey: "nav.leaderboard", icon: Trophy },
  { to: "/create", labelKey: "nav.launch", icon: Plus, highlight: true },
];

export function Header() {
  const { pathname } = useLocation();
  const { theme, toggle: toggleTheme } = useTheme();
  const { t, locale, setLocale } = useI18n();
  const { isOnline } = useBackendHealth();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
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
                Mo<span className="text-gradient">on</span>
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 ml-2" aria-label="Primary">
            {NAV.map((item) => {
              const active = pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
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
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>

          {/* Search trigger (desktop) */}
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Open search (Command or Control K)"
            className={cn(
              "hidden lg:flex items-center gap-2 ml-2 rounded-xl border px-3 py-2 text-sm transition-colors w-48",
              theme === "light"
                ? "border-neutral-200 bg-neutral-50 text-neutral-500 hover:bg-neutral-100"
                : "border-white/[0.06] bg-white/[0.02] text-neutral-500 hover:bg-white/[0.04]",
            )}
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">{t("common.search")}…</span>
            <kbd className={cn(
              "flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-mono",
              theme === "light" ? "bg-neutral-200 text-neutral-600" : "bg-white/[0.06] text-neutral-400",
            )}>
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>

          {/* Right cluster */}
          <div className="ml-auto flex items-center gap-2">
            {/* Search trigger (mobile / tablet) */}
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search tokens"
              className={cn(
                "lg:hidden btn-ghost text-xs !px-2.5 !py-2",
                theme === "light" && "hover:bg-neutral-200",
              )}
              title="Search tokens"
            >
              <Search className="h-4 w-4" />
            </button>

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

            {/* Language switcher */}
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={langOpen}
                aria-label={t("common.language")}
                title={t("common.language")}
                className={cn(
                  "btn-ghost text-xs !px-2.5 !py-2 flex items-center gap-1",
                  theme === "light" && "hover:bg-neutral-200",
                )}
              >
                <Globe className="h-4 w-4" />
                <span className="uppercase text-[10px] font-semibold">{locale}</span>
              </button>
              {langOpen && (
                <div
                  role="menu"
                  aria-label={t("common.language")}
                  className="absolute top-full right-0 mt-1.5 w-44 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] shadow-xl overflow-hidden z-20 py-1"
                >
                  {LOCALES.map((l) => (
                    <button
                      key={l.value}
                      role="menuitem"
                      onClick={() => {
                        setLocale(l.value);
                        setLangOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-2 text-sm transition-colors text-left",
                        locale === l.value
                          ? "bg-moon-500/15 text-moon-300"
                          : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]",
                      )}
                      aria-current={locale === l.value ? "true" : undefined}
                    >
                      {l.label}
                      {locale === l.value && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Network + chain selector dropdown */}
            <NetworkDropdown />

            {/* Single wallet button */}
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Spacer */}
      <div className="h-14" />

      {/* Search modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] px-4 animate-fade-in"
          onClick={() => setSearchOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Search tokens"
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

/* ── Network + Chain Selector Dropdown ────────────────────────────── */
function NetworkDropdown() {
  const { mode, toggle: toggleMode, activeChainIds, selectedChainId, setSelectedChainId } = useNetworkMode();
  const { theme } = useTheme();
  const walletChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { address } = useAccount();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Find the current chain metadata (the chain the token lists are filtered to).
  const currentMeta = chainMeta[selectedChainId];
  const isTestnet = mode === "testnet";

  async function selectChain(chainId: number) {
    setOpen(false);
    // Always update the app-level selected chain (works without a wallet).
    setSelectedChainId(chainId);
    // If a wallet is connected on a different chain, also switch it (best-effort).
    if (address && walletChainId !== chainId) {
      try {
        await switchChainAsync({ chainId });
      } catch {
        // user rejected — the list filter still follows the selected chain.
      }
    }
  }

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Select network"
        className={cn(
          "flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all",
          isTestnet
            ? theme === "light"
              ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
              : "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15"
            : theme === "light"
              ? "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
              : "border-white/[0.08] bg-white/[0.03] text-neutral-300 hover:bg-white/[0.06]",
        )}
      >
        <Globe className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden sm:inline">
          {currentMeta?.shortLabel ?? (isTestnet ? "Testnet" : "Mainnet")}
        </span>
        <ChevronDown className={cn("h-3 w-3 transition-transform shrink-0", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          aria-label="Networks"
          className={cn(
            "absolute top-full right-0 mt-2 w-64 rounded-xl border shadow-xl overflow-hidden animate-scale-in z-[60]",
            theme === "light"
              ? "bg-white border-neutral-200"
              : "bg-ink-900 border-white/[0.08]",
          )}
        >
          {/* Mode toggle header */}
          <div className={cn(
            "flex items-center gap-1 p-1.5 border-b",
            theme === "light" ? "border-neutral-100" : "border-white/[0.04]",
          )}>
            <button
              onClick={() => { if (isTestnet) toggleMode(); }}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all",
                !isTestnet
                  ? theme === "light"
                    ? "bg-neutral-900 text-white"
                    : "bg-white/[0.1] text-white"
                  : theme === "light"
                    ? "text-neutral-500 hover:bg-neutral-100"
                    : "text-neutral-500 hover:bg-white/[0.04]",
              )}
            >
              Mainnet
            </button>
            <button
              onClick={() => { if (!isTestnet) toggleMode(); }}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all",
                isTestnet
                  ? theme === "light"
                    ? "bg-amber-500 text-white"
                    : "bg-amber-500/20 text-amber-300"
                  : theme === "light"
                    ? "text-neutral-500 hover:bg-neutral-100"
                    : "text-neutral-500 hover:bg-white/[0.04]",
              )}
            >
              Testnet
            </button>
          </div>

          {/* Chain list */}
          <div className="max-h-64 overflow-y-auto py-1">
            {activeChainIds.map((id) => {
              const meta = chainMeta[id];
              if (!meta) return null;
              const isActive = selectedChainId === id;
              return (
                <button
                  key={id}
                  role="menuitem"
                  onClick={() => selectChain(id)}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2 text-sm transition-colors text-left",
                    isActive
                      ? theme === "light"
                        ? "bg-neutral-100 text-neutral-900"
                        : "bg-white/[0.06] text-white"
                      : theme === "light"
                        ? "text-neutral-700 hover:bg-neutral-50"
                        : "text-neutral-300 hover:bg-white/[0.04]",
                  )}
                >
                  {/* Chain icon — colored dot with short label */}
                  <div className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg text-[9px] font-bold shrink-0",
                    isActive
                      ? "bg-moon-gradient text-white"
                      : theme === "light"
                        ? "bg-neutral-100 text-neutral-500"
                        : "bg-white/[0.04] text-neutral-500",
                  )}>
                    {meta.shortLabel.slice(0, 3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{meta.label}</p>
                    <p className="text-[10px] text-neutral-500">{meta.nativeSymbol} · Chain {id}</p>
                  </div>
                  {isActive && (
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer hint */}
          <div className={cn(
            "px-3 py-2 border-t text-[10px] text-neutral-500",
            theme === "light" ? "border-neutral-100" : "border-white/[0.04]",
          )}>
            {address
              ? "Selecting a chain will prompt your wallet to switch."
              : "Connect wallet to switch chains."}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Wallet Button (single, no duplication) ───────────────────────── */
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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Focus trap for keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      e.preventDefault();
      const items = Array.from(ref.current?.querySelectorAll<HTMLElement>("a[role=menuitem], button[role=menuitem]") || []);
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      const nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= items.length) {
        ref.current?.focus();
      } else {
        items[nextIndex].focus();
      }
    };
    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [open]);

  if (!isConnected || !address) {
    return <ConnectButton showBalance={false} chainStatus="icon" />;
  }

  const meta = chainId ? chainMeta[chainId] : undefined;
  const menuItems = [
    { to: "/claim", label: "Claim Fees", icon: Gift },
    { to: "/portfolio", label: "Portfolio", icon: Wallet },
    { to: "/watchlist", label: "Watchlist", icon: Star },
    { to: "/referral", label: "Referrals", icon: Users },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={cn(
          "flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-sm transition-all",
          theme === "light"
            ? "border-neutral-200 bg-white hover:bg-neutral-50"
            : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]",
        )}
      >
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-full bg-moon-gradient opacity-40 blur-[3px]" />
          <div className="relative h-7 w-7 rounded-full bg-moon-gradient flex items-center justify-center text-[10px] font-bold text-white">
            {address.slice(2, 4).toUpperCase()}
          </div>
        </div>
        <span className={cn(
          "hidden sm:inline font-mono text-xs",
          theme === "light" ? "text-neutral-700" : "text-neutral-300",
        )}>
          {shortenAddress(address, 4)}
        </span>
        {meta && (
          <span className="h-2 w-2 rounded-full shrink-0 bg-moon-400" title={meta.label} />
        )}
        <ChevronDown className={cn(
          "h-3.5 w-3.5 transition-transform shrink-0",
          theme === "light" ? "text-neutral-400" : "text-neutral-500",
          open && "rotate-180",
        )} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className={cn(
            "absolute top-full right-0 mt-2 w-56 rounded-xl border shadow-xl overflow-hidden animate-scale-in z-[60]",
            theme === "light"
              ? "bg-white border-neutral-200"
              : "bg-ink-900 border-white/[0.08]",
          )}
        >
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
                <p className="text-xs font-mono truncate">{shortenAddress(address, 5)}</p>
              </div>
            </div>
            {meta && <p className="mt-1.5 text-[10px] text-neutral-500">{meta.label}</p>}
          </div>

          {menuItems.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                role="menuitem"
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

          <div className={cn("border-t", theme === "light" ? "border-neutral-100" : "border-white/[0.04]")}>
            <button
              role="menuitem"
              onClick={() => { disconnect(); setOpen(false); }}
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

import { Link, useLocation } from "react-router-dom";
import { Rocket, Trophy, Plus, Star, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT, type TranslationKey } from "@/stores/i18n";

const NAV: { to: string; labelKey: TranslationKey; icon: typeof Rocket; primary?: boolean }[] = [
  { to: "/", labelKey: "nav.discover", icon: Rocket },
  { to: "/leaderboard", labelKey: "nav.leaderboard", icon: Trophy },
  { to: "/create", labelKey: "nav.launch", icon: Plus, primary: true },
  { to: "/watchlist", labelKey: "nav.watchlist", icon: Star },
  { to: "/portfolio", labelKey: "nav.portfolio", icon: Wallet },
];

export function MobileNav() {
  const { pathname } = useLocation();
  const t = useT();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none" aria-label="Primary">
      <div className="pointer-events-auto glass border-t border-[var(--border-subtle)] shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.6)] safe-bottom">
        <div className="px-3 safe-x max-w-lg mx-auto">
          <ul className="grid grid-cols-5 h-14">
            {NAV.map((item) => {
              const active = pathname === item.to;
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    aria-label={t(item.labelKey)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-all duration-250 ease-smooth active:scale-95 mt-[3px]",
                      active
                        ? "text-moon-500"
                        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-lg transition-all duration-300 ease-smooth",
                        active && item.primary && "bg-gradient-to-br from-moon-500 to-moon-700 text-white shadow-glow scale-110",
                        active && !item.primary && "bg-moon-500/15 scale-105",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </div>
                    {t(item.labelKey)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}

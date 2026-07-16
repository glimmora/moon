import { Link, useLocation } from "react-router-dom";
import { Rocket, Trophy, Plus, Star, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";

const NAV = [
  { to: "/", label: "Explore", icon: Rocket },
  { to: "/leaderboard", label: "Ranks", icon: Trophy },
  { to: "/create", label: "Launch", icon: Plus, primary: true },
  { to: "/watchlist", label: "Watch", icon: Star },
  { to: "/portfolio", label: "Wallet", icon: Wallet },
];

export function MobileNav() {
  const { pathname } = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-x safe-bottom px-3 pb-3 pt-2 pointer-events-none">
      <div className="mx-auto max-w-md pointer-events-auto">
        <div className="glass rounded-2xl shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.6)]">
          <ul className="grid grid-cols-5 h-14">
            {NAV.map((item) => {
              const active = pathname === item.to;
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all duration-250 ease-smooth",
                      active ? "text-moon-400" : "text-neutral-500 hover:text-neutral-300",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-300 ease-smooth",
                        active && item.primary && "bg-gradient-to-br from-moon-500 to-moon-700 text-white shadow-glow scale-110",
                        active && !item.primary && "bg-white/[0.08] scale-105",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    {item.label}
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

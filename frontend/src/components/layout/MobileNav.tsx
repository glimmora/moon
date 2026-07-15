import { Link, useLocation } from "react-router-dom";
import { Rocket, Plus, Star, Gift, Users } from "lucide-react";
import { cn } from "@/lib/cn";

const NAV = [
  { to: "/", label: "Explore", icon: Rocket },
  { to: "/create", label: "Launch", icon: Plus, primary: true },
  { to: "/watchlist", label: "Watch", icon: Star },
  { to: "/claim", label: "Claim", icon: Gift },
  { to: "/referral", label: "Refer", icon: Users },
];

export function MobileNav() {
  const { pathname } = useLocation();
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 safe-x safe-bottom px-3 pb-3 pt-2 pointer-events-none"
      aria-label="Mobile navigation"
    >
      <div className="mx-auto max-w-md pointer-events-auto">
        <div className="glass rounded-2xl shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.6)]">
          <ul className="grid grid-cols-5">
            {NAV.map((item) => {
              const active = pathname === item.to;
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-all duration-200",
                      active ? "text-moon-300" : "text-neutral-500 hover:text-neutral-300",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
                        active && item.primary && "bg-moon-gradient shadow-glow",
                        active && !item.primary && "bg-white/[0.08]",
                      )}
                    >
                      <Icon className={cn("h-4 w-4", active && item.primary && "text-white")} />
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

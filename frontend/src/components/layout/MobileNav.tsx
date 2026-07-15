import { Link, useLocation } from "react-router-dom";
import { Rocket, Plus, Star, Gift, Users } from "lucide-react";
import { cn } from "@/lib/cn";

const NAV = [
  { to: "/", label: "Explore", icon: Rocket },
  { to: "/create", label: "Launch", icon: Plus },
  { to: "/watchlist", label: "Watch", icon: Star },
  { to: "/claim", label: "Claim", icon: Gift },
  { to: "/referral", label: "Refer", icon: Users },
];

export function MobileNav() {
  const { pathname } = useLocation();
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]"
      aria-label="Mobile navigation"
    >
      <ul className="grid grid-cols-5">
        {NAV.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-moon-400" : "text-neutral-500",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

import { Link } from "react-router-dom";
import { Rocket, Compass, Trophy, Wallet, Star } from "lucide-react";

const QUICK_LINKS = [
  { to: "/", label: "Explore tokens", icon: Compass },
  { to: "/create", label: "Launch a token", icon: Rocket },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/portfolio", label: "Your portfolio", icon: Wallet },
  { to: "/watchlist", label: "Watchlist", icon: Star },
];

export function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center animate-fade-in-up">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-moon-gradient opacity-30 blur-2xl animate-glow-pulse" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-moon-gradient shadow-glow-lg">
          <Rocket className="h-12 w-12 text-white" />
        </div>
      </div>
      <h1 className="mt-6 text-6xl font-bold font-display text-gradient">404</h1>
      <p className="mt-3 text-[var(--text-secondary)] max-w-sm">
        This page drifted into the dark side of the moon.
      </p>
      <Link to="/" className="btn-primary mt-6">
        Back to Earth
      </Link>

      <nav aria-label="Quick links" className="mt-8 w-full max-w-md">
        <p className="mb-3 text-xs uppercase tracking-wider text-[var(--text-muted)]">Or jump to</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Icon className="h-4 w-4 text-moon-400 shrink-0" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

import { Link } from "react-router-dom";
import { Rocket } from "lucide-react";

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
      <p className="mt-3 text-neutral-400 max-w-sm">
        This page drifted into the dark side of the moon.
      </p>
      <Link to="/" className="btn-primary mt-6">
        Back to Earth
      </Link>
    </div>
  );
}

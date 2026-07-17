import { type ReactNode } from "react";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { PageTransition } from "@/components/transitions/PageTransition";
import { useTheme } from "@/stores/theme";
import { cn } from "@/lib/cn";

export function Layout({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <div className={cn(
      "relative min-h-screen flex flex-col overflow-x-hidden",
      isLight ? "bg-neutral-50 text-neutral-900" : "bg-ink-950 text-neutral-100",
    )}>
      {/* Skip link — first tab stop lets keyboard users jump past the nav. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-moon-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>
      {/* Aurora background blobs (subtle in light mode) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className={cn("aurora-blob h-[400px] w-[400px] -top-32 -left-20 animate-aurora", isLight ? "bg-moon-300/30" : "bg-moon-700/30")} />
        <div className={cn("aurora-blob h-[500px] w-[500px] top-1/3 -right-32 animate-aurora-slow", isLight ? "bg-pink-200/40" : "bg-pink-600/20")} />
        <div className={cn("aurora-blob h-[300px] w-[300px] bottom-20 left-1/3 animate-aurora", isLight ? "bg-amber-200/30" : "bg-amber-500/10")} />
        {/* Subtle grid overlay */}
        <div className={cn("absolute inset-0 bg-grid", isLight ? "opacity-30" : "opacity-40")} />
        {/* Vignette */}
        <div className={cn("absolute inset-0 bg-gradient-to-b from-transparent via-transparent", isLight ? "to-neutral-50" : "to-ink-950")} />
      </div>

      {/* Header is fixed and always-on-top — no wrapper needed */}
      <Header />

      {/* Main content — z-10 to stay above background */}
      <div className="relative z-10 flex flex-col flex-1">
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-28 md:pb-12 pt-2">
          <PageTransition>{children}</PageTransition>
        </main>
        <footer className={cn(
          "relative z-10 mt-auto border-t py-6",
          isLight ? "border-neutral-200" : "border-white/[0.06]",
        )}>
          <div className={cn(
            "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs",
            isLight ? "text-neutral-500" : "text-neutral-500",
          )}>
            <p>
              moon.fun — permissionless meme-token launchpad.{" "}
              <a
                href="https://github.com/glimmora/moon"
                className={isLight ? "text-moon-600 hover:text-moon-700 hover:underline" : "text-moon-400 hover:text-moon-300 hover:underline"}
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
            </p>
            <p className="opacity-60">Always DYOR. Tokens are volatile and may go to zero.</p>
          </div>
        </footer>
        <MobileNav />
      </div>
    </div>
  );
}

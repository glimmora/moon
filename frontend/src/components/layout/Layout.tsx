import { type ReactNode } from "react";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { PageTransition } from "@/components/transitions/PageTransition";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col bg-ink-950 overflow-x-hidden">
      {/* Aurora background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="aurora-blob bg-moon-700/30 h-[400px] w-[400px] -top-32 -left-20 animate-aurora" />
        <div className="aurora-blob bg-pink-600/20 h-[500px] w-[500px] top-1/3 -right-32 animate-aurora-slow" />
        <div className="aurora-blob bg-amber-500/10 h-[300px] w-[300px] bottom-20 left-1/3 animate-aurora" />
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 bg-grid opacity-40" />
        {/* Vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink-950" />
      </div>

      {/* Header is always-on-top via sticky + z-50, wrapped in relative z-40 */}
      <div className="relative z-40">
        <Header />
      </div>

      <div className="relative z-10 flex flex-col flex-1">
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-28 md:pb-12 pt-2">
          <PageTransition>{children}</PageTransition>
        </main>
        <footer className="relative z-10 mt-auto border-t border-white/[0.06] py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-500">
            <p>
              moon.fun — permissionless meme-token launchpad.{" "}
              <a
                href="https://github.com/glimmora/moon"
                className="text-moon-400 hover:text-moon-300 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
            </p>
            <p className="text-neutral-600">Always DYOR. Tokens are volatile and may go to zero.</p>
          </div>
        </footer>
        <MobileNav />
      </div>
    </div>
  );
}

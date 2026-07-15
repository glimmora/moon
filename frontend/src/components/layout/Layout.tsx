import { type ReactNode } from "react";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-950">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 md:pb-8">
        {children}
      </main>
      <footer className="mt-auto border-t border-neutral-800 py-6 text-center text-xs text-neutral-500">
        <p>
          moon.fun — permissionless meme-token launchpad.{" "}
          <a
            href="https://github.com/glimmora/moon"
            className="text-moon-400 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </p>
        <p className="mt-1">Always DYOR. Tokens are volatile and may go to zero.</p>
      </footer>
      <MobileNav />
    </div>
  );
}

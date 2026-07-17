import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

/**
 * Wraps page content with a smooth enter animation on every route change.
 * Uses the native View Transitions API when available (Chrome 111+, Edge 111+),
 * and falls back to a CSS keyframe animation otherwise.
 *
 * Usage: drop `<PageTransition>` around the `<Outlet />` in your Layout.
 */
function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [visible, setVisible] = useState(true);
  const firstRender = useRef(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    // Reset scroll to the top and move focus into the new page so keyboard and
    // screen-reader users land at the start of the fresh content on navigation.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    requestAnimationFrame(() => containerRef.current?.focus({ preventScroll: true }));

    if (prefersReducedMotion()) {
      setVisible(true);
      return;
    }

    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> };
    };

    if (typeof doc.startViewTransition === "function") {
      const transition = doc.startViewTransition(() => {
        setVisible(false);
        requestAnimationFrame(() => setVisible(true));
      });
      transition.finished.catch(() => {});
    } else {
      setVisible(false);
      const id = setTimeout(() => setVisible(true), 80);
      return () => clearTimeout(id);
    }
  }, [location.pathname]);

  return (
    <div
      ref={containerRef}
      id="main-content"
      tabIndex={-1}
      key={location.pathname + (visible ? "-on" : "-off")}
      className={`outline-none ${visible ? "animate-page-enter" : "opacity-0"}`}
      style={{ willChange: "opacity, transform" }}
    >
      {children}
    </div>
  );
}

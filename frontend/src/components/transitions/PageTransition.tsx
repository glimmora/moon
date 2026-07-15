import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

/**
 * Wraps page content with a smooth enter animation on every route change.
 * Uses the native View Transitions API when available (Chrome 111+, Edge 111+),
 * and falls back to a CSS keyframe animation otherwise.
 *
 * Usage: drop `<PageTransition>` around the `<Outlet />` in your Layout.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [visible, setVisible] = useState(true);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
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
      key={location.pathname + (visible ? "-on" : "-off")}
      className={visible ? "animate-page-enter" : "opacity-0"}
      style={{ willChange: "opacity, transform" }}
    >
      {children}
    </div>
  );
}

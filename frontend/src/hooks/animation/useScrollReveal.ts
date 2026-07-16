import { useEffect, useRef, useState } from "react";

interface ScrollRevealOptions {
  threshold?: number;
  once?: boolean;
  rootMargin?: string;
}

interface ScrollRevealResult {
  ref: React.RefObject<HTMLDivElement>;
  visible: boolean;
}

/**
 * Triggers a CSS animation when the element scrolls into view.
 * Pair with `animate-fade-in-up` / `animate-scale-in` etc. classes.
 */
export function useScrollReveal({
  threshold = 0.15,
  once = true,
  rootMargin = "0px 0px -10% 0px",
}: ScrollRevealOptions = {}): ScrollRevealResult {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once, rootMargin]);

  return { ref, visible };
}

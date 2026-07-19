import { useEffect, useState } from "react";
import { type ReactNode, type CSSProperties } from "react";
import { useScrollReveal } from "@/hooks/animation/useScrollReveal";
import { cn } from "@/lib/cn";

interface RevealProps {
  children: ReactNode;
  variant?: "up" | "down" | "left" | "right" | "scale" | "fade";
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section" | "article";
}

const variantAnim: Record<NonNullable<RevealProps["variant"]>, string> = {
  up: "animate-fade-in-up",
  down: "animate-fade-in-down",
  left: "animate-fade-in-left",
  right: "animate-fade-in-right",
  scale: "animate-scale-in",
  fade: "animate-fade-in",
};

/**
 * Wraps children with a scroll-triggered reveal animation.
 * Falls back to visible after 2s if observer fails (JS disabled / error).
 */
export function Reveal({ children, variant = "up", delay = 0, className, as = "div" }: RevealProps) {
  const { ref, visible } = useScrollReveal();
  const [fallbackVisible, setFallbackVisible] = useState(false);
  const Tag = as as "div";
  const style: CSSProperties | undefined = delay > 0 ? { animationDelay: `${delay}ms` } : undefined;

  // Fallback: force visibility after 2s if scroll observer never fires
  useEffect(() => {
    const timer = setTimeout(() => setFallbackVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn(fallbackVisible || visible ? variantAnim[variant] : "opacity-0", className)}
      style={style}
    >
      {children}
    </Tag>
  );
}

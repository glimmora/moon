import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  disabled?: boolean;
  tabular?: boolean;
  groupSeparator?: boolean;
  className?: string;
}

/**
 * Smoothly animates a number from its previous value to the new value using
 * an ease-out cubic curve. Uses requestAnimationFrame so it never janks.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 800,
  disabled = false,
  tabular = true,
  groupSeparator = true,
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const fromRef = useRef<number>(value);

  useEffect(() => {
    if (disabled) {
      setDisplay(value);
      return;
    }
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const from = fromRef.current;
    const to = value;
    const delta = to - from;

    if (Math.abs(delta) < 0.0001) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }

    startRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + delta * eased;
      setDisplay(next);
      fromRef.current = next;

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(to);
        fromRef.current = to;
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, disabled]);

  const formatted = formatNumber(display, decimals, groupSeparator);

  return (
    <span className={`${tabular ? "tabular" : ""} ${className ?? ""}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

function formatNumber(n: number, decimals: number, group: boolean): string {
  if (!isFinite(n)) return "0";
  if (decimals === 0) {
    const rounded = Math.round(n);
    return group ? rounded.toLocaleString("en-US") : String(rounded);
  }
  const fixed = n.toFixed(decimals);
  if (!group) return fixed;
  const [intPart, decPart] = fixed.split(".");
  return Number(intPart).toLocaleString("en-US") + (decPart ? "." + decPart : "");
}

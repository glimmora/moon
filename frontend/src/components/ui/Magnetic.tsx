import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface MagneticProps {
  children: ReactNode;
  strength?: number;
  className?: string;
  disableOnTouch?: boolean;
}

/**
 * Wraps any element with a "magnetic" effect — the element translates towards
 * the cursor on hover, then springs back on leave. Disabled on touch devices.
 */
export function Magnetic({ children, strength = 0.3, className, disableOnTouch = true }: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const isTouch =
    disableOnTouch &&
    typeof window !== "undefined" &&
    ("ontouchstart" in window || navigator.maxTouchPoints > 0);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (isTouch || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    setPos({ x: x * strength, y: y * strength });
  }

  function handleLeave() {
    setPos({ x: 0, y: 0 });
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={cn("inline-block transition-transform duration-300 ease-smooth", className)}
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
}

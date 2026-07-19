import { useState } from "react";
import { cn } from "@/lib/cn";

interface AvatarProps {
  src?: string;
  alt: string;
  size?: number;
  className?: string;
  shape?: "square" | "circle";
}

/**
 * Square token avatar with a theme-aware fallback glyph when no image is
 * available (or the image fails to load). Fixes the previous dark-only
 * `bg-ink-900` fallback so it reads correctly in light mode.
 */
export function Avatar({ src, alt, size = 40, className, shape = "square" }: AvatarProps) {
  const [errored, setErrored] = useState(false);
  const showImage = src && !errored;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-[var(--border-subtle)]",
        shape === "circle" ? "rounded-full" : "rounded-xl",
        "avatar-fallback",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setErrored(true)}
          loading="lazy"
        />
      ) : (
        <span
          className="font-display font-semibold text-[var(--text-secondary)]"
          style={{ fontSize: Math.max(12, size * 0.4) }}
        >
          {alt.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

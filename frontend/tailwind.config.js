/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        moon: {
          50: "#fdf4ff",
          100: "#fae8ff",
          200: "#f5d0fe",
          300: "#f0abfc",
          400: "#e879f9",
          500: "#d946ef",
          600: "#c026d3",
          700: "#a21caf",
          800: "#86198f",
          900: "#701a75",
          950: "#4a044e",
        },
        // Modern deep-space background palette
        ink: {
          950: "#07060d",
          925: "#0b0a14",
          900: "#100e1c",
          850: "#16142a",
          800: "#1d1b38",
        },
        // Accent neon colors for modern feel
        neon: {
          purple: "#a855f7",
          pink: "#ec4899",
          cyan: "#06b6d4",
          green: "#10b981",
          amber: "#f59e0b",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        display: ["Space Grotesk", "Inter", "sans-serif"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "moon-gradient": "linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f59e0b 100%)",
        "glass-gradient": "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
      },
      boxShadow: {
        glow: "0 0 20px rgba(168, 85, 247, 0.35)",
        "glow-lg": "0 0 40px rgba(168, 85, 247, 0.45)",
        "glow-pink": "0 0 24px rgba(236, 72, 153, 0.4)",
        "glow-green": "0 0 20px rgba(16, 185, 129, 0.35)",
        "glow-red": "0 0 20px rgba(239, 68, 68, 0.35)",
        "inner-glow": "inset 0 1px 0 0 rgba(255,255,255,0.06)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s ease-in-out",
        "fade-in-up": "fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in": "scaleIn 0.2s ease-out",
        "slide-up": "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "shimmer": "shimmer 2s linear infinite",
        "aurora": "aurora 18s ease-in-out infinite",
        "aurora-slow": "aurora 30s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "spark": "spark 1.5s ease-in-out infinite",
        "glow-pulse": "glowPulse 2.5s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        aurora: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)", opacity: "0.5" },
          "33%": { transform: "translate(30px, -30px) scale(1.1)", opacity: "0.7" },
          "66%": { transform: "translate(-20px, 20px) scale(0.95)", opacity: "0.4" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        spark: {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.2)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(168, 85, 247, 0.25)" },
          "50%": { boxShadow: "0 0 36px rgba(168, 85, 247, 0.55)" },
        },
      },
    },
  },
  plugins: [],
};

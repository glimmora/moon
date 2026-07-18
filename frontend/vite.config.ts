import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Only env vars with these prefixes are exposed to import.meta.env in the
  // browser bundle. Frontend-only vars use FRONTEND_, blockchain data (RPC
  // URLs + contract addresses) uses CHAIN_, and E2E test flags use E2E_.
  // All other env vars (BACKEND_*, DB_*, AUTH_*, etc.) stay server-side only.
  envPrefix: ["FRONTEND_", "CHAIN_", "E2E_"],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: "es2020",
    // No source maps in production builds — smaller output, no source leakage.
    sourcemap: process.env.NODE_ENV !== "production",
    // Allow unavoidable large chunks (wallet/metamask-sdk) so build output
    // stays clean.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Split heavy vendor libs into separate chunks for better caching and
        // smaller initial bundle.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          wallet: ["wagmi", "viem", "@rainbow-me/rainbowkit"],
          query: ["@tanstack/react-query"],
          icons: ["lucide-react"],
        },
      },
    },
  },
});

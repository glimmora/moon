import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
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

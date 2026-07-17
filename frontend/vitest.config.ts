import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    // Pure-logic tests default to node; component/hook tests opt into jsdom via a
    // per-file `// @vitest-environment jsdom` directive.
    environment: "node",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    setupFiles: ["test/setup.ts"],
    globals: true,
    passWithNoTests: true,
  },
});

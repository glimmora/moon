import { afterEach, expect, vi } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

// jest-dom matchers are only meaningful under jsdom, but importing them is
// harmless in node — they simply won't be exercised by node-env suites.
expect.extend(matchers);

// jsdom doesn't implement matchMedia; the ThemeProvider reads it for
// system-preference detection, so provide a stub for component tests.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(async () => {
  // Best-effort DOM cleanup between component tests (no-op in node env).
  try {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
  } catch {
    /* not a DOM test */
  }
});

import { afterEach, expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

// jest-dom matchers are only meaningful under jsdom, but importing them is
// harmless in node — they simply won't be exercised by node-env suites.
expect.extend(matchers);

afterEach(async () => {
  // Best-effort DOM cleanup between component tests (no-op in node env).
  try {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
  } catch {
    /* not a DOM test */
  }
});

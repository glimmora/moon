// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, renderHook } from "@testing-library/react";
import { ToastProvider, useToast, type ToastContextValue } from "../src/stores/toast";

/**
 * Render the provider once and capture its context value via a child component,
 * so toasts fired through `api` render into the same DOM tree that `screen`
 * queries.
 */
function setup() {
  const ref: { api: ToastContextValue | null } = { api: null };
  function Capture() {
    ref.api = useToast();
    return null;
  }
  render(
    <ToastProvider>
      <Capture />
    </ToastProvider>,
  );
  return ref as { api: ToastContextValue };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe("useToast outside provider", () => {
  it("throws a helpful error", () => {
    expect(() => renderHook(() => useToast())).toThrow(/ToastProvider/);
  });
});

describe("toast lifecycle", () => {
  it("renders a success toast and auto-dismisses after duration", () => {
    const ref = setup();
    act(() => {
      ref.api.success("Saved", { description: "All good" });
    });
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("All good")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("loading toasts persist and can be promoted via update", () => {
    const ref = setup();
    let id = 0;
    act(() => {
      id = ref.api.loading("Working");
    });
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("Working")).toBeInTheDocument();
    // Promote to success without overriding duration: the toast retains the
    // loading toast's 60s duration (real app behavior when updating in place).
    act(() => ref.api.update(id, { type: "success", title: "Done" }));
    expect(screen.getByText("Done")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("Done")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(60000));
    expect(screen.queryByText("Done")).toBeNull();
  });

  it("error toasts use role=alert and an 8s duration", () => {
    const ref = setup();
    act(() => {
      ref.api.error("Boom");
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("Boom")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByText("Boom")).toBeNull();
  });

  it("dismiss removes a toast immediately", () => {
    const ref = setup();
    let id = 0;
    act(() => {
      id = ref.api.info("Note");
    });
    expect(screen.getByText("Note")).toBeInTheDocument();
    act(() => ref.api.dismiss(id));
    expect(screen.queryByText("Note")).toBeNull();
  });

  it("supports the legacy (title, description) string signature", () => {
    const ref = setup();
    act(() => {
      ref.api.success("Title", "legacy description");
    });
    expect(screen.getByText("legacy description")).toBeInTheDocument();
  });
});

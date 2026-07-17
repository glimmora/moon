import { useEffect } from "react";
import { useConnect, useAccount } from "wagmi";
import { isE2E } from "@/config/e2eConnector";

/**
 * TEST-ONLY: auto-connects the local E2E private-key connector on mount so
 * Playwright specs start in a connected state without driving the RainbowKit
 * modal. Renders (and does anything) only when `VITE_E2E === "true"`.
 */
export function E2EAutoConnect() {
  const { connect, connectors } = useConnect();
  const { isConnected } = useAccount();

  useEffect(() => {
    if (!isE2E || isConnected) return;
    const mock = connectors.find((c) => c.id === "e2e-mock");
    if (mock) connect({ connector: mock });
  }, [connect, connectors, isConnected]);

  return null;
}

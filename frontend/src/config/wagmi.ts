import { createConfig, http, fallback, createStorage } from "wagmi";
import { getDefaultWallets, darkTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import type { Chain } from "wagmi/chains";
import { moonChains } from "./chains";
import { e2eConnectors } from "./e2eConnector";

const rawProjectId = import.meta.env.FRONTEND_WALLETCONNECT_PROJECT_ID?.trim();

// Legacy placeholder values that must not be treated as a real projectId.
const PLACEHOLDERS = new Set(["", "moon-fun-demo", "demo", "YOUR_PROJECT_ID"]);

/**
 * WalletConnect (and RainbowKit's WC-based connectors) need a real projectId
 * from https://cloud.walletconnect.com. Without it, mobile/QR wallet
 * connections fail. We detect placeholder/missing ids and surface a flag so the
 * UI can hint users while injected/browser wallets keep working.
 */
export const isWalletConnectEnabled = Boolean(rawProjectId && !PLACEHOLDERS.has(rawProjectId));

// RainbowKit requires a non-empty projectId string; fall back to a clearly-fake
// one when unconfigured so the app still boots with injected wallets.
const projectId = isWalletConnectEnabled ? (rawProjectId as string) : "00000000000000000000000000000000";

if (!isWalletConnectEnabled) {
  console.warn(
    "[Moon] WalletConnect is disabled — no valid FRONTEND_WALLETCONNECT_PROJECT_ID set. " +
      "Mobile/QR wallets will not work. Injected/browser wallets are unaffected. " +
      "Get a projectId at https://cloud.walletconnect.com.",
  );
}

// RainbowKit v2 + wagmi v2: connectors no longer take `chains`; chains are
// passed only to createConfig. The empty-array cast satisfies the tuple type.
const { connectors } = getDefaultWallets({
  appName: "Moon",
  projectId,
});

const typedChains = moonChains as unknown as readonly [Chain, ...Chain[]];

// In E2E mode, prepend a local private-key connector so Playwright can sign and
// broadcast without a browser wallet. Returns [] (no-op) in normal builds.
const allConnectors = [...e2eConnectors(), ...connectors];

export const wagmiConfig = createConfig({
  chains: typedChains,
  connectors: allConnectors,
  transports: Object.fromEntries(
    moonChains.map((c) => [c.id, fallback(c.rpcUrls.default.http.map((url) => http(url)))]),
  ),
  ssr: false,
  storage: createStorage({ storage: localStorage, key: "Moon.wagmi" }),
  multiInjectedProviderDiscovery: true,
});

export { darkTheme, RainbowKitProvider };

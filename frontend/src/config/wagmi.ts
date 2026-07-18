import { createConfig, http, fallback, createStorage } from "wagmi";
import { getDefaultWallets, darkTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import type { Chain } from "wagmi/chains";
import { moonChains } from "./chains";
import { e2eConnectors } from "./e2eConnector";

const projectId = import.meta.env.FRONTEND_WALLETCONNECT_PROJECT_ID ?? "moon-fun-demo";

// WalletConnect (and RainbowKit's WC-based connectors) need a real projectId from
// https://cloud.walletconnect.com. Without it, mobile/QR wallet connections fail.
if (projectId === "moon-fun-demo") {
  console.warn(
    "[moon.fun] Using a placeholder WalletConnect projectId. " +
      "Set FRONTEND_WALLETCONNECT_PROJECT_ID for reliable wallet connections.",
  );
}

// RainbowKit v2 + wagmi v2: connectors no longer take `chains`; chains are
// passed only to createConfig. The empty-array cast satisfies the tuple type.
const { connectors } = getDefaultWallets({
  appName: "moon.fun",
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
  storage: createStorage({ storage: localStorage, key: "moon.fun.wagmi" }),
  multiInjectedProviderDiscovery: true,
});

export { darkTheme, RainbowKitProvider };

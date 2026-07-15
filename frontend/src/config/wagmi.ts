import { createConfig, http } from "wagmi";
import { getDefaultWallets, darkTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { moonChains } from "./chains";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "moon-fun-demo";

// RainbowKit v2 + wagmi v2: connectors no longer take `chains`; chains are
// passed only to createConfig. The empty-array cast satisfies the tuple type.
const { connectors } = getDefaultWallets({
  appName: "moon.fun",
  projectId,
});

export const wagmiConfig = createConfig({
  chains: moonChains as unknown as typeof moonChains & readonly [typeof moonChains[number], ...typeof moonChains],
  connectors,
  transports: Object.fromEntries(
    moonChains.map((c) => [c.id, http(c.rpcUrls.default.http[0])]),
  ),
  ssr: false,
});

export { darkTheme, RainbowKitProvider };

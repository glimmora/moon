import { createConfig, http } from "wagmi";
import { getDefaultWallets, darkTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { moonChains } from "./chains";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "moon-fun-demo";

const { connectors } = getDefaultWallets({
  appName: "moon.fun",
  projectId,
  chains: moonChains,
});

export const wagmiConfig = createConfig({
  chains: moonChains,
  connectors,
  transports: Object.fromEntries(
    moonChains.map((c) => [c.id, http(c.rpcUrls.default.http[0])]),
  ),
  ssr: false,
});

export { darkTheme, RainbowKitProvider };

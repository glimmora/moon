import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "./App";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/config/wagmi";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { NetworkModeProvider } from "@/stores/networkMode";
import { ThemeProvider, useTheme } from "@/stores/theme";
import { ToastProvider } from "@/stores/toast";
import { WalletEventsWatcher } from "@/components/WalletEventsWatcher";

import "@rainbow-me/rainbowkit/styles.css";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/** Inner component that needs access to theme + wagmi context. */
function RainbowKitWithTheme({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <RainbowKitProvider
      theme={theme === "light" ? lightTheme() : darkTheme()}
      modalSize="compact"
    >
      {children}
    </RainbowKitProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RainbowKitWithTheme>
            <ToastProvider>
              <NetworkModeProvider>
                <BrowserRouter>
                  <WalletEventsWatcher />
                  <App />
                </BrowserRouter>
              </NetworkModeProvider>
            </ToastProvider>
          </RainbowKitWithTheme>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);

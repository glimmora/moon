import React, { Component, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "./App";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/config/wagmi";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { NetworkModeProvider } from "@/stores/networkMode";
import { ThemeProvider, useTheme } from "@/stores/theme";
import { I18nProvider } from "@/stores/i18n";
import { ToastProvider } from "@/stores/toast";
import { WalletEventsWatcher } from "@/components/WalletEventsWatcher";
import { E2EAutoConnect } from "@/components/E2EAutoConnect";

import "@rainbow-me/rainbowkit/styles.css";
import "./index.css";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-ink-950 p-8">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-bold text-red-400">Something went wrong</h1>
            <p className="text-sm text-neutral-400 break-words font-mono">{this.state.error.message}</p>
            <button className="btn-primary" onClick={() => this.setState({ error: null })}>Try again</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
// eslint-disable-next-line react-refresh/only-export-components
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
        <ErrorBoundary>
          <ThemeProvider>
            <I18nProvider>
            <RainbowKitWithTheme>
              <ToastProvider>
                <NetworkModeProvider>
                  <BrowserRouter>
                    <WalletEventsWatcher />
                    <E2EAutoConnect />
                    <App />
                  </BrowserRouter>
                </NetworkModeProvider>
              </ToastProvider>
            </RainbowKitWithTheme>
            </I18nProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);

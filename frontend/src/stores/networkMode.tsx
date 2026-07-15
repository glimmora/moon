import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { type NetworkMode, getActiveChainIds } from "@/config/chains";

interface NetworkModeContextValue {
  mode: NetworkMode;
  setMode: (m: NetworkMode) => void;
  activeChainIds: number[];
  toggle: () => void;
}

const NetworkModeContext = createContext<NetworkModeContextValue | undefined>(undefined);

const STORAGE_KEY = "moon.fun.networkMode";

export function NetworkModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<NetworkMode>(() => {
    if (typeof window === "undefined") return "mainnet";
    const saved = window.localStorage.getItem(STORAGE_KEY) as NetworkMode | null;
    return saved ?? "mainnet";
  });

  const setMode = (m: NetworkMode) => {
    setModeState(m);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, m);
    }
  };

  const toggle = () => setMode(mode === "mainnet" ? "testnet" : "mainnet");

  useEffect(() => {
    document.documentElement.dataset.networkMode = mode;
  }, [mode]);

  const value: NetworkModeContextValue = {
    mode,
    setMode,
    activeChainIds: getActiveChainIds(mode),
    toggle,
  };

  return <NetworkModeContext.Provider value={value}>{children}</NetworkModeContext.Provider>;
}

export function useNetworkMode(): NetworkModeContextValue {
  const ctx = useContext(NetworkModeContext);
  if (!ctx) throw new Error("useNetworkMode must be used within NetworkModeProvider");
  return ctx;
}

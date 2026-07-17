import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { type NetworkMode, getActiveChainIds } from "@/config/chains";

interface NetworkModeContextValue {
  mode: NetworkMode;
  setMode: (m: NetworkMode) => void;
  activeChainIds: number[];
  toggle: () => void;
  /** The default chain ID for the current mode (first active chain). */
  defaultChainId: number;
}

const NetworkModeContext = createContext<NetworkModeContextValue | undefined>(undefined);

const STORAGE_KEY = "moon.fun.networkMode";

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return (window.localStorage.getItem(key) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private browsing or quota exceeded — silently ignore.
  }
}

export function NetworkModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<NetworkMode>(() =>
    safeRead<NetworkMode>(STORAGE_KEY, "testnet"),
  );

  const setMode = (m: NetworkMode) => {
    setModeState(m);
    safeWrite(STORAGE_KEY, m);
  };

  const toggle = () => setMode(mode === "mainnet" ? "testnet" : "mainnet");

  useEffect(() => {
    document.documentElement.dataset.networkMode = mode;
  }, [mode]);

  const activeChainIds = getActiveChainIds(mode);
  const defaultChainId = activeChainIds[0];

  const value: NetworkModeContextValue = {
    mode,
    setMode,
    activeChainIds,
    defaultChainId,
    toggle,
  };

  return <NetworkModeContext.Provider value={value}>{children}</NetworkModeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNetworkMode(): NetworkModeContextValue {
  const ctx = useContext(NetworkModeContext);
  if (!ctx) throw new Error("useNetworkMode must be used within NetworkModeProvider");
  return ctx;
}

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { type NetworkMode, getActiveChainIds } from "@/config/chains";

interface NetworkModeContextValue {
  mode: NetworkMode;
  setMode: (m: NetworkMode) => void;
  activeChainIds: number[];
  toggle: () => void;
  /** The default chain ID for the current mode (first active chain). */
  defaultChainId: number;
  /** The chain the token lists are currently filtered to. Always within activeChainIds. */
  selectedChainId: number;
  setSelectedChainId: (id: number) => void;
}

const NetworkModeContext = createContext<NetworkModeContextValue | undefined>(undefined);

const STORAGE_KEY = "Moon.networkMode";
const SELECTED_CHAIN_KEY = "Moon.selectedChainId";

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

  const [selectedChainRaw, setSelectedChainRaw] = useState<number>(() => {
    const stored = Number(safeRead<string>(SELECTED_CHAIN_KEY, ""));
    if (Number.isInteger(stored) && stored > 0) return stored;
    // Default to a populated testnet (Eth Sepolia) so the home feed isn't empty
    // before the user picks a chain.
    const ids = getActiveChainIds(safeRead<NetworkMode>(STORAGE_KEY, "testnet"));
    return ids.includes(11155111) ? 11155111 : ids[0];
  });

  const setMode = (m: NetworkMode) => {
    setModeState(m);
    safeWrite(STORAGE_KEY, m);
    // Keep the selected chain valid (and populated) for the new mode.
    const ids = getActiveChainIds(m);
    const preferred = m === "testnet" && ids.includes(11155111) ? 11155111 : ids[0];
    if (!ids.includes(selectedChainRaw)) {
      setSelectedChainRaw(preferred);
      safeWrite(SELECTED_CHAIN_KEY, String(preferred));
    }
  };

  const toggle = () => setMode(mode === "mainnet" ? "testnet" : "mainnet");

  const setSelectedChainId = (id: number) => {
    setSelectedChainRaw(id);
    safeWrite(SELECTED_CHAIN_KEY, String(id));
  };

  useEffect(() => {
    document.documentElement.dataset.networkMode = mode;
  }, [mode]);

  const activeChainIds = getActiveChainIds(mode);
  const defaultChainId = activeChainIds[0];
  // Sanitize: the selected chain must belong to the current mode.
  const selectedChainId = activeChainIds.includes(selectedChainRaw)
    ? selectedChainRaw
    : defaultChainId;

  const value: NetworkModeContextValue = {
    mode,
    setMode,
    activeChainIds,
    defaultChainId,
    selectedChainId,
    setSelectedChainId,
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

/** The chain the token lists are currently filtered to (validated for the active mode). */
// eslint-disable-next-line react-refresh/only-export-components
export function useSelectedChainId(): number {
  return useNetworkMode().selectedChainId;
}

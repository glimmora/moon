import { useWalletEvents } from "@/hooks/useWalletEvents";

/**
 * Invisible component that mounts the wallet events watcher.
 * Place once near the root of the app.
 */
export function WalletEventsWatcher() {
  useWalletEvents();
  return null;
}

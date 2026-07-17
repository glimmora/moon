import { chainMeta } from "@/config/chains";

/** Base block-explorer URL for a chain, without trailing slash. */
function explorerBase(chainId: number): string | undefined {
  const base = chainMeta[chainId]?.explorer;
  return base ? base.replace(/\/$/, "") : undefined;
}

/** Block-explorer URL for a transaction hash, or undefined if the chain is unknown. */
export function txUrl(chainId: number, hash: string): string | undefined {
  const base = explorerBase(chainId);
  return base ? `${base}/tx/${hash}` : undefined;
}

/** Block-explorer URL for an address, or undefined if the chain is unknown. */
export function addressUrl(chainId: number, address: string): string | undefined {
  const base = explorerBase(chainId);
  return base ? `${base}/address/${address}` : undefined;
}

/** Block-explorer URL for a token contract, or undefined if the chain is unknown. */
export function tokenUrl(chainId: number, address: string): string | undefined {
  const base = explorerBase(chainId);
  return base ? `${base}/token/${address}` : undefined;
}

/** Human-friendly explorer name for a chain (e.g. "BscScan"), falling back to "explorer". */
export function explorerName(chainId: number): string {
  const meta = chainMeta[chainId];
  if (meta?.explorerApi) return meta.explorerApi;
  if (meta?.explorer) {
    try {
      const host = new URL(meta.explorer).hostname.replace(/^www\./, "");
      return host;
    } catch {
      /* fall through */
    }
  }
  return "explorer";
}

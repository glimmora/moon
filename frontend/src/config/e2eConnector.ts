import { createConnector } from "wagmi";
import {
  createWalletClient,
  http,
  createPublicClient,
  type Transport,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { moonChains } from "./chains";

/**
 * TEST-ONLY wallet connector.
 *
 * Activated exclusively when `VITE_E2E === "true"`. It backs a wagmi connector
 * with a local viem private-key account so Playwright can drive the full
 * signing/broadcast path with no browser wallet extension. The private key is
 * supplied at build/serve time via `VITE_E2E_PRIVATE_KEY` and MUST only ever be
 * a throwaway/testnet key — never a production secret.
 *
 * This module is a no-op in normal builds: `e2eConnectors()` returns `[]` unless
 * the E2E flag is set, so it can never ship an auto-connecting hot wallet to
 * real users.
 */

const E2E_ENABLED = import.meta.env.VITE_E2E === "true";

function normalizePk(raw: string): Hex {
  const v = raw.trim();
  return (v.startsWith("0x") ? v : `0x${v}`) as Hex;
}

/** Build an EIP-1193 provider backed by a local viem PK account. */
function buildProvider() {
  const pk = import.meta.env.VITE_E2E_PRIVATE_KEY as string | undefined;
  if (!pk) throw new Error("[e2e] VITE_E2E_PRIVATE_KEY is required when VITE_E2E=true");
  const account = privateKeyToAccount(normalizePk(pk));

  // Per-chain read/write clients so we can serve eth_* RPC and locally sign.
  const chainsById = new Map(moonChains.map((c) => [c.id, c]));
  let currentChainId = Number(import.meta.env.VITE_E2E_CHAIN_ID ?? moonChains[0]?.id ?? 11155111);

  function clientsFor(chainId: number) {
    const chain = chainsById.get(chainId) ?? moonChains[0];
    const transport: Transport = http(chain.rpcUrls.default.http[0]);
    return {
      chain,
      wallet: createWalletClient({ account, chain, transport }),
      pub: createPublicClient({ chain, transport }),
    };
  }

  const request = async ({ method, params }: { method: string; params?: unknown }) => {
    const { wallet, pub } = clientsFor(currentChainId);
    switch (method) {
      case "eth_requestAccounts":
      case "eth_accounts":
        return [account.address];
      case "eth_chainId":
        return `0x${currentChainId.toString(16)}`;
      case "wallet_switchEthereumChain": {
        const target = Number((params as [{ chainId: string }])[0].chainId);
        if (chainsById.has(target)) currentChainId = target;
        return null;
      }
      case "personal_sign": {
        const [message] = params as [Hex, string];
        return account.signMessage({ message: { raw: message } });
      }
      case "eth_signTypedData_v4": {
        const [, json] = params as [string, string];
        return account.signTypedData(JSON.parse(json));
      }
      case "eth_sendTransaction": {
        const [tx] = params as [
          {
            to?: Hex;
            data?: Hex;
            value?: Hex;
            gas?: Hex;
            from?: Hex;
          },
        ];
        return wallet.sendTransaction({
          account,
          to: tx.to,
          data: tx.data,
          value: tx.value ? BigInt(tx.value) : undefined,
          gas: tx.gas ? BigInt(tx.gas) : undefined,
          chain: clientsFor(currentChainId).chain,
        });
      }
      default:
        // Delegate all reads (eth_call, eth_getBalance, estimateGas, receipts…)
        // to the public client's underlying transport.
        return pub.request({ method, params } as never);
    }
  };

  return { account, request, getChainId: () => currentChainId };
}

/**
 * A wagmi connector using the local PK provider. Only instantiated under E2E.
 */
export function e2eConnector() {
  // The mock connector deliberately implements a minimal EIP-1193 surface. We
  // cast the callback return because wagmi's `CreateConnectorFn` uses complex
  // conditional generics (withCapabilities) that a hand-rolled test connector
  // doesn't need to satisfy structurally.
  return createConnector((config) => {
    const provider = buildProvider();
    const addr = provider.account.address as `0x${string}`;
    return {
      id: "e2e-mock",
      name: "E2E Test Wallet",
      type: "mock",
      async connect() {
        return { accounts: [addr], chainId: provider.getChainId() };
      },
      async disconnect() {},
      async getAccounts() {
        return [addr];
      },
      async getChainId() {
        return provider.getChainId();
      },
      async getProvider() {
        return { request: provider.request };
      },
      async isAuthorized() {
        return true;
      },
      async switchChain({ chainId }: { chainId: number }) {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${chainId.toString(16)}` }],
        });
        const chain = config.chains.find((c) => c.id === chainId) ?? config.chains[0];
        config.emitter.emit("change", { chainId });
        return chain;
      },
      onAccountsChanged() {},
      onChainChanged() {},
      onDisconnect() {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });
}

/** Returns the E2E connector list, or [] when not in E2E mode. */
export function e2eConnectors() {
  return E2E_ENABLED ? [e2eConnector()] : [];
}

export const isE2E = E2E_ENABLED;

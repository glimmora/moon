import { type BaseError, type ContractFunctionRevertedError } from "viem";

export type TxErrorKind =
  | "rejected"
  | "insufficient-funds"
  | "slippage"
  | "limits"
  | "cooldown"
  | "graduated"
  | "network"
  | "timeout"
  | "contract-revert"
  | "unknown";

export interface ExplainedError {
  /** Short headline suitable for a toast title. */
  title: string;
  /** One-line human explanation of what went wrong. */
  message: string;
  /** Actionable step the user can take to recover, if any. */
  recovery?: string;
  kind: TxErrorKind;
}

/** Map of on-chain custom-error names -> friendly explanations. */
const REVERT_MAP: Record<string, Omit<ExplainedError, "kind"> & { kind: TxErrorKind }> = {
  SlippageExceeded: {
    title: "Price moved too much",
    message: "The price changed before your transaction landed, so it would exceed your slippage tolerance.",
    recovery: "Increase your slippage tolerance or reduce the trade size, then try again.",
    kind: "slippage",
  },
  InsufficientQuote: {
    title: "Not enough to cover the trade",
    message: "The amount sent wasn't enough to complete this trade at the current price.",
    recovery: "Lower the amount or add more funds and try again.",
    kind: "insufficient-funds",
  },
  ExceedsMaxTx: {
    title: "Above the max transaction size",
    message: "This token limits how large a single trade can be (anti-whale protection).",
    recovery: "Try a smaller amount.",
    kind: "limits",
  },
  ExceedsMaxHold: {
    title: "Above the max wallet holding",
    message: "This token caps how much one wallet can hold (anti-whale protection).",
    recovery: "Buy a smaller amount so your total stays under the limit.",
    kind: "limits",
  },
  CooldownActive: {
    title: "Trade cooldown active",
    message: "This token enforces a short wait between trades from the same wallet.",
    recovery: "Wait for the cooldown to elapse, then try again.",
    kind: "cooldown",
  },
  AlreadyGraduated: {
    title: "Token has graduated",
    message: "This token has left the bonding curve and now trades on a DEX.",
    recovery: "Trade it on the DEX pair instead.",
    kind: "graduated",
  },
  NotGraduated: {
    title: "Token hasn't graduated yet",
    message: "This action is only available after the token graduates to a DEX.",
    kind: "graduated",
  },
  ZeroAmount: {
    title: "Amount must be greater than zero",
    message: "Enter an amount above zero to continue.",
    recovery: "Enter a valid amount.",
    kind: "unknown",
  },
  ZeroAddress: {
    title: "Invalid address",
    message: "A required address was empty or invalid.",
    kind: "unknown",
  },
  EmptyName: {
    title: "Name is required",
    message: "The token name cannot be empty.",
    recovery: "Enter a token name.",
    kind: "unknown",
  },
  EmptySymbol: {
    title: "Symbol is required",
    message: "The token symbol cannot be empty.",
    recovery: "Enter a token symbol.",
    kind: "unknown",
  },
  InvalidMaxTx: { title: "Invalid max transaction", message: "The max-transaction limit is out of range.", recovery: "Adjust the max transaction setting.", kind: "unknown" },
  InvalidMaxHold: { title: "Invalid max holding", message: "The max-holding limit is out of range.", recovery: "Adjust the max holding setting.", kind: "unknown" },
  InvalidCooldown: { title: "Invalid cooldown", message: "The cooldown value is out of range.", recovery: "Adjust the cooldown setting.", kind: "unknown" },
  InvalidSupplyTier: { title: "Invalid supply tier", message: "The selected supply tier is not supported.", recovery: "Pick a different supply tier.", kind: "unknown" },
  InvalidCurveShape: { title: "Invalid curve shape", message: "The selected curve shape is not supported.", recovery: "Pick a different curve shape.", kind: "unknown" },
  NotFactory: { title: "Unauthorized", message: "This action can only be performed by the factory contract.", kind: "contract-revert" },
  NotExempt: { title: "Action not permitted", message: "Your wallet isn't permitted to perform this action right now.", kind: "contract-revert" },
  RescueBlocked: { title: "Rescue blocked", message: "Funds can't be rescued while the token is still active.", kind: "contract-revert" },
  AlreadyInitialized: { title: "Already initialized", message: "This contract has already been set up.", kind: "contract-revert" },
};

/** Extract the raw text we can pattern-match against from any error shape. */
function rawText(err: unknown): string {
  const e = err as BaseError & { shortMessage?: string; details?: string; message?: string };
  return [e?.shortMessage, e?.details, e?.message].filter(Boolean).join(" ");
}

/**
 * Turn any wallet/RPC/contract error into a structured, human-readable explanation
 * with an actionable recovery hint. Used by the transaction toast/progress pipeline.
 */
export function explainError(err: unknown): ExplainedError {
  const e = err as BaseError & { name?: string; shortMessage?: string; message?: string };
  const text = rawText(err);

  // 1. User rejection in the wallet.
  if (e?.name === "UserRejectedRequestError" || /user rejected|rejected the request|denied|user cancel/i.test(text)) {
    return {
      title: "Transaction cancelled",
      message: "You rejected the request in your wallet.",
      recovery: "Approve the request in your wallet to continue.",
      kind: "rejected",
    };
  }

  // 2. Named custom error from viem's decoded revert data.
  const reverted = err as Partial<ContractFunctionRevertedError>;
  const data = reverted?.data;
  let revertName: string | undefined;
  if (data && typeof data === "object" && "errorName" in data) {
    revertName = (data as { errorName?: string }).errorName;
  }
  // 3. Or the error name embedded in the message text (no ABI error entry).
  if (!revertName) {
    for (const name of Object.keys(REVERT_MAP)) {
      if (new RegExp(`\\b${name}\\b`).test(text)) {
        revertName = name;
        break;
      }
    }
  }
  if (revertName && REVERT_MAP[revertName]) {
    return { ...REVERT_MAP[revertName] };
  }

  // 4. Common non-contract failure conditions.
  if (/insufficient funds|exceeds the balance|gas required exceeds/i.test(text)) {
    return {
      title: "Insufficient funds",
      message: "Your wallet doesn't have enough to cover the amount plus gas.",
      recovery: "Add funds or lower the amount, then try again.",
      kind: "insufficient-funds",
    };
  }
  if (/timed out|timeout|took too long/i.test(text)) {
    return {
      title: "Request timed out",
      message: "The network took too long to respond.",
      recovery: "Check your connection and try again.",
      kind: "timeout",
    };
  }
  if (/network|fetch failed|connection|rpc|failed to fetch|http request failed/i.test(text)) {
    return {
      title: "Network error",
      message: "Couldn't reach the blockchain network.",
      recovery: "Check your connection or switch RPC, then try again.",
      kind: "network",
    };
  }
  if (/reverted|execution reverted/i.test(text)) {
    return {
      title: "Transaction reverted",
      message: e?.shortMessage || "The contract rejected this transaction.",
      recovery: "Double-check the inputs and try again.",
      kind: "contract-revert",
    };
  }

  // 5. Fallback.
  return {
    title: "Something went wrong",
    message: e?.shortMessage || e?.message?.split("\n")[0]?.slice(0, 160) || "An unknown error occurred.",
    recovery: "Please try again.",
    kind: "unknown",
  };
}

/** Back-compat: single-line message string (used by older call sites). */
export function parseContractError(err: unknown): string {
  const ex = explainError(err);
  return ex.recovery ? `${ex.message} ${ex.recovery}` : ex.message;
}

import { type BaseError, type ContractFunctionRevertedError } from "viem";

/** Extract a human-readable error message from a viem/contract revert. */
export function parseContractError(err: unknown): string {
  const e = err as BaseError & { shortMessage?: string; message?: string; name?: string };

  if (e?.name === "UserRejectedRequestError" || /rejected/i.test(e?.message ?? "")) {
    return "Transaction rejected in wallet.";
  }

  const reverted = e as Partial<ContractFunctionRevertedError>;
  const data = reverted?.data;
  if (data && typeof data === "object" && "errorName" in data) {
    const { errorName, args } = data as { errorName: string; args?: unknown[] };
    if (args && Array.isArray(args) && args.length > 0) {
      return `${errorName}(${args.map((a) => String(a)).join(", ")})`;
    }
    return errorName;
  }

  if (e?.shortMessage) return e.shortMessage;
  if (e?.message) return e.message.split("\n")[0].slice(0, 200);
  return "Unknown error";
}

/** Alias for backward compatibility. */
export const normalizeError = parseContractError;

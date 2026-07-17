/**
 * Backwards-compatible re-exports. The full implementation now lives in
 * `@/lib/txErrors`, which returns structured, human-readable explanations with
 * actionable recovery steps. Existing call sites importing from `@/lib/error`
 * keep working unchanged.
 */
export { parseContractError, explainError } from "./txErrors";
export type { ExplainedError, TxErrorKind } from "./txErrors";

/** Alias for backward compatibility. */
export { parseContractError as normalizeError } from "./txErrors";

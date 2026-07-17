import { describe, it, expect } from "vitest";
import { explainError, parseContractError, type TxErrorKind } from "../src/lib/txErrors";

function expectKind(err: unknown, kind: TxErrorKind) {
  const ex = explainError(err);
  expect(ex.kind).toBe(kind);
  expect(ex.title).toBeTruthy();
  expect(ex.message).toBeTruthy();
}

describe("explainError — user rejection", () => {
  it("detects UserRejectedRequestError by name", () => {
    expectKind({ name: "UserRejectedRequestError" }, "rejected");
  });
  it("detects rejection phrasing in message", () => {
    expectKind({ message: "MetaMask Tx Signature: User denied transaction signature." }, "rejected");
    expectKind({ message: "user rejected the request" }, "rejected");
  });
});

describe("explainError — named custom errors", () => {
  it("maps errorName from decoded revert data", () => {
    const ex = explainError({ data: { errorName: "SlippageExceeded" } });
    expect(ex.kind).toBe("slippage");
    expect(ex.recovery).toMatch(/slippage/i);
  });

  it("maps each known revert name from message text", () => {
    const cases: Array<[string, TxErrorKind]> = [
      ["SlippageExceeded", "slippage"],
      ["InsufficientQuote", "insufficient-funds"],
      ["ExceedsMaxTx", "limits"],
      ["ExceedsMaxHold", "limits"],
      ["CooldownActive", "cooldown"],
      ["AlreadyGraduated", "graduated"],
      ["NotGraduated", "graduated"],
      ["NotFactory", "contract-revert"],
      ["RescueBlocked", "contract-revert"],
    ];
    for (const [name, kind] of cases) {
      expectKind({ message: `execution reverted: ${name}()` }, kind);
    }
  });

  it("does not false-match a substring of another error name", () => {
    // "ExceedsMaxTx" must not be matched by a search for "ExceedsMax"
    const ex = explainError({ message: "reverted with ExceedsMaxHold" });
    expect(ex.title).toMatch(/max wallet holding/i);
  });
});

describe("explainError — infra failures", () => {
  it("insufficient funds", () => {
    expectKind({ message: "insufficient funds for gas * price + value" }, "insufficient-funds");
  });
  it("timeout", () => {
    expectKind({ message: "request timed out" }, "timeout");
  });
  it("network", () => {
    expectKind({ message: "fetch failed" }, "network");
  });
  it("generic revert", () => {
    expectKind({ message: "execution reverted", shortMessage: "execution reverted" }, "contract-revert");
  });
  it("unknown fallback", () => {
    expectKind({ message: "totally novel failure mode" }, "unknown");
  });
});

describe("parseContractError", () => {
  it("returns message + recovery joined", () => {
    const s = parseContractError({ data: { errorName: "CooldownActive" } });
    expect(s).toMatch(/cooldown/i);
    expect(s.length).toBeGreaterThan(10);
  });
  it("handles a bare string-less error", () => {
    expect(parseContractError({})).toBeTruthy();
  });
});

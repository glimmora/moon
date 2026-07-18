// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTxLifecycle } from "../src/hooks/useTxLifecycle";

const mockWriteContract = vi.hoisted(() => vi.fn(() => Promise.resolve("0xabc" as `0x${string}`)));

const toasts = vi.hoisted(() => ({
  loading: vi.fn(() => 42),
  update: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock("wagmi", () => ({
  useAccount: vi.fn(() => ({ address: "0x1234567890abcdef1234567890abcdef12345678", isConnected: true })),
  useChainId: vi.fn(() => 11155111),
  useSwitchChain: vi.fn(() => ({ switchChainAsync: vi.fn() })),
  usePublicClient: vi.fn(() => ({
    estimateContractGas: vi.fn(() => Promise.resolve(100_000n)),
    getGasPrice: vi.fn(() => Promise.resolve(10n ** 9n)),
  })),
  useWriteContract: vi.fn(() => ({
    writeContractAsync: mockWriteContract,
  })),
  useWaitForTransactionReceipt: vi.fn(() => ({
    isSuccess: false,
    isError: false,
    isPending: true,
    data: undefined,
    error: undefined,
    fetchStatus: "idle",
  })),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}));

vi.mock("@/stores/toast", () => ({
  useToast: vi.fn(() => toasts),
}));

vi.mock("@/lib/explorer", () => ({
  txUrl: vi.fn(() => "https://explorer.example.com/tx/0xabc"),
  explorerName: vi.fn(() => "TestScan"),
}));

const ANY_ADDR = "0x0000000000000000000000000000000000000001";

describe("useTxLifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteContract.mockResolvedValue("0xabc" as `0x${string}`);
  });

  it("returns idle stage initially", () => {
    const { result } = renderHook(() =>
      useTxLifecycle({ chainId: 11155111, label: "Test" }),
    );
    expect(result.current.stage).toBe("idle");
    expect(result.current.isBusy).toBe(false);
    expect(result.current.hash).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("transitions to pending on successful write", async () => {
    const { result } = renderHook(() =>
      useTxLifecycle({ chainId: 11155111, label: "Test" }),
    );

    expect(result.current.stage).toBe("idle");

    const hash = await result.current.execute({
      abi: [] as never,
      address: ANY_ADDR,
      functionName: "test",
    });

    expect(hash).toBe("0xabc");

    await waitFor(() => {
      expect(result.current.stage).toBe("pending");
    });
    expect(result.current.hash).toBe("0xabc");
  });

  it("sets error on wallet rejection", async () => {
    mockWriteContract.mockRejectedValue(new Error("User rejected"));

    const { result } = renderHook(() =>
      useTxLifecycle({ chainId: 11155111, label: "Test" }),
    );

    const hash = await result.current.execute({
      abi: [] as never,
      address: ANY_ADDR,
      functionName: "test",
    });

    expect(hash).toBeNull();

    await waitFor(() => {
      expect(result.current.stage).toBe("error");
    });
    expect(result.current.error).not.toBeNull();
  });

  it("reset returns to idle", () => {
    const { result } = renderHook(() =>
      useTxLifecycle({ chainId: 11155111, label: "Test" }),
    );

    act(() => result.current.reset());
    expect(result.current.stage).toBe("idle");
  });

  it("retry uses last params", async () => {
    const { result } = renderHook(() =>
      useTxLifecycle({ chainId: 11155111, label: "Test" }),
    );

    await result.current.execute({
      abi: [] as never,
      address: ANY_ADDR,
      functionName: "test",
    });

    mockWriteContract.mockResolvedValue("0xretry" as `0x${string}`);

    const hash = await result.current.retry();
    expect(hash).toBe("0xretry");
  });
});


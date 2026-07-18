// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TxProgress } from "../src/components/tx/TxProgress";
import { ThemeProvider } from "../src/stores/theme";

const SEPOLIA = 11155111;

const base = {
  chainId: SEPOLIA,
  confirmations: 2,
  confirmationCount: 0,
};

/** Wrap in ThemeProvider so useTheme() resolves (defaults to dark). */
function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe("TxProgress", () => {
  it("renders nothing when idle", () => {
    const { container } = renderWithTheme(<TxProgress stage="idle" {...base} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the stepper with steps while pending and shows confirmation count", () => {
    renderWithTheme(<TxProgress stage="pending" {...base} confirmationCount={1} />);
    expect(screen.getByText("Waiting for wallet signature")).toBeInTheDocument();
    expect(screen.getByText("Confirming on-chain")).toBeInTheDocument();
    expect(screen.getByText("(1/2)")).toBeInTheDocument();
  });

  it("renders a success state", () => {
    renderWithTheme(<TxProgress stage="success" {...base} />);
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
  });

  it("renders an error alert with title, message, recovery and retry", () => {
    const onRetry = vi.fn();
    renderWithTheme(
      <TxProgress
        stage="error"
        {...base}
        error={{
          title: "Price moved too much",
          message: "Slippage exceeded.",
          recovery: "Increase slippage.",
          kind: "slippage",
        }}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Price moved too much")).toBeInTheDocument();
    expect(screen.getByText("Slippage exceeded.")).toBeInTheDocument();
    expect(screen.getByText(/Increase slippage/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows a gas estimate and an explorer link", () => {
    renderWithTheme(
      <TxProgress
        stage="pending"
        {...base}
        gasEstimate={{ gas: 21000n, feeEth: "0.000123456789" }}
        explorerUrl="https://sepolia.etherscan.io/tx/0xabc"
        nativeSymbol="ETH"
      />,
    );
    expect(screen.getByText(/0\.000123 ETH/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /sepolia\.etherscan\.io/ });
    expect(link).toHaveAttribute("href", "https://sepolia.etherscan.io/tx/0xabc");
  });
});

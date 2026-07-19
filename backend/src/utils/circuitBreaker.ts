import { logger } from "./logger.js";

type CircuitState = "closed" | "open" | "half-open";

interface CircuitOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenSuccessThreshold: number;
}

/**
 * Circuit breaker to prevent cascade failures when DB is overloaded.
 * Transitions: closed -> open (on failures) -> half-open (after timeout) -> closed (on success)
 */
export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private pendingReset: NodeJS.Timeout | null = null;

  constructor(private readonly opts: CircuitOptions) {}

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      const now = Date.now();
      if (now - this.lastFailureTime > this.opts.resetTimeoutMs) {
        this.state = "half-open";
        this.successCount = 0;
        logger.info("Circuit breaker transitioning to half-open");
      } else {
        throw new Error("CIRCUIT_OPEN: Too many recent failures");
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    if (this.state === "half-open") {
      this.successCount++;
      if (this.successCount >= this.opts.halfOpenSuccessThreshold) {
        this.state = "closed";
        this.successCount = 0;
        logger.info("Circuit breaker closed after successful half-open");
        if (this.pendingReset) {
          clearTimeout(this.pendingReset);
          this.pendingReset = null;
        }
      }
    }
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.state === "half-open" || this.failureCount >= this.opts.failureThreshold) {
      this.state = "open";
      this.successCount = 0;
      logger.warn({ failureCount: this.failureCount, state: this.state }, "Circuit breaker opened");
      this.pendingReset = setTimeout(() => {
        this.state = "half-open";
        this.successCount = 0;
      }, this.opts.resetTimeoutMs);
    }
  }

  getState() {
    return this.state;
  }
}

// Default circuit breaker for Prisma operations
export const prismaCircuit = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenSuccessThreshold: 3,
});
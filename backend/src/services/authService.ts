import { randomBytes } from "node:crypto";
import { SiweMessage } from "siwe";
import jwt from "jsonwebtoken";
import { getAddress } from "viem";
import { env } from "../config/env.js";
import { SUPPORTED_CHAIN_IDS } from "../config/chains.js";

const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const JWT_TTL = "7d";
// Hard cap on live nonces to bound memory against issuance floods. When exceeded,
// the oldest entries are evicted (they are single-use and short-lived anyway).
const MAX_NONCES = 50_000;

interface NonceEntry {
  nonce: string;
  expiresAt: number;
}

// In-memory nonce store keyed by nonce value. Single-instance only; for a
// horizontally-scaled deployment this should move to Redis/DB.
const nonces = new Map<string, NonceEntry>();

// Periodic sweep of expired nonces.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of nonces) {
    if (entry.expiresAt < now) nonces.delete(key);
  }
}, 60_000).unref();

export interface AuthTokenPayload {
  sub: string; // checksummed wallet address
  chainId: number;
}

export const authService = {
  /** Issue a single-use nonce for SIWE. */
  issueNonce(): string {
    // Bound memory: evict oldest entries if we're at capacity (Map preserves
    // insertion order, so the first key is the oldest).
    while (nonces.size >= MAX_NONCES) {
      const oldest = nonces.keys().next().value;
      if (oldest === undefined) break;
      nonces.delete(oldest);
    }
    const nonce = randomBytes(16).toString("hex");
    nonces.set(nonce, { nonce, expiresAt: Date.now() + NONCE_TTL_MS });
    return nonce;
  },

  /**
   * Verify a SIWE message + signature. On success, consumes the nonce and
   * returns a signed JWT bound to the recovered address.
   */
  async verify(message: string, signature: string): Promise<{ token: string; address: string; chainId: number }> {
    const siwe = new SiweMessage(message);

    const stored = nonces.get(siwe.nonce);
    if (!stored || stored.expiresAt < Date.now()) {
      throw new AuthError("Invalid or expired nonce");
    }

    if (!SUPPORTED_CHAIN_IDS.has(siwe.chainId)) {
      throw new AuthError("Unsupported chainId");
    }

    let fields;
    try {
      fields = await siwe.verify({ signature, nonce: siwe.nonce });
    } catch {
      throw new AuthError("Signature verification failed");
    }
    if (!fields.success) throw new AuthError("Signature verification failed");

    // Single-use: consume the nonce so the message can't be replayed.
    nonces.delete(siwe.nonce);

    const address = getAddress(siwe.address);
    const payload: AuthTokenPayload = { sub: address, chainId: siwe.chainId };
    const token = jwt.sign(payload, env.AUTH_JWT_SECRET, { expiresIn: JWT_TTL });
    return { token, address, chainId: siwe.chainId };
  },

  /** Verify a JWT and return its payload, or throw AuthError. */
  verifyToken(token: string): AuthTokenPayload {
    try {
      const decoded = jwt.verify(token, env.AUTH_JWT_SECRET) as AuthTokenPayload;
      return decoded;
    } catch {
      throw new AuthError("Invalid or expired token");
    }
  },
};

export class AuthError extends Error {}

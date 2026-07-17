import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authService, AuthError } from "../services/authService.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const authRouter = Router();

// Tighter rate limit for auth endpoints to blunt brute-force / nonce spam.
const authLimiter = rateLimit({ windowMs: 60_000, max: 30 });
authRouter.use(authLimiter);

/** GET /api/auth/nonce — issue a single-use SIWE nonce. */
authRouter.get("/nonce", (_req, res) => {
  res.json({ nonce: authService.issueNonce() });
});

const verifySchema = z.object({
  message: z.string().min(1).max(4000),
  signature: z.string().min(1).max(400),
});

/** POST /api/auth/verify — verify a SIWE message + signature, return a JWT. */
authRouter.post("/verify", async (req, res, next) => {
  try {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }
    const result = await authService.verify(parsed.data.message, parsed.data.signature);
    res.json(result);
  } catch (e) {
    if (e instanceof AuthError) return res.status(401).json({ error: e.message });
    next(e);
  }
});

/** GET /api/auth/me — return the authenticated user (requires bearer token). */
authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ address: req.user?.sub, chainId: req.user?.chainId });
});

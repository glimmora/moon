import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import pinoHttp from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { apiRouter } from "./routes/api.js";
import { authRouter } from "./routes/auth.js";
import { prisma } from "./utils/db.js";

/**
 * Build the Express application (middleware + routes) without binding a port or
 * starting any background listeners. Extracted from the server bootstrap so it
 * can be exercised directly by integration tests (supertest) and reused by the
 * HTTP server in index.ts.
 */
/** Explicit allowlist from CORS_ORIGIN (comma-separated). */
const allowlist = new Set(env.BACKEND_CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean));

// Outside production, also permit any localhost/127.0.0.1 origin (any port) so
// the Vite dev server, the preview server, and Playwright E2E can all reach the
// API without hardcoding every port. In production, only the explicit allowlist
// is honored.
const LOCALHOST = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const corsOrigin: cors.CorsOptions["origin"] = (origin, cb) => {
  // Same-origin / non-browser requests (no Origin header) are always allowed.
  if (!origin) return cb(null, true);
  if (allowlist.has(origin)) return cb(null, true);
  if (env.NODE_ENV !== "production" && LOCALHOST.test(origin)) return cb(null, true);
  return cb(null, false);
};

export function createApp(): express.Express {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(pinoHttp({ logger }));
  app.set("trust proxy", 1);
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", ts: Date.now() });
    } catch {
      res.status(503).json({ status: "degraded", ts: Date.now() });
    }
  });
  app.use("/api/auth", authRouter);
  app.use("/api", apiRouter);

  // 404
  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  // Error handler
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err }, "Unhandled API error");
    // Handle Prisma errors more gracefully
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    // Circuit breaker open or load shedding
    if (errorMessage.includes("CIRCUIT_OPEN") || errorMessage.includes("LOAD_SHEDDING")) {
      res.status(503).json({ error: "Service temporarily unavailable", message: "The backend is overloaded or experiencing issues. Please retry in a moment." });
    } else if (errorMessage.includes("database") || errorMessage.includes("connection") || errorMessage.includes("timeout")) {
      res.status(503).json({ error: "Service temporarily unavailable", message: "Please try again in a moment." });
    } else if (errorMessage.includes("not found") || errorMessage.includes("not exist")) {
      res.status(404).json({ error: "Resource not found" });
    } else {
      res.status(500).json({ error: "Internal server error", message: errorMessage });
    }
  });

  return app;
}

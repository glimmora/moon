import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import http from "node:http";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { apiRouter } from "./routes/api.js";
import { authRouter } from "./routes/auth.js";
import { setupSockets } from "./sockets/server.js";
import { activeChains } from "./config/chains.js";
import { startChainListener, stopChainListener } from "./listeners/chainListener.js";
import { startHolderListener, stopHolderListener } from "./listeners/holderListener.js";
import { prisma } from "./utils/db.js";

let shutdown: (() => Promise<void>) | null = null;

async function main() {
  logger.info({ env: env.NODE_ENV, port: env.BACKEND_PORT }, "Starting moon.fun backend");

  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.set("trust proxy", 1);
  app.use(cors({ origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()) }));
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
    res.status(500).json({ error: "Internal server error" });
  });

  const server = http.createServer(app);
  const io = setupSockets(server);

  // Start chain listeners — each chain is isolated so one failure doesn't kill others.
  const chains = activeChains();
  if (chains.length === 0) {
    logger.warn("No factory addresses configured — no chain listeners started");
  }
  for (const chain of chains) {
    try {
      await startChainListener(chain, io);
    } catch (err) {
      logger.error({ chainId: chain.chainId, err }, "Failed to start chain listener");
    }
    try {
      await startHolderListener(chain);
    } catch (err) {
      logger.error({ chainId: chain.chainId, err }, "Failed to start holder listener");
    }
  }

  // Graceful shutdown — guard against double-invocation from SIGTERM+SIGINT.
  let shuttingDown = false;
  shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("Shutdown signal received — draining listeners");
    for (const chain of chains) {
      stopChainListener(chain.chainId);
      stopHolderListener(chain.chainId);
    }
    logger.info("Listeners stopped — closing connections");
    io.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
    logger.info("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  server.listen(env.BACKEND_PORT, () => {
    logger.info({ port: env.BACKEND_PORT, chains: chains.map((c) => c.shortLabel) }, "Backend listening");
  });
}

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — shutting down");
  if (shutdown) shutdown().catch(() => process.exit(1));
});

// A stray unhandled rejection (e.g. a transient RPC/socket error that escaped a
// .catch) must NOT tear down the API + all chain indexers. Log it and keep running;
// only truly-fatal synchronous faults (uncaughtException above) trigger shutdown.
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled rejection — logged, continuing");
});

main().catch((err) => {
  logger.fatal({ err }, "Fatal startup error");
  process.exit(1);
});

import express from "express";
import cors from "cors";
import http from "node:http";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { apiRouter } from "./routes/api.js";
import { setupSockets } from "./sockets/server.js";
import { activeChains } from "./config/chains.js";
import { startChainListener } from "./listeners/chainListener.js";
import { startHolderListener } from "./listeners/holderListener.js";
import { prisma } from "./utils/db.js";

async function main() {
  logger.info({ env: env.NODE_ENV, port: env.BACKEND_PORT }, "Starting moon.fun backend");

  const app = express();
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));
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

  // Start chain listeners.
  const chains = activeChains();
  if (chains.length === 0) {
    logger.warn("No factory addresses configured — no chain listeners started");
  }
  for (const chain of chains) {
    await startChainListener(chain);
    startHolderListener(chain);
  }

  // Graceful shutdown.
  process.on("SIGTERM", async () => {
    logger.info("SIGTERM received — shutting down");
    io.close();
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  });

  server.listen(env.BACKEND_PORT, () => {
    logger.info({ port: env.BACKEND_PORT, chains: chains.map((c) => c.shortLabel) }, "Backend listening");
  });
}

main().catch((err) => {
  logger.fatal({ err }, "Fatal startup error");
  process.exit(1);
});

import { type Server } from "http";
import { Server as IOServer } from "socket.io";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

// Mirror the Express CORS allowlist (see app.ts) so Socket.io connections from
// localhost dev ports are accepted in non-production environments.
const ALLOWED_ORIGINS = new Set(env.BACKEND_CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean));
const LOCALHOST = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function setupSockets(server: Server) {
  const io = new IOServer(server, {
    cors: {
      origin: (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) => {
        if (!origin) return cb(null, true);
        if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);
        if (env.NODE_ENV !== "production" && LOCALHOST.test(origin)) return cb(null, true);
        cb(new Error(`Origin ${origin} not allowed by CORS`));
      },
      methods: ["GET", "POST"],
    },
    path: "/socket.io",
  });

  io.on("connection", (socket) => {
    logger.info({ id: socket.id }, "Socket connected");

    // Join a token room for live trade updates.
    socket.on("subscribe:token", (chainId: number, address: string) => {
      if (typeof chainId !== "number" || typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) return;
      const room = `token:${chainId}:${address.toLowerCase()}`;
      socket.join(room);
      logger.debug({ room, id: socket.id }, "Subscribed to token room");
    });

    socket.on("unsubscribe:token", (chainId: number, address: string) => {
      if (typeof chainId !== "number" || typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) return;
      socket.leave(`token:${chainId}:${address.toLowerCase()}`);
    });

    socket.on("disconnect", () => {
      logger.debug({ id: socket.id }, "Socket disconnected");
    });
  });

  return io;
}

export type MoonIO = ReturnType<typeof setupSockets>;

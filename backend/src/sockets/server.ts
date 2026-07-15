import { type Server } from "http";
import { Server as IOServer } from "socket.io";
import { logger } from "../utils/logger.js";

export function setupSockets(server: Server) {
  const io = new IOServer(server, {
    cors: { origin: process.env.CORS_ORIGIN ?? "*", methods: ["GET", "POST"] },
    path: "/socket.io",
  });

  io.on("connection", (socket) => {
    logger.info({ id: socket.id }, "Socket connected");

    // Join a token room for live trade updates.
    socket.on("subscribe:token", (chainId: number, address: string) => {
      const room = `token:${chainId}:${address.toLowerCase()}`;
      socket.join(room);
      logger.debug({ room, id: socket.id }, "Subscribed to token room");
    });

    socket.on("unsubscribe:token", (chainId: number, address: string) => {
      socket.leave(`token:${chainId}:${address.toLowerCase()}`);
    });

    socket.on("disconnect", () => {
      logger.debug({ id: socket.id }, "Socket disconnected");
    });
  });

  return io;
}

export type MoonIO = ReturnType<typeof setupSockets>;

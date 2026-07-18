import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

// Many concurrent consumers share this single client (Express API + websocket
// server + one chain poller and one holder poller per configured chain). Ensure
// the connection pool is large enough to avoid pool-timeout errors under load,
// unless the operator has already pinned connection_limit in DB_URL.
function withPoolDefaults(url: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("connection_limit")) {
      u.searchParams.set("connection_limit", "20");
    }
    if (!u.searchParams.has("pool_timeout")) {
      u.searchParams.set("pool_timeout", "20");
    }
    return u.toString();
  } catch {
    return url;
  }
}

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  datasourceUrl: withPoolDefaults(env.DB_URL),
});

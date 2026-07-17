# ─────────────────────────  Build stage  ─────────────────────────
FROM node:20-slim AS build

# Prisma needs openssl at generate/runtime.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

# Install deps against the workspace lockfile for reproducible builds.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
RUN pnpm install --frozen-lockfile --filter @moon.fun/backend...

COPY backend ./backend
RUN pnpm --filter @moon.fun/backend run db:generate \
    && pnpm --filter @moon.fun/backend run build \
    # Prune dev dependencies for a lean runtime.
    && pnpm --filter @moon.fun/backend prune --prod

# ─────────────────────────  Runtime stage  ───────────────────────
FROM node:20-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app/backend

# Copy built app + node_modules (incl. generated Prisma client).
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/package.json ./package.json
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/node_modules /app/node_modules

# Run as the built-in non-root `node` user.
USER node

EXPOSE 4000
CMD ["node", "dist/index.js"]

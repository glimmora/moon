# ─────────────────────────  Build stage  ─────────────────────────
FROM node:20-slim AS build

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY frontend/package.json ./frontend/
RUN pnpm install --frozen-lockfile --filter @moon.fun/frontend...

COPY frontend ./frontend

# VITE_* vars are inlined at build time; pass with --build-arg if needed.
# Each chain has public fallback RPCs so these are all optional — but you
# should provide your own RPC endpoints and factory addresses in production.
ARG VITE_API_URL
ARG VITE_RPC_BSC
ARG VITE_RPC_BASE
ARG VITE_RPC_ARBITRUM
ARG VITE_RPC_ETHEREUM_SEPOLIA
ARG VITE_RPC_BSC_TESTNET
ARG VITE_RPC_BASE_SEPOLIA
ARG VITE_RPC_ARBITRUM_SEPOLIA
ARG VITE_FACTORY_BSC
ARG VITE_FACTORY_BASE
ARG VITE_FACTORY_ARBITRUM
ARG VITE_FACTORY_BSC_TESTNET
ARG VITE_FACTORY_BASE_SEPOLIA
ARG VITE_FACTORY_ARBITRUM_SEPOLIA
ARG VITE_FACTORY_ETHEREUM_SEPOLIA
ARG VITE_WALLETCONNECT_PROJECT_ID

# Propagate build-args so Vite can inline them via import.meta.env.
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_RPC_BSC=${VITE_RPC_BSC}
ENV VITE_RPC_BASE=${VITE_RPC_BASE}
ENV VITE_RPC_ARBITRUM=${VITE_RPC_ARBITRUM}
ENV VITE_RPC_ETHEREUM_SEPOLIA=${VITE_RPC_ETHEREUM_SEPOLIA}
ENV VITE_RPC_BSC_TESTNET=${VITE_RPC_BSC_TESTNET}
ENV VITE_RPC_BASE_SEPOLIA=${VITE_RPC_BASE_SEPOLIA}
ENV VITE_RPC_ARBITRUM_SEPOLIA=${VITE_RPC_ARBITRUM_SEPOLIA}
ENV VITE_FACTORY_BSC=${VITE_FACTORY_BSC}
ENV VITE_FACTORY_BASE=${VITE_FACTORY_BASE}
ENV VITE_FACTORY_ARBITRUM=${VITE_FACTORY_ARBITRUM}
ENV VITE_FACTORY_BSC_TESTNET=${VITE_FACTORY_BSC_TESTNET}
ENV VITE_FACTORY_BASE_SEPOLIA=${VITE_FACTORY_BASE_SEPOLIA}
ENV VITE_FACTORY_ARBITRUM_SEPOLIA=${VITE_FACTORY_ARBITRUM_SEPOLIA}
ENV VITE_FACTORY_ETHEREUM_SEPOLIA=${VITE_FACTORY_ETHEREUM_SEPOLIA}
ENV VITE_WALLETCONNECT_PROJECT_ID=${VITE_WALLETCONNECT_PROJECT_ID}
ENV NODE_ENV=production
RUN pnpm --filter @moon.fun/frontend run build

# ─────────────────────────  Runtime stage  ───────────────────────
FROM nginx:1.27-alpine AS runtime

# SPA routing: fall back to index.html for client-side routes.
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

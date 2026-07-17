# ─────────────────────────  Build stage  ─────────────────────────
FROM node:20-slim AS build

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY frontend/package.json ./frontend/
RUN pnpm install --frozen-lockfile --filter @moon.fun/frontend...

COPY frontend ./frontend

# VITE_* vars are inlined at build time; pass with --build-arg if needed.
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
ENV NODE_ENV=production
RUN pnpm --filter @moon.fun/frontend run build

# ─────────────────────────  Runtime stage  ───────────────────────
FROM nginx:1.27-alpine AS runtime

# SPA routing: fall back to index.html for client-side routes.
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

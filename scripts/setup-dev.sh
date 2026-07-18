#!/usr/bin/env bash
# moon.fun — one-shot developer setup.
# Installs Node deps, Foundry deps, spins up Postgres, pushes the schema.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "🌙 moon.fun dev setup"
echo "──────────────────────────────────────────"

# 1. Node deps
if ! command -v pnpm &>/dev/null; then
  echo "❌ pnpm not found. Install: corepack enable && corepack prepare pnpm@latest --activate"
  exit 1
fi
echo "📦 Installing workspace dependencies…"
pnpm install

# 2. Foundry deps
if command -v forge &>/dev/null; then
  echo "⚒️  Installing Foundry dependencies…"
  (cd contracts && forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts --no-commit 2>/dev/null || true)
else
  echo "⚠️  Foundry not installed — skipping contract deps. Install with: foundryup"
fi

# 3. Backend infra
echo "🐳 Starting Postgres…"
(cd backend && docker compose up -d)

# 4. Prisma
echo "🗄️  Pushing Prisma schema…"
(cd backend && pnpm install && pnpm db:push)

# 5. Env files
for f in .env.example contracts/.env.example frontend/.env.example backend/.env.example; do
  target="$(dirname "$f")/.env"
  if [ -f "$f" ] && [ ! -f "$target" ]; then
    cp "$f" "$target"
    echo "📝 Created $target from $f"
  fi
done

echo ""
echo "✅ Setup complete!"
echo "   Frontend:  cd frontend && pnpm dev   → http://localhost:5173"
echo "   Backend:   cd backend  && pnpm dev   → http://localhost:4000"
echo "   Contracts: cd contracts && forge test"

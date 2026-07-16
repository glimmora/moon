#!/usr/bin/env bash
# moon.fun — Dev launcher (frontend + backend)
# Usage:
#   ./dev.sh              # start both frontend + backend
#   ./dev.sh frontend     # frontend only
#   ./dev.sh backend      # backend only
#   ./dev.sh stop         # stop all running processes
#
# Ports:
#   Frontend: 5173 (Vite dev server)
#   Backend:  4000 (Express + Socket.io)
#
# Requires: node, npm, npx. Backend additionally needs a Postgres DATABASE_URL
# (defaults to sqlite file if Postgres is unavailable — see backend/.env).

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT/frontend"
BACKEND_DIR="$ROOT/backend"
PID_DIR="$ROOT/.dev-pids"
LOG_DIR="$ROOT/.dev-logs"

FRONTEND_PORT=5173
BACKEND_PORT=4000

mkdir -p "$PID_DIR" "$LOG_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[dev]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
err()  { echo -e "${RED}[err]${NC} $1" >&2; }
info() { echo -e "${CYAN}[info]${NC} $1"; }

# ─── Stop ──────────────────────────────────────────────────────────────
stop_all() {
  log "Stopping all dev processes…"
  for pidfile in "$PID_DIR"/*.pid; do
    [ -f "$pidfile" ] || continue
    local name=$(basename "$pidfile" .pid)
    local pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && log "Stopped $name (pid $pid)"
    else
      warn "$name (pid $pid) not running"
    fi
    rm -f "$pidfile"
  done
  # Kill any stray vite / tsx processes on our ports
  pkill -f "vite.*--port $FRONTEND_PORT" 2>/dev/null && log "Killed stray vite"
  pkill -f "tsx watch.*src/index.ts" 2>/dev/null && log "Killed stray tsx"
  log "Done."
  exit 0
}

# ─── Start frontend ────────────────────────────────────────────────────
start_frontend() {
  log "Starting frontend (port $FRONTEND_PORT)…"
  cd "$FRONTEND_DIR"

  # Install deps if missing
  if [ ! -d "node_modules" ]; then
    warn "frontend node_modules not found — installing…"
    npm install --legacy-peer-deps > "$LOG_DIR/frontend-install.log" 2>&1
  fi

  # Ensure .env exists
  if [ ! -f ".env" ]; then
    warn "frontend/.env not found — copying from .env.example"
    cp .env.example .env 2>/dev/null || warn "no .env.example either; using empty env"
  fi

  nohup ./node_modules/.bin/vite --port "$FRONTEND_PORT" --host \
    > "$LOG_DIR/frontend.log" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_DIR/frontend.pid"
  info "Frontend PID: $pid"
  info "URL: http://localhost:$FRONTEND_PORT"
  info "Logs: $LOG_DIR/frontend.log"
}

# ─── Start backend ─────────────────────────────────────────────────────
start_backend() {
  log "Starting backend (port $BACKEND_PORT)…"
  cd "$BACKEND_DIR"

  # Install deps if missing
  if [ ! -d "node_modules" ]; then
    warn "backend node_modules not found — installing…"
    npm install > "$LOG_DIR/backend-install.log" 2>&1
  fi

  # Ensure .env exists — detect Postgres or fall back to sqlite
  if [ ! -f ".env" ]; then
    # Check if Postgres is reachable on localhost:5432
    if command -v pg_isready >/dev/null 2>&1 && pg_isready -h localhost -p 5432 -q 2>/dev/null; then
      info "Postgres detected on localhost:5432 — using postgresql provider"
      cat > .env <<'EOF'
BACKEND_PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
DATABASE_PROVIDER=postgresql
DATABASE_URL=postgresql://moon:moon@localhost:5432/moonfun
JWT_SECRET=dev-secret-change-me
BSC_RPC_URL=https://bsc-dataseed.binance.org
BASE_RPC_URL=https://mainnet.base.org
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-arbitrum.api.onrender.com
ETHEREUM_SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
POLL_INTERVAL_MS=4000
START_BLOCK_OFFSET=10000
MAX_BLOCK_BATCH=500
FACTORY_ETHEREUM_SEPOLIA=0xC3DadD2643a6aB9857880EF7Bf208dEdd31937b3
TREASURY_ADDRESS=0xbBfD7255a1817b7d02a5cc9A0669a9C80599ef24
DEV_WALLET_ADDRESS=0xbBfD7255a1817b7d02a5cc9A0669a9C80599ef24
EOF
    else
      warn "Postgres not detected — using sqlite fallback (file:./dev.db)"
      cat > .env <<'EOF'
BACKEND_PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:./dev.db
JWT_SECRET=dev-secret-change-me
BSC_RPC_URL=https://bsc-dataseed.binance.org
BASE_RPC_URL=https://mainnet.base.org
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-arbitrum.api.onrender.com
ETHEREUM_SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
POLL_INTERVAL_MS=4000
START_BLOCK_OFFSET=10000
MAX_BLOCK_BATCH=500
FACTORY_ETHEREUM_SEPOLIA=0xC3DadD2643a6aB9857880EF7Bf208dEdd31937b3
TREASURY_ADDRESS=0xbBfD7255a1817b7d02a5cc9A0669a9C80599ef24
DEV_WALLET_ADDRESS=0xbBfD7255a1817b7d02a5cc9A0669a9C80599ef24
EOF
    fi
  fi

  # Show which DB provider is configured
  if [ -f ".env" ]; then
    local provider=$(grep -E "^DATABASE_PROVIDER=" .env | cut -d= -f2 || echo "postgresql")
    local dburl=$(grep -E "^DATABASE_URL=" .env | cut -d= -f2- || echo "?")
    info "Database provider: $provider"
    info "Database URL: $dburl"
  fi

  # Generate Prisma client + push schema
  if [ -f "prisma/schema.prisma" ]; then
    # Read DB provider from .env
    local db_provider=$(grep -E "^DATABASE_PROVIDER=" .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]' || echo "postgresql")
    local db_url=$(grep -E "^DATABASE_URL=" .env 2>/dev/null | cut -d= -f2- | tr -d '[:space:]')

    # If sqlite, sed-swap the provider in schema.prisma (Prisma doesn't allow env() for provider)
    if [ "$db_provider" = "sqlite" ]; then
      info "Swapping schema.prisma provider to sqlite…"
      sed -i.bak 's/provider = "postgresql"/provider = "sqlite"/' prisma/schema.prisma
    fi

    # Test Postgres connectivity before pushing schema
    if [ "$db_provider" = "postgresql" ]; then
      info "Testing Postgres connection…"
      local pg_user=$(echo "$db_url" | sed -n 's|postgresql://\([^:]*\):.*|\1|p')
      local pg_pass=$(echo "$db_url" | sed -n 's|postgresql://[^:]*:\([^@]*\)@.*|\1|p')
      local pg_host=$(echo "$db_url" | sed -n 's|.*@\([^:]*\):.*|\1|p')
      local pg_port=$(echo "$db_url" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
      local pg_db=$(echo "$db_url" | sed -n 's|.*/\([^?]*\).*|\1|p')

      if command -v psql >/dev/null 2>&1; then
        PGPASSWORD="$pg_pass" psql -h "$pg_host" -p "$pg_port" -U "$pg_user" -d "$pg_db" -c "SELECT 1;" > /dev/null 2>&1
        if [ $? -ne 0 ]; then
          err "Cannot connect to Postgres at $pg_host:$pg_port/$pg_db as user '$pg_user'"
          echo ""
          echo "${YELLOW}Common fixes:${NC}"
          echo "  1. Create user + database:"
          echo "     sudo -u postgres psql -c \"CREATE USER moon WITH PASSWORD 'moon';\""
          echo "     sudo -u postgres psql -c \"CREATE DATABASE moonfun OWNER moon;\""
          echo "     sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE moonfun TO moon;\""
          echo ""
          echo "  2. Fix pg_hba.conf auth method (change 'peer' to 'md5'):"
          echo "     sudo sed -i 's/peer/md5/g' /etc/postgresql/*/main/pg_hba.conf"
          echo "     sudo systemctl restart postgresql"
          echo ""
          echo "  3. Or fall back to SQLite (no Postgres needed):"
          echo "     Edit backend/.env:"
          echo "       DATABASE_PROVIDER=sqlite"
          echo "       DATABASE_URL=file:./dev.db"
          echo ""
          exit 1
        fi
        info "Postgres connection OK"
      else
        warn "psql not installed — skipping connection test"
      fi
    fi

    info "Generating Prisma client…"
    npx prisma generate > "$LOG_DIR/prisma.log" 2>&1 || {
      err "prisma generate failed:"
      cat "$LOG_DIR/prisma.log"
      # Restore schema if we swapped it
      [ -f "prisma/schema.prisma.bak" ] && mv prisma/schema.prisma.bak prisma/schema.prisma
      exit 1
    }

    info "Pushing schema to database…"
    npx prisma db push --accept-data-loss > "$LOG_DIR/prisma.log" 2>&1
    if [ $? -ne 0 ]; then
      err "prisma db push failed. Error output:"
      echo ""
      cat "$LOG_DIR/prisma.log"
      echo ""
      echo "${YELLOW}Full log: $LOG_DIR/prisma.log${NC}"
      # Restore schema if we swapped it
      [ -f "prisma/schema.prisma.bak" ] && mv prisma/schema.prisma.bak prisma/schema.prisma
      exit 1
    fi
    info "Schema pushed successfully"

    # Restore schema.prisma if we swapped it for sqlite
    if [ "$db_provider" = "sqlite" ] && [ -f "prisma/schema.prisma.bak" ]; then
      mv prisma/schema.prisma.bak prisma/schema.prisma
      info "Restored schema.prisma to postgresql"
    fi
  fi

  nohup ./node_modules/.bin/tsx watch src/index.ts \
    > "$LOG_DIR/backend.log" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_DIR/backend.pid"
  info "Backend PID: $pid"

  # Wait for backend to start (or crash), then verify it's actually listening
  info "Waiting for backend to start…"
  local waited=0
  local max_wait=15
  while [ $waited -lt $max_wait ]; do
    # Check if process is still alive
    if ! kill -0 "$pid" 2>/dev/null; then
      err "Backend process died after startup! Crash log:"
      echo ""
      cat "$LOG_DIR/backend.log"
      echo ""
      exit 1
    fi
    # Check if port is listening
    if curl -s "http://localhost:$BACKEND_PORT/health" > /dev/null 2>&1; then
      info "Backend is listening on port $BACKEND_PORT ✓"
      info "URL: http://localhost:$BACKEND_PORT"
      info "Logs: $LOG_DIR/backend.log"
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done

  # Timeout — backend didn't start in time
  warn "Backend hasn't responded after ${max_wait}s. Last 20 log lines:"
  echo ""
  tail -20 "$LOG_DIR/backend.log"
  echo ""
  warn "Full log: $LOG_DIR/backend.log"
}

# ─── Status ────────────────────────────────────────────────────────────
show_status() {
  echo ""
  log "Dev status:"
  for name in frontend backend; do
    local pidfile="$PID_DIR/$name.pid"
    if [ -f "$pidfile" ]; then
      local pid=$(cat "$pidfile")
      if kill -0 "$pid" 2>/dev/null; then
        local port=$( [ "$name" = "frontend" ] && echo $FRONTEND_PORT || echo $BACKEND_PORT )
        echo -e "  ${GREEN}●${NC} $name — pid $pid — http://localhost:$port"
      else
        echo -e "  ${RED}●${NC} $name — dead (stale pid $pid)"
      fi
    else
      echo -e "  ${YELLOW}●${NC} $name — not started"
    fi
  done
  echo ""
}

# ─── Main ──────────────────────────────────────────────────────────────
case "${1:-all}" in
  stop)
    stop_all
    ;;
  status)
    show_status
    ;;
  frontend)
    start_frontend
    show_status
    ;;
  backend)
    start_backend
    show_status
    ;;
  all|"")
    # Trap Ctrl-C to stop everything
    trap 'echo ""; stop_all' INT TERM
    start_backend
    sleep 2  # give backend a head start
    start_frontend
    show_status
    log "Both services running. Press Ctrl-C to stop all."
    log "Tail logs: tail -f $LOG_DIR/*.log"
    # Keep script alive so trap works
    wait
    ;;
  *)
    err "Unknown command: $1"
    echo "Usage: $0 [all|frontend|backend|stop|status]"
    exit 1
    ;;
esac

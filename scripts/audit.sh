#!/usr/bin/env bash
# moon.fun — run all static analysis + tests for a pre-audit pass.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/contracts"

echo "🔍 moon.fun audit pipeline"
echo "──────────────────────────────────────────"

echo "▶ forge build"
forge build

echo "▶ forge test -vvv"
forge test -vvv

echo "▶ forge fmt --check"
forge fmt --check

echo "▶ solhint src/**/*.sol"
npx --yes solhint 'src/**/*.sol'

if command -v slither &>/dev/null; then
  echo "▶ slither ."
  slither . --filter-paths "lib|test|script" || echo "⚠️  Slither reported findings (review manually)"
else
  echo "⚠️  Slither not installed — skipping. Install: pipx install slither-analyzer"
fi

echo ""
echo "✅ Audit pipeline complete."

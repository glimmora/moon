#!/usr/bin/env bash
# moon.fun — deploy the full system across all configured chains.
# Reads chain list from $MOON_DEPLOY_CHAINS (default: all testnets).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/contracts"

# Load env
set -a
[ -f .env ] && source .env
set +a

CHAINS="${MOON_DEPLOY_CHAINS:-bsc-testnet base-sepolia arbitrum-sepolia ethereum-sepolia}"

# Map chain key → script contract + RPC env var.
declare -A SCRIPT=(
  ["bsc"]="DeployBsc"
  ["base"]="DeployBase"
  ["arbitrum"]="DeployArbitrum"
  ["bsc-testnet"]="DeployBscTestnet"
  ["base-sepolia"]="DeployBaseSepolia"
  ["arbitrum-sepolia"]="DeployArbitrumSepolia"
  ["ethereum-sepolia"]="DeployEthereumSepolia"
)
declare -A RPC=(
  ["bsc"]="BSC_RPC_URL"
  ["base"]="BASE_RPC_URL"
  ["arbitrum"]="ARBITRUM_RPC_URL"
  ["bsc-testnet"]="BSC_TESTNET_RPC_URL"
  ["base-sepolia"]="BASE_SEPOLIA_RPC_URL"
  ["arbitrum-sepolia"]="ARBITRUM_SEPOLIA_RPC_URL"
  ["ethereum-sepolia"]="ETHEREUM_SEPOLIA_RPC_URL"
)

echo "🚀 moon.fun multi-chain deploy"
echo "──────────────────────────────────────────"
echo "Chains: $CHAINS"
echo ""

for chain in $CHAINS; do
  script="${SCRIPT[$chain]:-}"
  rpc_var="${RPC[$chain]:-}"
  if [ -z "$script" ] || [ -z "$rpc_var" ]; then
    echo "⚠️  Unknown chain: $chain — skipping"
    continue
  fi
  rpc_url="${!rpc_var:-}"
  if [ -z "$rpc_url" ]; then
    echo "⚠️  $rpc_var not set — skipping $chain"
    continue
  fi
  echo "▶ Deploying $chain ($script)…"
  forge script "script/Deploy.s.sol:$script" \
    --rpc-url "$rpc_url" \
    --broadcast \
    --verify || echo "⚠️  Deploy for $chain failed — continuing"
  echo ""
done

echo "✅ Deploy script complete."

# moon.fun — Deployment Guide

## Prerequisites

- [Foundry](https://book.getfoundry.sh/) (`foundryup`)
- A funded deployer wallet (private key in `.env`)
- RPC URLs for the target chain (in `.env`)
- Etherscan API key for verification (in `.env`)

## 1. Install dependencies

```bash
cd contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts
```

## 2. Configure environment

```bash
cp .env.example .env
# Fill in PRIVATE_KEY, TREASURY_ADDRESS, DEV_WALLET_ADDRESS, RPC URLs, etc.
source .env
```

## 3. Deploy the $MOON governance token (optional, needed for buyback-burn)

```bash
forge script script/DeployMoonToken.s.sol \
  --rpc-url $BSC_RPC_URL \
  --broadcast \
  --verify
```

Record the deployed address in `MOON_TOKEN_BSC` (and per-chain equivalents).

## 4. Deploy the moon.fun system

The `Deploy.s.sol` script deploys the full system on a chain:

```bash
# BSC mainnet
forge script script/Deploy.s.sol:DeployBsc \
  --rpc-url $BSC_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BSC_ETHERSCAN_API_KEY

# Base mainnet
forge script script/Deploy.s.sol:DeployBase \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASE_ETHERSCAN_API_KEY

# Arbitrum mainnet
forge script script/Deploy.s.sol:DeployArbitrum \
  --rpc-url $ARBITRUM_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ARBITRUM_ETHERSCAN_API_KEY
```

### Testnets

```bash
forge script script/Deploy.s.sol:DeployBscTestnet       --rpc-url $BSC_TESTNET_RPC_URL --broadcast
forge script script/Deploy.s.sol:DeployBaseSepolia      --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
forge script script/Deploy.s.sol:DeployArbitrumSepolia  --rpc-url $ARBITRUM_SEPOLIA_RPC_URL --broadcast
forge script script/Deploy.s.sol:DeployEthereumSepolia  --rpc-url $ETHEREUM_SEPOLIA_RPC_URL --broadcast
```

## 5. Post-deployment wiring

After the factory is deployed, the deployer must:

1. **Grant the factory ADMIN on each infra contract** so `createToken()` can grant
   `CALLER_ROLE` / `ACCRUER_ROLE` / `REFERRER_ROLE` to new curves:
   ```bash
   cast send $CREATOR_FEE_VAULT "grantRole(bytes32,address)" \
     0x00 $FACTORY --rpc-url $BSC_RPC_URL --private-key $PRIVATE_KEY
   cast send $REFERRAL_REGISTRY "grantRole(bytes32,address)" \
     0x00 $FACTORY --rpc-url $BSC_RPC_URL --private-key $PRIVATE_KEY
   cast send $FEE_ROUTER "grantRole(bytes32,address)" \
     0x00 $FACTORY --rpc-url $BSC_RPC_URL --private-key $PRIVATE_KEY
   ```

2. **Set the DEX router** on each new bonding curve (or configure the factory to pass it
   at clone time — the deploy script leaves it `address(0)` and graduation will emit
   without LP until set).

3. **Configure the backend** with the factory addresses per chain in `backend/.env`.

4. **Configure the frontend** with all 7 contract addresses per chain in `frontend/.env`.

## 6. Multi-chain matrix

| Chain              | Script                  | Factory env var            |
| ------------------ | ----------------------- | -------------------------- |
| BSC                | `DeployBsc`             | `FACTORY_BSC`              |
| Base               | `DeployBase`            | `FACTORY_BASE`             |
| Arbitrum           | `DeployArbitrum`        | `FACTORY_ARBITRUM`         |
| BSC Testnet        | `DeployBscTestnet`      | `FACTORY_BSC_TESTNET`      |
| Base Sepolia       | `DeployBaseSepolia`     | `FACTORY_BASE_SEPOLIA`     |
| Arbitrum Sepolia   | `DeployArbitrumSepolia` | `FACTORY_ARBITRUM_SEPOLIA` |
| Ethereum Sepolia   | `DeployEthereumSepolia` | `FACTORY_ETHEREUM_SEPOLIA` |

## 7. Verification

```bash
forge verify-contract <address> src/MoonFactory.sol:MoonFactory \
  --chain-id 56 --etherscan-api-key $BSC_ETHERSCAN_API_KEY
```

## 8. Backend + frontend

```bash
# Backend
cd backend
cp .env.example .env  # fill in factory addresses + DATABASE_URL
docker compose up -d
pnpm install && pnpm db:push && pnpm dev

# Frontend
cd ../frontend
cp .env.example .env  # fill in VITE_FACTORY_* addresses
pnpm install && pnpm dev
```

## 9. Upgrades

Implementation upgrades (affects new clones only):

```bash
# Deploy a new MoonToken implementation
forge create src/MoonToken.sol:MoonToken --rpc-url $BSC_RPC_URL --private-key $PRIVATE_KEY

# Point the factory at it
cast send $FACTORY "upgradeMoonTokenImpl(address)" <newImpl> \
  --rpc-url $BSC_RPC_URL --private-key $PRIVATE_KEY
```

Existing clones are immutable and unaffected.

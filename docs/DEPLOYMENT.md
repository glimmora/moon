# moon.fun — Deployment Guide

## Prerequisites

- [Foundry](https://book.getfoundry.sh/) (`foundryup`)
- A funded deployer wallet (private key in `.env`)
- RPC URLs for the target chain (in `.env`)
- Etherscan API key for verification (in `.env`)

## 1. Install dependencies

```bash
cd contracts
forge install foundry-rs/forge-std@v1.7.1 OpenZeppelin/openzeppelin-contracts@v5.0.2
```

## 2. Configure environment

```bash
cp .env.example .env
# Fill in WALLET_PRIVATE_KEY, WALLET_TREASURY_ADDRESS, WALLET_DEV_ADDRESS, RPC URLs, etc.
source .env
```

Required env vars (see `contracts/.env.example` for the full schema):
- `WALLET_PRIVATE_KEY` — deployer wallet
- `WALLET_TREASURY_ADDRESS` — where treasury fees go
- `WALLET_DEV_ADDRESS` — where dev fees go
- `CHAIN_MOON_TOKEN_ETHEREUM_SEPOLIA` — $MOON governance token address (use treasury as placeholder if not deployed)
- `CHAIN_*_RPC_URL` — RPC endpoint for the target chain

## 3. Deploy the $MOON governance token (optional, needed for buyback-burn)

```bash
forge script script/DeployMoonToken.s.sol \
  --rpc-url $CHAIN_ETHEREUM_SEPOLIA_RPC_URL \
  --broadcast \
  --verify
```

Record the deployed address in `CHAIN_MOON_TOKEN_ETHEREUM_SEPOLIA` (and per-chain equivalents).

## 4. Deploy the moon.fun system

The `Deploy.s.sol` script deploys the full system on a chain AND grants the factory
`DEFAULT_ADMIN_ROLE` on FeeRouter / CreatorFeeVault / ReferralRegistry (so it can grant
operational roles to new curves):

```bash
# Ethereum Sepolia (already deployed — see section 7)
forge script script/Deploy.s.sol:DeployEthereumSepolia \
  --rpc-url $CHAIN_ETHEREUM_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $VERIFY_ETHEREUM_API_KEY

# BSC mainnet
forge script script/Deploy.s.sol:DeployBsc \
  --rpc-url $CHAIN_BSC_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $VERIFY_BSC_API_KEY
```

Other chains: `DeployBase`, `DeployArbitrum`, `DeployBscTestnet`, `DeployBaseSepolia`,
`DeployArbitrumSepolia`.

## 5. Post-deployment wiring

The deploy script automatically:
1. Deploys all 8 contracts (2 implementations + 6 infra)
2. Grants factory `DEFAULT_ADMIN_ROLE` on FeeRouter / Vault / Registry

After deployment, you should:
1. **Set the DEX router** on MoonBurner (for buyback-burn swap path):
    ```bash
    cast send $MOON_BURNER "setDexRouter(address)" <uniswapV2Router> \
      --rpc-url $CHAIN_ETHEREUM_SEPOLIA_RPC_URL --private-key $WALLET_PRIVATE_KEY
    ```

2. **Configure the backend** with factory addresses in `backend/.env`:
    ```
    CHAIN_FACTORY_ETHEREUM_SEPOLIA=0xC3DadD...
    ```

3. **Configure the frontend** with all contract addresses in `frontend/.env`:
    ```
    CHAIN_FACTORY_ETHEREUM_SEPOLIA=0xC3DadD...
    CHAIN_FEE_ROUTER_ETHEREUM_SEPOLIA=0x95032e...
    CHAIN_CREATOR_FEE_VAULT_ETHEREUM_SEPOLIA=0x3c67d2...
    CHAIN_REFERRAL_REGISTRY_ETHEREUM_SEPOLIA=0xADB082...
    CHAIN_MOON_BURNER_ETHEREUM_SEPOLIA=0x47240b...
    CHAIN_V3_CONCENTRATOR_ETHEREUM_SEPOLIA=0x17Fa68...
    ```

## 6. Multi-chain matrix

| Chain              | Script                  | Factory env var                  |
| ------------------ | ----------------------- | -------------------------------- |
| Ethereum Sepolia   | `DeployEthereumSepolia` | `CHAIN_FACTORY_ETHEREUM_SEPOLIA` |
| BSC                | `DeployBsc`             | `CHAIN_FACTORY_BSC`              |
| Base               | `DeployBase`            | `CHAIN_FACTORY_BASE`             |
| Arbitrum           | `DeployArbitrum`        | `CHAIN_FACTORY_ARBITRUM`         |
| BSC Testnet        | `DeployBscTestnet`      | `CHAIN_FACTORY_BSC_TESTNET`      |
| Base Sepolia       | `DeployBaseSepolia`     | `CHAIN_FACTORY_BASE_SEPOLIA`     |
| Arbitrum Sepolia   | `DeployArbitrumSepolia` | `CHAIN_FACTORY_ARBITRUM_SEPOLIA` |

## 7. Current deployment (Ethereum Sepolia)

Deployed at block 11,285,810 by `0xbBfD7255a1817b7d02a5cc9A0669a9C80599ef24`.

| Contract | Address |
|----------|---------|
| MoonFactory | `0xC3DadD2643a6aB9857880EF7Bf208dEdd31937b3` |
| FeeRouter | `0x95032e828144707e9754993e421c31dE986A3bb1` |
| CreatorFeeVault | `0x3c67d2f9f3aA5B909332f2eF7a3862b58015345B` |
| ReferralRegistry | `0xADB082E1AA4696bffDAD8aB754874d31E37e9Fe0` |
| MoonBurner | `0x47240bE29d50Eeb46bCCE0c227D67A34CE18682c` |
| MoonV3Concentrator | `0x17Fa6827FacD0B41Fa263ed1bC1E6D0bD73DaD30` |
| MoonToken (impl) | `0x4cE45cf3bE80858Bb85355E1052F7C9a7469D033` |
| BondingCurve (impl) | `0x0d4f99646e33f40522cbd0C6BAc1ac857c4eD6A8` |

RPC: `https://ethereum-sepolia-rpc.publicnode.com`

Verified on-chain with 28/28 tests passing — see `docs/TEST-REPORT-SEPOLIA-v2.md`.

## 8. Verification

```bash
forge verify-contract <address> src/MoonFactory.sol:MoonFactory \
  --chain-id 11155111 --etherscan-api-key $VERIFY_ETHEREUM_API_KEY
```

## 9. Backend + frontend

Use the dev launcher (recommended):
```bash
./scripts/dev.sh
```

Or manual:
```bash
# Backend
cd backend
cp .env.example .env  # fill in factory addresses + DB_PROVIDER + DB_URL
npm install
npx prisma generate
npx prisma db push
npm run dev

# Frontend
cd ../frontend
cp .env.example .env  # fill in CHAIN_FACTORY_* addresses
npm install --legacy-peer-deps
npm run dev
```

### Database configuration

The backend uses PostgreSQL (required for production and local dev):

```env
DB_URL=postgresql://moon:moon@localhost:5432/moonfun
```

The Prisma schema has `provider = "postgresql"` hardcoded. PostgreSQL 16+ is required.

## 10. Upgrades

Implementation upgrades (affects new clones only):

```bash
# Deploy a new MoonToken implementation
forge create src/MoonToken.sol:MoonToken --rpc-url $CHAIN_ETHEREUM_SEPOLIA_RPC_URL --private-key $WALLET_PRIVATE_KEY

# Point the factory at it
cast send $CHAIN_FACTORY_ETHEREUM_SEPOLIA "upgradeMoonTokenImpl(address)" <newImpl> \
  --rpc-url $CHAIN_ETHEREUM_SEPOLIA_RPC_URL --private-key $WALLET_PRIVATE_KEY
```

Existing clones are immutable and unaffected.

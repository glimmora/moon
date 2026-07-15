# moon.fun

> A permissionless meme-token launchpad with multi-shape bonding curves, on-chain referrals, creator fee vaults, and a self-buyback-and-burn flywheel for the `$MOON` governance token.

[![CI](https://img.shields.io/badge/CI-foundry%20%2B%20pnpm-blue)](./.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636.svg)](https://soliditylang.org/)
[![Foundry](https://img.shields.io/badge/Built%20with-Foundry-FF7A13.svg)](https://getfoundry.sh/)

---

## Overview

`moon.fun` lets anyone launch an ERC-20 meme token in seconds with no upfront liquidity. Tokens are bought and sold against an on-chain **bonding curve** (linear, exponential, or logarithmic). When a token's market cap reaches the graduation threshold, the curve mints the reserved supply, seeds a Uniswap V2 pool, and burns the LP tokens — graduating the token to permissionless DEX trading.

A portion of every trade fee flows back to the protocol:

- **40%** → Dev wallet
- **30%** → `MoonBurner` (buyback-and-burn of `$MOON`)
- **30%** → Treasury

Creators earn a share of fees through `CreatorFeeVault`, and referrers earn through `ReferralRegistry` — both pull-payment to avoid reentrancy.

---

## Architecture

```
                    ┌─────────────────────────────────────────────┐
                    │                 MoonFactory                  │
                    │   createToken() → Clones(MoonToken, Curve)  │
                    └───────────┬─────────────────────────────────┘
                                │ grants CALLER_ROLE / ACCRUER_ROLE / REFERRER_ROLE
                ┌───────────────┼───────────────┬──────────────────┐
                ▼               ▼               ▼                  ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │ BondingCurve │ │CreatorFeeVault│ │ReferralRegist│ │  FeeRouter   │
        │  buy/sell    │ │  accrueFees  │ │recordReferral│ │ distribute() │
        └──────┬───────┘ └──────────────┘ └──────────────┘ └──────┬───────┘
               │ mint/burn via IMoonToken                          │
               ▼                                                  ▼
        ┌──────────────┐                                  ┌──────────────┐
        │  MoonToken   │                                  │  MoonBurner  │
        │ (ERC-20)     │                                  │ buyback+burn │
        └──────────────┘                                  └──────────────┘
```

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full system design.

---

## Monorepo Layout

```
moon.fun/
├── contracts/      # Foundry project — Solidity 0.8.24 + OpenZeppelin v5
├── frontend/       # Vite 5 + React 18 + wagmi 2 + RainbowKit 2
├── backend/        # Node 20 + Express + Socket.io + Prisma + Postgres
├── docs/           # Architecture, security, deployment, audit, API, contributing
├── scripts/        # Dev setup, audit, deploy-all helpers
└── .github/        # CI workflow
```

---

## Quickstart

### Prerequisites

- [Node.js 20](https://nodejs.org/) (see `.nvmrc`)
- [pnpm 9](https://pnpm.io/) (`corepack enable`)
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`foundryup`)
- [Docker](https://www.docker.com/) (for local Postgres + Redis)

### 1. Clone & install

```bash
git clone https://github.com/glimmora/moon.git moon.fun
cd moon.fun
pnpm install
```

### 2. Smart contracts

```bash
cd contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts
forge build
forge test -vvv
```

### 3. Backend

```bash
cd backend
cp .env.example .env
docker compose up -d          # Postgres + Redis
pnpm dlx prisma migrate dev
pnpm dev
```

### 4. Frontend

```bash
cd frontend
cp .env.example .env
pnpm dev
```

---

## Supported Chains

| Chain              | Chain ID | Type    |
| ------------------ | -------- | ------- |
| BNB Smart Chain    | 56       | mainnet |
| Base               | 8453     | mainnet |
| Arbitrum One       | 42161    | mainnet |
| BSC Testnet        | 97       | testnet |
| Base Sepolia       | 84532    | testnet |
| Arbitrum Sepolia   | 421614   | testnet |
| Ethereum Sepolia   | 11155111 | testnet |

---

## Security

- **Option B tokenomics**: `MoonToken` starts with `totalSupply = 0`. Tokens are minted on buy and burned on sell — no pre-mint, no rug surface.
- **CEI ordering**: every external interaction in `BondingCurve.sell()` happens **after** state effects; the token `burnFrom` is the final call.
- **`CALLER_ROLE` gating**: `FeeRouter`, `MoonBurner`, `CreatorFeeVault`, and `ReferralRegistry` only accept calls from authorized bonding curves.
- **`try/catch` everywhere**: all three fee distribution calls in `_distributeFee()`, the DEX `addLiquidity` in `_graduate()`, and the `buybackAndBurn` self-call are wrapped so a single failing external call never reverts a trade.
- **Pull payments**: creator and referral rewards are claimed, never pushed.
- **Reentrancy guards** on token `_update`, curve `buy`/`sell`, and all claim functions.
- **X-Mode anti-sniper**: 99% fee in block 0 of a token's life, decaying to 1.25% by block 6.

See [`docs/SECURITY.md`](./docs/SECURITY.md) and [`docs/AUDIT-CHECKLIST.md`](./docs/AUDIT-CHECKLIST.md).

---

## License

MIT © moon.fun contributors

# moon.fun

> A permissionless meme-token launchpad with bonding curves, on-chain referrals, creator fee vaults, and a self-sustaining buyback-and-burn flywheel.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636.svg)](https://soliditylang.org/)
[![Foundry](https://img.shields.io/badge/Built%20with-Foundry-FF7A13.svg)](https://getfoundry.sh/)
[![Network](https://img.shields.io/badge/Deployed-Sepolia-9b59b6.svg)](https://sepolia.etherscan.io/address/0xC3DadD2643a6aB9857880EF7Bf208dEdd31937b3)

---

## Overview

`moon.fun` lets anyone launch an ERC-20 meme token in seconds with no upfront liquidity. Tokens are bought and sold against an on-chain **bonding curve** (linear, exponential, or logarithmic). When a token's market cap reaches the graduation threshold, the curve mints the reserved supply, seeds a Uniswap V2 pool, and burns the LP tokens — graduating the token to permissionless DEX trading.

A portion of every trade fee flows back to the protocol:

- **40%** → Dev wallet
- **30%** → `MoonBurner` (buyback-and-burn)
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
                                │ grants MINTER_ROLE on token → curve
                ┌───────────────┼───────────────┬──────────────────┐
                ▼               ▼               ▼                  ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │ BondingCurve │ │CreatorFeeVault│ │ReferralRegist│ │  FeeRouter   │
        │  buy/sell    │ │  accrueFees  │ │recordReferral│ │ distribute() │
        └──────┬───────┘ └──────────────┘ └──────────────┘ └──────┬───────┘
               │ mint/burn via MINTER_ROLE                         │
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
├── frontend/       # Vite 5 + React 18 + wagmi 2 + RainbowKit 2 + Tailwind 3
├── backend/        # Node 20 + Express + Socket.io + Prisma + Postgres
├── docs/           # Architecture, security, deployment, audit, API, contributing
├── scripts/        # dev.sh, setup-dev.sh, audit.sh, deploy-all.sh, security-test-sepolia.sh, e2e-launch.mjs
└── .github/        # CI workflow
```

---

## Quickstart

### Prerequisites

- [Node.js 20](https://nodejs.org/)
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`foundryup`) — for smart contract tests
- [PostgreSQL](https://www.postgresql.org/) 16+ (required)

### One-command dev launcher

```bash
git clone https://github.com/glimmora/moon.git moon.fun
cd moon.fun
./scripts/dev.sh
```

This will:
- Install frontend + backend dependencies (if missing)
- Auto-detect Postgres (errors with a helpful hint if not running)
- Generate Prisma client + push schema
- Start backend on port `4000`
- Start frontend on port `5173`

Other commands:
```bash
./scripts/dev.sh frontend   # frontend only
./scripts/dev.sh backend    # backend only
./scripts/dev.sh stop       # stop all processes
./scripts/dev.sh status     # show running processes
```

### Manual setup (alternative)

<details>
<summary>Click to expand</summary>

```bash
# 1. Smart contracts
cd contracts
forge install foundry-rs/forge-std@v1.7.1 OpenZeppelin/openzeppelin-contracts@v5.0.2
forge build
forge test -vvv

# 2. Backend
cd backend
cp .env.example .env
# Edit .env — set DATABASE_URL to your Postgres connection
npm install
npx prisma generate
npx prisma db push
npm run dev

# 3. Frontend
cd frontend
cp .env.example .env
npm install --legacy-peer-deps
npm run dev
```

</details>

---

## Deployed Contracts (Ethereum Sepolia)

All contracts deployed and verified on-chain at block 11,285,810.

| Contract | Address |
|----------|---------|
| MoonFactory | `0xC3DadD2643a6aB9857880EF7Bf208dEdd31937b3` |
| FeeRouter | `0x95032e828144707e9754993e421c31dE986A3bb1` |
| CreatorFeeVault | `0x3c67d2f9f3aA5B909332f2eF7a3862b58015345B` |
| ReferralRegistry | `0xADB082E1AA4696bffDAD8aB754874d31E37e9Fe0` |
| MoonBurner | `0xaca899314bd11E103779CA0a790C9b33c2b8FebA` |
| MoonV3Concentrator | `0x17Fa6827FacD0B41Fa263ed1bC1E6D0bD73DaD30` |

See [`contracts/deployments/ethereum-sepolia.json`](./contracts/deployments/ethereum-sepolia.json) for full deployment record.

---

## Supported Chains

| Chain              | Chain ID | Type    | Status |
| ------------------ | -------- | ------- | ------ |
| Ethereum Sepolia   | 11155111 | testnet | ✅ Deployed |
| BNB Smart Chain    | 56       | mainnet | Planned |
| Base               | 8453     | mainnet | Planned |
| Arbitrum One       | 42161    | mainnet | Planned |
| BSC Testnet        | 97       | testnet | Planned |
| Base Sepolia       | 84532    | testnet | Planned |
| Arbitrum Sepolia   | 421614   | testnet | Planned |

---

## Features

### Smart Contracts
- **Tokenomics**: Mint-on-buy, burn-on-sell. No pre-mint, no rug surface.
- **3 Curve Shapes**: Linear, Exponential (pump.fun style), Logarithmic
- **3 Supply Tiers**: 1B, 10B, 100B tokens
- **Anti-Sniper**: 99% fee at block 0, linear decay to 1.25% by block 6
- **Auto-Graduation**: Tokens graduate to DEX LP at threshold; LP permanently burned
- **Fee Distribution**: 20% creator + 10% referrer + 70% FeeRouter (40/30/30 dev/burn/treasury)
- **Pull Payments**: Creator fees + referral rewards claimed, never pushed
- **Access Control**: 7 roles (DEFAULT_ADMIN, OPERATOR, PAUSER, MINTER, ACCRUER, REFERRER, CALLER)
- **EIP-1167 Clones**: Cheap per-token deployment via OpenZeppelin Clones

### Frontend
- **Modern UI**: Glassmorphism, aurora background, gradient accents, smooth animations
- **Dark/Light Theme**: Toggle with system preference detection + localStorage persistence
- **Toast Notifications**: Wallet connect/disconnect, chain changes, mode toggle events
- **Auto Chain Switch**: Wallet auto-prompts switch when transacting on a different chain
- **Pages**: Home, Explore, Create, Token Detail, Portfolio, Leaderboard, Watchlist, Claim, Referral
- **Live Preview**: Real-time token preview on Create page
- **Graduation Countdown**: Visual ETA to graduation on token cards
- **Responsive**: Mobile-first with safe-area support for notched devices

### Backend
- **Multi-chain Indexer**: Polls TokenCreated, Bought, Sold, Graduated events
- **Holder Indexing**: Periodic Transfer event scanning with per-token checkpoints
- **Portfolio API**: Holdings, P&L, recent trades, created tokens
- **Leaderboard API**: Top traders, creators, tokens
- **Socket.io**: Live trade updates via token rooms
- **Rate Limiting**: 120 req/min per IP

---

## Security

- **CEI ordering**: every external interaction in `BondingCurve.sell()` happens **after** state effects; the token `burnFrom` is the final call.
- **Fee handling**: `_getBuyOut()`/`_getSellOut()` return fee as a fraction (1e18-based); `buy()`/`sell()` convert to absolute amount before subtraction and distribution.
- **MINTER_ROLE grant**: Factory grants `MINTER_ROLE` to the bonding curve clone so it can mint (buy) and burnFrom (sell).
- **`CALLER_ROLE` gating**: `FeeRouter`, `MoonBurner`, `CreatorFeeVault`, and `ReferralRegistry` only accept calls from authorized bonding curves.
- **`try/catch` everywhere**: all fee distribution calls, DEX `addLiquidity`, and `buybackAndBurn` are wrapped so a single failing external call never reverts a trade.
- **Pull payments**: creator and referral rewards are claimed, never pushed.
- **Reentrancy guards** on token `_update`, curve `buy`/`sell`, and all claim functions.
- **Anti-sniper**: 99% fee in block 0 of a token's life, decaying to 1.25% by block 6.

### On-Chain Test Results

**28/28 tests PASS** on Ethereum Sepolia — see:
- [`docs/TEST-REPORT-SEPOLIA-v2.md`](./docs/TEST-REPORT-SEPOLIA-v2.md) — comprehensive security + feature tests
- [`docs/AUDIT-REPORT.md`](./docs/AUDIT-REPORT.md) — formal audit report (score: 9.5/10)

Run on-chain tests:
```bash
./scripts/security-test-sepolia.sh
```

---

## License

MIT © moon.fun contributors

# Moon — Architecture

## 1. System overview

`Moon` is a permissionless meme-token launchpad. Anyone deploys an ERC-20 token
against an on-chain bonding curve; the curve mints on buy and burns on sell. When the
token's market cap reaches the graduation threshold, the curve seeds a Uniswap V2 pool
and burns the LP — graduating the token to permissionless DEX trading.

```
                       ┌───────────────────────────────────────────────┐
                       │                MoonFactory                    │
                       │   createToken() → Clones(MoonToken, Curve)   │
                       └───────────┬───────────────────────────────────┘
                                   │ grants (try/catch, non-blocking)
                                   │ CALLER_ROLE / ACCRUER_ROLE / REFERRER_ROLE
                                   │ MINTER_ROLE on token → curve
            ┌──────────────────────┼──────────────────────┬─────────────┐
            ▼                      ▼                      ▼             ▼
   ┌────────────────┐   ┌────────────────────┐  ┌──────────────────┐  ┌──────────────┐
   │  BondingCurve  │   │  CreatorFeeVault   │  │ ReferralRegistry │  │  FeeRouter   │
   │  buy / sell    │   │  accrue / claim    │  │ record / claim   │  │  distribute  │
   │  graduate      │   │                    │  │                  │  │              │
   └────┬────┬──────┘   └────────────────────┘  └──────────────────┘  └──────┬───────┘
        │    │ mint/burn via MINTER_ROLE                                 │
        │    ▼                                                            ▼
        │  ┌──────────────┐                                      ┌──────────────┐
        │  │  MoonToken   │                                      │  MoonBurner  │
        │  │  (ERC-20)    │                                      │ buyback+burn │
        │  └──────────────┘                                      └──────────────┘
        │
        ▼ fee (quote asset)
   split: 20% creator / 10% referrer / 70% FeeRouter → 40% dev / 30% burn / 30% treasury
```

## 2. Contracts

### 2.1 MoonToken
- ERC-20 + AccessControl + ReentrancyGuard. **Not** ERC20Burnable.
- Mint-on-buy, burn-on-sell. `totalSupply` starts at 0.
- `s_totalSupplyInit` (1B/10B/100B cap) drives max-tx / max-hold math.
- `_update` override enforces limits + cooldown, wrapped in `nonReentrant`.
- `burn()` (self, permissionless) and `burnFrom()` (MINTER_ROLE or allowance) are explicit.
- `grantMinterRole(address)` — callable by MINTER_ROLE, used by factory to delegate to curve.

### 2.2 BondingCurve
- Cloned per token. Three shapes: LINEAR, EXPONENTIAL, LOGARITHMIC.
- Price bounds: START_PRICE=270e6 → END_PRICE=270e9 (1e18 fixed point).
- Anti-sniper: 99% fee block 0, linear decay to 1.25% by block 6.
- `buy()`: pull quote → compute `feeAmount = (quoteAmountIn * fee) / 1e18` → mint tokens →
  distribute fee (try/catch ×3) → maybe graduate.
- `sell()`: **CEI** — effects (decrement reserves by `grossQuoteOut`) → interactions
  (send quote, distribute fee) → **burnFrom LAST**.
- `_distributeFee()` wraps all 3 external calls (CreatorFeeVault, ReferralRegistry,
  FeeRouter) in try/catch — a single failure never reverts a trade.
- For native ETH, calls `FeeRouter.distribute{value: routerShare}()` directly.
- `_graduate()`: mints reserved supply, seeds Uniswap V2 LP (try/catch), burns LP.
- `rescue()` blocks `s_token` + `s_quoteAsset`; supports native ETH (`address(0)`).
- `rescueGraduation()` recovers stuck tokens + ETH after failed DEX addLiquidity.

### 2.3 MoonFactory
- Clones MoonToken + BondingCurve via OpenZeppelin `Clones`.
- `createToken()` validates params, initializes both clones, grants roles via non-blocking
  try/catch:
  - `CALLER_ROLE` on FeeRouter → curve
  - `ACCRUER_ROLE` on CreatorFeeVault → curve
  - `REFERRER_ROLE` on ReferralRegistry → curve
  - `MINTER_ROLE` on MoonToken → curve (via `grantMinterRole()`)
  - `setExempt(curve, true)` on MoonToken (bypass transfer limits)
- `upgradeMoonTokenImpl()` / `upgradeBondingCurveImpl()` for implementation upgrades
  (new clones use the new impl; existing clones are unaffected).

### 2.4 FeeRouter
- Split: 40% dev / 30% MoonBurner / 30% treasury.
- `CALLER_ROLE` — only bonding curves may call `distribute()`.
- `distribute()` checks `require(msg.value == amount)` for native ETH.
- `buybackAndBurn` wrapped in try/catch. If `moonBurner == address(0)`, burn share → treasury.
- `_send()` falls back to treasury on native push failure, emits `PushFallback` event.

### 2.5 MoonBurner
- `CALLER_ROLE` — only FeeRouter may call `buybackAndBurn()`.
- Swap is an external self-call (`_executeSwap`) wrapped in try/catch — emits
  `BuybackSkipped` on failure (with reason string).
- `rescue()` blocks `$MOON` (`moonToken`).
- Pausable.

### 2.6 CreatorFeeVault
- `ACCRUER_ROLE` — bonding curves accrue fees.
- Creator set on **first** accrue, **immutable** afterwards (anti-hijack).
- `claimFees()` / `claimAllFees()` are pull-payment + nonReentrant.

### 2.7 ReferralRegistry
- `REFERRER_ROLE` — bonding curves record referrals.
- `recordReferral` has exactly **6 params** (no 5-param overload).
- `setReferrer()` is one-shot per trader (permanent link, anti-abuse).
- `registerCode(bytes32)` for shareable referral codes.
- `claimRewards()` / `claimAllRewards()` pull-payment + nonReentrant.

### 2.8 MoonV3Concentrator (stub)
- Burns V2 LP and returns underlying tokens to the user. V3 mint intentionally omitted.

## 3. Frontend

- React 18 + Vite 5 + wagmi 2 + viem 2 + RainbowKit 2 + Tailwind 3.
- 7 chains (3 mainnet + 4 testnet) with a mainnet/testnet toggle (`NetworkModeProvider`).
- **Dark/Light theme** with system preference detection + localStorage persistence.
- **Toast notifications** for wallet connect/disconnect, chain changes, mode toggle.
- **Auto chain switch**: `useCreateToken` + `useTrade` call `switchChainAsync` before
  sending transactions if wallet is on a different chain.
- On-chain curve math mirrored in `src/lib/curve.ts` for optimistic quoting.
- Pages: Home, Advanced (filters), Create (with live preview + auto chain), TokenDetail
  (chart + trade + holders + bubblemap), Portfolio, Leaderboard, Watchlist, Claim,
  Referral, NotFound.
- Smooth page transitions via View Transitions API + CSS keyframe fallback.

## 4. Backend

- Node 20 + Express + Socket.io + viem + Prisma + Postgres 16 (or SQLite for dev).
- Per-chain polling indexer (`chainListener`) for TokenCreated / Bought / Sold / Graduated.
- Holder refresh listener (`holderListener`) polls Transfer events with per-token
  checkpoints + bounded block range.
- REST API under `/api/*`:
  - Tokens: list, get, search, prices, holders, bubblemap
  - Portfolio: holdings, trades, created tokens
  - Leaderboard: top traders, creators, tokens
  - Creator fees + referral stats
- Socket.io namespace for live trade push.
- Pino logging, Zod-validated env, idempotent checkpoints.

## 5. Data flow (a single buy)

1. User signs `buy(quoteIn, minOut, referrer)` on the TradePanel.
2. Frontend auto-switches wallet chain if needed (`switchChainAsync`).
3. `BondingCurve.buy` pulls quote, computes `feeAmount = (quoteIn * fee) / 1e18`,
   mints tokens to buyer.
4. `_distributeFee` accrues creator fee (try/catch), records referral (try/catch),
   routes remainder to FeeRouter via `distribute{value: routerShare}()` (try/catch).
5. FeeRouter pushes dev/treasury shares, calls `MoonBurner.buybackAndBurn` (try/catch).
6. If graduation threshold hit, `_graduate` seeds Uniswap V2 LP and burns LP.
7. Backend indexer sees `Bought` log → upserts trade + updates token stats → emits via Socket.io.
8. Frontend TradePanel refetches + chart updates + toast notification.

## 6. Upgrade path

- Implementations are upgradable via the factory (new clones use the new impl).
- Existing clones are **not** upgraded automatically (immutable proxies). For state
  migration, a future governance proposal can deploy a migrator that reads old curve
  state and initializes a new clone.

## 7. Deployed contracts (Ethereum Sepolia)

| Contract | Address |
|----------|---------|
| MoonFactory | `0xC3DadD2643a6aB9857880EF7Bf208dEdd31937b3` |
| FeeRouter | `0x95032e828144707e9754993e421c31dE986A3bb1` |
| CreatorFeeVault | `0x3c67d2f9f3aA5B909332f2eF7a3862b58015345B` |
| ReferralRegistry | `0xADB082E1AA4696bffDAD8aB754874d31E37e9Fe0` |
| MoonBurner | `0xaca899314bd11E103779CA0a790C9b33c2b8FebA` |
| MoonV3Concentrator | `0x17Fa6827FacD0B41Fa263ed1bC1E6D0bD73DaD30` |

Deployer: `0xbBfD7255a1817b7d02a5cc9A0669a9C80599ef24`
RPC: `https://ethereum-sepolia-rpc.publicnode.com`

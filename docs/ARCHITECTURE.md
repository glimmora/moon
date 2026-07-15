# moon.fun — Architecture

## 1. System overview

`moon.fun` is a permissionless meme-token launchpad. Anyone deploys an ERC-20 token
against an on-chain bonding curve; the curve mints on buy and burns on sell (Option B).
When the token's market cap reaches the graduation threshold, the curve seeds a Uniswap
V2 pool and burns the LP to `0xdEaD` — graduating the token to permissionless DEX trading.

```
                       ┌───────────────────────────────────────────────┐
                       │                MoonFactory                    │
                       │   createToken() → Clones(MoonToken, Curve)   │
                       └───────────┬───────────────────────────────────┘
                                   │ grants (try/catch, non-blocking)
            ┌──────────────────────┼──────────────────────┬─────────────┐
            ▼                      ▼                      ▼             ▼
   ┌────────────────┐   ┌────────────────────┐  ┌──────────────────┐  ┌──────────────┐
   │  BondingCurve  │   │  CreatorFeeVault   │  │ ReferralRegistry │  │  FeeRouter   │
   │  buy / sell    │   │  accrue / claim    │  │ record / claim   │  │  distribute  │
   │  graduate      │   │                    │  │                  │  │              │
   └────┬────┬──────┘   └────────────────────┘  └──────────────────┘  └──────┬───────┘
        │    │ mint/burn via IMoonToken                                       │
        │    ▼                                                                ▼
        │  ┌──────────────┐                                          ┌──────────────┐
        │  │  MoonToken   │                                          │  MoonBurner  │
        │  │  (ERC-20)    │                                          │ buyback+burn │
        │  └──────────────┘                                          └──────────────┘
        │
        ▼ fee (quote asset)
   split: 20% creator / 10% referrer / 70% FeeRouter → 40% dev / 30% burn / 30% treasury
```

## 2. Contracts

### 2.1 MoonToken
- ERC-20 + AccessControl + ReentrancyGuard. **Not** ERC20Burnable.
- Option B: `totalSupply` starts at 0. Mint on buy (`MINTER_ROLE`), burn on sell.
- `s_totalSupplyInit` (1B/10B/100B cap) drives max-tx / max-hold math.
- `_update` override enforces limits + cooldown, wrapped in `nonReentrant`.
- `burn()` (self) and `burnFrom()` (MINTER_ROLE or allowance) are explicit.

### 2.2 BondingCurve
- Cloned per token. Three shapes: LINEAR, EXPONENTIAL, LOGARITHMIC.
- Price bounds: START_PRICE=270e6 → END_PRICE=270e9 (1e18 fixed point).
- X-Mode anti-sniper: 99% fee block 0, linear decay to 1.25% by block 6.
- `buy()`: pull quote → mint tokens → distribute fee (try/catch ×3) → maybe graduate.
- `sell()`: **CEI** — effects (decrement reserves by `grossQuoteOut`) → interactions
  (send quote, distribute fee) → **burnFrom LAST**.
- `_distributeFee()` wraps all 3 external calls (CreatorFeeVault, ReferralRegistry,
  FeeRouter) in try/catch — a single failure never reverts a trade.
- `_graduate()`: mints reserved supply, seeds Uniswap V2 LP (try/catch), burns LP to `0xdEaD`.
- `rescue()` blocks `s_token` + `s_quoteAsset`; supports native ETH (`address(0)`).

### 2.3 MoonFactory
- Clones MoonToken + BondingCurve via OpenZeppelin `Clones`.
- `createToken()` validates params, initializes both clones, grants roles via non-blocking
  try/catch.
- `upgradeMoonTokenImpl()` / `upgradeBondingCurveImpl()` for implementation upgrades
  (new clones use the new impl; existing clones are unaffected).

### 2.4 FeeRouter
- Split: 40% dev / 30% MoonBurner / 30% treasury.
- `CALLER_ROLE` — only bonding curves may call `distribute()`.
- `buybackAndBurn` wrapped in try/catch. If `moonBurner == address(0)`, burn share → treasury.

### 2.5 MoonBurner
- `CALLER_ROLE` — only FeeRouter may call `buybackAndBurn()`.
- Swap is an external self-call (`_executeSwap`) wrapped in try/catch — emits
  `BuybackSkipped` on failure.
- `rescue()` blocks `$MOON` (`i_moonToken`).
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
- `claimRewards()` pull-payment + nonReentrant.

### 2.8 MoonV3Concentrator (stub)
- Burns V2 LP and returns underlying tokens to the user. V3 mint intentionally omitted.

## 3. Frontend

- React 18 + Vite 5 + wagmi 2 + viem 2 + RainbowKit 2 + Tailwind 3.
- 7 chains (3 mainnet + 4 testnet) with a mainnet/testnet toggle (`NetworkModeProvider`).
- On-chain curve math mirrored in `src/lib/curve.ts` for optimistic quoting.
- Pages: Home (feed), Advanced (filters), Create, TokenDetail (chart + trade + holders),
  Claim (creator fees), Referral, Watchlist, NotFound.

## 4. Backend

- Node 20 + Express + Socket.io + viem + Prisma + Postgres 16 + Redis 7.
- Per-chain polling indexer (`chainListener`) for TokenCreated / Bought / Sold / Graduated.
- Holder refresh listener (`holderListener`) polls Transfer events.
- REST API under `/api/*`, Socket.io namespace for live trade push.
- Pino logging, Zod-validated env, idempotent checkpoints.

## 5. Data flow (a single buy)

1. User signs `buy(quoteIn, minOut, referrer)` on the TradePanel.
2. `BondingCurve.buy` pulls quote, computes `tokensOut`, mints tokens to buyer.
3. `_distributeFee` accrues creator fee (try/catch), records referral (try/catch),
   routes remainder to FeeRouter (try/catch).
4. FeeRouter pushes dev/treasury shares, calls `MoonBurner.buybackAndBurn` (try/catch).
5. If graduation threshold hit, `_graduate` seeds Uniswap V2 LP and burns LP to `0xdEaD`.
6. Backend indexer sees `Bought` log → upserts trade + updates token stats → emits via Socket.io.
7. Frontend TradePanel refetches + chart updates.

## 6. Upgrade path

- Implementations are upgradable via the factory (new clones use the new impl).
- Existing clones are **not** upgraded automatically (immutable proxies). For state
  migration, a future governance proposal can deploy a migrator that reads old curve
  state and initializes a new clone.

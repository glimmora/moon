# moon.fun — Engineering Skill Rules

Canonical rules every contributor (human or AI) MUST follow when touching this repo.
These rules are derived from the security fixes applied after the v1 audit and are
non-negotiable.

## 1. Solidity

### 1.1 Token model
- **Option B only.** `MoonToken` mints on buy, burns on sell. `totalSupply` starts at 0.
- Never pre-mint the full supply. Use `s_totalSupplyInit` for max-tx / max-hold math.
- Supply tiers are restricted to **1B / 10B / 100B** — validate in `initialize()`.
- `MoonToken` MUST NOT inherit `ERC20Burnable`. Self-burn lives in `burn()`; external burn
  lives in `burnFrom()` and is guarded by `MINTER_ROLE`.

### 1.2 CEI ordering
- In `BondingCurve.sell()`: effects → interactions → **burn last**.
- `_distributeFee()` MUST run after reserves are updated but the token burn is the final
  external call.
- `s_realQuoteReserves` is decremented by `grossQuoteOut` (before fee split), never
  `quoteOut`.

### 1.3 External calls
- Every external call inside a trade path MUST be wrapped in `try/catch`:
  - `CreatorFeeVault.accrueFees`
  - `ReferralRegistry.recordReferral`
  - `FeeRouter.distribute`
  - DEX `addLiquidity` (in `_graduate`)
  - `MoonBurner.buybackAndBurn` (self-call in `MoonBurner._executeSwap`)
- A failing fee/graduation side-effect MUST NOT revert the trade.

### 1.4 Access control
- Use `AccessControl` roles, never `Ownable` for privileged entrypoints:
  - `MINTER_ROLE` → factory (mint/burn on curve)
  - `CALLER_ROLE` → bonding curves (on FeeRouter / MoonBurner)
  - `ACCRUER_ROLE` → bonding curves (on CreatorFeeVault)
  - `REFERRER_ROLE` → bonding curves (on ReferralRegistry)
- Role grants from the factory MUST be `try/catch` and **non-blocking**.

### 1.5 Reentrancy
- `_update` override in `MoonToken` is `nonReentrant`.
- `buy` / `sell` / `claimFees` / `claimRewards` are `nonReentrant`.

### 1.6 Math
- All bonding-curve math is in 1e18 / 1e36 fixed point.
- Square root via Babylonian; cube-root-ish (`pow1_5`) via Newton, 3 iterations.
- Overflow-safe: use `unchecked` only after explicit bounds checks.

### 1.7 Referrals
- `recordReferral` has exactly **6 parameters**. There is no 5-param overload.
- Referrer links are **permanent** (`setReferrer`) to prevent churn abuse.
- Referral codes (`registerCode`) are unique `bytes32`.

## 2. Frontend (React + wagmi)

- React 18 + Vite 5 + wagmi 2 + viem 2 + RainbowKit 2 + Tailwind 3.
- **All addresses and ABIs come from `src/config/contracts.ts` + `src/abi/*`** — never hardcode.
- Network switching uses `NetworkModeProvider` (mainnet/testnet toggle).
- All reads go through custom hooks in `src/hooks/*` — components stay dumb.
- No `any`. Strict TypeScript.

## 3. Backend (Node + Express + Prisma)

- Pino for logging (never `console.log`).
- All env validated with Zod in `src/config/env.ts` — fail fast on boot.
- Listeners are per-chain and idempotent (use `s_checkpoint`).
- Socket.io namespaces mirror REST resources.

## 4. Git & CI

- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- `forge test` + `forge lint` (solhint) + `pnpm lint` + `pnpm typecheck` must pass on CI.
- Never commit `.env`, `broadcast/`, `out/`, or `lib/`.

## 5. Do NOT
- ❌ Add a 5-param `recordReferral`.
- ❌ Pre-mint token supply (Option A is forbidden).
- ❌ Push referral/creator rewards (always pull).
- ❌ Use `tx.origin` for authorization.
- ❌ Use floating pragma in `src/` (lock `0.8.24`).
- ❌ Add `ERC20Burnable` to `MoonToken`.

# moon.fun — Engineering Skill Rules

Canonical rules every contributor (human or AI) MUST follow when touching this repo.
These rules are derived from the security fixes applied after the v2 audit + on-chain
testing on Ethereum Sepolia. They are non-negotiable.

## 1. Solidity

### 1.1 Token model
- **Mint-on-buy, burn-on-sell.** `MoonToken` starts with `totalSupply = 0`.
- Never pre-mint the full supply. Use `s_totalSupplyInit` for max-tx / max-hold math.
- Supply tiers are restricted to **1B / 10B / 100B** — validate in `initialize()`.
- `MoonToken` MUST NOT inherit `ERC20Burnable`. Self-burn lives in `burn()` (permissionless);
  external burn lives in `burnFrom()` and is guarded by `MINTER_ROLE`.

### 1.2 CEI ordering
- In `BondingCurve.sell()`: effects → interactions → **burn last**.
- `_distributeFee()` MUST run after reserves are updated but the token burn is the final
  external call.
- `s_realQuoteReserves` is decremented by `grossQuoteOut` (before fee split), never
  `quoteOut`.

### 1.3 Fee handling (CRITICAL)
- `_getBuyOut()` / `_getSellOut()` return `fee` as a **fraction** (1e18-based, e.g. 0.99e18 = 99%).
- `buy()` / `sell()` MUST convert to **absolute amount** before subtraction:
  ```solidity
  uint256 feeAmount = (quoteAmountIn * fee) / 1e18;
  s_realQuoteReserves += (quoteAmountIn - feeAmount);
  _distributeFee(feeAmount, referrer);  // pass absolute, NOT fraction
  ```
- NEVER pass `fee` (fraction) directly to `_distributeFee()` — it will try to send
  0.99 ETH as fee when only 0.01 ETH was received.
- `Bought` / `Sold` events MUST emit `feeAmount` (absolute), not `fee` (fraction).

### 1.4 MINTER_ROLE grant (CRITICAL)
- The factory MUST grant `MINTER_ROLE` to the bonding curve clone in `createToken()`:
  ```solidity
  try IMoonToken(token).grantMinterRole(curve) {} catch {}
  try IMoonToken(token).setExempt(curve, true) {} catch {}
  ```
- Without this, `mint()` (buy) and `burnFrom()` (sell) will revert with
  `AccessControlUnauthorizedAccount`.
- `MoonToken.grantMinterRole(address)` is `onlyRole(MINTER_ROLE)` — factory has MINTER
  from `initialize()`, and can delegate to the curve.

### 1.5 FeeRouter.distribute with native ETH
- For native ETH, call `distribute{value: routerShare}()` directly — do NOT send ETH via
  low-level `call{value:}` then call `distribute()` without value.
- `FeeRouter.distribute()` checks `require(msg.value == amount)` — without `{value:}`,
  it always reverts.
- For ERC-20 quote assets: `safeTransfer` first, then call `distribute()` (which does
  `safeTransferFrom`).

### 1.6 External calls
- Every external call inside a trade path MUST be wrapped in `try/catch`:
  - `CreatorFeeVault.accrueFees`
  - `ReferralRegistry.recordReferral`
  - `FeeRouter.distribute`
  - DEX `addLiquidity` (in `_graduate`)
  - `MoonBurner.buybackAndBurn` (self-call in `MoonBurner._executeSwap`)
- A failing fee/graduation side-effect MUST NOT revert the trade.

### 1.7 Access control
- Use `AccessControl` roles, never `Ownable` for privileged entrypoints:
  - `MINTER_ROLE` → factory + curve (mint/burn on curve)
  - `CALLER_ROLE` → bonding curves (on FeeRouter / MoonBurner)
  - `ACCRUER_ROLE` → bonding curves (on CreatorFeeVault)
  - `REFERRER_ROLE` → bonding curves (on ReferralRegistry)
- Role grants from the factory MUST be `try/catch` and **non-blocking**.
- The factory MUST be granted `DEFAULT_ADMIN_ROLE` on FeeRouter / Vault / Registry
  in the deploy script so it can grant operational roles to curves.

### 1.8 Reentrancy
- `_update` override in `MoonToken` is `nonReentrant`.
- `buy` / `sell` / `claimFees` / `claimRewards` are `nonReentrant`.

### 1.9 Math
- All bonding-curve math is in 1e18 / 1e36 fixed point.
- Square root via Babylonian (bounded to 256 iterations); cube-root-ish (`pow1_5`) via
  Newton, 40 iterations.
- Overflow-safe: use `unchecked` only after explicit bounds checks.

### 1.10 Referrals
- `recordReferral` has exactly **6 parameters**. There is no 5-param overload.
- Referrer links are **permanent** (`setReferrer`) to prevent churn abuse.
- Referral codes (`registerCode`) are unique `bytes32`.

### 1.11 Rescue paths
- `BondingCurve.rescue()` blocks `s_token` and `s_quoteAsset` (can't drain live reserves).
- `BondingCurve.rescueGraduation()` recovers minted-but-unused reserved tokens + leftover
  quote after a graduation where DEX `addLiquidity` failed.
- `MoonBurner.rescue()` blocks the `$MOON` token.

## 2. Frontend (React + wagmi)

- React 18 + Vite 5 + wagmi 2 + viem 2 + RainbowKit 2 + Tailwind 3.
- **All addresses and ABIs come from `src/config/contracts.ts` + `src/abi/*`** — never hardcode.
- Network switching uses `NetworkModeProvider` (mainnet/testnet toggle, defaults to testnet).
- **Auto chain switch**: `useCreateToken` and `useTrade` MUST call `switchChainAsync` before
  `writeContractAsync` if `activeChainId !== targetChainId`.
- **Wallet events**: `useWalletEvents` hook fires toast notifications on connect/disconnect/
  account change/chain change/mode toggle.
- **Theme**: `ThemeProvider` with dark/light toggle, localStorage persistence, system
  preference detection. RainbowKit switches between `darkTheme()` / `lightTheme()`.
- All reads go through custom hooks in `src/hooks/*` — components stay dumb.
- No `any`. Strict TypeScript.

## 3. Backend (Node + Express + Prisma)

- Pino for logging (never `console.log`).
- All env validated with Zod in `src/config/env.ts` — fail fast on boot.
- `DATABASE_URL` accepts both `postgresql://` and `file:` (SQLite) — don't use
  `z.string().url()` (rejects SQLite paths).
- `DATABASE_PROVIDER` env var is NOT used by Prisma schema (Prisma doesn't allow `env()`
  for `provider`). The `dev.sh` script sed-swaps the provider to `sqlite` if needed,
  then restores after `prisma generate/push`.
- **Schema naming**: `Token.holderCount` (Int) — NOT `Token.holders` (conflicts with the
  `holders Holder[]` relation).
- Listeners are per-chain and idempotent (use `IndexerCheckpoint`).
- `holderListener` uses per-token checkpoints + bounded block range (not `fromBlock: 0`).
- Socket.io namespaces mirror REST resources.

## 4. Git & CI

- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- `forge test` + `pnpm lint` + `pnpm typecheck` must pass on CI.
- Never commit `.env`, `broadcast/`, `out/`, or `contracts/lib/`.
- `frontend/src/lib/` MUST be committed (only `contracts/lib/` is gitignored).

## 5. Dev workflow

- Use `./scripts/dev.sh` to start frontend + backend concurrently.
- The script auto-detects Postgres via `pg_isready`, falls back to SQLite.
- Tests on Sepolia: `./scripts/security-test-sepolia.sh` (needs `PRIVATE_KEY` env).
- Deployment: `forge script DeployEthereumSepolia --rpc-url ... --broadcast`.

## 6. Do NOT
- ❌ Pass `fee` (fraction) directly to `_distributeFee()` — convert to `feeAmount` first.
- ❌ Forget to grant `MINTER_ROLE` to the curve in `createToken()`.
- ❌ Call `FeeRouter.distribute()` without `{value:}` for native ETH.
- ❌ Add a 5-param `recordReferral`.
- ❌ Pre-mint token supply.
- ❌ Push referral/creator rewards (always pull).
- ❌ Use `tx.origin` for authorization.
- ❌ Use floating pragma in `src/` (lock `0.8.24`).
- ❌ Add `ERC20Burnable` to `MoonToken`.
- ❌ Name a scalar field the same as a relation in Prisma (e.g. `holders Int` + `holders Holder[]`).
- ❌ Use `env()` for Prisma `provider` field (must be a string literal).
- ❌ Use `z.string().url()` for `DATABASE_URL` (rejects SQLite `file:` paths).

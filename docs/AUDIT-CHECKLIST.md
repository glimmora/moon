# Moon — Pre-Audit Checklist

Run through this list before any mainnet deployment and before engaging a formal auditor.

## Solidity

### Token model
- [ ] `MoonToken` does **not** inherit `ERC20Burnable`.
- [ ] `totalSupply` starts at 0 (Option B). No pre-mint in `initialize()`.
- [ ] Supply tier validated: only 0 (1B), 1 (10B), 2 (100B) accepted.
- [ ] `s_totalSupplyInit` used for max-tx / max-hold math (not live `totalSupply`).
- [ ] `burn()` (self) and `burnFrom()` (MINTER_ROLE or allowance) are explicit.

### CEI
- [ ] `BondingCurve.sell()`: effects → interactions → **burnFrom LAST**.
- [ ] `s_realQuoteReserves` decremented by `grossQuoteOut` (pre-fee), not `quoteOut`.
- [ ] No state writes after any external call in `buy` / `sell`.

### try/catch
- [ ] `CreatorFeeVault.accrueFees` wrapped in try/catch in `_distributeFee`.
- [ ] `ReferralRegistry.recordReferral` wrapped in try/catch in `_distributeFee`.
- [ ] `FeeRouter.distribute` wrapped in try/catch in `_distributeFee`.
- [ ] DEX `addLiquidity` wrapped in try/catch in `_graduate`.
- [ ] `MoonBurner.buybackAndBurn` self-call wrapped in try/catch.

### Access control
- [ ] `MINTER_ROLE` on MoonToken (factory only).
- [ ] `CALLER_ROLE` on FeeRouter + MoonBurner (bonding curves only).
- [ ] `ACCRUER_ROLE` on CreatorFeeVault (bonding curves only).
- [ ] `REFERRER_ROLE` on ReferralRegistry (bonding curves only).
- [ ] Factory role grants use try/catch and are non-blocking.
- [ ] No `tx.origin` authorization anywhere.
- [ ] No `Ownable` for privileged entrypoints (AccessControl only).

### Reentrancy
- [ ] `MoonToken._update` is `nonReentrant`.
- [ ] `BondingCurve.buy` / `sell` are `nonReentrant`.
- [ ] `CreatorFeeVault.claimFees` / `claimAllFees` are `nonReentrant`.
- [ ] `ReferralRegistry.claimRewards` is `nonReentrant`.

### Referrals
- [ ] `recordReferral` has exactly **6** parameters. No 5-param overload.
- [ ] `setReferrer` is one-shot per trader (permanent).
- [ ] `CannotSelfRefer` enforced.
- [ ] `registerCode` enforces unique `bytes32` codes.

### Creator vault
- [ ] Creator set on first accrue, **immutable** afterwards.
- [ ] `claimFees` / `claimAllFees` are pull-payment.

### Rescue
- [ ] `BondingCurve.rescue` blocks `s_token` + `s_quoteAsset`.
- [ ] `MoonBurner.rescue` blocks `i_moonToken` (`$MOON`).
- [ ] `MoonV3Concentrator.rescue` blocks `$MOON`.
- [ ] All rescue functions are admin-only.

### Math
- [ ] All fixed-point math in 1e18 / 1e36.
- [ ] Square root via Babylonian (bounded iterations).
- [ ] `pow1_5` via Newton's method (3 iterations), overflow-safe.
- [ ] No `unchecked` blocks without explicit bounds checks.
- [ ] Price clamped to `[START_PRICE, END_PRICE]`.

### X-Mode
- [ ] Block 0: 99% fee.
- [ ] Linear decay to 1.25% by block 6.
- [ ] Flat 1.25% after block 6.

### Graduation
- [ ] `_graduate` mints reserved supply (`totalSupplyInit - realReservesInit`).
- [ ] LP burned to `0xdEaD` (not to deployer).
- [ ] `addLiquidity` wrapped in try/catch.
- [ ] `s_graduated` set to true before DEX interaction.

## Foundry
- [ ] `forge build` succeeds with `via_ir = true`, `optimizer_runs = 200`.
- [ ] `forge test -vvv` passes.
- [ ] Fuzz tests cover supply tier + curve shape combinations.
- [ ] Revert paths tested (empty name, invalid tier, max-tx/hold/cooldown bounds).
- [ ] `forge lint` (solhint) passes.

## Slither
- [ ] `slither .` has no high/medium severity findings.
- [ ] All reentrancy findings reviewed and confirmed false-positives (nonReentrant guards).

## Frontend
- [ ] No `any` types.
- [ ] All addresses from `config/contracts.ts` (no hardcoded addresses).
- [ ] All ABIs from `src/abi/*`.
- [ ] Network mode toggle works (mainnet/testnet).
- [ ] TradePanel optimistic quote matches on-chain `getBuyOut` / `getSellOut`.
- [ ] Error messages parsed via `parseContractError`.

## Backend
- [ ] Env validated with Zod (fail-fast on boot).
- [ ] No `console.log` (Pino only).
- [ ] Indexer checkpoints are idempotent.
- [ ] Rate limiting on REST endpoints.
- [ ] CORS restricted to known origins.
- [ ] Graceful shutdown on SIGTERM.

## Operational
- [ ] Deployer wallet is a hardware wallet or multisig.
- [ ] Treasury / dev / pauser are separate wallets.
- [ ] `$MOON` governance token deployed before MoonBurner (or `moonBurner` left `address(0)`).
- [ ] Factory granted ADMIN on CreatorFeeVault / ReferralRegistry / FeeRouter post-deploy.
- [ ] All contracts verified on Etherscan.
- [ ] Deployment addresses recorded in `deployments/<chain>.json`.

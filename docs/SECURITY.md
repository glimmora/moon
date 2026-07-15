# moon.fun — Security

## Threat model

The primary adversaries are:
1. **Snipers** — bots buying in block 0 of a token's life to dump on retail.
2. **Fee hijackers** — attackers trying to redirect creator/referral fees.
3. **Reentrancy** — malicious tokens / callbacks attempting to re-enter the curve.
4. **Ruggers** — creators pre-minting supply or pulling liquidity.

## Mitigations

### Option B tokenomics (anti-rug)
- `MoonToken.totalSupply` starts at **0**. Tokens are only minted on buy, burned on sell.
- No pre-mint means no creator-held dump supply at launch.
- `s_totalSupplyInit` (1B/10B/100B cap) is used purely for max-tx / max-hold math.
- `MoonToken` intentionally does **not** inherit `ERC20Burnable`. Self-burn lives in
  `burn()`; external burn in `burnFrom()` (gated by `MINTER_ROLE`).

### X-Mode anti-sniper
- Block 0 of a token's life: **99% fee**.
- Linear decay to **1.25%** by block 6.
- After block 6: flat **1.25%**.
- Implemented in `BondingCurve._currentFee()` using `s_creationBlock`.

### CEI ordering
- `BondingCurve.sell()`: effects (decrement reserves) → interactions (send quote,
  distribute fee) → **burnFrom LAST**.
- `s_realQuoteReserves` decremented by `grossQuoteOut` (pre-fee), never `quoteOut`.

### try/catch everywhere
- All external calls inside a trade path are wrapped:
  - `CreatorFeeVault.accrueFees`
  - `ReferralRegistry.recordReferral`
  - `FeeRouter.distribute`
  - DEX `addLiquidity` (in `_graduate`)
  - `MoonBurner.buybackAndBurn` (self-call in `_executeSwap`)
- A single failing side-effect never reverts a trade.

### Access control
- `AccessControl` roles (never `Ownable` for privileged entrypoints):
  - `MINTER_ROLE` → factory (mint/burn on curve)
  - `CALLER_ROLE` → bonding curves (FeeRouter / MoonBurner)
  - `ACCRUER_ROLE` → bonding curves (CreatorFeeVault)
  - `REFERRER_ROLE` → bonding curves (ReferralRegistry)
- Role grants from the factory are `try/catch` and **non-blocking**.

### Reentrancy
- `_update` override in `MoonToken` is `nonReentrant`.
- `buy` / `sell` / `claimFees` / `claimAllFees` / `claimRewards` are `nonReentrant`.

### Pull payments
- Creator fees and referral rewards are **claimed**, never pushed.
- Eliminates an entire class of reentrancy vectors from the trade path.

### Permanent referrer links (anti-abuse)
- `setReferrer()` is one-shot per trader. Once linked, the referrer cannot be changed.
- Prevents churn abuse (referring yourself via a fresh address after each trade).
- Self-referral (`CannotSelfRefer`) is blocked.

### Immutable creator (anti-hijack)
- `CreatorFeeVault.accrueFees` sets the creator on the **first** accrue for a token.
- Subsequent accrues always credit the original creator — a malicious factory upgrade
  cannot redirect fees.

### Rescue safety
- `BondingCurve.rescue()` blocks `s_token` + `s_quoteAsset`.
- `MoonBurner.rescue()` blocks `$MOON` (`i_moonToken`).
- `MoonV3Concentrator.rescue()` blocks `$MOON`.
- All rescue functions are admin-only.

### Supply validation
- Only 1B / 10B / 100B tiers are allowed (`InvalidSupplyTier` otherwise).
- Prevents accidental deployment with weird supply caps.

## What is NOT protected

- **DEX price after graduation** is subject to normal AMM mechanics (impermanent loss,
  sandwich attacks). Use the V3 concentrator (future) for concentrated liquidity.
- **Creator reputation** is off-chain. DYOR.
- **Bridge risk** — moon.fun does not bridge tokens across chains; each chain has its own
  factory and token set.

## Auditing

See [`AUDIT-CHECKLIST.md`](./AUDIT-CHECKLIST.md) for the pre-audit self-check list.

## Reporting a vulnerability

Email security@moon.fun with a detailed report. We run a responsible disclosure program
with rewards scaled by severity.

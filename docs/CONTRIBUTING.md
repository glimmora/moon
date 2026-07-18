# Contributing to moon.fun

Thanks for your interest in contributing! This guide covers the basics.

## Repository setup

```bash
git clone https://github.com/glimmora/moon.git moon.fun
cd moon.fun
```

Install Foundry and contract dependencies:

```bash
foundryup
cd contracts
forge install foundry-rs/forge-std@v1.7.1 OpenZeppelin/openzeppelin-contracts@v5.0.2
```

## Development workflow

### One-command dev launcher (recommended)

```bash
./scripts/dev.sh
```

This starts both frontend (port 5173) and backend (port 4000), auto-detects Postgres
(falls back to SQLite), generates Prisma client, and pushes the schema.

Other commands:
```bash
./scripts/dev.sh frontend   # frontend only
./scripts/dev.sh backend    # backend only
./scripts/dev.sh stop       # stop all
./scripts/dev.sh status     # show running processes
```

### Smart contracts

```bash
cd contracts
forge build
forge test -vvv
```

Run the integration test suite (13 tests covering all on-chain features):
```bash
forge test --match-contract SepoliaIntegration -vvv
```

### Frontend

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev        # http://localhost:5173
npm run typecheck
```

### Backend

```bash
cd backend
npm install
npm run dev        # http://localhost:4000
```

Database setup:
- The dev.sh script auto-configures the database (Postgres or SQLite)
- For manual setup, set `DB_PROVIDER` + `DB_URL` in `backend/.env`
- Run `npx prisma generate` + `npx prisma db push` after schema changes

### On-chain tests (Ethereum Sepolia)

```bash
# Set env vars
export WALLET_PRIVATE_KEY=0x...  # testnet wallet
export CHAIN_ETHEREUM_SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com

# Run the security test suite
./scripts/security-test-sepolia.sh
```

## Coding standards

### Solidity
- Lock pragma to `0.8.24` in `src/`.
- Follow the rules in [`SKILL.md`](../SKILL.md) — they are non-negotiable.
- Use custom errors (not `require` strings).
- Run `forge fmt` before committing.

### TypeScript (frontend + backend)
- Strict mode, no `any`.
- Pino for logging (backend) — never `console.log`.
- Named exports preferred.

### Prisma gotchas
- Don't use `env()` for the `provider` field — Prisma requires a string literal.
  Use `provider = "postgresql"` and sed-swap to `sqlite` in dev.sh if needed.
- Don't name a scalar field the same as a relation (e.g. `holders Int` + `holders Holder[]`
  conflicts — use `holderCount` for the scalar).
- `DB_URL` validation must use `z.string().min(1)`, not `z.string().url()` (SQLite
  paths like `file:./dev.db` are not valid URLs).

## Commit conventions

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add logarithmic curve shape
fix: fee fraction vs absolute amount in buy()
chore: bump viem to 2.21
docs: update ARCHITECTURE.md
test: fuzz supply tier combinations
```

## Pull request checklist

- [ ] `forge test` passes
- [ ] `npm run typecheck` passes in frontend + backend
- [ ] No `.env`, `broadcast/`, `out/`, or `contracts/lib/` committed
- [ ] `frontend/src/lib/` IS committed (only `contracts/lib/` is gitignored)
- [ ] Conventional commit messages
- [ ] If touching contracts: update `SKILL.md` if needed
- [ ] If touching the API: update `docs/API.md`

## Security-sensitive changes

Any change to:
- `BondingCurve.buy` / `sell` / `_distributeFee` / `_graduate`
- `MoonToken._update` / `burnFrom` / `grantMinterRole`
- Fee calculation (fraction → absolute conversion)
- Access control roles
- Referral `recordReferral` signature

…requires a detailed PR description explaining the security implications and must be
reviewed by at least one core maintainer.

## Reporting issues

- Bugs: open a GitHub issue with reproduction steps.
- Security: email security@moon.fun (see [`SECURITY.md`](./SECURITY.md)).

## License

MIT. By contributing you agree your contributions are licensed under the same terms.

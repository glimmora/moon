# Contributing to moon.fun

Thanks for your interest in contributing! This guide covers the basics.

## Repository setup

```bash
git clone https://github.com/glimmora/moon.git moon.fun
cd moon.fun
pnpm install
```

Install Foundry and contract dependencies:

```bash
foundryup
cd contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts
```

## Development workflow

### Smart contracts

```bash
cd contracts
forge build
forge test -vvv
forge lint      # solhint + forge fmt --check
```

### Frontend

```bash
cd frontend
pnpm dev        # http://localhost:5173
pnpm lint
pnpm typecheck
```

### Backend

```bash
cd backend
docker compose up -d
pnpm db:push
pnpm dev        # http://localhost:4000
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

## Commit conventions

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add logarithmic curve shape
fix: grossQuoteOut decrement in sell()
chore: bump viem to 2.21
docs: update ARCHITECTURE.md
test: fuzz supply tier combinations
```

## Pull request checklist

- [ ] `forge test` passes
- [ ] `forge lint` (solhint) passes
- [ ] `pnpm lint` + `pnpm typecheck` pass in frontend + backend
- [ ] No `.env`, `broadcast/`, `out/`, or `lib/` committed
- [ ] Conventional commit messages
- [ ] If touching contracts: update `AUDIT-CHECKLIST.md` if needed
- [ ] If touching the API: update `docs/API.md`

## Security-sensitive changes

Any change to:
- `BondingCurve.buy` / `sell` / `_distributeFee` / `_graduate`
- `MoonToken._update` / `burnFrom`
- Access control roles
- Referral `recordReferral` signature

…requires a detailed PR description explaining the security implications and must be
reviewed by at least one core maintainer.

## Reporting issues

- Bugs: open a GitHub issue with reproduction steps.
- Security: email security@moon.fun (see [`SECURITY.md`](../docs/SECURITY.md)).

## License

MIT. By contributing you agree your contributions are licensed under the same terms.

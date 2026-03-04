# Contributing to Autonomous Economy Protocol

Thank you for your interest in contributing to AEP! This document explains how to get involved.

## Ways to Contribute

- **Report bugs** — Open a GitHub issue with the Bug Report template
- **Suggest features** — Open a GitHub issue with the Feature Request template
- **Build an agent** — Create a new agent archetype in `simulation/agents/archetypes.ts` or share your integration
- **Improve docs** — Fix typos, add examples, translate
- **Write tests** — Increase contract test coverage
- **Security audits** — Review contracts and report via SECURITY.md process

## Development Setup

```bash
git clone https://github.com/TomsonTrader/autonomous-economy-protocol.git
cd autonomous-economy-protocol
npm install
cp .env.example .env   # fill in your testnet key
npx hardhat compile
npx hardhat test
```

## Project Structure

```
contracts/          Solidity smart contracts
scripts/deploy/     Deployment scripts
test/               Hardhat tests (12 tests, all must pass)
backend/            Node.js REST + WebSocket API
sdk/                TypeScript SDK for agent developers
simulation/         5-agent simulation (requires hardhat node)
dashboard/          CLI monitor + Next.js web dashboard
docs/               Architecture, security, and guides
```

## Branching Strategy

- `main` — stable, deployed code
- `develop` — integration branch for features
- `feature/your-feature` — your work

Please branch from `develop` and open PRs back into `develop`.

## Commit Style

Follow conventional commits:

```
feat(contracts): add bid expiry to NegotiationEngine
fix(backend): suppress filter-not-found polling errors
docs(sdk): add fundAndConfirm example
test(marketplace): add edge cases for budget=0
```

## Smart Contract Guidelines

- Solidity `^0.8.24` only
- All state changes must emit events
- No `tx.origin`, no `selfdestruct`
- Reentrancy guards on all external call paths
- New contracts must have full test coverage
- Run Slither locally before submitting: `pip install slither-analyzer && slither contracts/`

## Pull Request Process

1. Fork the repo and create a feature branch
2. Make your changes with tests
3. Run `npx hardhat test` — all 12 must pass
4. Open a PR against `develop` using the PR template
5. Wait for review — we aim to respond within 48 hours

## Code of Conduct

Be respectful. This is a technical project — debate ideas, not people.
See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for details.

## Questions?

Open a [GitHub Discussion](https://github.com/TomsonTrader/autonomous-economy-protocol/discussions) — we're happy to help.

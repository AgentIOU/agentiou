# AgentIOU

**Pay later. Can't disappear.**

AgentIOU is an on-chain pay-later ledger for Agent ID holders on BNB Smart Chain. An IOU ("I owe you") is a small promise to pay later. Every promise, repayment and late payment is written on-chain against the borrower's Agent ID, so a good record builds a Trust Score and a higher credit level, and a broken promise stays visible.

Built for the Agent ID Hackathon (Nov 18 to Dec 9, 2026). Updates: [@AgentIOU on X](https://x.com/AgentIOU). Independent project, not affiliated with Binance. Not financial advice: nobody guarantees that an IOU is repaid.

## How it works

1. **Get IOU Verified.** An Agent ID holder calls `join` from their own Agentic Wallet. The contract checks the Agent ID on-chain.
2. **Take an IOU.** Take a sticker from Promise Mart on credit, or accept an IOU a friend sends you.
3. **Repay on time.** Repayment goes straight from the borrower's wallet to the lender. The contract never holds it.
4. **Build a record.** On-time repays raise the Trust Score and the level (limits: L1 $1, L2 $5, L3 $10). One IOU past due lowers the level and the score at once; two past due, or one more than 7 days past due, makes the account Restricted until it repays.

The site never connects to a wallet. It writes a plain-text prompt with the exact contract call; the person pastes it into their own Binance Agentic Wallet, which shows a preview and asks them to confirm.

## What is here

| Folder | What it holds |
|---|---|
| `contracts/` | `AgentIOU.sol` (the whole contract), test mocks, compile script and a 93-check test run on a local chain, and the local-chain helper for the live website test |
| `web/` | The website: Vite, React, TypeScript, Tailwind, GSAP, viem. No backend, no login, no wallet connect, no stored sessions |
| `tools/` | Image cutting scripts and the browser checks for the site (`check.py`, `check2.py`, `check_numbers.py`, `check_abi.mjs`, `check_units.mjs`), the live test `check_live.py` (the built site against a local chain, sending each prompt's exact call), and `abi.mjs` (exports the contract's read interface for the site) |
| `docs/SECURITY.md` | Owner permissions (none), money flows, what the project never does, known limits |
| `docs/DEPLOY.md` | The deployment order, compiler settings and the values to type in |

## Contract

- Solidity 0.8.28, optimizer on with **runs = 1**, EVM version **paris**, no via-IR. Use the same settings to verify it on BscScan.
- Constructor argument: the metadata base URI for the soulbound stickers.
- Fixed addresses (constants): Agent ID `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`, USDT (BSC-USD) `0x55d398326f99059fF775485246999027B3197955`, Chainlink BNB/USD `0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE`.
- Deployed address: added here after deployment.
- Promise Mart (the deploying wallet, a plain wallet with no special rights beyond its Founders stickers): `0xf2d95FDEdE5Ba5BCA7F47cCb60a779E427d9f179`.

Run the tests (Node 20+):

    cd contracts
    npm install
    npm test

## Website

    cd web
    npm install
    npm run dev            # local site
    npm run build          # public build for Cloudflare Pages (output: web/dist)

Demo or live is chosen when the site is built:

- **Demo** (no settings): the site runs on demo data and every screen says so.
- **Live**: set `VITE_CONTRACT` (the AgentIOU address) and `VITE_MART` (the Promise Mart wallet) in the build environment. Every number is then read from the contract; the site only reads, it never signs or sends.

A visitor starts as a guest: they can look at everything, and every action stays off until their wallet has joined. The only thing saved in the browser is the visitor's public address.

## Licence

MIT

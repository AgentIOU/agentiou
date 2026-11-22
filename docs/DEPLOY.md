# Deploying AgentIOU

The order matters: the public site address goes into the contract (sticker descriptions), and the contract address goes into the site.

**After the contract is deployed nothing in it can be changed.** There is no owner and no upgrade. Limits, level rules, XP amounts, the shop wallet, the lending rule (shop offers are USDT loans, one per wallet for a sticker offer) and the sticker address are fixed for good. A mistake means deploying a new contract and starting its records from zero.

## 1. Put the website online (demo mode)

Cloudflare Pages, connected to this GitHub repository:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Root directory | `web` |
| Build command | `npm run build` |
| Build output directory | `dist` |

`web/.nvmrc` picks the Node.js version. With no environment variables the site builds in demo mode. Note the public address Cloudflare gives it (for example `https://agentiou.pages.dev`).

## 2. Write the sticker descriptions

    node tools/meta.mjs https://<your site>

This writes 12 files to `web/public/meta/`. Commit and push them, wait for Cloudflare to rebuild, and open `https://<your site>/meta/0000000000000000000000000000000000000000000000000000000000000001.json` in a browser to check it loads.

## 3. Check the fixed addresses

Open each on BscScan and confirm it is what the contract expects:

| Constant | Address | Should be |
|---|---|---|
| `AGENT_ID` | `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` | The Agent ID registry (ERC-721, non-transferable) |
| `USDT` | `0x55d398326f99059fF775485246999027B3197955` | BSC-USD, 18 decimals |
| `BNB_USD_FEED` | `0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE` | Chainlink BNB / USD |

## 4. Deploy with Remix

    node tools/deploy_args.mjs https://<your site>

prints the values used below.

1. Open remix.ethereum.org, create `AgentIOU.sol` and paste `contracts/src/AgentIOU.sol` into it.
2. Solidity compiler tab: version **0.8.28**. Advanced configurations: **Enable optimization, runs 1**; EVM version **paris**. Compile.
3. Deploy tab: environment = the browser wallet (or WalletConnect) holding the **shop wallet**; network **BNB Smart Chain (56)**. The deploying wallet becomes Promise Mart for good.
4. Contract: `AgentIOU`. Constructor argument `metadataBaseUri`: `https://<your site>/meta/{id}.json` (keep `{id}` exactly as written).
5. Deploy, read the cost in the wallet, confirm. Copy the new contract address.

## 5. Verify the source on BscScan

Contract page, Contract tab, Verify and Publish: single file, compiler `v0.8.28+commit.7893614a`, licence MIT, optimization **Yes, 1 run**, EVM version **paris**. Paste the source. If it asks for constructor arguments, use the ABI-encoded line printed by `deploy_args.mjs`.

## 6. Open the three shop offers and fund the shop

On the verified contract's Write Contract tab (or in Remix, "At Address"), from the shop wallet, call `createOffer` three times with the values printed by `deploy_args.mjs`:

| title | asset | price (wei) | termDays | stock | designId |
|---|---|---|---|---|---|
| `Day one sticker` | 1 | 10000000000000000 | 2 | 100 | 1 |
| `Night owl sticker` | 1 | 30000000000000000 | 3 | 100 | 2 |
| `Good word sticker` | 1 | 50000000000000000 | 5 | 100 | 3 |

The shop lends its own USDT. Taking an offer moves the price from the shop wallet to the borrower, and repaying moves it back. So the shop wallet must:

1. hold USDT (9 USDT covers 100 loans of each offer; a few dollars is enough to start);
2. approve the AgentIOU contract on the USDT contract (`0x55d398326f99059fF775485246999027B3197955`, Write Contract, `approve`) with the AgentIOU address as spender and the largest amount it is willing to have out on loan at once.

That approval is the shop's whole risk: a loan that is never repaid is the shop's loss, and the total can never pass the approved amount. The shop can lower it to 0 at any time to stop lending.

## 7. Switch the website to live

In Cloudflare Pages, Settings, Environment variables (Production):

| Name | Value |
|---|---|
| `VITE_CONTRACT` | the new contract address |
| `VITE_MART` | the shop wallet address |

Redeploy. The footer then says "Reading BNB Smart Chain" and the shop shows the three offers.

## 8. First real run

With an Agent ID wallet and an AI agent signed in to it (Developer Mode on): get IOU Verified, take the 0.01 USDT offer (0.01 USDT arrives from the shop with the sticker), repay it, check in. Each step should finish on the site by itself a few seconds after the agent reports success.

## Before any deployment

    cd contracts && npm install && npm test          # the contract on a local chain
    python3 tools/check_live.py                      # the built site against a local chain

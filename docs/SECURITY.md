# Security and permissions

## Owner permissions: none

`AgentIOU.sol` has no owner, no admin, no upgrade, no pause, no fee and no function that moves anyone's money on its own.

The deploying address is stored as `MART` (Promise Mart, the demo shop). Its only extra right: its offers may carry one of the three Founders stickers (design 1 to 3). It cannot change rules, limits or prices of other shops, touch balances, or act for any user. Like any shop, it can open, restock and close its own offers.

A shop lends its own money and keeps nothing: the price goes to the borrower when an offer is taken and the same amount comes back on repayment. The shop's risk is unpaid loans, capped by the USDT approval it gives the contract, which it can lower to zero at any time. For an offer that carries a sticker, each wallet can borrow once.

## Where money goes

| Action | Money moved |
|---|---|
| `join`, `setNickname`, `createIOU`, `acceptIOU`, `declineIOU`, `cancelIOU`, `checkIn`, `claimVoucher`, `mintSticker` | None. Gas only |
| `takeOffer` | Exactly the offer's price in USDT, from the shop's wallet to the borrower, out of an approval the shop set for itself. Nothing leaves the borrower's wallet |
| `repay` (USDT) | Exactly the IOU amount, from the borrower to the lender, using an approval the borrower gave for that exact amount |
| `repay` (BNB) | Exactly the IOU amount, sent with the call and forwarded to the lender. If the lender cannot receive BNB, it is kept under the lender's name |
| `withdraw` | The caller's own undelivered BNB, back to the caller |

The site never asks for an unlimited approval. Every repay prompt names who gets paid and how much.

## What AgentIOU never does

| Rule | How AgentIOU meets it |
|---|---|
| No web QR or pairing-code login, no stored sessions | The site has no login and no wallet connection. It only writes prompts the person pastes into their own Agentic Wallet |
| No confirmation bypass | Every prompt ends: "Show me the preview and risks first. Do not execute until I confirm." |
| No scheduled collection, automatic or bundled transfers, unlimited approvals | Every transfer is one call the borrower starts and confirms; approvals are for the exact amount |
| Open source, owner permissions documented | This repository and this file; the contract source is verified on BscScan after deployment |
| No "Binance" or "BNB" in project, token or domain names | Project and site name: AgentIOU. Nicknames containing "binance", "bnb", "official", "admin" or "support" are refused by the contract |
| Never collect seed phrases, private keys, API secrets or pairing codes | The site has no form that asks for them and no server to send them to |
| No name lookup of other people | There is no search by name; an IOU needs the other person's address |

## Website protection

- Static site with no backend: there is no database or account to break into.
- The only thing kept in the visitor's browser is the public address they typed in, plus the sound and motion settings. No key, no session, no cookie.
- The site moves a step forward only when it can read the result from the contract; a visitor pressing "I confirmed" proves nothing by itself.
- Content Security Policy blocks outside scripts; only the BNB Smart Chain RPC hosts can be contacted.
- Every record lives in the contract, and only an address's own wallet can change it (`msg.sender`). The site cannot edit anyone's profile.
- User text (nicknames, notes) is limited to plain characters and never rendered as HTML.

## Limits and known risks

- Nobody guarantees repayment. A missed IOU shows on the borrower's record, but AgentIOU cannot recover the money.
- Promise Mart lends real USDT. Someone can borrow a few cents and never repay; the shop accepts that loss, and the borrower's record shows the default for good.
- Credit limits are small on purpose (L1 $1, L2 $5, L3 $10) to limit losses to scams.
- A member can receive many pending IOU requests; they can decline them, and each sender can have at most 20 waiting.
- Nicknames are not unique. Check the address, not the name.
- BNB amounts are converted to dollars with the Chainlink BNB/USD price at the moment an IOU is made; the call is refused if the price is more than a day old.

# Security and permissions

## Owner permissions: none

`AgentIOU.sol` has no owner, no admin, no upgrade, no pause, no fee and no function that moves anyone's money on its own.

The deploying address is stored as `MART` (Promise Mart, the demo shop). Its only extra right: its offers may carry one of the three Founders stickers (design 1 to 3). It cannot change rules, limits or prices of other shops, touch balances, or act for any user. Like any shop, it can open, restock and close its own offers.

A shop lends its own money and keeps nothing: the price goes to the borrower when an offer is taken and the same amount comes back on repayment. The shop's risk is unpaid loans, capped by the USDT approval it gives the contract, which it can lower to zero at any time. Each wallet can take two shop loans a day, and none while it is Restricted.

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
| No web QR or pairing-code login, no stored sessions | The site has no account, password, QR code, pairing code or wallet connection, and nothing that holds a session: the only server code is the read-only Open Trust API (`web/functions/api/trust`), which takes a wallet address, reads the contract and keeps nothing. It only writes prompts the person pastes into their own Agentic Wallet. To show a profile as "mine" on a device, the wallet sends one ordinary transaction to the contract: the join itself for a new member, or today's check-in or the same nickname again for someone who joined before. The site adds 41 bytes to the end of that call's data, which the contract ignores: a fixed word and the hash of a random 32-byte seal that the device made and keeps to itself. The site finds the transaction on the chain, keeps it whole and signed on that device, and checks it in the browser (`web/src/lib/proof.ts`): the signer must be the wallet, the target the AgentIOU contract, and the mark the hash of this device's seal. The transaction is public, but the seal is not, so it is no use on another device. It moves no money and approves nothing. (The site first used a signed EIP-712 message for this. On 27 November the Agentic Wallet's `sign-message` began refusing it with error 953004, so the proof moved into a transaction; devices that proved the earlier way keep working.) Typing an address never makes a profile "mine"; anyone can still view a public record, as on BscScan |
| No confirmation bypass | Every prompt ends: "Show me the preview and risks first. Do not execute until I confirm." |
| No scheduled collection, automatic or bundled transfers, unlimited approvals | Every transfer is one call the borrower starts and confirms; approvals are for the exact amount |
| Open source, owner permissions documented | This repository and this file; the contract source is verified on BscScan after deployment |
| No "Binance" or "BNB" in project, token or domain names | Project and site name: AgentIOU. Nicknames containing "binance", "bnb", "official", "admin" or "support" are refused by the contract |
| Never collect seed phrases, private keys, API secrets or pairing codes | The site has no form that asks for them; the only server code, the read-only Open Trust API, accepts nothing but a public wallet address |
| No name lookup of other people | There is no search by name; an IOU needs the other person's address |

## Website protection

- Static site. The only server code is the read-only Open Trust API: no database, no account, no key and nothing stored, so there is nothing to break into. It looks up by wallet address only, never by nickname or Agent ID name.
- The only thing kept in the visitor's browser is the public address they typed in, plus the sound and motion settings. No key, no session, no cookie.
- The site moves a step forward only when it can read the result from the contract; a visitor pressing "I confirmed" proves nothing by itself.
- Content Security Policy blocks outside scripts; only the BNB Smart Chain RPC hosts can be contacted.
- Every record lives in the contract, and only an address's own wallet can change it (`msg.sender`). The site cannot edit anyone's profile.
- User text (nicknames, notes) is limited to plain characters and never rendered as HTML.

## Limits and known risks

- Nobody guarantees repayment. A missed IOU shows on the borrower's record, but AgentIOU cannot recover the money.
- Promise Mart lends real USDT. Someone can borrow and never repay; the shop accepts that loss, and the borrower's record shows the default for good. One wallet can never owe more than its own credit limit ($1 at the first level), takes at most two shop loans a day, and is cut off once two loans are past due. The shop's total risk is the USDT approval it gave.
- Credit limits are small on purpose (L1 $1, L2 $5, L3 $10) to limit losses to scams.
- A member can receive many pending IOU requests; they can decline them, and each sender can have at most 20 waiting.
- Nicknames are not unique. Check the address, not the name.
- BNB amounts are converted to dollars with the Chainlink BNB/USD price at the moment an IOU is made; the call is refused if the price is more than a day old.

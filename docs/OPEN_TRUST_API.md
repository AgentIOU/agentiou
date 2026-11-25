# Open Trust API

**Trust Check for DeFi & CEX.** Before an app or exchange lends to an Agent ID wallet, it can read that wallet's AgentIOU record: Trust Score, level, overdue IOUs and whether it is restricted.

- Page with a live check: https://agentiou.pages.dev/trust
- Read only. No key, no sign-up, no account. Nothing is stored.
- Lookups are **by wallet address only**, never by nickname or Agent ID name.
- Each app sets its own lending rules. AgentIOU blocks no one outside AgentIOU.

There are two ways to read the same numbers: the web API, or the contract itself.

## 1. Web API

```
GET https://agentiou.pages.dev/api/trust/{walletAddress}
```

`walletAddress` is a BNB Smart Chain address: `0x` and 40 hex characters, all lowercase or with a correct checksum.

### Response `200`

```json
{
  "address": "0x54D9a0D1811D32bF68B523A7Aa293D3Ab4e8e325",
  "verified": true,
  "trustScore": 81,
  "level": 2,
  "limitUsd": 5,
  "overdue": false,
  "restricted": false,
  "onTimeRepays": 5,
  "late": 0,
  "defaults": 0,
  "peopleDealtWith": 3,
  "readAt": "2026-11-25T10:45:00.000Z",
  "contract": "0x75DE83b3CE69c8eE363BE702FD3cd02e9Ab7F3f8",
  "chain": "BNB Smart Chain (56)",
  "docs": "https://agentiou.pages.dev/trust"
}
```

The address above is made up for the example.

| Field | Meaning |
|---|---|
| `verified` | The wallet has joined AgentIOU (IOU Verified). When `false`, every number is `0` and every flag `false`: there is no record. |
| `trustScore` | 0 to 100, computed by the contract: 50 + 5 per on-time repay − 10 per late or overdue IOU − 25 per default + 2 per person dealt with (up to 10). |
| `level` | 1 to 3. Opens with on-time repays; one IOU past due drops it by one. |
| `limitUsd` | What the wallet may owe at once on AgentIOU: $1, $5 or $10. |
| `overdue` | At least one IOU is past its due date and not repaid. |
| `restricted` | Two IOUs past due, or one more than 7 days late. The wallet cannot borrow on AgentIOU until it repays. |
| `onTimeRepays`, `late`, `defaults`, `peopleDealtWith` | The counts behind the score. |
| `readAt` | When the contract was read for this answer. |

### Errors

| Status | `error` | When |
|---|---|---|
| `400` | `invalid_address` | Not an address, or a mixed-case address with a wrong checksum (most likely a typo). |
| `404` | `not_found` | Any other path under `/api/`. |
| `502` | `chain_unavailable` | BNB Smart Chain could not be read just then. Try again, or read the contract directly. |

### Behaviour

- CORS is open (`Access-Control-Allow-Origin: *`), so a website on any domain can call it.
- The same wallet asked again within 30 seconds gets the same answer without another chain read.
- The API reads `getUser(address)` on the contract at the moment of the request. Source: [`web/functions/api/trust/[address].ts`](../web/functions/api/trust/%5Baddress%5D.ts) (a Cloudflare Pages Function).

## 2. Straight from the contract (no server)

Contract: [`0x75DE83b3CE69c8eE363BE702FD3cd02e9Ab7F3f8`](https://bscscan.com/address/0x75DE83b3CE69c8eE363BE702FD3cd02e9Ab7F3f8#code) on BNB Smart Chain, verified source. Full ABI: https://agentiou.pages.dev/agentiou-abi.json

| Function | Returns |
|---|---|
| `getUser(address)` | The full record, then `level`, `score`, `limitCents`, `overdue`, `restricted` |
| `trustScore(address)` | 0 to 100 (0 if not a member) |
| `levelOf(address)` | 1 to 3 (0 if not a member) |

### In a contract (Solidity)

```solidity
interface IAgentIOU {
    // 0 to 100; 0 if the wallet is not a member
    function trustScore(address wallet) external view returns (uint8);
    // 1 to 3; 0 if the wallet is not a member
    function levelOf(address wallet) external view returns (uint8);
}

contract YourLender {
    IAgentIOU constant IOU = IAgentIOU(0x75DE83b3CE69c8eE363BE702FD3cd02e9Ab7F3f8);

    function checkBorrower(address borrower) internal view {
        require(IOU.levelOf(borrower) > 0, "Not IOU Verified");
        // your own rule:
        require(IOU.trustScore(borrower) >= 60, "Trust Score too low");
    }
}
```

### In an app or exchange backend (JavaScript, viem)

```js
import { createPublicClient, http } from 'viem'
import { bsc } from 'viem/chains'
import abi from './agentiou-abi.json' with { type: 'json' }   // from https://agentiou.pages.dev/agentiou-abi.json

const client = createPublicClient({ chain: bsc, transport: http() })

const [, level, score, , overdue, restricted] = await client.readContract({
  address: '0x75DE83b3CE69c8eE363BE702FD3cd02e9Ab7F3f8',
  abi,
  functionName: 'getUser',
  args: [wallet],
})
// your own rule, for example:
if (level === 0 || restricted) { /* no loan */ }
```

Both snippets are the ones shown on the Open Trust page.

## What a record is, and is not

A record shows only what happened on AgentIOU. It is not a credit rating and not financial advice. Agent ID rules (one per person, not transferable) are Binance's; AgentIOU only reads whether a wallet holds one.

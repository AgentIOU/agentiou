// Prints everything that has to be typed or pasted when deploying and verifying AgentIOU.
//   node tools/deploy_args.mjs https://your-site.example
import { encodeAbiParameters, parseEther } from '../web/node_modules/viem/_esm/index.js'
const site = (process.argv[2] || '').replace(/\/+$/, '')
if (!/^https:\/\/[a-z0-9.-]+$/i.test(site)) { console.error('Give the public site address, for example: node tools/deploy_args.mjs https://agentiou.pages.dev'); process.exit(1) }
const uri = `${site}/meta/{id}.json`
console.log('1. Constructor argument (metadataBaseUri), typed into Remix:\n   ' + uri)
console.log('\n2. The same argument ABI-encoded, for the BscScan "Constructor Arguments" box (without 0x):\n   ' + encodeAbiParameters([{ type: 'string' }], [uri]).slice(2))
console.log('\n3. The three Promise Mart offers, typed into createOffer in this order:\n   title, asset (always 1 = USDT), price in wei, termDays, stock, designId')
for (const [t, a, p, d, s, id] of [['Day one sticker', 1, '0.01', 2, 100, 1], ['Night owl sticker', 1, '0.03', 3, 100, 2], ['Good word sticker', 1, '0.05', 5, 100, 3]])
  console.log(`   "${t}", ${a}, ${parseEther(p)}, ${d}, ${s}, ${id}      (lends ${p} USDT, repay within ${d} days)`)
const cap = process.argv[3] || '5'
console.log(`\n4. The shop's lending money. The shop wallet must hold USDT, and approve the AgentIOU contract on the USDT contract\n   (0x55d398326f99059fF775485246999027B3197955, function approve) for the most it is willing to have out on loan:\n   spender = the AgentIOU address, amount = ${parseEther(cap)}      (${cap} USDT; pass another figure as the second argument)\n   Every 100 loans of all three offers need 9 USDT. Unpaid loans are the shop's loss, up to this amount.`)

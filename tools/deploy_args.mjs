// Prints everything that has to be typed or pasted when deploying and verifying AgentIOU.
//   node tools/deploy_args.mjs https://your-site.example
import { encodeAbiParameters, parseEther } from '../web/node_modules/viem/_esm/index.js'
const site = (process.argv[2] || '').replace(/\/+$/, '')
if (!/^https:\/\/[a-z0-9.-]+$/i.test(site)) { console.error('Give the public site address, for example: node tools/deploy_args.mjs https://agentiou.pages.dev'); process.exit(1) }
const uri = `${site}/meta/{id}.json`
console.log('1. Constructor argument (metadataBaseUri), typed into Remix:\n   ' + uri)
console.log('\n2. The same argument ABI-encoded, for the BscScan "Constructor Arguments" box (without 0x):\n   ' + encodeAbiParameters([{ type: 'string' }], [uri]).slice(2))
console.log('\n3. The three Promise Mart offers, typed into createOffer in this order:\n   title, asset (1 = USDT, 0 = BNB), price in wei, termDays, stock, designId')
for (const [t, a, p, d, s, id] of [['Day one sticker', 1, '0.01', 2, 100, 1], ['Night owl sticker', 1, '0.03', 3, 100, 2], ['Good word sticker', 0, '0.00008', 5, 100, 3]])
  console.log(`   "${t}", ${a}, ${parseEther(p)}, ${d}, ${s}, ${id}      (${p} ${a ? 'USDT' : 'BNB'}, repay within ${d} days)`)

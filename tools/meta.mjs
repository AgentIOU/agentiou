// Writes the 12 sticker description files that wallets and explorers read (ERC-1155 metadata).
// Run once the public site address is known, before deploying the contract:
//   node tools/meta.mjs https://your-site.example
// The contract is then deployed with the base address  https://your-site.example/meta/{id}.json
// ({id} is the 64-character hex form of the design number; that is how ERC-1155 fills it in).
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
const site = (process.argv[2] || '').replace(/\/+$/, ''), out = process.argv[3] || new URL('../web/public/meta', import.meta.url).pathname
if (!/^https:\/\/[a-z0-9.-]+$/i.test(site)) { console.error('Give the public site address, for example: node tools/meta.mjs https://agentiou.pages.dev'); process.exit(1) }
// the design list is read from the site's own data file, so the two cannot drift apart
const src = readFileSync(new URL('../web/src/lib/data.ts', import.meta.url), 'utf8')
const designs = [...src.matchAll(/\{ id: (\d+), key: '([^']+)', name: '([^']+)', tier: '([^']+)' \}/g)].map((m) => ({ id: +m[1], key: m[2], name: m[3], tier: m[4] }))
if (designs.length !== 12) { console.error('expected 12 designs, found ' + designs.length); process.exit(1) }
mkdirSync(out, { recursive: true })
for (const d of designs) {
  const file = d.tier === 'Founders' ? d.key : 'coin-' + d.key
  if (!existsSync(new URL(`../web/public/img/${file}.webp`, import.meta.url))) { console.error('missing picture: ' + file); process.exit(1) }
  const meta = {
    name: `AgentIOU: ${d.name}`,
    description: d.tier === 'Founders' ? 'A Promise Mart Founders sticker, taken on credit on AgentIOU. Soulbound: it cannot be sold or sent.' : `A Season 1 ${d.tier} stamp, earned by keeping promises on AgentIOU. Soulbound: it cannot be sold or sent.`,
    image: `${site}/img/${file}.webp`, external_url: site,
    attributes: [{ trait_type: 'Tier', value: d.tier }, { trait_type: 'Collection', value: d.tier === 'Founders' ? 'Founders' : 'Season 1' }, { trait_type: 'Transferable', value: 'No' }],
  }
  writeFileSync(`${out}/${d.id.toString(16).padStart(64, '0')}.json`, JSON.stringify(meta, null, 2) + '\n')
}
console.log(`wrote ${designs.length} files to ${out}\nconstructor argument (metadataBaseUri):  ${site}/meta/{id}.json`)

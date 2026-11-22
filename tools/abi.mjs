// Writes the contract's read interface for the website straight from the compiled contract, so the two cannot drift apart.
// Run after contracts/compile.mjs:  node tools/abi.mjs
import { readFileSync, writeFileSync } from 'node:fs'
const abi = JSON.parse(readFileSync(new URL('../contracts/out/artifacts.json', import.meta.url), 'utf8')).AgentIOU.abi
const want = ['getUser', 'getUserIOUs', 'getRecentIOUs', 'getOffers', 'getUsers', 'stats', 'mintInfo', 'pendingSent', 'credits', 'MART']
const out = want.map((n) => { const f = abi.find((x) => x.type === 'function' && x.name === n); if (!f) throw new Error('missing ' + n); return f })
writeFileSync(new URL('../web/src/data/abi.json', import.meta.url), JSON.stringify(out) + '\n')
console.log(`wrote ${out.length} read functions to web/src/data/abi.json`)

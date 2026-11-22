// every call the site writes into a prompt must exist in the compiled contract with the same inputs and payability
import { readFileSync } from 'node:fs'
import { toFunctionSelector, toFunctionSignature } from '../web/node_modules/viem/_esm/index.js'
const src = readFileSync(new URL('../web/src/lib/prompt.ts', import.meta.url), 'utf8')
const site = [...src.matchAll(/'function (\w+)\(([^)]*)\)( payable)?( returns \(bool\))?'/g)].filter((m) => m[1] !== 'approve')
const abi = JSON.parse(readFileSync(new URL('../contracts/out/artifacts.json', import.meta.url), 'utf8')).AgentIOU.abi.filter((x) => x.type === 'function')
let bad = 0
for (const m of site) {
  const types = m[2].split(',').map((p) => p.trim().split(' ')[0]).filter(Boolean).join(',')
  const hit = abi.find((f) => f.name === m[1] && f.inputs.map((i) => i.type).join(',') === types)
  const pay = !!m[3]
  const ok = hit && (hit.stateMutability === 'payable') === pay && toFunctionSelector(toFunctionSignature(hit)) === toFunctionSelector(`${m[1]}(${types})`)
  if (!ok) { bad++; console.log('FAIL', m[1], types) }
}
console.log(`${site.length - bad} of ${site.length} site calls match the contract`)

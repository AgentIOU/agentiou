// every amount a person can type (up to 6 decimals) must reach the chain as exactly that amount
import { parseEther } from '../web/node_modules/viem/_esm/index.js'
const wei = (n) => parseEther(n.toFixed(9).replace(/0+$/, '').replace(/\.$/, ''))
import { readFileSync } from 'node:fs'
if (!readFileSync(new URL('../web/src/lib/prompt.ts', import.meta.url), 'utf8').includes('n.toFixed(9)')) { console.log('FAIL the site no longer uses the tested conversion'); process.exit(1) }
let bad = 0, n = 0
const test = (str) => { n++; if (wei(Number(str)) !== parseEther(str)) { bad++; if (bad < 6) console.log('FAIL', str, wei(Number(str))) } }
for (const s of ['0.01', '0.03', '0.00008', '0.1', '0.07', '1.1', '2.675', '5', '0.000001', '0.3', '4.35', '10', '9.999999']) test(s)
for (let i = 0; i < 200000; i++) test((Math.floor(Math.random() * 10_000_000) / 1e6).toFixed(6).replace(/0+$/, '').replace(/\.$/, '') || '0')
console.log(`${n - bad} of ${n} amounts exact`)

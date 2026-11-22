// Compile with solc 0.8.28, optimizer on (runs = 1, to keep the code under the size limit), no via-IR: the same settings to pick in Remix and on BscScan.
import solc from 'solc'; import fs from 'fs'
const src = (f) => ({ content: fs.readFileSync(`src/${f}`, 'utf8') })
const input = { language: 'Solidity', sources: { 'AgentIOU.sol': src('AgentIOU.sol'), 'Mocks.sol': src('Mocks.sol') },
  settings: { optimizer: { enabled: true, runs: 1 }, evmVersion: 'paris', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } } } }
const out = JSON.parse(solc.compile(JSON.stringify(input)))
const errs = (out.errors || []).filter((e) => e.severity === 'error'); const warns = (out.errors || []).filter((e) => e.severity !== 'error')
warns.forEach((w) => console.log('WARN', w.formattedMessage.split('\n').slice(0, 3).join(' | ')))
if (errs.length) { errs.forEach((e) => console.log(e.formattedMessage)); process.exit(1) }
fs.mkdirSync('out', { recursive: true }); const art = {}
for (const f of Object.keys(out.contracts)) for (const [n, c] of Object.entries(out.contracts[f])) art[n] = { abi: c.abi, bytecode: '0x' + c.evm.bytecode.object, deployed: '0x' + c.evm.deployedBytecode.object }
fs.writeFileSync('out/artifacts.json', JSON.stringify(art))
console.log('solc', solc.version(), '| AgentIOU runtime size', (art.AgentIOU.deployed.length - 2) / 2, 'bytes (limit 24576)')

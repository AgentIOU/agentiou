// Helper for tools/check_live.py: a local chain that stands in for BNB Smart Chain while the live website is tested.
//   node live_chain.mjs setup                      deploy stand-ins + AgentIOU, open the three shop offers, print addresses
//   node live_chain.mjs send <from> <to> <data> <bnb>   send exactly the call a site prompt describes (what the agent wallet would do)
//   node live_chain.mjs join <from> <nickname> | warp <seconds> | user <address>
import fs from 'fs'
import { createTestClient, http, publicActions, walletActions, parseEther } from 'viem'
import { foundry } from 'viem/chains'
const art = JSON.parse(fs.readFileSync(new URL('./out/artifacts.json', import.meta.url), 'utf8')), A = art.AgentIOU.abi
const AGENT_ID = '0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F', USDT = '0x55d398326f99059fF775485246999027B3197955', FEED = '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE'
const c = createTestClient({ chain: foundry, mode: 'anvil', transport: http('http://127.0.0.1:8547') }).extend(publicActions).extend(walletActions)
const [mart, ana, ben, cat] = await c.getAddresses()
const state = new URL('./out/live.json', import.meta.url)
const w = async (from, to, abi, fn, args = [], value = 0n) => { const r = await c.waitForTransactionReceipt({ hash: await c.writeContract({ address: to, abi, functionName: fn, args, account: from, value, gas: 3_000_000n }) }); if (r.status !== 'success') throw new Error('reverted: ' + fn) }
const [cmd, ...a] = process.argv.slice(2)
if (cmd === 'setup') {
  for (const [addr, n] of [[AGENT_ID, 'MockAgentId'], [USDT, 'MockUsdt'], [FEED, 'MockFeed']]) await c.setCode({ address: addr, bytecode: art[n].deployed })
  await w(mart, FEED, art.MockFeed.abi, 'set', [600n * 10n ** 8n, 0n])
  for (const p of [ana, ben]) { await w(mart, AGENT_ID, art.MockAgentId.abi, 'set', [p, 1n]); await w(mart, USDT, art.MockUsdt.abi, 'mint', [p, parseEther('100')]) }   // cat holds no Agent ID
  const iou = (await c.waitForTransactionReceipt({ hash: await c.deployContract({ abi: A, bytecode: art.AgentIOU.bytecode, args: ['https://example.invalid/meta/{id}.json'], account: mart }) })).contractAddress
  // the three Promise Mart offers, exactly as planned for the real deployment
  await w(mart, iou, A, 'createOffer', ['Day one sticker', 1, parseEther('0.01'), 1, 100, 1])
  await w(mart, iou, A, 'createOffer', ['Night owl sticker', 1, parseEther('0.03'), 2, 100, 2])
  await w(mart, iou, A, 'createOffer', ['Good word sticker', 1, parseEther('0.05'), 3, 100, 3])
  // the shop's lending money: it holds 9 USDT (100 loans of each offer) and lets the contract pass on up to that much
  await w(mart, USDT, art.MockUsdt.abi, 'mint', [mart, parseEther('9')]); await w(mart, USDT, art.MockUsdt.abi, 'approve', [iou, parseEther('9')])
  const out = { contract: iou, mart, ana, ben, cat }; fs.writeFileSync(state, JSON.stringify(out)); console.log(JSON.stringify(out))
} else {
  const { contract } = JSON.parse(fs.readFileSync(state, 'utf8'))
  if (cmd === 'sendh') { const hash = await c.sendTransaction({ account: a[0], to: a[1], data: a[2], value: 0n, gas: 3_000_000n, ...(a[3] === 'legacy' ? { type: 'legacy' } : {}) }); const r = await c.waitForTransactionReceipt({ hash }); console.log(r.status + ' ' + hash) }   // the same, answering with the hash too; 'legacy' sends the kind of transaction the Agentic Wallet sends
  else if (cmd === 'send') { const r = await c.waitForTransactionReceipt({ hash: await c.sendTransaction({ account: a[0], to: a[1], data: a[2], value: parseEther(a[3] || '0'), gas: 3_000_000n }) }); console.log(r.status) }
  else if (cmd === 'join') { await w(a[0], contract, A, 'join', [a[1]]); console.log('success') }
  else if (cmd === 'call') { await w(a[0], contract, A, a[1], JSON.parse(a[2] || '[]').map((v) => (typeof v === 'string' && /^\d+n$/.test(v) ? BigInt(v.slice(0, -1)) : v))); console.log('success') }
  else if (cmd === 'pay') { await w(a[0], contract, A, a[1], JSON.parse(a[2]).map((v) => BigInt(v)), parseEther(a[3])); console.log('success') }
  else if (cmd === 'block') { await c.setCode({ address: a[0], bytecode: a[1] === 'on' ? art.Rejector.deployed : '0x' }); console.log('success') }   // make an address unable to receive BNB, or able again
  else if (cmd === 'sign') {   // what the wallet's sign-message does: sign the site's EIP-712 request, answer the way the agent does
    const req = JSON.parse(a[1]); const sig = await c.request({ method: 'eth_signTypedData_v4', params: [a[0], req.params[1]] })
    console.log(`Signature: ${sig.slice(2, 130)} signatureRecovery: ${sig.slice(130) === '1c' ? '01' : '00'}`)
  }
  else if (cmd === 'usdt') { console.log((await c.readContract({ address: USDT, abi: art.MockUsdt.abi, functionName: 'balanceOf', args: [a[0]] })).toString()) }
  else if (cmd === 'shop') { await w(mart, USDT, art.MockUsdt.abi, 'approve', [contract, parseEther(a[0])]); console.log('success') }   // change how much the shop lets the contract lend
  else if (cmd === 'credit') { console.log((await c.readContract({ address: contract, abi: A, functionName: 'credits', args: [a[0]] })).toString()) }
  else if (cmd === 'warp') { await c.increaseTime({ seconds: Number(a[0]) }); await c.mine({ blocks: 1 }); await w(mart, FEED, art.MockFeed.abi, 'set', [600n * 10n ** 8n, 0n]); console.log('success') }
  else if (cmd === 'user') { const [u, level, score, limitCents, overdue, restricted] = await c.readContract({ address: contract, abi: A, functionName: 'getUser', args: [a[0]] }); console.log(JSON.stringify({ xp: u.xp, onTime: u.onTime, late: u.late, owedCents: u.owedCents, nickname: u.nickname, level, score, limitCents, overdue, restricted, checkDays: u.checkDays, pocket: [...u.pocket] })) }
}

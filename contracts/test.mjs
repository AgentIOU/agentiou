// Tests for AgentIOU against a local chain (anvil). Run: node compile.mjs && node test.mjs
import { spawn } from 'child_process'; import fs from 'fs'
import { createTestClient, http, publicActions, walletActions, parseEther, decodeErrorResult, getAddress } from 'viem'
import { foundry } from 'viem/chains'
const art = JSON.parse(fs.readFileSync('out/artifacts.json', 'utf8'))
const AGENT_ID = '0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F', USDT = '0x55d398326f99059fF775485246999027B3197955', FEED = '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE'
const anvil = spawn('./node_modules/@foundry-rs/anvil-linux-amd64/bin/anvil', ['--port', '8546', '--silent', '--accounts', '30', '--code-size-limit', '24576'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 1500))
const c = createTestClient({ chain: foundry, mode: 'anvil', transport: http('http://127.0.0.1:8546') }).extend(publicActions).extend(walletActions)
const accts = await c.getAddresses(); const [mart, ana, ben, cat, dan, eve] = accts
let pass = 0, fail = 0
const ok = (name, cond, note = '') => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' :: ' + note)) }
const deploy = async (name, args = [], from = mart) => { const h = await c.deployContract({ abi: art[name].abi, bytecode: art[name].bytecode, args, account: from }); return (await c.waitForTransactionReceipt({ hash: h })).contractAddress }
const A = art.AgentIOU.abi
let iou
const send = async (from, fn, args = [], value = 0n, to = iou, abi = A) => { const h = await c.writeContract({ address: to, abi, functionName: fn, args, account: from, value, gas: 3_000_000n }); const r = await c.waitForTransactionReceipt({ hash: h }); if (r.status !== 'success') throw new Error('reverted: ' + fn); return r }
const read = (fn, args = [], to = iou, abi = A) => c.readContract({ address: to, abi, functionName: fn, args })
const reverts = async (name, want, from, fn, args = [], value = 0n) => {
  try { await c.simulateContract({ address: iou, abi: A, functionName: fn, args, account: from, value }); ok(name, false, 'did not revert') }
  catch (e) { const n = e.cause?.data?.errorName ?? (() => { try { return decodeErrorResult({ abi: A, data: e.cause?.cause?.data ?? e.cause?.data }).errorName } catch { return String(e.shortMessage).slice(0, 80) } })(); ok(name, n === want, `got ${n}`) }
}
const warp = async (sec) => { await c.increaseTime({ seconds: sec }); await c.mine({ blocks: 1 }); await send(mart, 'set', [600n * 10n ** 8n, 0n], 0n, FEED, art.MockFeed.abi) }
const U = parseEther, usdt = art.MockUsdt.abi, dan2 = () => dan
try {
  // stand-ins for Agent ID, USDT and the price feed, placed at the real addresses
  for (const [addr, n] of [[AGENT_ID, 'MockAgentId'], [USDT, 'MockUsdt'], [FEED, 'MockFeed']]) await c.setCode({ address: addr, bytecode: art[n].deployed })
  await send(mart, 'set', [600n * 10n ** 8n, 0n], 0n, FEED, art.MockFeed.abi)
  for (const a of [ana, ben, cat, dan]) { await send(mart, 'set', [a, 1n], 0n, AGENT_ID, art.MockAgentId.abi); await send(mart, 'mint', [a, U('1000')], 0n, USDT, usdt) }
  iou = await deploy('AgentIOU', ['https://example.invalid/{id}.json'])
  ok('deployer is the shop and nothing else', getAddress(await read('MART')) === getAddress(mart) && !A.some((f) => /owner|pause|upgrade|setFee|setUri|rescue|sweep/i.test(f.name ?? '')))

  // ---- joining
  await reverts('join needs an Agent ID', 'NotAgentIdHolder', eve, 'join', ['eve'])
  for (const bad of ['a', 'x'.repeat(21), 'has space', 'BinanceHelp', 'my_bnb', 'Admin1', 'support-team', 'official', '<b>hi</b>', 'line\nbreak']) await reverts(`nickname refused: ${JSON.stringify(bad).slice(0, 16)}`, 'BadNickname', ana, 'join', [bad])
  await send(ana, 'join', ['ana']); await send(ben, 'join', ['ben_2']); await send(cat, 'join', ['cat-3'])
  let [u, level, score, limit] = await read('getUser', [ana])
  ok('join: 50 XP, L1, $1 limit, score 50, member no 1, verified badge', u.xp === 50 && level === 1 && limit === 100 && score === 50 && u.no === 1 && u.badges === 1)
  await reverts('cannot join twice', 'AlreadyJoined', ana, 'join', ['again'])

  // ---- offers
  await send(mart, 'createOffer', ['Day one sticker', 1, U('0.01'), 2, 50, 1]); await send(mart, 'createOffer', ['Night owl sticker', 1, U('0.03'), 3, 50, 2]); await send(mart, 'createOffer', ['Good word sticker', 0, U('0.00008'), 5, 2, 3])
  await reverts('only the shop can attach a Founders sticker', 'BadDesign', ana, 'createOffer', ['Fake', 1, U('1'), 2, 5, 1])
  await reverts('Season designs cannot be sold in an offer', 'BadDesign', mart, 'createOffer', ['Nope', 1, U('1'), 2, 5, 4])
  await send(ben, 'createOffer', ['Ben tea', 1, U('0.9'), 2, 5, 0]); ok('a member can open a plain shop; offers read in pages', (await read('getOffers', [0n, 50n])).length === 4 && (await read('getOffers', [3n, 50n])).length === 1 && (await read('getOffers', [9n, 5n])).length === 0)
  await reverts('a shop must be IOU Verified (stops free level farming through throwaway shops)', 'NotJoined', eve, 'createOffer', ['x', 1, 1n, 30, 10, 0])
  await reverts('take needs joining first', 'NotJoined', dan, 'takeOffer', [1n])
  await send(ana, 'takeOffer', [1n])
  let x = await read('getIOU', [1n]); let mi = await read('mintInfo', [ana, 1n])
  ok('take: IOU active for 1 cent, due in 2 days, sticker No 1 minted with block and time', x.status === 1 && x.usdCents === 1 && Number(x.dueAt - x.createdAt) === 2 * 86400 && mi[0] === 1 && mi[1] > 0n && mi[2] > 0 && (await read('balanceOf', [ana, 1n])) === 1n)
  await send(ana, 'takeOffer', [4n]); await reverts('L1 limit is $1', 'OverLimit', ana, 'takeOffer', [4n])
  await reverts('a shop cannot take its own offer', 'SelfIou', ben, 'takeOffer', [4n])

  // ---- repay USDT
  await reverts('only the debtor can repay', 'NotDebtor', ben, 'repay', [1n])
  await reverts('USDT repay must send no BNB', 'WrongAmount', ana, 'repay', [1n], 1n)
  await reverts('USDT repay needs the approval first', 'TransferFailed', ana, 'repay', [1n])
  const m0 = await read('balanceOf', [mart], USDT, usdt)
  await send(ana, 'approve', [iou, U('0.01')], 0n, USDT, usdt); await send(ana, 'repay', [1n])
  ;[u, level, score] = await read('getUser', [ana])
  ok('USDT repay: exact amount reaches the shop, contract holds nothing, allowance used up', (await read('balanceOf', [mart], USDT, usdt)) - m0 === U('0.01') && (await read('balanceOf', [iou], USDT, usdt)) === 0n && (await read('allowance', [ana, iou], USDT, usdt)) === 0n)
  ok('on-time repay: XP 50+30+10+25+15 = 130, score 57, First Promise badge', u.xp === 130 && score === 57 && (u.badges & 2) === 2 && u.onTime === 1 && u.people === 1, `xp ${u.xp} score ${score}`)
  await reverts('cannot repay twice', 'WrongStatus', ana, 'repay', [1n])

  // ---- IOUs between people
  await reverts('no IOU to yourself', 'SelfIou', ben, 'createIOU', [ben, 1, U('1'), 7, 'x'])
  await reverts('0 days refused', 'BadDays', ben, 'createIOU', [ana, 1, U('1'), 0, 'x']); await reverts('31 days refused', 'BadDays', ben, 'createIOU', [ana, 1, U('1'), 31, 'x'])
  await reverts('zero amount refused', 'BadAmount', ben, 'createIOU', [ana, 1, 0n, 7, 'x']); await reverts('note over 48 bytes refused', 'BadMemo', ben, 'createIOU', [ana, 1, U('1'), 7, 'x'.repeat(49)])
  await reverts('cannot ask for more than your own level allows ($1 at L1)', 'OverLimit', cat, 'createIOU', [ana, 1, U('1.01'), 7, 'big'])
  await reverts('sender must be a member', 'NotJoined', eve, 'createIOU', [ana, 1, U('0.5'), 7, 'x'])
  await send(cat, 'createIOU', [ana, 0, U('0.0001'), 7, 'Bus fare'])            // id 3, 0.0001 BNB = 6 cents
  x = await read('getIOU', [3n]); ok('BNB IOU priced from the feed: 0.0001 BNB = 6 cents', x.usdCents === 6 && x.status === 0)
  await reverts('only the debtor can accept', 'NotDebtor', ben, 'acceptIOU', [3n]); await reverts('only the creditor can cancel', 'NotCreditor', ana, 'cancelIOU', [3n])
  await send(ana, 'acceptIOU', [3n]); await reverts('cannot cancel after accept', 'WrongStatus', cat, 'cancelIOU', [3n])
  await reverts('BNB repay must send the exact value', 'WrongAmount', ana, 'repay', [3n], U('0.00009'))
  const c0 = await c.getBalance({ address: cat }); await send(ana, 'repay', [3n], U('0.0001'))
  ok('BNB repay: creditor gets exactly the amount, contract holds nothing', (await c.getBalance({ address: cat })) - c0 === U('0.0001') && (await c.getBalance({ address: iou })) === 0n)
  await send(cat, 'createIOU', [ana, 1, U('1'), 7, 'a']); await send(ana, 'declineIOU', [4n]); await send(cat, 'createIOU', [ana, 1, U('1'), 7, 'b']); await send(cat, 'cancelIOU', [5n])
  ok('decline and cancel work and free the sender count', (await read('getIOU', [4n])).status === 3 && (await read('getIOU', [5n])).status === 4 && (await read('pendingSent', [cat])) === 0n)
  await reverts('declined IOU cannot be accepted', 'WrongStatus', ana, 'acceptIOU', [4n])
  await reverts('cannot send an IOU to someone who is not IOU Verified', 'NotJoined', cat, 'createIOU', [dan, 1, U('1'), 7, 'c'])

  // ---- levels: ana has 2 on-time; the third opens L2
  await send(ana, 'approve', [iou, U('0.9')], 0n, USDT, usdt); await send(ana, 'repay', [2n])
  ;[u, level, score, limit] = await read('getUser', [ana])
  ok('3 on-time repays: L2, $5 limit, Trusted badge, +125 XP once', level === 2 && limit === 500 && (u.badges & 4) === 4 && u.onTime === 3, `level ${level} xp ${u.xp}`)
  const xpL2 = u.xp
  // ---- check-in
  await send(ana, 'checkIn'); await reverts('check-in once a day', 'AlreadyCheckedIn', ana, 'checkIn'); await reverts('check-in needs joining', 'NotJoined', eve, 'checkIn')
  await warp(86400); await send(ana, 'checkIn'); u = (await read('getUser', [ana]))[0]; ok('check-in: +5 XP a day, card counts days', u.xp === xpL2 + 10 && u.checkDays === 2)

  // ---- vouchers and stickers
  let cl = await read('claimable', [ana]); ok('claimable follows XP', cl[0] === Math.floor(u.xp / 50) && cl[1] === Math.floor(u.xp / 150) && cl[2] === Math.floor(u.xp / 300), String(cl))
  await send(ana, 'claimVoucher', [0]); await send(ana, 'mintSticker', [4n]); mi = await read('mintInfo', [ana, 4n])
  ok('mint: edition 1 with block and time, balance 1, voucher used', mi[0] === 1 && mi[1] > 0n && (await read('balanceOf', [ana, 4n])) === 1n && (await read('getUser', [ana]))[0].pocket[0] === 0)
  await reverts('each design once per wallet', 'AlreadyHeld', ana, 'mintSticker', [4n]); await reverts('no voucher, no mint', 'NoVoucher', ana, 'mintSticker', [5n])
  await reverts('Founders designs cannot be minted with a voucher', 'BadDesign', ana, 'mintSticker', [2n]); await reverts('design 13 does not exist', 'BadDesign', ana, 'mintSticker', [13n])
  for (let i = 0; i < cl[0] - 1; i++) await send(ana, 'claimVoucher', [0]); await reverts('cannot claim more than XP allows', 'NotEnoughXp', ana, 'claimVoucher', [0])
  await reverts('stickers cannot be sent', 'Soulbound', ana, 'safeTransferFrom', [ana, ben, 4n, 1n, '0x']); await reverts('stickers cannot be approved', 'Soulbound', ana, 'setApprovalForAll', [ben, true])

  // ---- late, default
  await send(ben, 'takeOffer', [2n]); const lateId = BigInt((await read('stats'))[1])
  await warp(4 * 86400)                                                          // 1 day past due
  ;[u, level, score, , x] = await read('getUser', [ben]); ok('one IOU past due: shows overdue, score drops 10 at once, not restricted yet', x === true && score === 40 && (await read('getUser', [ben]))[5] === false, `score ${score}`); await reverts('overdue blocks claim', 'Overdue', ben, 'claimVoucher', [0])
  await send(ben, 'approve', [iou, U('0.03')], 0n, USDT, usdt); await send(ben, 'repay', [lateId]); ;[u, , score] = await read('getUser', [ben])
  ok('late repay: counted late, no repay XP (50 join + 15 new person + 10 for an IOU paid back to him), score 50-10+2 = 42', u.late === 1 && u.onTime === 0 && score === 42 && u.xp === 75, `late ${u.late} score ${score} xp ${u.xp}`)
  // ---- two IOUs past due: Restricted until repaid
  await send(ben, 'takeOffer', [1n]); const r1 = BigInt((await read('stats'))[1]); await send(ben, 'takeOffer', [2n]); const r2 = r1 + 1n; await warp(4 * 86400)
  let rs; ;[u, level, score, , , rs] = await read('getUser', [ben]); ok('two IOUs past due: Restricted, level 1, score drops 20 more', rs === true && level === 1 && score === 22, `restricted ${rs} score ${score}`)
  await reverts('restricted: cannot borrow', 'Restricted', ben, 'takeOffer', [1n]); await reverts('restricted: cannot send an IOU', 'Restricted', ben, 'createIOU', [ana, 1, U('0.1'), 7, 'x']); await reverts('restricted: cannot claim', 'Overdue', ben, 'claimVoucher', [0])
  await send(cat, 'createIOU', [ben, 1, U('0.1'), 7, 'to restricted']); await reverts('restricted: cannot accept an IOU', 'Restricted', ben, 'acceptIOU', [BigInt((await read('stats'))[1])])
  await send(ben, 'approve', [iou, U('0.04')], 0n, USDT, usdt); await send(ben, 'repay', [r1]); ok('repaying one lifts the restriction', (await read('getUser', [ben]))[5] === false)
  await send(ben, 'repay', [r2]); ;[u, , , , x, rs] = await read('getUser', [ben]); ok('repaying all clears overdue; both stay on the record as late', x === false && rs === false && u.late === 3)
  await send(ben, 'setNickname', ['ben_new'])
  ok('a profile can only be changed by its own wallet', (await read('getUser', [ben]))[0].nickname === 'ben_new' && (await read('getUser', [ana]))[0].nickname === 'ana')
  const touch = A.filter((f) => f.type === 'function' && !['view', 'pure'].includes(f.stateMutability) && f.inputs.some((i) => i.type.startsWith('address'))).map((f) => f.name).sort().join(',')
  ok('no function lets one wallet act on another wallet\'s profile or money', touch === 'createIOU', touch)
  await send(cat, 'takeOffer', [1n]); const defId = BigInt((await read('stats'))[1]); await warp(10 * 86400)
  let od; ;[u, level, , , , od] = await read('getUser', [cat]); ok('8 days past due: Restricted, level 1', od === true && level === 1)
  await reverts('a default blocks new credit', 'Restricted', cat, 'takeOffer', [2n])
  await send(cat, 'approve', [iou, U('0.01')], 0n, USDT, usdt); await send(cat, 'repay', [defId]); ;[u, , score, , , od] = await read('getUser', [cat])
  ok('default repaid: recorded for good, credit opens again', u.defaults === 1 && od === false && score === 50 - 25 + 2); await send(cat, 'takeOffer', [2n])

  // ---- stock runs out, the shop refills
  await send(ana, 'takeOffer', [3n]); await send(dan2(), 'join', ['dan']); await send(dan, 'takeOffer', [3n])
  await reverts('sold out when stock is gone', 'SoldOut', ben, 'takeOffer', [3n]); await reverts('only the shop can restock', 'NotShop', ben, 'restock', [3n, 100])
  await send(mart, 'restock', [3n, 100]); await send(ben, 'takeOffer', [3n]); ok('restock opens the offer again', (await read('getOffers', [0n, 50n]))[2].taken === 3)
  // ---- price feed
  const now = (await c.getBlock()).timestamp; await send(mart, 'set', [600n * 10n ** 8n, now - 2n * 86400n], 0n, FEED, art.MockFeed.abi)
  await reverts('stale price pauses new BNB IOUs', 'StalePrice', ben, 'createIOU', [ana, 0, U('0.001'), 7, 'x']); await send(ben, 'createIOU', [ana, 1, U('0.5'), 7, 'usdt ok']); ok('USDT keeps working with a stale feed', true)
  await send(mart, 'set', [0n, 0n], 0n, FEED, art.MockFeed.abi); await reverts('zero price refused', 'StalePrice', ben, 'createIOU', [ana, 0, U('0.001'), 7, 'x']); await send(mart, 'set', [600n * 10n ** 8n, 0n], 0n, FEED, art.MockFeed.abi)

  // ---- BNB that cannot be delivered waits for the creditor
  const rej = await deploy('Rejector'); await send(mart, 'set', [rej, 1n], 0n, AGENT_ID, art.MockAgentId.abi); await send(mart, 'join', [iou], 0n, rej, art.Rejector.abi); await send(mart, 'create', [iou, ana, U('0.001')], 0n, rej, art.Rejector.abi); const rid = BigInt((await read('stats'))[1])
  await send(ana, 'acceptIOU', [rid]); await send(ana, 'repay', [rid], U('0.001'))
  ok('undeliverable BNB is kept under the creditor\'s name, IOU still counts as repaid', (await read('credits', [rej])) === U('0.001') && (await c.getBalance({ address: iou })) === U('0.001') && (await read('getIOU', [rid])).status === 2)
  await reverts('nothing to withdraw for others', 'NothingToWithdraw', ana, 'withdraw')
  await send(mart, 'setOpen', [true], 0n, rej, art.Rejector.abi); await send(mart, 'pull', [iou], 0n, rej, art.Rejector.abi)
  ok('the creditor can collect undelivered BNB; the contract is empty again', (await read('credits', [rej])) === 0n && (await c.getBalance({ address: iou })) === 0n && (await c.getBalance({ address: rej })) === U('0.001'))
  // ---- level farming: only 3 repays a day count toward the level
  await send(mart, 'set', [eve, 1n], 0n, AGENT_ID, art.MockAgentId.abi); await send(mart, 'mint', [eve, U('10')], 0n, USDT, usdt); await send(eve, 'join', ['eve']); await send(eve, 'approve', [iou, U('1')], 0n, USDT, usdt)
  for (let k = 0; k < 5; k++) { await send(eve, 'takeOffer', [2n]); await send(eve, 'repay', [BigInt((await read('stats'))[1])]) }
  ;[u, level] = await read('getUser', [eve]); ok('5 on-time repays in one day: all on record, only 3 count toward the level', u.onTime === 5 && u.good === 3 && level === 2, `onTime ${u.onTime} good ${u.good}`)

  // ---- caps
  for (let i = 0; i < 20; i++) await send(dan, 'createIOU', [ana, 1, U('0.01'), 30, 'p' + i]); await reverts('20 pending per sender', 'TooManyPending', dan, 'createIOU', [ana, 1, U('0.01'), 30, 'x'])
  const first = BigInt((await read('stats'))[1]) - 19n; const act0 = (await read('getUser', [ana]))[0]
  let accepted = 0; for (let i = 0n; i < 20n; i++) { try { await send(ana, 'acceptIOU', [first + i]); accepted++ } catch { break } }
  ok('10 active debts at most', accepted <= 10 && accepted > 0, String(accepted)); await reverts('11th active debt refused', 'TooManyActive', ana, 'acceptIOU', [first + BigInt(accepted)])

  // ---- random run: 600 actions by 4 people; the money rules must hold after every one
  let seed = 12345; const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n }
  const people = [ana, ben, cat, dan]; let bad = '', done = 0
  for (const p of people) await send(p, 'approve', [iou, 0n], 0n, USDT, usdt)
  for (let i = 0; i < 600 && !bad; i++) {
    const p = people[rnd(4)], q = people[rnd(4)], n = BigInt((await read('stats'))[1]); const id = n ? BigInt(rnd(Number(n))) + 1n : 1n
    try {
      const k = rnd(9)
      if (k === 0) await send(p, 'createIOU', [q, rnd(2), rnd(2) ? U('0.0' + (rnd(9) + 1)) : U('0.000' + (rnd(9) + 1)), rnd(30) + 1, 'r'])
      else if (k === 1) await send((await read('getIOU', [id])).debtor, 'acceptIOU', [id]); else if (k === 2) await send((await read('getIOU', [id])).debtor, 'declineIOU', [id]); else if (k === 3) await send(rnd(3) ? (await read('getIOU', [id])).creditor : p, 'cancelIOU', [id])
      else if (k === 4 || k === 5) { const it = await read('getIOU', [id]); if (it.asset === 1) await send(it.debtor, 'approve', [iou, it.amount], 0n, USDT, usdt); await send(it.debtor, 'repay', [id], it.asset === 0 ? it.amount : 0n) }
      else if (k === 6) await send(p, 'takeOffer', [BigInt(rnd(4)) + 1n]); else if (k === 7) await warp(rnd(3 * 86400)); else await send(p, 'checkIn')
      done++
    } catch { /* refused actions are expected */ }
    if ((await read('balanceOf', [iou], USDT, usdt)) !== 0n) bad = 'contract holds USDT'
    let cr = 0n; for (const a of [...people, mart, rej]) cr += await read('credits', [a]); if ((await c.getBalance({ address: iou })) !== cr) bad = 'BNB balance differs from undelivered credits'
    if (i % 20 === 19) for (const a of people) { const [uu] = await read('getUser', [a]); const [, list] = await read('getUserIOUs', [a, 0n, 500n]); const sum = list.filter((t) => t.status === 1 && getAddress(t.debtor) === getAddress(a)).reduce((s, t) => s + t.usdCents, 0); if (sum !== uu.owedCents) bad = `owed ${uu.owedCents} but active sum ${sum}`; if (list.filter((t) => t.status === 1 && getAddress(t.debtor) === getAddress(a)).length > 10) bad = 'more than 10 active debts' }
  }
  ok(`random run: ${done} accepted actions of 600, contract never held USDT, BNB equals undelivered credits, owed totals match`, !bad && done > 100, bad || `only ${done} actions`)
  const st = await read('stats'); ok('stats add up', st[0] === 6n && st[1] > 20n)
  { const all = await read('getUsers', [0n, 50n]); const nos = []; for (const m of all) nos.push((await read('getUser', [m]))[0].no)
    ok('member numbers are 1, 2, 3... in joining order, one per wallet, never repeated', nos.length === 6 && nos.every((n, i) => n === i + 1), nos.join(',')) }
  // ---- the 7-day check-in card
  { const day = async () => { await warp(86400); await send(eve, 'checkIn'); return (await read('getUser', [eve]))[0] }
    await warp(2 * 86400); await send(eve, 'checkIn'); let e = (await read('getUser', [eve]))[0]; const x0 = e.xp
    ok('check-in after a gap starts the card at day 1', e.checkDays === 1)
    for (let i = 0; i < 5; i++) e = await day()
    ok('six days in a row: day 6 on the card, 5 XP each', e.checkDays === 6 && e.xp === x0 + 25, `${e.checkDays} ${e.xp - x0}`)
    e = await day(); ok('day 7: 5 XP + 20 bonus', e.checkDays === 7 && e.xp === x0 + 50, `${e.checkDays} ${e.xp - x0}`)
    e = await day(); ok('day 8: the card starts again at 1, plain 5 XP', e.checkDays === 1 && e.xp === x0 + 55, `${e.checkDays} ${e.xp - x0}`)
    e = await day(); await warp(86400); e = await day(); ok('a missed day restarts at 1 and takes no XP away', e.checkDays === 1 && e.xp === x0 + 65, `${e.checkDays} ${e.xp - x0}`) }
} catch (e) { fail++; console.log('TEST CRASHED', e.shortMessage ?? e) }
console.log(`\n${pass} of ${pass + fail} contract checks passed`); anvil.kill(); process.exit(fail ? 1 : 0)

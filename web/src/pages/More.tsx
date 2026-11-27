import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, ClipboardPaste, Copy, ShieldCheck } from 'lucide-react'
import { HAS_ME, saveMe, rankPoints, AGENT_ID, BNB_FEED, BNB_USD, CONTRACT, DEMO, LEVELS, ME, SAFE_TEXT, USDT, isAddr, levelOf, nickError, score, short, styleOf, usd, viewOf } from '../lib/data'
import { useStore } from '../lib/store'
import { useFlows } from '../lib/flows'
import { prompts } from '../lib/prompt'
import { checkTx, dropAsk, hashesIn, markOf, newAsk, openAsk, type Ask } from '../lib/proof'
import { Link } from '../lib/router'
import { Avatar, Led, rosette } from '../components/art'
import { DemoChip, LevelChip, RestrictedTag, Risk, useCopy } from '../components/ui'
import { Mascot, type Pose } from '../components/fx'
import { FAQ, Q } from './Home'

/* /start: five steps to get verified */
const START: [string, string, Pose][] = [
  ['Claim your Agent ID in the Binance App', 'The contract only lets Agent ID holders join. The live site checks this by reading the Agent ID contract for your address.', 'search'],
  ['Turn on Developer Mode in the App', 'It lets your Agentic Wallet call a contract directly. It can only be turned on in the Binance App.', 'read'],
  ['Keep a little BNB in your Agentic Wallet', 'Every action costs a small amount of gas. The live site reads your balance to check.', 'coin'],
  ['Enter your wallet address', 'Paste your Agentic Wallet address. The site reads the chain for it. Never paste a key or seed phrase anywhere.', 'card'],
  ['Get IOU Verified', 'Pick a nickname, copy one prompt to your agent and confirm there. One transaction joins you and proves the wallet is yours on this device. You start with 50 XP and a $1 limit.', 'stamp'],
]
type Seen = { address: string; joined: boolean; nickname: string; checkedToday: boolean; holdsAgentId: boolean | null; nonce: number; block: number }
/** Steps 4 and 5 on the live site. An address becomes "mine" on this device only when its own wallet sends a transaction that carries this device's mark:
 *  the join itself for a new member, today's check-in or the same nickname again for someone who joined before. The site finds that transaction on the chain by itself. */
function useVerify(on: boolean) {
  const [ask, setAsk] = useState<Ask | null>(() => (on ? openAsk() : null))
  const [seen, setSeen] = useState<Seen | null>(() => (ask ? { address: ask.wallet, joined: ask.carrier !== 'join', nickname: ask.carrier === 'join' ? '' : ask.nick, checkedToday: ask.carrier === 'nick', holdsAgentId: null, nonce: ask.nonce, block: ask.block } : null))
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [found, setFound] = useState(false); const [over, setOver] = useState(false); const [why, setWhy] = useState('')
  const working = useRef(false)
  const start = (who: Seen, nick: string) => setAsk(newAsk(who.address, who.joined ? (who.checkedToday ? 'nick' : 'checkIn') : 'join', nick, who.nonce, who.block))
  const look = async (address: string) => {
    setBusy(true); setErr('')
    try { const w = await (await import('../lib/chain')).lookWallet(address); const who = { address, ...w }; setSeen(who); if (who.joined) start(who, who.nickname) }
    catch { setErr("We can't reach BNB Smart Chain right now. Check your connection and try again.") }
    setBusy(false)
  }
  const again = () => { dropAsk(); setAsk(null); setSeen(null); setErr(''); setFound(false); setOver(false); setWhy('') }
  const accept = async (tx: Parameters<typeof checkTx>[1]) => { if (!ask) return 'none' as const; const r = await checkTx(ask, tx); if (!r.ok) return r.why; setFound(true); dropAsk(); setTimeout(() => saveMe(r.proof, ask.seal), 900); return 'ok' as const }
  // while a request is open: ask the chain every few seconds, and at once when the visitor comes back to the page
  useEffect(() => {
    if (!ask || found) return
    let live = true
    const go = async () => {
      if (!live || working.current || document.hidden) return
      if (Date.now() / 1000 > ask.expires) { setOver(true); return }
      working.current = true
      try { const tx = await (await import('../lib/chain')).findMarked(ask.wallet, markOf(ask.seal), ask.nonce, ask.block); if (live && tx) await accept(tx) } catch { /* the chain did not answer: the next round asks again */ }
      working.current = false
    }
    go(); const id = setInterval(go, 4000); document.addEventListener('visibilitychange', go); addEventListener('focus', go)
    return () => { live = false; clearInterval(id); document.removeEventListener('visibilitychange', go); removeEventListener('focus', go) }
  }, [ask, found])   // eslint-disable-line react-hooks/exhaustive-deps
  /** The way round when the site does not find the transaction by itself: the visitor pastes its hash, or the agent's answer that holds it. */
  const paste = async (text: string) => {
    if (!ask) return
    const hashes = hashesIn(text); if (!hashes.length) { setWhy("We can't find a transaction hash in that. It starts with 0x and is 64 characters long."); return }
    setBusy(true); setWhy(''); let last = 'none'
    try { const chain = await import('../lib/chain'); for (const h of hashes) { const tx = await chain.txByHash(h); if (!tx) continue; last = await accept(tx); if (last === 'ok') break } } catch { last = 'down' }
    setBusy(false)
    if (last !== 'ok') setWhy(last === 'none' ? 'The chain does not have that transaction yet. Wait a few seconds and try again.' : last === 'down' ? "We can't reach BNB Smart Chain right now. Try again." : last === 'other' ? 'That transaction is not from this wallet to the AgentIOU contract.' : last === 'mark' ? 'That transaction was not made from the prompt on this page. Copy the prompt above and run that one.' : "We could not read that transaction. Start again to get a new prompt.")
  }
  const prompt = !ask ? '' : ask.carrier === 'join' ? prompts.joinProof(ask.nick, markOf(ask.seal)) : ask.carrier === 'checkIn' ? prompts.checkInProof(markOf(ask.seal)) : prompts.nickProof(ask.nick, markOf(ask.seal))
  return { ask, seen, busy, err, found, over, why, look, start, again, paste, prompt }
}
type Verify = ReturnType<typeof useVerify>
/** Step 4, live: the address, then what the chain says about it. */
function StepAddress({ v }: { v: Verify }) {
  const s = useStore(); const [addr, setAddr] = useState('')
  if (v.seen) return <p className="mt-2 text-[14px]"><span className="mono break-all">{v.seen.address}</span> <span className="text-muted">· {v.seen.joined ? <>already IOU Verified as <b className="text-chalk">{v.seen.nickname}</b></> : 'not joined yet'}</span> <button type="button" className="btn-text underline underline-offset-4 text-[14px] ml-1" onClick={v.again}>Use a different address</button></p>
  return (
    <div className="mt-4"><label className="label" htmlFor="aw">Agentic Wallet address</label><div className="flex gap-3"><input id="aw" className="input mono" placeholder="0x…" value={addr} onChange={(e) => setAddr(e.target.value)} autoComplete="off" spellCheck={false} /><button type="button" className="btn btn-secondary" aria-label="Paste from clipboard" onClick={async () => { try { setAddr((await navigator.clipboard.readText()).trim()) } catch { s.toast('Paste with your keyboard here.', 'bad') } }}><ClipboardPaste size={17} aria-hidden />Paste</button></div>
      {addr && !isAddr(addr) && <p className="hint text-coral">This doesn't look like a BNB Smart Chain address.</p>}{isAddr(addr) && <p className="hint text-leaf flex items-center gap-1.5"><Check size={15} aria-hidden />Looks like a valid address</p>}
      {v.err && <p className="hint text-coral" role="alert">{v.err}</p>}
      <button type="button" className="btn btn-primary btn-sm mt-4" disabled={!isAddr(addr.trim()) || v.busy} onClick={() => v.look(addr.trim())}>{v.busy ? 'Reading the chain' : 'Continue'}</button>
      <p className="hint mt-3">To look at a wallet without proving anything, check it on <Link to="trust" className="underline underline-offset-4">Open Trust</Link> or open its public profile.</p></div>
  )
}
/** Step 5, live: the one prompt, and the wait for its transaction. */
function StepProve({ v }: { v: Verify }) {
  const copy = useCopy(); const [nick, setNick] = useState(''); const [copied, setCopied] = useState(false); const [open, setOpen] = useState(false); const [text, setText] = useState('')
  const badNick = nickError(nick), who = v.seen
  if (!who) return null
  if (!v.ask) return (
    <div className="mt-4 max-w-[420px]">
      {who.holdsAgentId === false && <p className="text-coral text-[14px] font-semibold mb-3">This address has no Agent ID yet, so joining will be refused. Claim one in the Binance App first.</p>}
      <label className="label" htmlFor="nn">Nickname</label><input id="nn" className="input" value={nick} onChange={(e) => setNick(e.target.value)} maxLength={20} placeholder="2 to 20 characters" /><p className={`hint ${badNick ? 'text-coral' : ''}`}>{badNick || 'Not unique and not searchable. It always shows next to your short address.'}</p>
      <button type="button" className="btn btn-primary mt-4" disabled={!nick || !!badNick} onClick={() => v.start(who, nick)}>Make my prompt</button></div>
  )
  return (
    <div className="mt-4">
      {v.ask.carrier === 'join' && <p className="text-[14px]"><span className="text-muted">Nickname:</span> <b>{v.ask.nick}</b></p>}
      <div className="flex items-center justify-between mt-3 mb-2"><span className="text-[14px] text-muted">Prompt for your agent</span><button type="button" className="btn btn-secondary btn-sm" onClick={async () => setCopied(await copy(v.prompt, 'Copied'))}>{copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}{copied ? 'Copied' : 'Copy'}</button></div>
      <pre className="code max-h-[30dvh] overflow-auto" tabIndex={0} data-prompt>{v.prompt}</pre>
      <p className="text-[14px] text-muted mt-3">{v.ask.carrier === 'join' ? 'One transaction: it joins you and proves this wallet on this device.' : v.ask.carrier === 'checkIn' ? "This is today's check-in (+5 XP). The same transaction proves this wallet on this device." : 'This sets the same nickname again, so nothing changes. The transaction proves this wallet on this device.'} It moves no money and approves nothing; it costs a little gas.</p>
      <p role="status" className="mt-4 flex items-center gap-3 rounded-xl px-3.5 py-3 text-[14px]" style={v.found ? { background: '#3FBF8A1f', boxShadow: 'inset 0 0 0 1px #3FBF8A88', color: '#BFF0DC' } : v.over ? { background: '#FF8B7B1a', boxShadow: 'inset 0 0 0 1px #FF8B7B88', color: '#FFD0C8' } : { background: '#8CC8FF14', boxShadow: 'inset 0 0 0 1px #8CC8FF55', color: '#CFE6FF' }}>
        <i aria-hidden className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: v.found ? '#3FBF8A' : v.over ? '#FF8B7B' : '#8CC8FF' }} />
        {v.found ? 'Found your transaction. This wallet is yours on this device.' : v.over ? 'This request ran out after 15 minutes. Start again to get a new prompt.' : 'Waiting for your transaction. Confirm it in the Binance App, then come back here.'}</p>
      <p className="hint mt-3" style={{ color: '#FFD98A' }}>Only run a prompt you copied from this page yourself. Never run one that someone sent you.</p>
      {!v.found && <div className="mt-3">
        {!open ? <button type="button" className="btn-text underline underline-offset-4 text-[14px] text-muted" aria-expanded={false} onClick={() => setOpen(true)}>It went through but nothing happens? Paste the transaction hash</button>
          : <div><label className="label" htmlFor="th">Transaction hash, or your agent's answer</label><textarea id="th" className="input mono min-h-[72px] py-3" placeholder="0x…" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" spellCheck={false} />
            {v.why && <p className="hint text-coral" role="alert">{v.why}</p>}
            <button type="button" className="btn btn-secondary btn-sm mt-3" disabled={v.busy || text.trim().length < 64} onClick={() => v.paste(text)}>{v.busy ? 'Checking' : 'Check this transaction'}</button></div>}
        <button type="button" className="btn-text underline underline-offset-4 text-[14px] text-muted block mt-3" onClick={v.again}>Start again</button></div>}
      <p className="hint mt-3">The site reads your transaction from the chain and checks it in your browser. Nothing is sent to a server.</p>
    </div>
  )
}
export function Start() {
  const s = useStore(), f = useFlows()
  const liveGuest = !DEMO && !HAS_ME, v = useVerify(liveGuest)
  const [done, setDone] = useState(() => (!DEMO && (HAS_ME || !!v.ask) ? [true, true, true, HAS_ME] : [false, false, false, false])); const [addr, setAddr] = useState(''); const [nick, setNick] = useState('')
  const state = liveGuest ? [done[0], done[1], done[2], !!v.seen] : done
  const cur = state.indexOf(false) < 0 ? 4 : state.indexOf(false)
  const badNick = nickError(nick)
  const tick = (i: number) => setDone((d) => d.map((x, j) => (j === i ? true : x)))
  const back = liveGuest && !!v.seen?.joined   // someone who joined before, on a device that has not proved the wallet yet
  // joining is once per wallet: the contract refuses a second join, so the page shows the profile instead
  if (s.joined) return <div className="wrap pt-32 pb-24 flex flex-wrap items-center gap-8"><Mascot pose="stamp" expr="success" className="w-40" /><div><h1 className="h2">You are IOU Verified</h1><p className="lead mt-3">This is done once per wallet. Your profile, Credit Pass and IOUs are ready.</p><div className="flex flex-wrap gap-3 mt-6"><Link to="u" param={ME} className="btn btn-primary">Open my profile</Link><Link to="mart" className="btn btn-secondary">Go to Promise Mart</Link></div></div></div>
  return (
    <div className="wrap pt-28 pb-16 grid gap-10 lg:grid-cols-[1fr_300px] items-start">
      <div><div className="flex flex-wrap items-center gap-3"><h1 className="h2">Get IOU Verified</h1><DemoChip /></div><p className="lead mt-3">Five steps, about five minutes. The site never asks for a key, a seed phrase or a wallet connection.</p>
        <ol className="mt-8 grid gap-4">{START.map(([t0, d0], i) => { const ok = i < 4 ? state[i] : false, now = i === cur
          const [t, d] = i === 4 && back ? ['Open your profile on this device', 'You joined before. One small transaction from your wallet proves it is yours on this device.'] : [t0, d0]
          return <li key={t0} className="panel p-5 flex gap-4" style={{ borderColor: now ? '#FFB23F' : undefined }} aria-current={now ? 'step' : undefined}>
            <span className={`w-9 h-9 rounded-full shrink-0 inline-flex items-center justify-center font-extrabold ${ok ? 'bg-leaf text-ink' : 'border border-rule'}`}>{ok ? <Check size={18} aria-label="Done" /> : i + 1}</span>
            <div className="flex-1 min-w-0"><h2 className="text-[20px]">{t}</h2><p className="text-muted mt-1">{d}</p>
              {i === 3 && liveGuest && (now || ok) && <StepAddress v={v} />}
              {i === 4 && liveGuest && now && <StepProve v={v} />}
              {i === 3 && !ok && DEMO && <div className="mt-4"><label className="label" htmlFor="aw">Agentic Wallet address</label><div className="flex gap-3"><input id="aw" className="input mono" placeholder="0x…" value={addr} onChange={(e) => setAddr(e.target.value)} autoComplete="off" spellCheck={false} /><button type="button" className="btn btn-secondary" aria-label="Paste from clipboard" onClick={async () => { try { setAddr((await navigator.clipboard.readText()).trim()) } catch { s.toast('Paste with your keyboard here.', 'bad') } }}><ClipboardPaste size={17} aria-hidden />Paste</button></div>
                {addr && !isAddr(addr) && <p className="hint text-coral">This doesn't look like a BNB Smart Chain address.</p>}{isAddr(addr) && <p className="hint text-leaf flex items-center gap-1.5"><Check size={15} aria-hidden />Looks like a valid address</p>}</div>}
              {i < 4 && !ok && now && !(i === 3 && !DEMO) && <button type="button" className="btn btn-secondary btn-sm mt-4" disabled={i === 3 && !isAddr(addr)} onClick={() => tick(i)}>{i === 3 ? 'Save on this device' : 'I did this'}</button>}
              {i === 4 && now && !liveGuest && <div className="mt-4 max-w-[420px]"><label className="label" htmlFor="nn">Nickname</label><input id="nn" className="input" value={nick} onChange={(e) => setNick(e.target.value)} maxLength={20} placeholder="2 to 20 characters" /><p className={`hint ${badNick ? 'text-coral' : ''}`}>{badNick || 'Not unique and not searchable. It always shows next to your short address.'}</p><button type="button" className="btn btn-primary mt-4" disabled={!nick || !!badNick} onClick={() => f.join(nick)}>Get IOU Verified</button></div>}
            </div></li> })}</ol>
        {DEMO ? <p className="hint mt-5">In this demo you tick the first steps yourself. On the live site steps 1, 3 and 4 are read from the chain, and step 5 is one transaction from your own wallet.</p>
          : HAS_ME && <div className="panel p-4 mt-5 flex flex-wrap items-center gap-x-4 gap-y-2"><span className="text-[14px] text-muted">Proved on this device:</span><span className="mono text-[14px] break-all">{ME}</span>{s.holdsAgentId === true && <span className="pill pill-leaf"><ShieldCheck size={14} aria-hidden />Holds an Agent ID</span>}{s.holdsAgentId === false && <span className="text-coral text-[14px] font-semibold">This address has no Agent ID yet, so joining will be refused. Claim one in the Binance App first.</span>}<button type="button" className="btn-text underline underline-offset-4 text-[14px] ml-auto" onClick={() => saveMe(null)}>Use a different address</button></div>}</div>
      <aside className="hidden lg:block sticky top-28 text-center"><Mascot pose={START[cur][2]} expr={cur === 4 ? 'success' : 'happy'} className="w-56 mx-auto" /><p className="text-muted mt-4">Step {cur + 1} of 5</p></aside>
    </div>
  )
}

/* /new: send a friend an IOU */
export function NewIou() {
  const s = useStore(), f = useFlows()
  const [to, setTo] = useState(s.draftTo); const [asset, setAsset] = useState<'BNB' | 'USDT'>('USDT'); const [amount, setAmount] = useState(''); const [days, setDays] = useState('7'); const [memo, setMemo] = useState('')
  const n = Number(amount), d = Number(days), bytes = new TextEncoder().encode(memo).length, addr = to.trim()
  const friend = isAddr(addr) ? s.user(addr) : undefined
  const myLimit = LEVELS[levelOf(s.me) - 1].limit, meBlocked = !!s.whyNotSend(), friendBlocked = !!friend && s.restricted(friend.address)
  const known = useMemo(() => [...new Set(s.ious.filter((x) => x.creditor === ME || x.debtor === ME).map((x) => (x.creditor === ME ? x.debtor : x.creditor)))].map((a) => s.user(a)).filter((u) => u && u.nickname !== 'promise-mart').slice(0, 4), [s])
  const err = {
    to: addr && !isAddr(addr) ? "This doesn't look like a BNB Smart Chain address. Check every character." : addr.toLowerCase() === ME.toLowerCase() ? "You can't send an IOU to yourself." : '',
    amount: amount && !/^\d+(\.\d{1,6})?$/.test(amount) ? 'Use numbers only, up to 6 decimals.' : amount && !(n > 0) ? 'Enter an amount above zero.' : (asset === 'BNB' ? n * BNB_USD : n) > myLimit ? `Your level lets you ask for up to $${myLimit} at a time.` : '',
    days: !(d >= 1 && d <= 30 && Number.isInteger(d)) ? 'Choose 1 to 30 days.' : '',
    memo: bytes > 48 ? 'Keep the note under 48 bytes.' : !SAFE_TEXT.test(memo) ? "Use plain letters, numbers and . , ! ? ( ) ' - only." : '',
  }
  const notVerified = isAddr(addr) && !friend && !err.to
  const ok = isAddr(addr) && n > 0 && !Object.values(err).some(Boolean) && !meBlocked && !friendBlocked && !notVerified
  const due = new Date(Date.now() + (d || 0) * 86400_000), dueT = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), who = friend?.nickname ?? (isAddr(addr) ? short(addr) : 'your friend')
  const over = friend && (asset === 'BNB' ? n * BNB_USD : n) > LEVELS[levelOf(friend) - 1].limit - s.owed(friend.address)
  return (
    <div className="wrap pt-28 pb-16 grid gap-12 lg:grid-cols-[minmax(0,540px)_1fr] items-start">
      <form onSubmit={(e) => { e.preventDefault(); if (ok) f.create(addr, asset, n, d, memo) }} noValidate>
        <div className="flex flex-wrap items-center gap-3"><h1 className="h2">Send a friend an IOU</h1><DemoChip /></div><p className="lead mt-3">Someone owes you? Write it down here. It becomes active only when they accept.</p>
        {meBlocked && <div className="panel border-coral p-4 mt-5"><p className="text-coral font-semibold">{s.restricted(ME) ? 'Your account is Restricted. Repay your overdue IOUs to send IOUs again.' : s.whyNotSend()}</p><Link to="me" className="btn btn-primary btn-sm mt-3">Open My IOUs</Link></div>}
        <fieldset disabled={meBlocked} className={meBlocked ? 'opacity-50' : ''}>
        <div className="mt-8"><label className="label" htmlFor="to"><span className="led text-amber mr-2">1</span>Who owes you</label><input id="to" className="input mono" placeholder="0x… their Agentic Wallet address" value={to} onChange={(e) => setTo(e.target.value)} autoComplete="off" spellCheck={false} aria-invalid={!!err.to} aria-describedby="to-h" />
          <p id="to-h" className={`hint ${err.to ? 'text-coral' : ''}`}>{err.to || 'Ask your friend for their address, or open their profile and press "Send an IOU". There is no search by name.'}</p>
          {known.length > 0 && !friend && <div className="flex flex-wrap items-center gap-2 mt-3"><span className="text-[14px] text-muted">People you have dealt with:</span>{known.map((u) => <button key={u!.address} type="button" className="chip cursor-pointer hover:border-chalk" onClick={() => setTo(u!.address)}><span className="flex items-center gap-1.5"><Avatar address={u!.address} score={score(u!)} level={levelOf(u!)} style={styleOf(u)} size={22} mini />{u!.nickname}</span></button>)}</div>}
          {friend && <div className="panel p-4 mt-3 flex items-center gap-4"><Avatar address={friend.address} score={score(friend)} level={levelOf(friend)} style={styleOf(friend)} size={56} mini /><div className="min-w-0"><p className="font-extrabold flex flex-wrap items-center gap-2">{friend.nickname}<span className="pill pill-leaf"><ShieldCheck size={14} aria-hidden />Agent ID holder</span>{friendBlocked && <RestrictedTag small />}</p>{friendBlocked && <p className="text-coral text-[14px] mt-1">This account has overdue IOUs and can't accept new ones until it repays.</p>}<p className="text-muted text-[14px] mt-1">Trust Score {score(friend)}, {LEVELS[levelOf(friend) - 1].name}, {friend.onTime} on-time repays, {friend.defaults} defaults. Room left on their limit: {usd(Math.max(0, LEVELS[levelOf(friend) - 1].limit - s.owed(friend.address)))}</p></div></div>}
          {notVerified && <p className="hint text-coral font-semibold">This user is not IOU Verified yet. They need an Agent ID and to get IOU Verified before you can send them an IOU.</p>}</div>
        <div className="grid grid-cols-[1fr_auto] gap-3 mt-7"><div><label className="label" htmlFor="am"><span className="led text-amber mr-2">2</span>How much</label><input id="am" className="input" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} aria-invalid={!!err.amount} /></div>
          <fieldset><legend className="label">Token</legend><div className="flex rounded-xl border border-rule overflow-hidden h-11">{(['USDT', 'BNB'] as const).map((a) => <label key={a} className={`px-4 inline-flex items-center cursor-pointer font-semibold ${asset === a ? 'bg-chalk text-ink' : ''}`}><input type="radio" name="asset" className="sr-only" checked={asset === a} onChange={() => setAsset(a)} />{a}</label>)}</div></fieldset></div>
        <p className={`hint ${err.amount || over ? 'text-coral' : ''}`}>{err.amount || (over ? `This is more than the room left on ${who}'s limit, so they will not be able to accept it.` : asset === 'BNB' && n > 0 ? `≈ ${usd(n * BNB_USD)} at ${DEMO ? 'the demo price' : 'the current price'}` : 'They repay exactly this amount. No interest, no fees.')}</p>
        <div className="mt-7"><label className="label" htmlFor="dd"><span className="led text-amber mr-2">3</span>Pay back within</label><div className="flex flex-wrap items-center gap-2"><input id="dd" className="input" style={{ width: 88 }} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} aria-invalid={!!err.days} /><span className="mr-2">days</span>{[3, 7, 14, 30].map((q) => <button key={q} type="button" aria-pressed={d === q} onClick={() => setDays(String(q))} className={`chip cursor-pointer ${d === q ? 'chip-now' : ''}`}><span>{q} days</span></button>)}</div><p className={`hint ${err.days ? 'text-coral' : ''}`}>{err.days || `Due ${dueT}, your time`}</p></div>
        <div className="mt-7"><label className="label" htmlFor="me"><span className="led text-amber mr-2">4</span>What is it for</label><input id="me" className="input" placeholder="Lunch, bus fare, print shop" value={memo} onChange={(e) => setMemo(e.target.value)} aria-invalid={!!err.memo} /><p className={`hint ${err.memo ? 'text-coral' : ''}`}>{err.memo || `${bytes} of 48 bytes. Public on-chain, so no private details.`}</p></div>
        <div className="panel p-5 mt-8"><h2 className="text-[18px]">Check before you send</h2><p className="mt-2">{ok ? <><b>{who}</b> promises to pay you <b className="money">{n} {asset}</b> on or before <b>{dueT}</b>{memo && <> for "{memo}"</>}.</> : <span className="text-muted">Fill in the four boxes to see the promise in one sentence.</span>}</p>
          <button className="btn btn-primary mt-4" disabled={!ok}>Write the prompt for my agent</button></div>
        </fieldset>
        <Risk>Nobody guarantees repayment. If they don't pay, it shows on their record, but AgentIOU can't get the money back for you.</Risk>
      </form>
      <aside className="grid gap-8">
        <div aria-label="Preview"><p className="text-muted mb-3">How it looks in their Inbox</p>
          <div className="panel p-5 max-w-[420px]" style={{ borderRadius: '4px 16px 16px 16px' }}><p><b>{s.me.nickname}</b> says you owe <b className="money">{n > 0 ? n : '0'} {asset}</b></p><p className="text-muted text-[15px] mt-1">For: {memo || 'no note'}. Due {dueT}.</p><div className="flex gap-3 mt-4" aria-hidden><span className="btn btn-primary btn-sm opacity-70">Accept</span><span className="btn btn-secondary btn-sm opacity-70">Decline</span></div></div></div>
        <section aria-labelledby="n-next"><h2 id="n-next" className="text-[20px]">What happens next</h2>
          <ol className="mt-4 grid gap-4 max-w-[440px]">{[['You send it', 'One transaction from your agent. Gas only; no money moves.', 'wave'], ['Your friend accepts', 'It shows in their Inbox. Until they accept, you can cancel it.', 'card'], [`They repay by ${dueT}`, `The exact amount goes straight from their wallet to yours.`, 'coin'], ['Both records update', 'They get Trust Score and XP for paying on time. You get XP too.', 'jump']].map(([t, dd, pose], i) => <li key={i} className="flex gap-4 items-center"><Mascot pose={pose as Pose} className="w-14 shrink-0" /><div><p className="font-extrabold"><span className="led text-amber mr-2">{i + 1}</span>{t}</p><p className="text-muted text-[15px]">{dd}</p></div></li>)}</ol>
          <p className="hint mt-4">One IOU past due drops their level. Two past due, or one more than 7 days late, makes the account Restricted until it repays.</p></section>
      </aside>
    </div>
  )
}

/* /board */
export function Board() {
  const s = useStore(); const rows = useMemo(() => s.users.filter((u) => u.nickname !== 'promise-mart').sort((a, b) => rankPoints(b) - rankPoints(a) || score(b) - score(a) || b.onTime - a.onTime), [s.users])
  return (
    <div className="wrap pt-28 pb-16"><div className="flex flex-wrap items-center gap-3"><h1 className="h2">Leaderboard</h1><DemoChip /></div><p className="lead mt-3">Every member, by points. Profiles are public: the record is on-chain for anyone to check.</p><p className="text-muted mt-2">Points = Trust Score x 10 + XP. Repaying on time moves you up fastest; a late IOU moves you down.</p>
      <ol className="ledger mt-8">{rows.map((u, i) => <li key={u.address} className="grid grid-cols-[36px_1fr_auto] sm:grid-cols-[48px_1fr_170px_130px_90px] items-center gap-x-4 py-3.5 border-b border-rule">
        <span className="led text-[20px] text-muted">{i + 1}</span>
        <Link to="u" param={u.address} className="flex items-center gap-3 font-semibold min-w-0 hover:underline underline-offset-4"><Avatar address={u.address} score={score(u)} level={levelOf(u)} style={styleOf(u)} overdue={s.hasOverdue(u.address)} size={44} mini /><span className="truncate">{u.nickname}</span>{s.restricted(u.address) && <RestrictedTag small />}</Link>
        <span className="hidden sm:block"><LevelChip level={levelOf(u)} /></span><span className="hidden sm:block text-muted text-[14px]">Trust {score(u)}, {u.xp} XP</span>
        <span className="text-right"><span className="led text-amber text-[28px] leading-none">{rankPoints(u)}</span><span className="sr-only"> points</span><span className="block sm:hidden text-muted text-[12px]">Trust {score(u)}, {u.xp} XP</span></span></li>)}</ol></div>
  )
}

/* /proof */
const RED: [string, string][] = [
  ['Never asks for a password or a wallet connection', 'No account, no password, no wallet connection, no QR or pairing code. To show a profile as yours on a device, your own wallet sends one transaction to the contract (the join itself, a check-in, or the same nickname again). The site reads it from the chain, and the check runs in your browser.'],
  ['Never acts without your confirmation', 'Every prompt ends with: show me the preview first, do not execute until I confirm.'],
  ['Never takes an unlimited approval', "Approvals are for the exact amount. The contract can't pull anyone's money."],
  ['Never hides its code', 'The source is public under the MIT licence. There is no owner, so there are no owner powers.'],
  ['Never asks for a seed phrase or a key', 'Not on any page, for any reason.'],
  ['Never promises income', 'No yield and no interest. XP has no cash value.'],
  ['Never hides the risk', 'Next to every credit and repay action: nobody guarantees repayment.'],
  ['Never looks people up by name', 'There is no search by name. Nicknames are neither unique nor searchable.'],
]
export function ProofPage() {
  return (
    <div className="relative overflow-hidden">
      <svg aria-hidden className="absolute -right-52 top-10 w-[760px] opacity-25" viewBox="0 0 400 400"><path d={rosette(200, 200, 150, 30, 12, 26, 0, 0.5, 200)} stroke="#2C3156" strokeWidth="0.7" fill="none" /></svg>
      <div className="wrap relative pt-28 pb-16 grid gap-14 max-w-[980px] mx-0 xl:mx-auto">
        <div><h1 className="h2">Proof &amp; Safety</h1><p className="lead mt-3">What the contract can and can't do, and how to check it yourself.</p></div>
        <section aria-labelledby="p-c"><h2 id="p-c" className="text-[20px]">Contract</h2>
          <dl className="ledger mt-4">{[['AgentIOU', CONTRACT ?? 'Not deployed yet. The address and the BscScan verified-source link appear here after deploy.'], ['Agent ID (ERC-721, non-transferable)', AGENT_ID], ['USDT (BSC-USD, 18 decimals)', USDT], ['Chainlink BNB/USD price feed', BNB_FEED]].map(([k, v]) => <div key={k} className="grid sm:grid-cols-[280px_1fr] gap-1 py-3.5 border-b border-rule"><dt className="text-muted">{k}</dt><dd className={`break-all ${String(v).startsWith('0x') ? 'mono text-[14px]' : ''}`}>{v}</dd></div>)}</dl>
          <p className="hint mt-3">The three addresses below AgentIOU are fixed in the contract code as constants.</p></section>
        <section aria-labelledby="p-o"><h2 id="p-o" className="text-[20px]">Owner powers: none</h2><ul className="mt-4 grid gap-3 text-muted max-w-[62ch]"><li>There is no owner, no upgrade, no pause and no fee.</li><li>The contract never holds money. A repayment goes straight from the person who owes to the person owed. If a BNB payment can't be delivered, it waits under the receiver's name until they withdraw it.</li><li>The contract never moves money by itself: no scheduled collection, no automatic transfer, no extra transfer bundled into another action. Every payment is one you start and confirm, and the prompt names who gets paid.</li><li>Everything the site shows is read from the contract's view functions, straight from your browser, so there is no server or indexer to trust. The Open Trust API (/api/trust) only reads the same functions for other apps; the site does not depend on it.</li><li>Limits are small on purpose: $1, $5 and $10. Nobody can ask for more than their own level allows, and nobody can owe more than their level's limit.</li><li>An account with two IOUs past due, or one more than 7 days late, is Restricted: it can only repay. Repaying lifts it at once.</li><li>A profile can only be changed by its own wallet. No function lets one wallet change another wallet's name, record or money.</li><li>If the BNB price feed is stale, new BNB IOUs pause for a while. USDT keeps working.</li></ul></section>
        <section aria-labelledby="p-r"><h2 id="p-r" className="text-[20px]">What AgentIOU never does</h2><div className="ledger mt-4">{RED.map(([r, a]) => <div key={r} className="grid sm:grid-cols-2 gap-x-8 gap-y-1 py-3.5 border-b border-rule border-l-[3px] border-l-leaf pl-4"><p className="font-semibold">{r}</p><p className="text-muted">{a}</p></div>)}</div></section>
        <section aria-labelledby="p-v"><h2 id="p-v" className="text-[20px]">Check it yourself</h2><ol className="mt-4 grid gap-3 text-muted list-decimal pl-5 max-w-[62ch]"><li>Open the AgentIOU address on BscScan and look for the verified-source tick on the Contract tab.</li><li>Under Read Contract, confirm there is no owner function and no way to change the rules.</li><li>Open any profile here, then read the same address with getUser on BscScan. The numbers match.</li><li>For a sticker, compare the edition, block and time in its mint proof with mintInfo.</li></ol>{DEMO && <p className="hint mt-4">These steps work once the contract is deployed. Until then this page describes the design.</p>}</section>
        <section aria-labelledby="p-k"><h2 id="p-k" className="text-[20px]">Risks</h2><ul className="mt-4 grid gap-3 text-muted max-w-[62ch]"><li>Nobody guarantees repayment. If you give credit, you can lose that amount.</li><li>Smart contracts can have bugs. The code is open and tested, but it has not been audited by a firm.</li><li>BNB changes price. The limit is counted in dollars at the moment the IOU is made.</li></ul></section>
      </div>
    </div>
  )
}

/* /about: what the project is, what is live, and where to check each claim */
const FACTS: [string, string, string][] = [
  ['Built on Agent ID', "Without an Agent ID you can't take credit. The whole credit history is tied to the Agent ID wallet; level, limit and badges all come from it; every action is run by the user's own agent.", 'The Agent ID check in the verified code, and the counters on this page.'],
  ['What it is for', 'Small tabs between shops, friends and freelancers. Money goes straight to the person owed. No fee, no interest. BNB or USDT.', 'Real IOUs and repayment records.'],
  ['What is live today', 'The website, the open-source contract with its tests, and the documentation are public.', 'The links on this page.'],
  ['What is new here', "Agent ID as a credit identity that can't be reset. Every action runs through your own agent. A shop that lends its own money at no interest. A record drawn as a town.", 'Promise Mart, the prompt cards, and Promise Town.'],
]
export function About() {
  const s = useStore()
  return (
    <div className="wrap pt-28 pb-16 grid gap-12">
      <div><div className="flex flex-wrap items-center gap-3"><h1 className="h2">About AgentIOU</h1><DemoChip text="Pre-deploy build" /></div><p className="lead mt-3">What AgentIOU is, what is live today, and where you can check each claim yourself.</p></div>
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-6">{[[s.users.length, 'Agent ID holders joined'], [s.ious.length, 'IOUs created'], [s.ious.filter((x) => viewOf(x) === 'Repaid').length, 'Repaid on time'], [s.users.reduce((n, u) => n + Object.keys(u.stickers).length, 0), 'Stickers minted']].map(([n, l]) => <div key={l} className="panel p-5"><dd><Led className="text-amber text-[40px] leading-none">{String(n)}</Led></dd><dt className="text-muted mt-2">{l}</dt></div>)}</dl>
      {DEMO && <p className="hint -mt-6">Demo numbers. After deploy these counters read the contract's stats function live.</p>}
      <div className="grid gap-5 md:grid-cols-2">{FACTS.map(([c, how, ev]) => <article key={c} className="panel p-6" style={{ borderRadius: '4px 18px 18px 18px' }}><h2 className="text-[20px]">{c}</h2><p className="mt-3">{how}</p><p className="text-muted mt-3"><b className="text-chalk">Where to see it:</b> {ev}</p></article>)}</div>
      <section aria-labelledby="j-l"><h2 id="j-l" className="text-[20px]">Links</h2><dl className="ledger mt-4">{([['Contract on BscScan', CONTRACT ? <a key="c" href={`https://bscscan.com/address/${CONTRACT}#code`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 mono break-all">{CONTRACT}</a> : 'Added when the contract is deployed'], ['Source code (MIT)', <a key="g" href="https://github.com/AgentIOU/agentiou" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">github.com/AgentIOU/agentiou</a>], ['Updates', <a key="x" href="https://x.com/AgentIOU" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">@AgentIOU on X</a>], ['Rules check', <Link key="r" to="proof" className="underline underline-offset-4">Proof &amp; Safety, rule by rule</Link>]] as [string, ReactNode][]).map(([k, v]) => <div key={k} className="grid sm:grid-cols-[280px_1fr] gap-1 py-3.5 border-b border-rule"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>)}</dl></section>
      <section><h2 className="text-[20px]">Credit Pass levels</h2><div className="ledger mt-4">{LEVELS.map((l) => <div key={l.n} className="grid grid-cols-[auto_1fr_auto] gap-4 items-center py-3.5 border-b border-rule"><LevelChip level={l.n} /><span className="text-muted">{l.rule}</span><Led className="text-amber text-[20px]">{'$' + l.limit}</Led></div>)}</div></section>
    </div>
  )
}

/* /legal */
export function Legal() {
  const H = ({ children }: { children: string }) => <h2 className="text-[20px] mt-10">{children}</h2>, P = ({ children }: { children: React.ReactNode }) => <p className="text-muted mt-3 max-w-[66ch]">{children}</p>
  return (
    <div className="wrap pt-28 pb-16 max-w-[860px] mx-0 xl:mx-auto"><h1 className="h2">Terms, privacy and risks</h1><P>Short and plain. AgentIOU is an independent project, not affiliated with Binance. Nothing here is financial advice.</P>
      <H>Terms</H><P>AgentIOU is a public smart contract and a website that reads it. There is no company account, no custody and no operator who can reverse a transaction. You use it at your own choice and your own risk.</P><P>An IOU is a promise between two wallets. AgentIOU records it; it does not enforce it and can't recover money for anyone.</P><P>XP has no cash value. Vouchers and stickers can't be sold or transferred.</P>
      <H>Privacy</H><P>No cookies, no analytics, no account, no personal details. The site keeps only your public address, the proof that it is yours on this device (one of your own transactions, exactly as it stands on the chain), a random seal for this device, your settings and your best Harbour Run score, all on your own device. Fonts and scripts are served from this site; nothing loads from third parties.</P><P>What you write on-chain is public and permanent: addresses, amounts, due dates, nicknames and notes. Don't put private details in a note.</P>
      <H>Risks</H><P>People may not repay. Smart contracts can have bugs. Token prices move. Gas costs change. Only promise what you can repay, and only give credit you could afford to lose.</P>
      <H>FAQs</H><div className="mt-4 border-t border-rule">{FAQ.slice(1, 4).map(([q, a]) => <Q key={q} q={q} a={a} />)}</div>
    </div>
  )
}

/* 404 */
export function NotFound() {
  return (
    <div className="wrap pt-28 pb-20 text-center relative">
      <div aria-hidden className="absolute left-1/2 top-40 -translate-x-1/2 w-[420px] max-w-[90vw] aspect-square rounded-full pointer-events-none" style={{ background: 'radial-gradient(closest-side,#8C96FF2e,transparent)' }} />
      <div className="relative flex items-center justify-center gap-2 md:gap-8" role="img" aria-label="404"><span className="led text-amber text-[120px] md:text-[220px] leading-none" style={{ textShadow: '0 0 30px #FFB23F66' }}>4</span><Mascot pose="search" expr="confused" className="w-32 md:w-56" /><span className="led text-amber text-[120px] md:text-[220px] leading-none" style={{ textShadow: '0 0 30px #FFB23F66' }}>4</span></div>
      <h1 className="h2 mt-6 relative">No IOU at this address.</h1><p className="lead mx-auto mt-3 relative">The page you're looking for isn't here. Your promises are safe.</p>
      <div className="flex flex-wrap gap-3 justify-center mt-8 relative"><Link to="home" className="btn btn-primary">Back to home</Link><Link to="mart" className="btn btn-secondary">Open Promise Mart</Link></div>
    </div>
  )
}
export { DEMO }

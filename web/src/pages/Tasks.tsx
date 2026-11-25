import { useEffect, useRef, useState } from 'react'
import { Check, Eye } from 'lucide-react'
import { ME, SEASON, TIERS, TIER_XP, claimable, dayOf, isAddr, levelOf, score, short, DEMO } from '../lib/data'
import { Link } from '../lib/router'
import { useStore } from '../lib/store'
import { useFlows } from '../lib/flows'
import { StickerCard, Ticket } from '../components/art'
import { DemoChip, InfoTip } from '../components/ui'
import { Floaters, Mascot, type Pose } from '../components/fx'

interface Quest { key: string; pose: Pose; title: string; cap: string; xp: string; bg: string }
const ONCE: Quest[] = [
  { key: 'join', pose: 'wave', title: 'Get IOU Verified', cap: 'Once', xp: '50', bg: '#2A2F6E' },
  { key: 'badge', pose: 'jump', title: 'Get a badge', cap: 'Once per badge', xp: '25', bg: '#5A2E63' },
  { key: 'level', pose: 'card', title: 'Reach Credit Pass L2, then L3', cap: 'Once each', xp: '100, 200', bg: '#1F4F4A' },
]
const REPEAT: Quest[] = [
  { key: 'repay', pose: 'coin', title: 'Repay on time', cap: '3 a day', xp: '30', bg: '#5C4320' },
  { key: 'early', pose: 'ticket', title: 'Repay 24 hours early', cap: 'With those 3', xp: '+10', bg: '#2A2F6E' },
  { key: 'paidback', pose: 'read', title: 'An IOU you gave comes back on time', cap: '5 a day', xp: '10', bg: '#1F4F4A' },
  { key: 'newperson', pose: 'search', title: 'Finish a first IOU with someone new', cap: '10 people in total', xp: '15', bg: '#5A2E63' },
]
function QuestCard({ q, done }: { q: Quest; done?: boolean }) {
  return (
    <li className="quest flex items-center gap-4 p-4 pr-5" style={{ background: `linear-gradient(120deg, ${q.bg}, ${q.bg}cc)` }}>
      <Mascot pose={q.pose} className="w-[68px] shrink-0" />
      <div className="min-w-0 flex-1"><h3 className="text-[17px] leading-snug">{q.title}</h3><p className="text-[14px] text-chalk/70 mt-0.5">{q.cap}</p></div>
      <div className="text-right shrink-0"><p className="led text-amber text-[24px] leading-none">{q.xp}</p><p className="text-[12px] text-chalk/70 mt-1">XP</p>{done && <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-leaf mt-1"><Check size={13} aria-hidden />Done before</span>}</div>
    </li>
  )
}
export default function Tasks() {
  const s = useStore(), f = useFlows(), me = s.me, can = claimable(me), od = s.hasOverdue(ME)
  const [addr, setAddr] = useState(''); const [seen, setSeen] = useState('')
  const next = TIER_XP.map((step) => step - (me.xp % step))
  const done: Record<string, boolean> = { join: s.joined, repay: me.onTime > 0, early: me.onTime > 1, paidback: false, newperson: me.people > 0, badge: Object.keys(me.badges).length > 0, level: levelOf(me) > 1 }
  const checked = dayOf(me.lastCheck) === dayOf(Date.now())
  // the card only shows days that are still in a row: a missed day empties it, as the contract will on the next check-in
  const cardDays = checked || dayOf(me.lastCheck) + 1 === dayOf(Date.now()) ? me.checkDays : 0
  const prev = useRef(me.xp); const [gain, setGain] = useState(0)
  useEffect(() => { if (me.xp > prev.current) { setGain(me.xp - prev.current); const t = setTimeout(() => setGain(0), 1400); prev.current = me.xp; return () => clearTimeout(t) } prev.current = me.xp }, [me.xp])
  return (
    <div className="glow" style={{ '--glow': 'radial-gradient(45% 22% at 88% 4%,#F2A7E038,transparent),radial-gradient(45% 22% at 0% 30%,#8C96FF38,transparent),radial-gradient(50% 20% at 95% 70%,#FFB23F26,transparent)' } as React.CSSProperties}>
      <Floaters items={[{ k: 'ticket', w: 96, style: { right: '4%', top: 96 }, desk: true }, { k: 'star', w: 50, style: { right: '15%', top: 250 }, far: true, desk: true }, { k: 'coin', w: 60, style: { left: '2%', top: 900 }, far: true, desk: true }]} />
      <div className="wrap relative pt-28 pb-16 grid gap-14">
        <div><div className="flex flex-wrap items-center gap-3"><h1 className="h2">Task Hub</h1><DemoChip /></div><p className="lead mt-3">Get XP for keeping your word, turn it into vouchers, and mint Season 1 stamps for free.</p>
          <form className="mt-6 max-w-[520px]" onSubmit={(e) => { e.preventDefault(); if (isAddr(addr)) setSeen(addr) }}>
            <label className="label" htmlFor="see">Look up a wallet</label><div className="flex gap-3"><input id="see" className="input mono" placeholder="0x… any Agentic Wallet address" value={addr} onChange={(e) => { setAddr(e.target.value); setSeen('') }} aria-describedby="see-h" autoComplete="off" spellCheck={false} /><button className="btn btn-secondary" disabled={!isAddr(addr)}>Show</button></div>
            <p id="see-h" className={`hint ${addr && !isAddr(addr) ? 'text-coral' : ''}`}>{addr && !isAddr(addr) ? "This doesn't look like a BNB Smart Chain address." : 'Public numbers only. Nothing is saved, and it does not change whose profile this device shows.'}</p><p className="hint">Lending somewhere else? <Link to="trust" className="underline underline-offset-4">Open Trust</Link> shows any app or exchange how to read this record.</p></form>
          {seen && (() => { const u = s.users.find((x) => x.address.toLowerCase() === seen.toLowerCase())
            return <div className="panel p-4 mt-4 max-w-[520px]" role="status">{u
              ? <><p className="text-[13px] text-muted flex items-center gap-1.5"><Eye size={14} aria-hidden />Viewing only</p><p className="font-semibold mt-1">{u.nickname} <span className="mono text-muted font-normal text-[14px]">{short(u.address)}</span></p><p className="mt-1"><span className="led text-amber text-[22px]">{u.xp}</span> XP, level L{levelOf(u)}, Trust Score {score(u)}</p><Link to="u" param={u.address} className="underline underline-offset-4 text-[14px] inline-block mt-2">Open the public profile</Link></>
              : <p className="text-muted">{s.loaded || DEMO ? 'This address is not IOU Verified.' : 'Reading the contract. Try again in a moment.'}</p>}</div> })()}</div>

        <section aria-labelledby="t-xp" className="quest p-6 md:p-8" style={{ background: 'linear-gradient(120deg,#23286A,#3B2A6E 60%,#5A2E63)' }}><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 id="t-xp" className="text-[20px]">Your XP</h2><p className="relative led text-[72px] leading-none text-chalk mt-2 inline-block" aria-live="polite">{me.xp}{gain > 0 && <span className="absolute left-full top-0 ml-3 text-amber text-[32px] whitespace-nowrap" style={{ animation: 'xpfly 1.4s var(--ease-out) both' }}>+{gain}</span>}</p></div><p className="text-chalk/80 max-w-[34ch]">XP only goes up. It never changes your Trust Score or your limit. <InfoTip label="About XP">XP has no cash value. Vouchers and stamps can't be sold or transferred.</InfoTip></p></div>
          <ul className="grid gap-5 mt-7 sm:grid-cols-3">{TIERS.map((t, i) => <li key={t}><div className="flex justify-between text-[14px]"><b>{t}</b><span className="text-chalk/70">every {TIER_XP[i]} XP</span></div><div className="h-2 rounded-full bg-ink/50 overflow-hidden mt-2"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${((TIER_XP[i] - next[i]) / TIER_XP[i]) * 100}%`, background: i === 2 ? 'var(--holo)' : i === 1 ? '#FFB23F' : '#AEB5FF' }} /></div><p className="text-[14px] text-chalk/70 mt-2">{next[i]} XP to the next voucher</p></li>)}</ul></section>

        <section aria-labelledby="t-daily"><h2 id="t-daily" className="text-[20px]">Daily</h2>
          <div className="quest mt-4 p-5 md:p-6 grid gap-6 md:grid-cols-[auto_1fr_auto] items-center" style={{ background: 'linear-gradient(120deg,#5C4320,#6B3A2A)' }}>
            <Mascot pose="stamp" expr={checked ? 'success' : 'happy'} className="w-24 hidden md:block" />
            <div><h3 className="text-[20px]">Daily check-in</h3><p className="text-chalk/75 mt-1">One small transaction a day for 5 XP. Seven days in a row adds a 20 XP bonus on day 7, then the card starts again. Miss a day and it restarts at day 1; you lose no XP.</p>
              <ol className="flex flex-wrap gap-1.5 sm:gap-2 mt-4" aria-label={`Check-in card: ${cardDays} of 7 days in a row`}>{Array.from({ length: 7 }, (_, i) => { const on = i < cardDays; return <li key={i} className={`w-9 h-9 sm:w-12 sm:h-12 rounded-full border-2 flex items-center justify-center led text-[16px] ${on ? 'border-amber bg-amber text-ink' : 'border-dashed border-chalk/40 text-chalk/60'}`} style={on && i === cardDays - 1 && checked ? { animation: 'stamp 700ms var(--ease-out) both', transform: 'none' } : undefined}>{on ? <Check size={20} aria-hidden /> : i === 6 ? <span className="text-[12px] sm:text-[14px] text-amber">+20</span> : i + 1}</li> })}</ol></div>
            <div className="text-left md:text-right"><p className="led text-amber text-[32px] leading-none">+{!checked && cardDays === 6 ? 25 : 5} <span className="text-[16px]">XP</span></p><button type="button" className="btn btn-primary mt-3" disabled={checked || !s.joined} onClick={f.checkIn}>{checked ? 'Come back tomorrow' : 'Check in'}</button></div>
          </div></section>

        <section aria-labelledby="t-once"><h2 id="t-once" className="text-[20px]">One-time</h2><ul className="grid gap-4 mt-4 md:grid-cols-2 xl:grid-cols-3">{ONCE.map((q) => <QuestCard key={q.key} q={q} done={done[q.key]} />)}</ul></section>
        <section aria-labelledby="t-rep"><h2 id="t-rep" className="text-[20px]">Every time</h2><ul className="grid gap-4 mt-4 md:grid-cols-2">{REPEAT.map((q) => <QuestCard key={q.key} q={q} done={done[q.key]} />)}</ul>
          <p className="text-muted text-[14px] mt-3">A late repay gives 0 XP. Repay XP is added inside the repay itself, with no extra transaction.</p></section>

        <section aria-labelledby="t-claim"><h2 id="t-claim" className="text-[20px]">Vouchers</h2><p className="text-muted mt-1">Claiming is one transaction through your agent. In your pocket: {me.pocket.map((n, i) => `${n} ${TIERS[i]}`).join(', ')}.</p>
          {od && <p className="text-coral mt-3 font-semibold">You have an overdue IOU. Repay it to unlock vouchers and minting.</p>}
          <ul className="grid gap-6 mt-6 grid-cols-3 max-w-[620px]">{TIERS.map((t, i) => <li key={t} className="text-center"><div className="relative mx-auto w-full max-w-[150px]"><Ticket tier={t} code={`x${me.pocket[i]}`} style={{ opacity: can[i] > 0 || me.pocket[i] > 0 ? 1 : 0.4, animation: me.pocket[i] > 0 ? undefined : undefined }} />{can[i] > 0 && <span className="absolute -top-2 -right-2 bg-amber text-ink rounded-full min-w-7 h-7 px-1.5 inline-flex items-center justify-center font-extrabold text-[14px]" aria-label={`${can[i]} ready to claim`}>{can[i]}</span>}</div>
            <button type="button" className="btn btn-primary btn-sm mt-4 w-full max-w-[150px]" disabled={can[i] < 1 || od || !s.joined} onClick={() => f.claim(i)}>Claim<span className="sr-only sm:not-sr-only"> {t}</span></button></li>)}</ul></section>

        <section aria-labelledby="t-shelf"><div className="flex flex-wrap items-center gap-4"><h2 id="t-shelf" className="text-[20px]">Season 1 stamps</h2><Mascot pose="coin" className="w-14" /></div><p className="text-muted mt-1">One voucher mints any one stamp of its tier. You choose; it is never random. Each design once per wallet.</p>
          {TIERS.map((t, ti) => <div key={t} className="mt-7"><h3 className="text-[16px] font-semibold flex items-center gap-3">{t}<span className="text-muted font-normal text-[14px]">{me.pocket[ti]} voucher{me.pocket[ti] === 1 ? '' : 's'} in pocket</span></h3>
            <ul className="grid grid-cols-3 gap-4 mt-3 max-w-[620px]">{SEASON.filter((d) => d.tier === t).map((d) => { const have = me.stickers[d.id]; return <li key={d.id} className="text-center"><StickerCard k={d.key} name={d.name} tier={t} mint={have} owner={ME} dim={!have} onFlip />
              {have ? <span className="pill pill-leaf mt-3">Minted</span> : <button type="button" className="btn btn-secondary btn-sm mt-3 w-full" disabled={me.pocket[ti] < 1 || od || !s.joined} onClick={() => f.mint(d.id)}>Mint</button>}</li> })}</ul></div>)}
          <p className="text-muted text-[14px] mt-6">Minting costs gas only and needs no token approval. Stamps are soulbound.</p></section>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Check, Sailboat, Sparkles, Ticket as TicketIcon } from 'lucide-react'
import { LOOK_NAME, LOOKS, ME, SEASON, SHADES, SHADE_XP, TIERS, TIER_XP, claimable, dayOf, levelOf, styleOf } from '../lib/data'
import { Link } from '../lib/router'
import { useStore } from '../lib/store'
import { useFlows } from '../lib/flows'
import { StickerCard, Ticket } from '../components/art'
import { DemoChip, InfoTip } from '../components/ui'
import { Floaters, Mascot, type Pose } from '../components/fx'
import { TownBox } from './Town'
import { MascotMark } from '../components/art'

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
    <li className="quest flex items-center gap-3 py-2 pl-2.5 pr-4" style={{ background: `linear-gradient(120deg, ${q.bg}, ${q.bg}cc)`, borderRadius: 16 }}>
      <Mascot pose={q.pose} className="w-10 shrink-0" />
      <div className="min-w-0 flex-1"><h3 className="text-[15px] leading-tight">{q.title}</h3><p className="text-[12.5px] text-chalk/70 mt-0.5">{q.cap}{done && <span className="inline-flex items-center gap-1 font-semibold text-leaf ml-2"><Check size={12} aria-hidden />Done before</span>}</p></div>
      <p className="shrink-0 whitespace-nowrap"><span className="led text-amber text-[20px] leading-none">{q.xp}</span><span className="text-[11px] text-chalk/70 ml-1">XP</span></p>
    </li>
  )
}
/** One-time and Every time in one box: two tabs, one list at a time. */
function Quests({ done }: { done: Record<string, boolean | undefined> }) {
  const [tab, setTab] = useState<'rep' | 'once'>('rep'); const list = tab === 'rep' ? REPEAT : ONCE
  return (
    <section aria-labelledby="t-ways"><h2 id="t-ways" className="text-[20px]">Ways to get XP</h2>
      <div className="inline-flex p-1 rounded-full mt-3" style={{ background: '#0E1024', boxShadow: 'inset 0 0 0 1px #2C3156' }}>{([['rep', 'Every time'], ['once', 'One-time']] as const).map(([k, label]) => <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className={`h-9 px-4 rounded-full text-[14px] font-bold cursor-pointer ${tab === k ? 'text-[#1E1B4B]' : 'text-muted hover:text-chalk'}`} style={tab === k ? { background: 'var(--holo)', boxShadow: 'inset 0 0 0 1.5px #ffffffd9' } : undefined}>{label}</button>)}</div>
      <ul className="grid gap-2 mt-3 md:grid-cols-2" aria-label={tab === 'rep' ? 'Every time' : 'One-time'}>{list.map((q) => <QuestCard key={q.key} q={q} done={done[q.key]} />)}</ul>
      {tab === 'rep' && <p className="text-muted text-[14px] mt-3">A late repay gives 0 XP. Repay XP is added inside the repay itself, with no extra transaction.</p>}
    </section>
  )
}
export default function Tasks() {
  const s = useStore(), f = useFlows(), me = s.me, can = claimable(me), od = s.hasOverdue(ME)
  const mine = styleOf(me)
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
      <div className="wrap relative pt-28 pb-16 grid gap-14 [&>*]:min-w-0">
        <div><div className="flex flex-wrap items-center gap-3"><h1 className="h2">Task Hub</h1><DemoChip /></div><p className="lead mt-3">Get XP for keeping your word, turn it into vouchers, and mint Season 1 stamps for free.</p>
          <p className="hint mt-4">Lending to someone? <Link to="trust" className="underline underline-offset-4 text-chalk">Check their record on Open Trust.</Link></p></div>

        <TownBox checked={checked} streak={cardDays} />

        <section aria-labelledby="t-xp" className="quest p-4 md:p-6" style={{ background: 'linear-gradient(120deg,#23286A,#3B2A6E 60%,#5A2E63)' }}>
          <div className="flex items-center justify-between gap-4">
            <div><h2 id="t-xp" className="text-[14px] font-bold text-chalk/80 flex items-center gap-1.5">Your XP <InfoTip label="About XP">XP only goes up. It never changes your Trust Score or your limit. XP has no cash value. Vouchers and stamps can't be sold or transferred.</InfoTip></h2>
              <p className="relative led text-[44px] md:text-[64px] leading-none text-chalk mt-1 inline-block" aria-live="polite">{me.xp}{gain > 0 && <span className="absolute left-full top-0 ml-3 text-amber text-[24px] whitespace-nowrap" style={{ animation: 'xpfly 1.4s var(--ease-out) both' }}>+{gain}</span>}</p></div>
            <ul className="flex gap-1.5 min-[360px]:gap-3 md:gap-7">{TIERS.map((t, i) => <li key={t} className="text-center">
              <svg role="img" aria-label={`${t}: ${next[i]} XP to the next voucher, one every ${TIER_XP[i]} XP`} viewBox="0 0 54 54" className="w-[54px] h-[54px] md:w-[68px] md:h-[68px] mx-auto">
                <defs><linearGradient id={`xp-ring-${i}`} x1="0" x2="1" y2="1"><stop offset="0" stopColor="#9FA8FF" /><stop offset=".5" stopColor="#F2A7E0" /><stop offset="1" stopColor="#FFC46B" /></linearGradient></defs>
                <circle cx="27" cy="27" r="22" fill="none" stroke="#0E102480" strokeWidth="6" />
                <circle cx="27" cy="27" r="22" fill="none" stroke={i === 2 ? `url(#xp-ring-${i})` : i === 1 ? '#FFB23F' : '#AEB5FF'} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${((TIER_XP[i] - next[i]) / TIER_XP[i]) * 138.2} 138.2`} transform="rotate(-90 27 27)" style={{ transition: 'stroke-dasharray 700ms' }} />
                <text x="27" y="32" textAnchor="middle" fontFamily="Doto" fontWeight="800" fontSize="15" fill="#fff">{next[i]}</text></svg>
              <p className="text-[11px] min-[360px]:text-[12px] md:text-[14px] font-bold mt-0.5" aria-hidden>{t}</p></li>)}</ul>
          </div>
          <p className="text-[13px] text-chalk/70 mt-2">The number in each ring is the XP left to the next voucher: Common every {TIER_XP[0]}, Rare every {TIER_XP[1]}, Legendary every {TIER_XP[2]}.</p></section>

        <section aria-labelledby="t-daily"><h2 id="t-daily" className="text-[20px]">Daily</h2>
          <div className="quest mt-4 p-4 md:p-5" style={{ background: 'linear-gradient(120deg,#5C4320,#6B3A2A)' }}>
            <div className="flex items-center justify-between gap-3"><h3 className="text-[18px] flex items-center gap-2"><Sailboat size={20} className="text-amber shrink-0" aria-hidden />Daily check-in</h3>
              <p className="flex items-center gap-1.5 shrink-0"><span className="led text-amber text-[22px] leading-none">+{!checked && cardDays === 6 ? 25 : 5}</span><span className="text-[13px] text-chalk/80">XP</span><InfoTip label="How the check-in card works">One small transaction a day for 5 XP. Seven days in a row adds a 20 XP bonus on day 7, then the card starts again. Miss a day and it restarts at day 1; you lose no XP.</InfoTip></p></div>
            <ol className="flex justify-between sm:justify-start sm:gap-3 mt-3" aria-label={`Check-in card: ${cardDays} of 7 days in a row`}>{Array.from({ length: 7 }, (_, i) => { const on = i < cardDays, now = !checked && i === cardDays
              return <li key={i} className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full border-2 flex items-center justify-center led text-[16px] ${on ? 'border-amber bg-amber text-ink' : now ? 'border-white text-[#1E1B4B]' : 'border-dashed border-chalk/40 text-chalk/60'}`} style={on && i === cardDays - 1 && checked ? { animation: 'stamp 700ms var(--ease-out) both', transform: 'none' } : now ? { background: 'var(--holo)', boxShadow: '0 0 14px #F2A7E088' } : undefined}>{on ? <Check size={20} aria-hidden /> : now ? <><Sailboat size={19} aria-hidden /><span className="sr-only">today</span></> : i === 6 ? <span className="text-[12px] sm:text-[14px] text-amber">+20</span> : i + 1}</li> })}</ol>
            <div className="flex flex-wrap items-center justify-between gap-3 mt-3"><p className="text-[14px] text-chalk/80">{checked ? `Day ${cardDays} of 7 is done.` : `Day ${cardDays + 1} of 7.`} Day 7 adds +20.</p><button type="button" className="btn btn-primary" disabled={checked || !s.joined} onClick={f.checkIn}><Sailboat size={18} aria-hidden />{checked ? 'Come back tomorrow' : 'Check in'}</button></div>
          </div></section>

        <Quests done={done} />

        <section aria-labelledby="t-claim"><h2 id="t-claim" className="text-[20px]">Vouchers</h2><p className="text-muted mt-1">Claiming is one transaction through your agent. In your pocket: {me.pocket.map((n, i) => `${n} ${TIERS[i]}`).join(', ')}.</p>
          {od && <p className="text-coral mt-3 font-semibold">You have an overdue IOU. Repay it to unlock vouchers and minting.</p>}
          <ul className="grid gap-6 mt-6 grid-cols-3 max-w-[620px]">{TIERS.map((t, i) => <li key={t} className="text-center"><div className="relative mx-auto w-full max-w-[150px]"><Ticket tier={t} code={`x${me.pocket[i]}`} style={{ opacity: can[i] > 0 || me.pocket[i] > 0 ? 1 : 0.4, animation: me.pocket[i] > 0 ? undefined : undefined }} />{can[i] > 0 && <span className="absolute -top-2 -right-2 bg-amber text-ink rounded-full min-w-7 h-7 px-1.5 inline-flex items-center justify-center font-extrabold text-[14px]" aria-label={`${can[i]} ready to claim`}>{can[i]}</span>}</div>
            <button type="button" className="btn btn-primary btn-sm mt-4 w-full max-w-[150px]" disabled={can[i] < 1 || od || !s.joined} onClick={() => f.claim(i)}><TicketIcon size={15} aria-hidden />Claim<span className="sr-only sm:not-sr-only"> {t}</span></button></li>)}</ul></section>

        <section aria-labelledby="t-shelf"><div className="flex flex-wrap items-center gap-4"><h2 id="t-shelf" className="text-[20px]">Season 1 stamps</h2><Mascot pose="coin" className="w-14" /></div><p className="text-muted mt-1">One voucher mints any one stamp of its tier. You choose; it is never random. Each design once per wallet.</p>
          <div className="panel p-4 mt-5 max-w-[620px]" aria-labelledby="t-opens">
            <h3 id="t-opens" className="text-[16px] font-semibold flex items-center gap-1.5">What your stamps open <InfoTip label="How the metal is chosen">A card and a mascot in that metal: any Common stamp gives Silver, any Rare stamp Gold, any Legendary stamp Aurora. The highest tier you hold sets the metal. The stamp you minted last in that tier sets the mascot's pose. Its colour changes every {SHADE_XP} XP.</InfoTip></h3>
            <div className="relative mt-3">
              <span aria-hidden className="absolute h-[3px] rounded-full" style={{ left: '16.67%', right: '16.67%', top: 23, background: `linear-gradient(90deg,#D8DAE8,#F2C14E ${mine.tier >= 2 ? 50 : 0}%,${mine.tier >= 3 ? '#C9A6FF' : '#ffffff22'} ${mine.tier >= 2 ? 50 : 0}%)`, opacity: mine.tier >= 2 ? 1 : 0.5 }} />
              <ol className="relative flex">{TIERS.map((t, i) => { const lk = LOOKS[i + 1], got = mine.tier >= i + 1, on = mine.tier === i + 1, ink = ['#D8DAE8', '#F2C14E', '#C9A6FF'][i], d = on ? 48 : 40
                return <li key={t} className="flex-1 text-center" aria-current={on || undefined}>
                  <span className="mx-auto rounded-full flex items-center justify-center" style={{ width: d, height: d, marginTop: on ? 0 : 4, background: got ? ['linear-gradient(135deg,#F4F5FA,#B9BDD2 55%,#E8EAF4)', 'linear-gradient(135deg,#FFE9A0,#E0A82E 55%,#FFD98A)', 'linear-gradient(135deg,#9FE8E0,#B9A6FF 50%,#FFB7D9)'][i] : '#ffffff12', boxShadow: on ? `0 0 0 3px #171A35, 0 0 0 4.5px ${ink}, 0 0 20px ${ink}88` : 'inset 0 0 0 1.5px #ffffff30' }}>
                    <span aria-hidden className="block" style={{ width: d * 0.66, opacity: got ? 1 : 0.5 }}><MascotMark address={ME} pose={on ? mine.pose : (['wave', 'stamp', 'jump'] as const)[i]} look={lk} shade={on ? mine.shade : 0} width={0} fill /></span></span>
                  <b className="block text-[14px] mt-1.5" style={{ color: got ? ink : '#8A8FB5' }}>{LOOK_NAME[lk]}</b><span className="block text-[11.5px] text-muted">{t} stamp</span>{on && <span className="inline-block text-[10.5px] font-extrabold rounded-full px-2 mt-1" style={{ background: ink, color: '#14163A' }}>yours now</span>}</li> })}</ol>
            </div>
            <p className="text-muted text-[13px] mt-2.5 text-center">{mine.tier ? <>Your card and mascot are <b className="text-chalk">{SHADES[mine.look][mine.shade]}</b>. The shade changes every {SHADE_XP} XP.</> : 'Mint a stamp and your card and mascot turn Silver.'}</p></div>
          {TIERS.map((t, ti) => <div key={t} className="mt-7"><h3 className="text-[16px] font-semibold flex items-center gap-3">{t}<span className="text-muted font-normal text-[14px]">{me.pocket[ti]} voucher{me.pocket[ti] === 1 ? '' : 's'} in pocket</span></h3>
            <ul className="grid grid-cols-3 gap-4 mt-3 max-w-[620px]">{SEASON.filter((d) => d.tier === t).map((d) => { const have = me.stickers[d.id]; return <li key={d.id} className="text-center"><StickerCard k={d.key} name={d.name} tier={t} mint={have} owner={ME} dim={!have} onFlip />
              {have ? <span className="pill pill-leaf mt-3">Minted</span> : <button type="button" className="btn btn-secondary btn-sm mt-3 w-full" disabled={me.pocket[ti] < 1 || od || !s.joined} onClick={() => f.mint(d.id)}><Sparkles size={15} aria-hidden />Mint</button>}</li> })}</ul></div>)}
          <p className="text-muted text-[14px] mt-6">Minting costs gas only and needs no token approval. Stamps are soulbound.</p></section>
      </div>
    </div>
  )
}

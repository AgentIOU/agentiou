import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowRight, Eye, ShieldCheck, Ban, ArrowLeftRight, KeyRound, Check, ChevronDown, CircleHelp, CirclePlay, Wallet, X } from 'lucide-react'
import { Tour } from '../components/Tour'
import { CONTRACT, DEMO, LEVELS, ME, SEASON, amt, levelOf, memberSince, score, short, styleOf, viewOf } from '../lib/data'
import { useStore } from '../lib/store'
import { usePrefs } from '../lib/prefs'
import { Link } from '../lib/router'
import { Floaters, Mascot, img } from '../components/fx'
import { Avatar, Badge, CreditPass, IouCard, MartLogo, Money, PaidStamp, Seal, StickerCard, rosette } from '../components/art'
import { LedSign } from '../components/LedSign'
import { DemoChip } from '../components/ui'
import { OfferCard } from './Mart'
gsap.registerPlugin(ScrollTrigger)

export const FAQ: [string, string][] = [
  ['What is AgentIOU?', 'A pay-later ledger on BNB Smart Chain for Agent ID holders. You take a small promise from Promise Mart or from a friend, repay it on time, and that record raises your Trust Score and your Credit Pass limit.'],
  ['Do you need my keys or seed phrase?', 'Never. The site has no wallet connection, no password and no account. To show a profile as yours on a device, your own wallet sends one small transaction that the site then reads from the chain. For everything, the site writes out the exact contract call; your own Binance Agentic Wallet shows you a preview and nothing is sent until you confirm there.'],
  ['Is this a loan with interest?', 'It is a loan without interest or fees. Promise Mart lends you a few cents of its own USDT; you repay exactly that amount, straight to the shop. The contract never holds money, and the shop keeps nothing for itself.'],
  ["What if someone doesn't repay?", 'One IOU past due: their level drops by one and their Trust Score falls right away. Two past due, or one more than 7 days late: the account is Restricted. It shows a red card and a Restricted label, and it can\'t borrow, send IOUs, play Harbour Run or open Build your town until it repays. It can still look at Promise Town. Limits are small on purpose ($1, $5, $10) so nobody can be asked for much. The record stays on their Agent ID history. AgentIOU cannot force anyone to pay, so the person who gives credit carries that risk. Keep amounts small.'],
  ['Why do I need an Agent ID?', "A new wallet costs nothing, so a wallet alone can't be trusted with credit. An Agent ID can't be transferred, so your repayment history stays with you."],
  ['What is Developer Mode and why is it needed?', 'A setting in the Binance App that lets your Agentic Wallet call a contract directly. AgentIOU actions are contract calls, so it has to be on. It can only be turned on in the App.'],
  ['What is Promise Town?', "Your record, drawn. Every member is a mascot standing on the terrace of their level, and every open IOU is a boat in the harbour with the days left on it. Press the town to zoom in, and press a mascot to see that member's town and record. It holds no new data: it is the same record the contract keeps."],
  ['Does Harbour Run give XP or money?', "No. It is a 40-second game for fun: catch promise notes and steer round the rocks; one hit ends the run. Today's check-in opens it. The score stays on your device and counts for nothing: no XP, no rank, no reward."],
  ['How do I build my town?', 'Claim the vouchers your XP has earned, on Task Hub. Two Common vouchers open one part; one Rare or one Legendary voucher opens one. There are 28 parts, each with its own place, and they open in a fixed order: press a lock to see what goes there. The same vouchers still mint stickers. Parts cannot be bought, sold or moved, and they are worth no money.'],
  ['Why did my card and mascot change colour?', 'Your stickers set the look. Any Common sticker gives Silver, any Rare sticker Gold, any Legendary sticker Aurora; the highest tier you hold counts. The shade then changes every 100 XP. It is a look only: it never changes your Trust Score or your limit.'],
  ['Which tokens work?', 'BNB and USDT on BNB Smart Chain.'],
]
const HERO_FLOAT = [
  { k: 'cloud', w: 120, style: { left: 'max(8px, calc(50% - 720px))', top: 420 }, desk: true }, { k: 'star', w: 54, style: { right: 'max(6px, calc(50% - 690px))', top: 392 }, desk: true },
  { k: 'plane', w: 92, style: { right: 'max(4px, calc(50% - 716px))', top: 132 }, far: true, desk: true }, { k: 'drop', w: 46, style: { left: 'max(10px, calc(50% - 680px))', top: 690 }, far: true, desk: true },
  { k: 'star', w: 34, style: { right: 10, top: 76 }, mob: true }, { k: 'drop', w: 30, style: { left: 6, top: 64 }, far: true, mob: true }, { k: 'coin', w: 38, style: { right: '8%', bottom: 96 }, far: true, mob: true },
] as const

export default function Home() {
  // a guest has no card of their own yet, so the hero shows the demo member's card as a sample
  const s = useStore(), me = s.joined ? s.me : s.user(ME) ?? s.me, lv = levelOf(me), limit = LEVELS[lv - 1].limit, owed = s.owed(ME)
  const repaid = s.ious.filter((x) => x.status === 'Repaid')
  return (
    <>
      <section className="relative pt-24 md:pt-28 pb-14">
        <Floaters items={[...HERO_FLOAT]} />
        <div className="wrap relative">
          <LedSign />
          <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr] items-center mt-12 md:mt-16">
            <div>
              <p className="text-[28px] md:text-[40px] font-extrabold leading-[1.12] tracking-tight max-w-[16ch]">Your promise history follows your Agent ID.</p>
              <p className="mt-5 text-[18px] font-semibold"><span className="led text-amber text-[22px]">IOU</span> means "I owe you": a small promise to pay later.</p>
              <p className="lead mt-3">Take a small promise from Promise Mart or a friend, repay on time, and your Credit Pass limit grows. No interest, no fees, no collateral.</p>
              <StartButtons />
            </div>
            <div className="relative flex items-end justify-center lg:justify-end">
              <div aria-hidden className="absolute right-0 top-1/2 -translate-y-1/2 w-[80%] aspect-square rounded-full pointer-events-none" style={{ background: 'radial-gradient(closest-side,#FFB23F26,transparent)' }} />
              <Mascot pose="wave" float className="w-[30%] max-w-[190px] -mr-[4%] mb-[-2%] relative z-10" alt="The AgentIOU mascot, a small jelly agent with an LED face, waving" />
              <IouCard className="w-[72%] max-w-[470px] relative" nick={me.nickname} address={me.address} no={me.no} level={lv} available={Math.max(0, limit - owed)} limit={limit} demo look={styleOf(me).look} overdue={s.hasOverdue(ME)} restricted={s.restricted(ME)} back={[['On-time repays', String(me.onTime)], ['Late', String(me.late)], ['Defaults', String(me.defaults)], ['People dealt with', String(me.people)], ['Member since', memberSince(me.joinedAt)]]} />
            </div>
          </div>
          <Strip lines={repaid.map((x) => `${s.name(x.debtor)} repaid ${amt(x)} ${viewOf(x) === 'Repaid' ? 'on time' : 'late'}`)} />
        </div>
      </section>

      <section className="glow border-y border-rule bg-ledger/60" style={{ '--glow': 'radial-gradient(50% 120% at 85% 0%,#F2A7E030,transparent),radial-gradient(40% 120% at 0% 100%,#8C96FF30,transparent)' } as React.CSSProperties} aria-labelledby="t-teaser">
        <div className="wrap py-12 grid gap-8 lg:grid-cols-[320px_1fr] items-center">
          <div><h2 id="t-teaser" className="text-[28px]">Join and get your first sticker voucher</h2><p className="text-muted mt-3">Nine Season 1 stickers, free to mint with vouchers you get for keeping your word.</p><Link to="tasks" className="btn btn-primary mt-6">Open Task Hub</Link></div>
          <ul className="flex gap-4 overflow-x-auto pb-3 -mx-5 px-5 snap-x lg:grid lg:grid-cols-9 lg:gap-3 lg:mx-0 lg:px-0 lg:pb-0 lg:overflow-visible" aria-label="Season 1 stickers">{SEASON.map((d) => <li key={d.id} className="shrink-0 w-[132px] lg:w-auto snap-start"><StickerCard k={d.key} name={d.name} tier={d.tier as never} /></li>)}</ul>
        </div>
      </section>

      <section className="band"><div className="wrap"><h2 className="text-[28px] md:text-[56px] md:leading-[1.05] max-w-[18ch]">DeFi asks for collateral. AgentIOU uses your Agent ID history instead.</h2><p className="lead mt-6">Most on-chain credit only lends to people who already have more than they borrow. A corner shop works the other way: it knows you, so it lets you pay on Friday. AgentIOU keeps that kind of record on-chain.</p></div></section>

      <How />

      <section className="band glow" style={{ '--glow': 'radial-gradient(40% 60% at 80% 50%,#8C96FF2e,transparent)' } as React.CSSProperties} aria-labelledby="t-why">
        <div className="wrap grid gap-12 lg:grid-cols-2 items-center">
          <div><h2 id="t-why" className="h2">Many wallets, one person</h2><p className="lead mt-4">Anyone can open a fresh wallet in a second and walk away from a debt. An Agent ID can't be transferred, so the promise record stays with whoever made it.</p></div>
          <div className="relative h-[300px] md:h-[340px]" role="img" aria-label="Six throwaway wallet addresses fade out on the left; lines lead from them to a single Agent ID profile on the right.">
            {['0x9f3a…1c07', '0x41be…77d2', '0xc08d…e5a9', '0x7a12…03bf', '0x2e6c…9d40', '0xb5f1…6a8e'].map((a, i) => <span key={a} aria-hidden className="absolute mono text-[13px] md:text-[14px] border border-dashed border-rule rounded-lg px-3 py-1.5 text-muted" style={{ left: `${[0, 9, 2, 12, 4, 10][i]}%`, top: `${6 + i * 15}%`, opacity: 0.5 + i * 0.09, transform: `rotate(${[-4, 3, -2, 4, -3, 2][i]}deg)`, textDecoration: i < 4 ? 'line-through' : undefined }}>{a}</span>)}
            <svg aria-hidden className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">{[12, 27, 42, 57, 72, 87].map((y) => <path key={y} d={`M38 ${y} C 55 ${y}, 52 50, 68 50`} stroke="#8C96FF" strokeOpacity="0.8" strokeWidth="1.2" strokeDasharray="3 5" fill="none" vectorEffect="non-scaling-stroke" />)}</svg>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 text-center"><Avatar address={ME} score={score(me)} level={lv} style={styleOf(me)} size={176} /><p className="font-extrabold mt-2">One Agent ID</p><p className="text-muted text-[14px]">One record that stays</p></div>
          </div>
        </div>
      </section>

      <section className="band pt-0 glow" style={{ '--glow': 'radial-gradient(45% 50% at 90% 40%,#3FBF8A26,transparent),radial-gradient(40% 50% at 0% 70%,#8C96FF2e,transparent)' } as React.CSSProperties} aria-labelledby="t-pass">
        <div className="wrap"><h2 id="t-pass" className="h2">Credit Pass</h2><p className="lead mt-3">Three levels. Each one opens a higher limit, and only your own repayments move you up.</p>
          <ul className="flex flex-wrap gap-x-8 gap-y-4 mt-8" aria-label="Badges you get on the way">{['IOU Verified', 'First Promise', 'Trusted', 'Highly Trusted'].map((b) => <li key={b} className="flex items-center gap-3 font-semibold"><Badge name={b} size={56} />{b}</li>)}</ul>
          <div className="grid gap-8 mt-10 sm:grid-cols-3 max-w-[980px]">{([1, 2, 3] as const).map((n) => <CreditPass key={n} level={n} no={me.no} state={n === lv ? 'current' : n < lv ? 'open' : 'locked'} progress={<Progress now={me.onTime} of={n === 2 ? 3 : 10} />} />)}</div>
          {DEMO && <p className="text-muted text-[14px] mt-6 flex items-center gap-2"><DemoChip /> The marked level belongs to the demo profile.</p>}</div>
      </section>

      <section className="band pt-0 glow" style={{ '--glow': 'radial-gradient(50% 60% at 10% 30%,#FFB23F26,transparent),radial-gradient(40% 50% at 95% 80%,#F2A7E026,transparent)' } as React.CSSProperties} aria-labelledby="t-mart">
        <Floaters items={[{ k: 'ticket', w: 92, style: { right: '2%', top: 10 }, desk: true }, { k: 'cube', w: 56, style: { left: '1%', bottom: 80 }, far: true, desk: true }]} />
        <div className="wrap relative"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 id="t-mart" className="h2 flex items-center gap-3"><MartLogo size={52} />Promise Mart</h2><p className="lead mt-3">Three Founders stickers. Take one now, repay within days.</p></div><Link to="mart" className="btn btn-secondary">Open Promise Mart</Link></div>
          <div className="grid gap-6 mt-10 sm:grid-cols-2 lg:grid-cols-3">{s.offers.map((o, i) => <OfferCard key={o.id} o={o} i={i} />)}</div></div>
      </section>

      <section className="border-y border-rule bg-[#0A0C1C]" aria-labelledby="t-stats">
        <div className="wrap py-14"><h2 id="t-stats" className="sr-only">Ledger numbers</h2>
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-6">{[[s.users.length, 'Members'], [repaid.filter((x) => viewOf(x) === 'Repaid').length, 'IOUs repaid on time'], [s.ious.filter((x) => x.status === 'Active').length, 'Open promises'], [s.users.reduce((n, u) => n + Object.keys(u.stickers).length, 0), 'Stickers minted']].map(([n, l]) => <div key={l}><dd className="led text-amber text-[64px] leading-none" style={{ textShadow: '0 0 18px #FFB23F66' }}>{n}</dd><dt className="text-muted mt-2">{l}</dt></div>)}</dl>
          {DEMO ? <p className="mt-8 text-[14px] text-muted flex items-center gap-2"><DemoChip /> These numbers come from the demo ledger. After deploy they are read from the contract.</p> : <p className="mt-8 text-[14px] text-muted">These numbers are read from the contract on BNB Smart Chain.</p>}</div>
      </section>

      <section className="band relative overflow-hidden" aria-labelledby="t-proof">
        <svg aria-hidden className="absolute -right-40 top-1/2 -translate-y-1/2 w-[640px] opacity-30" viewBox="0 0 400 400"><path d={rosette(200, 200, 150, 30, 12, 26, 0, 0.5, 200)} stroke="#2C3156" strokeWidth="0.7" fill="none" /></svg>
        <div className="wrap relative"><h2 id="t-proof" className="h2">Proof and safety</h2>
          <ul className="grid gap-x-10 gap-y-7 mt-8 sm:grid-cols-2 max-w-[900px]">{[[Ban, 'No owner', 'No admin key, no upgrade, no pause. Nobody can change the rules after deploy.'], [ArrowLeftRight, 'The contract never holds your money', 'A repayment goes straight from you to the person you owe.'], [KeyRound, 'The site never touches your wallet', 'No wallet connection, no password, no seed phrase. Your own agent previews every call.'], [ShieldCheck, 'Exact amounts only', 'USDT approvals are for the exact amount. Never unlimited.']].map(([I, t, d]) => { const Ic = I as typeof Ban; return <li key={t as string} className="flex gap-4"><Ic className="text-iris shrink-0 mt-1" size={22} aria-hidden /><div><h3 className="text-[20px]">{t as string}</h3><p className="text-muted mt-1">{d as string}</p></div></li> })}</ul>
          <p className="mt-8 text-muted">Contract: <span className="mono text-chalk">{CONTRACT ?? 'address and BscScan link appear here after deploy'}</span></p>
          <Link to="proof" className="btn btn-secondary mt-6">Read Proof &amp; Safety</Link></div>
      </section>

      <section id="faq" className="band pt-0 scroll-mt-20" aria-labelledby="t-faq"><div className="wrap max-w-[820px] mx-0"><h2 id="t-faq" className="h2">FAQs</h2><div className="mt-8 border-t border-rule">{FAQ.map(([q, a]) => <Q key={q} q={q} a={a} />)}</div></div></section>

      <section className="band pt-0" aria-labelledby="h-town"><div className="wrap"><div className="panel p-6 md:p-10 grid gap-6 md:grid-cols-[1fr_minmax(0,420px)] items-center" style={{ borderRadius: 28 }}>
        <div><h2 id="h-town" className="h2 max-w-[18ch]">Your record becomes a town.</h2>
          <p className="lead mt-3">Every member is a mascot on the terrace of their level. Every open IOU is a boat in the harbour. The vouchers you claim open the parts of a town of your own.</p>
          <p className="text-muted text-[14px] mt-3">It is the contract's record, drawn. The small harbour game is for fun and gives no XP.</p>
          <Link to="tasks" className="btn btn-secondary mt-6">Open Promise Town</Link></div>
        <img src={img('town')} alt="Promise Town: a small town on three terraces above a harbour" loading="lazy" className="w-full rounded-2xl" style={{ aspectRatio: '1.5517' }} /></div></div></section>
      <section className="band pt-0"><div className="wrap"><div className="panel p-8 md:p-12 flex flex-wrap items-center gap-8 justify-between" style={{ borderRadius: 28 }}><div><h2 className="h2 max-w-[16ch]">Make one small promise. Keep it.</h2><p className="lead mt-3">{s.joined ? 'You are IOU Verified. Pick a small promise and keep it.' : 'Five minutes to get verified. Your first voucher is waiting.'}</p><div className="flex flex-wrap gap-3 mt-7">{s.joined ? <><Link to="mart" className="btn btn-primary">Open Promise Mart</Link><Link to="me" className="btn btn-secondary">Open My IOUs</Link></> : <><Link to="start" className="btn btn-primary">Get IOU Verified</Link><Link to="mart" className="btn btn-secondary">Open Promise Mart</Link></>}</div></div><Mascot pose="jump" expr="success" className="w-40 md:w-52" /></div></div></section>
    </>
  )
}
function Progress({ now, of }: { now: number; of: number }) {
  const n = Math.min(now, of)
  return <div><div className="h-1.5 rounded-full bg-rule overflow-hidden" role="progressbar" aria-label="On-time repays toward this level" aria-valuemin={0} aria-valuemax={of} aria-valuenow={n}><div className="h-full bg-amber" style={{ width: `${(n / of) * 100}%` }} /></div><p className="text-[14px] text-muted mt-2">{n} of {of} on-time repays</p></div>
}
function Strip({ lines }: { lines: string[] }) {
  const [i, setI] = useState(0); const { motionOff } = usePrefs()
  useEffect(() => { if (motionOff || lines.length < 2) return; const t = setInterval(() => setI((n) => (n + 1) % lines.length), 3600); return () => clearInterval(t) }, [motionOff, lines.length])
  return <div className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule pt-5 text-[15px]"><span className="font-semibold">Ledger</span><DemoChip /><span key={i} className="text-muted" style={{ animation: 'fadein 400ms' }}>{lines[i % lines.length]}</span></div>
}
export function Q({ q, a }: { q: string; a: string }) {
  return <details className="group border-b border-rule"><summary className="flex justify-between gap-6 py-5 cursor-pointer list-none font-semibold text-[18px] [&::-webkit-details-marker]:hidden"><span>{q}</span><span aria-hidden className="text-muted text-[24px] leading-none transition-transform duration-200 group-open:rotate-45">+</span></summary><p className="text-muted pb-6 max-w-[62ch]">{a}</p></details>
}

/* How it works: one promise note that fills in line by line while you scroll */
const STEPS: [string, string][] = [
  ['Get IOU Verified', 'Join once with your Agent ID. It costs gas only, and you start at Credit Pass L1 with a $1 limit.'],
  ['Take a promise', 'Borrow a few cents from Promise Mart, sticker included, or accept an IOU from a friend. The note records who, how much and by when.'],
  ['Repay on time', 'Pay the exact amount before the due date. It goes straight to the person you owe.'],
  ['Your record grows', 'Each on-time repay adds 5 to your Trust Score. Three of them open L2 and a $5 limit.'],
]
function How() {
  const ref = useRef<HTMLElement>(null); const { motionOff } = usePrefs(); const [step, setStep] = useState(0)
  useEffect(() => {
    if (motionOff) { setStep(3); return }
    const st = ScrollTrigger.create({ trigger: ref.current, start: 'top top', end: 'bottom bottom', onUpdate: (self) => setStep(Math.min(3, Math.floor(self.progress * 4))) })
    return () => st.kill()
  }, [motionOff])
  const row = (label: string, v: React.ReactNode, on: boolean) => <div className="flex justify-between gap-4 border-b border-dotted border-[#23232b66] py-2.5"><span className="text-[#5b5d6b] italic">{label}</span>{on && <span className="font-semibold text-right led text-[17px]" style={{ animation: motionOff ? undefined : 'typein 500ms steps(14) both' }}>{v}</span>}</div>
  return (
    <section id="how" ref={ref} className="relative scroll-mt-0" style={{ height: motionOff ? undefined : '320vh' }} aria-labelledby="t-how">
      <div className={motionOff ? 'band' : 'sticky top-0 min-h-[100svh] flex items-center md:max-lg:items-start py-20 md:max-lg:pt-12'}>
        <div className="wrap grid gap-8 lg:gap-16 lg:grid-cols-2 items-center">
          <div className="order-2 lg:order-1"><h2 id="t-how" className="h2">How it works</h2>
            <ol className="mt-6 grid gap-1">{STEPS.map(([t, d], i) => <li key={t} className="flex gap-4 py-3 transition-opacity duration-300" style={{ opacity: motionOff || i === step ? 1 : 0.38 }} aria-current={i === step ? 'step' : undefined}><span className="led text-amber text-[28px] leading-none w-7 shrink-0">{i + 1}</span><div><h3 className="text-[20px]">{t}</h3><p className={`text-muted mt-1 ${motionOff || i === step ? '' : 'hidden lg:block'}`}>{d}</p></div></li>)}</ol></div>
          <div className="order-1 lg:order-2 relative mx-auto w-full max-w-[460px] md:max-lg:[zoom:1.45]" aria-hidden>
            <div className="relative text-[#23232B]" style={{ background: '#F4F1E6', boxShadow: '0 30px 60px #0009', borderRadius: 6, transform: 'rotate(-1.5deg)', WebkitMask: 'radial-gradient(7px at 7px 50%,#0000 96%,#000) -7px 0 / 100% 22px', mask: 'radial-gradient(7px at 7px 50%,#0000 96%,#000) -7px 0 / 100% 22px' }}>
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 400 480"><path d={rosette(330, 400, 86, 14, 12, 18, 0, 0.5, 160)} stroke="#1f8a5f" strokeOpacity="0.16" strokeWidth="0.8" fill="none" /><rect x="22" y="12" width="366" height="456" rx="4" fill="none" stroke="#23232B" strokeOpacity="0.5" strokeWidth="1" /><rect x="27" y="17" width="356" height="446" rx="2" fill="none" stroke="#23232B" strokeOpacity="0.25" strokeWidth="3" strokeDasharray="1 3" /></svg>
              <div className="relative pl-12 pr-8 py-9">
                <div className="flex justify-between items-baseline"><span className="font-extrabold text-[24px]">Promise note</span><span className="led text-[15px]">No 000142</span></div>
                <p className="text-[13px] text-[#5b5d6b] mt-1">AgentIOU, on BNB Smart Chain</p>
                <div className="mt-5 text-[16px]">
                  {row('I,', <span className="inline-flex items-center gap-2">tuku <Check size={15} className="text-[#1f8a5f]" />Agent ID</span>, step >= 0)}
                  {row('promise to pay', 'Promise Mart', step >= 1)}{row('the amount of', '0.03 USDT', step >= 1)}{row('on or before', 'Nov 25', step >= 1)}
                  {row('Trust Score', <span className="text-[#1f8a5f]">74, up 5</span>, step >= 3)}
                </div>
                <div className="mt-5 flex items-end justify-between h-[84px]">
                  <div><span className="block text-[26px] leading-none transition-opacity duration-300" style={{ fontFamily: 'cursive', fontStyle: 'italic', opacity: step >= 1 ? 1 : 0 }}>AgentIOU</span><span className="block border-t border-[#23232b66] text-[12px] text-[#5b5d6b] pt-1 mt-1 w-36">Signed by AgentIOU</span></div>
                  {step >= 2 && <span className="flex items-end gap-2"><PaidStamp key={motionOff ? 's' : 'a'} text="Paid" className="text-[#1f8a5f]" /></span>}
                  <Seal size={46} />
                </div>
              </div>
            </div>
            {step >= 2 && <div className="absolute right-0 md:-right-4 -bottom-10 w-28 md:w-32" style={{ animation: motionOff ? undefined : 'thump 600ms var(--ease-out) both' }}><Mascot pose="stamp" expr="success" /></div>}
          </div>
        </div>
      </div>
    </section>
  )
}
export { short, Money }

/* the big yellow start button, the guide for people with no Agent ID yet, and the short tour */
function StartButtons() {
  const [open, setOpen] = useState(false), [guide, setGuide] = useState(false), [tour, setTour] = useState(false)
  const { joined, me } = useStore()
  useEffect(() => { if (!guide) return; const k = (e: KeyboardEvent) => e.key === 'Escape' && setGuide(false); document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k) }, [guide])
  return (
    <div className="mt-8 max-w-[520px]">
      {joined ? <Link to="u" param={ME} className="btn btn-wallet w-full text-left" style={{ justifyContent: 'flex-start', gap: 14, padding: '12px 18px 12px 12px' }}>
        <span className="w-11 h-11 rounded-[13px] bg-white/40 inline-flex items-center justify-center shrink-0"><ShieldCheck size={22} aria-hidden /></span>
        <span className="flex-1"><span className="block text-[20px] font-extrabold leading-tight">IOU Verified</span><span className="block text-[14px] font-semibold opacity-85">Open my profile, {me.nickname}</span></span></Link> : <>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="btn btn-wallet w-full text-left" style={{ justifyContent: 'flex-start', gap: 14, padding: '12px 18px 12px 12px' }}>
        <span className="w-11 h-11 rounded-[13px] bg-white/40 inline-flex items-center justify-center shrink-0"><Wallet size={22} aria-hidden /></span>
        <span className="flex-1"><span className="block text-[20px] font-extrabold leading-tight">Agentic Wallet</span><span className="block text-[14px] font-semibold opacity-85">Get IOU Verified</span></span>
        <ChevronDown size={22} aria-hidden style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 200ms' }} />
      </button>
      {open && <div className="panel p-5 mt-3" style={{ animation: 'trayup 220ms var(--ease-out)' }}>
        <ol className="grid gap-2.5">{['Paste your Agentic Wallet address. The site reads the chain for it.', 'Copy the prompt the site writes and give it to your agent.', 'Confirm in your agent. The site never connects to your wallet.'].map((t, i) => <li key={t} className="flex gap-3"><span className="led text-amber text-[20px] leading-6 w-4 shrink-0">{i + 1}</span><span>{t}</span></li>)}</ol>
        <Link to="start" className="btn btn-primary mt-4">Start the 5 steps</Link>
      </div>}</>}
      {/* two buttons at most (join, or look around as a guest), then one quiet line of help, so the block stays calm */}
      {!joined && <Link to="mart" className="guest-pill flex items-center gap-2.5 min-h-[50px] mt-3 pl-5 pr-2 rounded-full font-semibold text-[16px]"><Eye size={19} aria-hidden className="shrink-0" /><span>Browse as a guest</span><span className="guest-arrow inline-flex items-center justify-center w-9 h-9 rounded-full shrink-0 ml-auto"><ArrowRight size={18} aria-hidden /></span></Link>}
      <div className="flex flex-wrap items-center gap-x-6 mt-2">
        <button type="button" onClick={() => setTour(true)} className="btn-text inline-flex items-center gap-2 min-h-[44px] text-[15px] text-muted hover:text-chalk cursor-pointer"><CirclePlay size={17} aria-hidden /><span className="underline underline-offset-4">How it works</span></button>
        {!joined && <button type="button" onClick={() => setGuide(true)} className="btn-text inline-flex items-center gap-2 min-h-[44px] text-[15px] text-muted hover:text-chalk cursor-pointer"><CircleHelp size={17} aria-hidden /><span className="underline underline-offset-4">No Agent ID yet?</span></button>}
      </div>
      {tour && <Tour close={() => setTour(false)} />}
      {guide && createPortal(<div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6" style={{ background: '#05061299', animation: 'fadein 200ms' }} onPointerDown={(e) => e.target === e.currentTarget && setGuide(false)}>
        <div role="dialog" aria-modal="true" aria-label="How to get an Agent ID" className="frost w-full max-w-[560px] rounded-t-[22px] sm:rounded-[22px] p-6 max-h-[90dvh] overflow-y-auto" style={{ animation: 'trayup 320ms var(--ease-out)' }}>
          <div className="flex items-start justify-between gap-4"><h2 className="text-[22px]">How to get an Agent ID</h2><button type="button" aria-label="Close" onClick={() => setGuide(false)} className="w-11 h-11 -mr-2 -mt-2 inline-flex items-center justify-center rounded-full cursor-pointer text-muted hover:text-chalk"><X size={20} /></button></div>
          <div className="flex gap-5 items-start mt-4"><Mascot pose="read" className="w-24 shrink-0 hidden sm:block" />
            <ol className="grid gap-4">{[['Open the Binance App and set up a Binance Wallet', 'This is the keyless wallet inside the app.'], ['Create your Agentic Wallet', 'A separate wallet your AI agent works from, with limits you set in the app.'], ['Find the Agent ID banner on the wallet home screen', 'Pick your name and claim it. An Agent ID cannot be transferred.'], ['Come back and get IOU Verified', 'Paste your Agentic Wallet address here and follow the 5 steps.']].map(([t, d], i) => <li key={t} className="flex gap-3"><span className="led text-amber text-[22px] leading-6 w-5 shrink-0">{i + 1}</span><span><b className="block">{t}</b><span className="text-muted text-[15px]">{d}</span></span></li>)}</ol></div>
          <p className="hint mt-5">Steps follow Binance's public announcements; screens in the app may differ. Only ever sign in inside the official Binance App.</p>
          <Link to="start" onClick={() => setGuide(false)} className="btn btn-primary mt-5">I have my Agent ID</Link>
        </div>
      </div>, document.body)}
    </div>
  )
}

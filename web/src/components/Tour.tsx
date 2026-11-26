import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Link } from '../lib/router'
import { usePrefs } from '../lib/prefs'
import { play } from '../lib/sound'
import { useStore } from '../lib/store'
import { Badge, CreditPass, Founder, PaidStamp, StickerCard, Ticket } from './art'
import { Mascot, img } from './fx'
import { ME } from '../lib/data'

/* A short guided tour: six slides, one idea each, with a small moving scene. Opened from "How it works". */
const SLIDES: { t: string; d: string }[] = [
  { t: 'Get IOU Verified', d: 'Join once with your Agent ID. You start at Credit Pass L1 with a $1 limit and 50 XP.' },
  { t: 'Take a small promise', d: 'Promise Mart lends you a few cents with a sticker, or you accept an IOU a friend sends you. Nothing to pay up front.' },
  { t: 'Repay on time', d: 'Pay the exact amount before the due date. It goes straight to the person you owe.' },
  { t: 'Your limit grows', d: 'Each on-time repay adds to your Trust Score. Three of them open L2 and a $5 limit.' },
  { t: 'Collect stamps', d: 'Keeping your word gives XP. XP becomes vouchers, and vouchers mint Season 1 stamps for free.' },
  { t: 'Watch your town grow', d: 'Promise Town draws the record: members are mascots, open IOUs are boats. The vouchers you claim also open the parts of a town of your own.' },
]
function Scene({ i, on }: { i: number; on: boolean }) {
  const a = (name: string, ms: number, delay = 0) => (on ? { animation: `${name} ${ms}ms var(--ease-out) ${delay}ms both` } : undefined)
  if (i === 0) return <div className="flex items-end justify-center gap-6"><Mascot pose="wave" className="w-32" /><div style={a('pop', 700, 250)}><Badge name="IOU Verified" size={104} /></div></div>
  if (i === 1) return <div className="flex items-center justify-center gap-3 sm:gap-5"><div style={a('rise', 520, 60)}><Founder k="founder-search" className="h-32 sm:h-36" /></div><div className="bg-chalk text-ink rounded-lg px-3 py-1.5 font-extrabold" style={{ ...a('pop', 600, 400), rotate: '6deg' }}><span className="led text-[22px]">0<span className="dp" />03</span> USDT</div></div>
  if (i === 2) return <div className="flex items-center justify-center gap-3 sm:gap-6"><div className="rounded-md px-5 py-4 sm:px-6 sm:py-5 text-[#23232B] w-44 sm:w-56 shrink-0" style={{ background: '#F4F1E6', rotate: '-3deg' }}><p className="font-extrabold">Promise note</p><p className="led mt-2 text-[18px]">0<span className="dp" />03 USDT</p><div className="h-10 mt-2">{<span style={a('stamp', 700, 500)} className="inline-block"><PaidStamp text="Paid" className="text-[#1f8a5f]" /></span>}</div></div><div style={a('rise', 520, 220)}><Mascot pose="stamp" expr="success" className="w-20 sm:w-28" /></div></div>
  if (i === 3) return <div className="flex items-center justify-center gap-4"><div className="w-24 opacity-60"><CreditPass level={1} state="open" /></div><ChevronRight className="text-amber" size={30} aria-hidden /><div className="w-28" style={a('pop', 700, 300)}><CreditPass level={2} state="current" /></div></div>
  if (i === 5) return <div className="flex items-center justify-center"><img src={img('town')} alt="" className="h-[186px] rounded-xl" style={a('pop', 600, 40)} /></div>
  return <div className="flex items-center justify-center gap-2 sm:gap-5"><div className="w-14 sm:w-20 shrink-0" style={a('ticket', 700)}><Ticket tier="Common" /></div><ChevronRight className="text-amber shrink-0" size={26} aria-hidden /><div className="w-24 sm:w-28 shrink-0" style={a('pop', 700, 500)}><StickerCard k="hello" name="Hello" tier="Common" mint={{ edition: 42, block: 0, time: 0 }} /></div><Mascot pose="jump" expr="success" className="w-[72px] sm:w-24 shrink-0" /></div>
}
export function Tour({ close }: { close: () => void }) {
  const { joined } = useStore(); const [i, setI] = useState(0); const { motionOff } = usePrefs(); const last = i === SLIDES.length - 1
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') setI((n) => Math.min(SLIDES.length - 1, n + 1)); if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1)) }
    document.addEventListener('keydown', k); const o = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = o }
  }, [close])
  useEffect(() => { play('tick') }, [i])
  const s = SLIDES[i]
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-6" style={{ background: '#050612b3', animation: 'fadein 200ms' }} onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-modal="true" aria-label="How AgentIOU works" className="frost w-full max-w-[560px] rounded-t-[24px] sm:rounded-[24px] p-6 md:p-7" style={{ animation: 'trayup 320ms var(--ease-out)' }}>
        <div className="flex items-center justify-between"><p className="text-muted text-[14px]" aria-live="polite">Step {i + 1} of {SLIDES.length}</p><div className="flex gap-1.5 ml-4 mr-auto" aria-hidden>{SLIDES.map((_, n) => <i key={n} className="h-2 rounded-full transition-all duration-200" style={{ width: n === i ? 22 : 8, background: n <= i ? '#FFB23F' : '#2C3156' }} />)}</div><button type="button" aria-label="Close the tour" onClick={close} className="w-11 h-11 -mr-2 inline-flex items-center justify-center rounded-full cursor-pointer text-muted hover:text-chalk"><X size={20} /></button></div>
        {/* all six scenes stay mounted and cross-fade, so pictures are already loaded when their slide comes up and nothing pops in */}
        <div className="h-[210px] grid rounded-2xl mt-1 overflow-hidden" style={{ background: 'radial-gradient(70% 90% at 50% 20%,#8C96FF33,transparent),#0E1024' }} aria-hidden>
          {SLIDES.map((_, n) => <div key={n} className="tour-scene flex items-center justify-center" style={{ gridArea: '1 / 1', opacity: n === i ? 1 : 0, transform: motionOff || n === i ? 'none' : `translateX(${n < i ? -28 : 28}px)`, visibility: n === i ? 'visible' : 'hidden', transitionDelay: n === i ? '0ms, 0ms, 0ms' : '0ms, 0ms, 320ms' }}><Scene key={n === i ? 'on' : 'off'} i={n} on={n === i && !motionOff} /></div>)}
        </div>
        <div key={i} style={motionOff ? undefined : { animation: 'tourtext 360ms var(--ease-out) both' }}>
          <h2 className="text-[24px] mt-5 flex items-baseline gap-3"><span className="led text-amber text-[28px]">{i + 1}</span>{s.t}</h2>
          <p className="text-muted mt-2 min-h-[72px]">{s.d}</p>
        </div>
        <div className="flex items-center justify-end gap-3 mt-4">
          {i > 0 && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setI(i - 1)}><ChevronLeft size={16} aria-hidden />Back</button>}
          {last ? (joined ? <Link to="u" param={ME} onClick={close} className="btn btn-primary">Open my profile</Link> : <Link to="start" onClick={close} className="btn btn-primary">Get IOU Verified</Link>) : <button type="button" className="btn btn-primary" onClick={() => setI(i + 1)}>Next<ChevronRight size={16} aria-hidden /></button>}
        </div>
      </div>
    </div>, document.body)
}

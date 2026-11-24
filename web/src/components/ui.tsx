import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Check, CheckCircle2, Clock, Copy, Info, ShieldAlert, X, CircleDot } from 'lucide-react'
import { DEMO, LEVELS, ME, amt, dateShort, dateUtc, dueText, short, usd, viewOf, type Iou, type View } from '../lib/data'
import { useStore, type TrayReq } from '../lib/store'
import { play } from '../lib/sound'
import { Avatar, Money, PaidStamp } from './art'
import { Mascot, type Pose } from './fx'
import { score, levelOf, plain } from '../lib/data'
import { Link } from '../lib/router'

export const Dots = ({ label }: { label?: string }) => <span className="inline-flex items-center gap-3" role="status"><span className="dots" aria-hidden><i /><i /><i /><i /></span>{label && <span>{label}</span>}</span>
export const DemoChip = ({ text = 'Demo data' }: { text?: string }) => (DEMO ? <span className="demo-chip"><CircleDot size={13} aria-hidden />{text}</span> : null)

const TONE: Record<View, [string, typeof Check]> = { Repaid: ['pill-leaf', CheckCircle2], 'Repaid late': ['pill-coral', Clock], Pending: ['pill-muted', Clock], Active: ['pill-iris', CircleDot], 'Due soon': ['pill-iris', Clock], Overdue: ['pill-coral', AlertTriangle], Declined: ['pill-muted', X], Cancelled: ['pill-muted', X] }
export const BAR: Record<View, string> = { Repaid: '#3FBF8A', 'Repaid late': '#FF6B57', Pending: '#2C3156', Active: '#8C96FF', 'Due soon': '#8C96FF', Overdue: '#FF6B57', Declined: '#2C3156', Cancelled: '#2C3156' }
export function StatusPill({ v }: { v: View }) { const [c, I] = TONE[v]; return <span className={`pill ${c}`}><I size={14} aria-hidden />{v}</span> }
/** The mark for a Restricted account: solid red with a shield, so it reads as a status, not a decoration. */
export const RestrictedTag = ({ small }: { small?: boolean }) => (
  <span className={`inline-flex items-center font-extrabold text-white whitespace-nowrap ${small ? 'gap-1 text-[12px] h-6 px-2 rounded-md' : 'gap-1.5 text-[14px] h-8 px-3 rounded-lg'}`} style={{ background: 'linear-gradient(180deg,#D8362F,#9F1B1A)', boxShadow: 'inset 0 1px 0 #ffffff40, 0 0 0 1px #7A0F12, 0 4px 10px #7A0F1266' }}>
    <ShieldAlert size={small ? 13 : 16} aria-hidden strokeWidth={2.4} />Restricted
  </span>
)
export const LevelChip = ({ level, now }: { level: number; now?: boolean }) => <span className={`chip ${now ? 'chip-now' : ''}`}><b>L{level}</b><span>{LEVELS[level - 1].name}</span></span>

export function useCopy() {
  const { toast } = useStore()
  return async (text: string, what = 'Copied') => {
    try { await navigator.clipboard.writeText(text); play('copy'); toast(what); return true } catch { toast('Copy did not work here. Select the text and copy it by hand.', 'bad'); return false }
  }
}
export function AddressChip({ address }: { address: string }) {
  const copy = useCopy()
  return <button type="button" className="mono text-[14px] text-muted hover:text-chalk inline-flex items-center gap-1.5 cursor-pointer" aria-label={`Copy address ${address}`} onClick={() => copy(address, 'Address copied')}>{short(address)}<Copy size={13} aria-hidden /></button>
}
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false); const ref = useRef<HTMLSpanElement>(null); const id = useId()
  useEffect(() => { if (!open) return; const f = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }; const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false); document.addEventListener('pointerdown', f); document.addEventListener('keydown', k); return () => { document.removeEventListener('pointerdown', f); document.removeEventListener('keydown', k) } }, [open])
  return (
    <span ref={ref} className="relative inline-block align-middle">
      <button type="button" aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="w-6 h-6 rounded-full border border-rule inline-flex items-center justify-center text-muted hover:text-chalk cursor-pointer"><Info size={13} aria-hidden /></button>
      {open && <span id={id} role="note" className="absolute z-30 left-1/2 -translate-x-1/2 top-8 w-[260px] max-w-[80vw] panel p-3 text-[14px] text-chalk font-normal block text-left" style={{ borderRadius: 12, animation: 'fadein 220ms' }}>{children}</span>}
    </span>
  )
}
export function Toasts() {
  const { toasts, dropToast } = useStore()
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-[84px] md:bottom-8 z-[70] flex flex-col gap-2 items-center w-[min(92vw,460px)]" aria-live="polite">
      {toasts.map((t) => <div key={t.id} className="frost rounded-xl px-4 py-3 flex items-start gap-3 w-fit max-w-full" style={{ animation: 'trayup 220ms var(--ease-out)' }}>
        {t.kind === 'bad' ? <AlertTriangle size={18} className="text-coral shrink-0 mt-0.5" aria-hidden /> : <Check size={18} className="text-leaf shrink-0 mt-0.5" aria-hidden />}
        <span>{t.text}</span>{t.kind === 'bad' && <button type="button" aria-label="Dismiss" className="cursor-pointer text-muted" onClick={() => dropToast(t.id)}><X size={16} /></button>}
      </div>)}
    </div>
  )
}

/* Agent tray: the site never touches a wallet. It writes the exact call; the visitor's own agent previews and runs it. */
export function Tray() {
  const { tray, closeTray } = useStore()
  if (!tray) return null
  return <TrayInner key={tray.title} t={tray} close={closeTray} />
}
function TrayInner({ t, close }: { t: TrayReq; close: () => void }) {
  const store = useStore(); const base = useRef(store.print)   // my on-chain record as it was when this step was shown
  const [step, setStep] = useState(0)
  const [phase, setPhase] = useState<'prompt' | 'wait' | 'slow' | 'between' | 'done' | 'error'>('prompt')
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  const copy = useCopy(); const box = useRef<HTMLDivElement>(null)
  useEffect(() => { play('swish'); box.current?.focus() }, [])   // once, when the card opens: never again while it waits
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && close(); document.addEventListener('keydown', k); const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.removeEventListener('keydown', k); document.body.style.overflow = o } }, [close])
  useEffect(() => {
    if ((phase !== 'wait' && phase !== 'slow') || DEMO) return
    // live: nothing is assumed. The card moves on only when the contract shows the step: my record changed, or the step's own check passed.
    // It never stops looking: people leave for their agent app for minutes, and a phone pauses this page while they are away.
    let stop = false, timer = 0, busy = false; const t0 = Date.now(), st = t.steps[step]
    const look = async () => {
      if (busy) return
      busy = true; clearTimeout(timer)
      let ok = false
      try { ok = st.seen ? await st.seen() : (await store.refresh()) !== base.current } catch { /* the next look tries again */ }
      busy = false
      if (stop) return
      if (!ok) { if (phase === 'wait' && Date.now() - t0 > 40_000) setPhase('slow'); else timer = window.setTimeout(look, phase === 'slow' ? 3000 : 2000); return }
      if (step < t.steps.length - 1) { setPhase('between'); setCopied(false); play('chime'); return }
      if (st.seen) await store.refresh().catch(() => undefined)
      setPhase('done'); play('stamp'); try { navigator.vibrate?.(30) } catch { /* optional */ }
    }
    const back = () => { if (document.visibilityState === 'visible') void look() }   // coming back from the agent app: look at once
    document.addEventListener('visibilitychange', back); window.addEventListener('focus', back)
    timer = window.setTimeout(look, phase === 'slow' ? 3000 : 1200)
    return () => { stop = true; clearTimeout(timer); document.removeEventListener('visibilitychange', back); window.removeEventListener('focus', back) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, step, t])
  useEffect(() => {
    if (phase !== 'wait' || !DEMO) return
    const id = setTimeout(() => {
      if (step < t.steps.length - 1) { setPhase('between'); setCopied(false); play('chime'); return }
      const e = t.apply()
      if (e) { setErr(e); setPhase('error'); play('error') } else { setPhase('done'); play('stamp'); try { navigator.vibrate?.(30) } catch { /* optional */ } }
    }, 1700)
    return () => clearTimeout(id)
  }, [phase, step, t])
  const s = t.steps[step]; const many = t.steps.length > 1
  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center md:p-6" style={{ background: '#05061299', animation: 'fadein 200ms' }} onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t.title} className="frost w-full max-w-[640px] rounded-t-[22px] md:rounded-[22px] p-5 md:p-7 max-h-[92dvh] overflow-y-auto outline-none" style={{ animation: 'trayup 320ms var(--ease-out)' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[20px]">{t.title}</h2>
            {many && phase !== 'between' && <p className="text-muted text-[14px] mt-1 flex items-center gap-2">Step {step + 1} of {t.steps.length}: {s.label}<span className="inline-flex gap-1" aria-hidden>{t.steps.map((_, i) => <i key={i} className="w-2 h-2 rounded-full" style={{ background: i <= step ? '#FFB23F' : '#2C3156' }} />)}</span></p>}
          </div>
          <button type="button" aria-label="Close" onClick={close} className="w-11 h-11 -mr-2 -mt-2 inline-flex items-center justify-center rounded-full cursor-pointer text-muted hover:text-chalk"><X size={20} /></button>
        </div>
        {phase === 'prompt' && <>
          {t.note && <p className="text-muted mt-3">{t.note}</p>}
          <div className="flex items-center justify-between mt-4 mb-2"><span className="text-[14px] text-muted">Prompt for your agent</span><button type="button" className="btn btn-secondary btn-sm" onClick={async () => setCopied(await copy(s.prompt, 'Copied'))}>{copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}{copied ? 'Copied' : many ? `Copy prompt ${step + 1} of ${t.steps.length}` : 'Copy'}</button></div>
          <pre className="code max-h-[34dvh] overflow-auto" tabIndex={0}>{s.prompt}</pre>
          <p className="text-[14px] text-muted mt-3">Paste this into your Binance Agentic Wallet agent. It shows a preview and the risks; nothing is sent until you confirm there.</p>
          <div className="flex flex-wrap gap-3 mt-5"><button type="button" className="btn btn-primary" onClick={() => setPhase('wait')}>I confirmed in my agent</button><button type="button" className="btn btn-secondary" onClick={close}>Not now</button></div>
        </>}
        {phase === 'between' && <div className="pt-6"><div className="flex items-center gap-5"><Mascot pose="jump" expr="success" className="w-24 shrink-0" /><div><p className="led text-amber text-[30px] leading-[1.05]">{step + 1} of {t.steps.length} done</p><p className="font-extrabold text-[18px] leading-tight mt-2">{t.steps.length - step - 1 === 1 ? `One more prompt to finish the ${t.steps[t.steps.length - 1].label.toLowerCase()}.` : `${t.steps.length - step - 1} more prompts to finish.`}</p>{s.landed && <p className="text-muted text-[14px] mt-1.5">{s.landed}</p>}</div></div><button type="button" className="btn btn-primary w-full justify-center mt-5" onClick={() => { setStep(step + 1); setPhase('prompt') }}>Show prompt {step + 2} of {t.steps.length}</button><p className="text-muted text-[13px] text-center mt-2.5">The next prompt opens with its own Copy button.</p></div>}
        {phase === 'wait' && <div className="py-8 flex items-center gap-5"><Mascot pose="wave" expr="thinking" className="w-24 shrink-0" /><div><Dots label="Waiting for your agent" /><p className="text-muted text-[14px] mt-2">{DEMO ? 'The site reads the contract every few seconds: pending, confirmed, then updated. In this demo it confirms by itself.' : 'The site is reading the contract every few seconds. This card moves on by itself, usually within a few seconds of your transaction landing.'}</p>{!DEMO && <button type="button" className="btn-text underline underline-offset-4 text-[14px] text-muted mt-3 min-h-[44px]" onClick={() => setPhase('prompt')}>I have not sent it yet: back to the prompt</button>}</div></div>}
        {phase === 'slow' && <div className="py-6 flex items-center gap-5"><Mascot pose="search" expr="confused" className="w-24 shrink-0" /><div><p className="font-semibold">We can't see it on-chain yet. Still looking.</p><p className="text-muted text-[14px] mt-2">This card moves on by itself as soon as the chain shows it. If your agent showed an error or you did not confirm there, nothing was sent.</p><div className="flex flex-wrap gap-3 mt-4"><button type="button" className="btn btn-primary btn-sm" onClick={() => setPhase('wait')}>Check again</button><button type="button" className="btn btn-secondary btn-sm" onClick={() => setPhase('prompt')}>Back to the prompt</button></div></div></div>}
        {phase === 'done' && <div className="py-6 flex flex-wrap items-center gap-6"><Mascot pose={(t.pose as Pose) ?? 'jump'} expr="success" className="w-28 shrink-0" /><div className="flex-1 min-w-[200px]"><PaidStamp text={t.done} />{t.after && <div className="mt-4">{t.after}</div>}<div className="mt-5"><button type="button" className="btn btn-secondary" onClick={close}>Done</button></div></div></div>}
        {phase === 'error' && <div className="py-6 flex items-center gap-5"><Mascot pose="rest" expr="worried" className="w-28 shrink-0" /><div><p className="font-semibold text-coral flex gap-2"><AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />{err}</p><p className="text-muted text-[14px] mt-2">Nothing was sent.</p><button type="button" className="btn btn-secondary mt-4" onClick={close}>Close</button></div></div>}
      </div>
    </div>
  )
}

/* one ledger line: date, who, what, amount, status, action. Press Details for the full record. */
export function IouLine({ x, action }: { x: Iou; action?: ReactNode }) {
  const { name, user } = useStore(); const [open, setOpen] = useState(false); const id = useId()
  const v = viewOf(x), mine = x.debtor === ME, other = mine ? x.creditor : x.debtor, o = user(other)
  const when = (t: number) => new Date(t).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
  const rows: [string, ReactNode][] = [['IOU number', `No. ${x.id}`], [mine ? 'You owe' : 'Owes you', <span className="inline-flex flex-wrap items-center gap-x-3">{name(other)} <AddressChip address={other} /></span>], ['Amount', <><Money>{amt(x)}</Money>{x.asset === 'BNB' && <span className="text-muted"> ≈ {usd(x.usd)} when it was made</span>}</>], ['For', plain(x.memo) || 'No note'], ['Made on', when(x.createdAt)], ['Due', <>{when(x.dueAt)} <span className="text-muted">({dateUtc(x.dueAt)})</span></>], ['Status', x.status === 'Active' ? `${v}, ${dueText(x.dueAt).toLowerCase()}` : v]]
  if (x.repaidAt) rows.push(['Repaid on', when(x.repaidAt)])
  return (
    <li style={{ ['--bar' as string]: BAR[v] }} className="border-b border-rule border-l-[3px] border-l-[var(--bar)]">
      <div className="line" style={{ border: 0 }}>
        <time className="text-muted text-[14px]" dateTime={new Date(x.createdAt).toISOString()}>{dateShort(x.createdAt)}</time>
        <span className="flex items-center gap-2 min-w-0 font-semibold">{o && <Avatar address={other} score={score(o)} level={levelOf(o)} size={28} mini />}<span className="truncate">{mine ? name(other) : `To ${name(other)}`}</span></span>
        <span className="text-right min-[860px]:hidden"><Money>{amt(x)}</Money></span>
        <span className="text-muted truncate col-span-3 min-[860px]:col-span-1">{plain(x.memo)}</span>
        <span className="hidden min-[860px]:block text-right"><Money>{amt(x)}</Money> <span className="text-muted text-[13px]">{x.asset === 'BNB' ? `≈ ${usd(x.usd)}` : ''}</span></span>
        <span className="flex flex-col items-start gap-1 col-span-3 min-[860px]:col-span-1"><StatusPill v={v} />{x.status === 'Active' && <span className="text-[13px] text-muted" title={dateUtc(x.dueAt)}>{dueText(x.dueAt)}</span>}</span>
        <span className="col-span-3 min-[860px]:col-span-1 flex flex-wrap items-center gap-2 [&>.btn-primary]:flex-1 min-[860px]:[&>.btn-primary]:flex-none">{action}<button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="btn btn-secondary btn-sm">{open ? 'Hide' : 'Details'}</button></span>
      </div>
      {open && <dl id={id} className="grid sm:grid-cols-[150px_1fr] gap-x-4 gap-y-1.5 px-4 pb-4 text-[15px]" style={{ animation: 'fadein 200ms' }}>{rows.map(([k, val]) => <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="mb-1.5 sm:mb-0">{val}</dd></div>)}</dl>}
    </li>
  )
}
export function Empty({ text, cta, to }: { text: string; cta?: string; to?: 'mart' | 'tasks' }) {
  return <div className="flex items-center gap-5 py-8"><Mascot pose="rest" expr="sleep" className="w-28 shrink-0" /><div><p>{text}</p>{cta && to && <Link to={to} className="btn btn-secondary mt-3">{cta}</Link>}</div></div>
}
export const Risk = ({ children }: { children?: ReactNode }) => <p className="text-[14px] text-muted flex gap-2 mt-3"><AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden /><span>{children ?? 'Only promise what you can repay by the due date. A missed promise stays on your record and lowers your level.'}</span></p>

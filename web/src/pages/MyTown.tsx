import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, Lock, X } from 'lucide-react'
import { ME, PART_COST, TIERS, claimable, levelOf, score, styleOf, townOf, type User } from '../lib/data'
import { TOWN_ART, TOWN_ME, TOWN_ME_Z, TOWN_PARTS, TOWN_RATIO } from '../lib/townmap'
import { useStore } from '../lib/store'
import { Link } from '../lib/router'
import { MascotMark } from '../components/art'
import { AddressChip } from '../components/ui'
import { img } from '../components/fx'

/* Build your own town. Every part has one fixed place; which parts are open is read from the vouchers the address has claimed on the contract.
   The picture is a stack of small cut-outs, back to front, so an unfinished town and a finished one use the same files. */
const INK = ['#D8DAE8', '#F2C14E', '#C9A6FF']
const SIZE = [0, 1, 2].map((t) => TOWN_PARTS.filter((p) => p.tier === t).length)

export function TownPlot({ u, sample, bare }: { u: User; /** a finished town, shown to visitors who have none yet */ sample?: boolean; /** the pictures only, as a backdrop: no locks, no mascot, nothing announced */ bare?: boolean }) {
  const s = useStore(); const open = sample ? new Set(TOWN_PARTS.map((_, i) => i)) : townOf(u).open; const st = styleOf(u), od = s.hasOverdue(u.address)
  const names = TOWN_PARTS.filter((_, i) => open.has(i)).map((p) => p.name)
  return (
    <div role={bare ? undefined : 'img'} aria-hidden={bare || undefined} aria-label={bare ? undefined : sample ? `A finished town: all ${TOWN_PARTS.length} parts, from a tree to a castle tower.` : `${u.address === ME ? 'Your town' : `${u.nickname}'s town`}: ${open.size} of ${TOWN_PARTS.length} parts open${names.length ? `: ${names.join(', ')}` : ''}.`} className="relative overflow-hidden"
      style={{ borderRadius: bare ? 0 : 18, aspectRatio: String(TOWN_RATIO), containerType: 'inline-size', isolation: 'isolate', background: 'radial-gradient(60% 50% at 50% 38%,#3A2F7A,#151845 60%,#0E1024)' }}>
      {TOWN_ART.filter((a) => a.p < 0 || open.has(a.p)).map((a) => <img key={a.f} src={img(`town/${a.f}`)} alt="" draggable={false} className="absolute max-w-none" style={{ left: `${a.x}%`, top: `${a.y}%`, width: `${a.w}%`, zIndex: a.z }} />)}
      {!bare && TOWN_PARTS.map((p, i) => open.has(i) ? null : <span key={i} aria-hidden className="absolute flex items-center justify-center" style={{ left: `${p.at[0]}%`, top: `${p.at[1]}%`, width: '5cqw', height: '2.5cqw', transform: 'translate(-50%,-50%)', borderRadius: '50%', background: '#0E102480', border: `1px dashed ${INK[p.tier]}`, color: INK[p.tier], zIndex: 150 }}><Lock style={{ width: '1.7cqw', height: '1.7cqw' }} strokeWidth={3} /></span>)}
      {!bare && <span aria-hidden className="absolute town-hop" style={{ left: `${TOWN_ME[0]}%`, top: `${TOWN_ME[1]}%`, width: '5.6cqw', transform: 'translate(-50%,-100%)', zIndex: TOWN_ME_Z, filter: 'drop-shadow(0 .5cqw .4cqw #0009)' }}><MascotMark address={u.address} pose={od ? 'rest' : st.pose} look={st.look} shade={st.shade} asleep={od} width={0} fill /></span>}
    </div>
  )
}
const count = (u: User) => `${townOf(u).open.size} of ${TOWN_PARTS.length} parts`

/** The shell of both town panels: a sheet from the bottom on a phone, a card in the middle on a wide screen. */
const sheets: object[] = []   // open panels, oldest first: Escape closes only the one on top
export function Sheet({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const me = {}, from = document.activeElement as HTMLElement | null; sheets.push(me); box.current?.focus()
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && sheets[sheets.length - 1] === me) close() }
    addEventListener('keydown', key); return () => { removeEventListener('keydown', key); sheets.splice(sheets.indexOf(me), 1); from?.focus?.() }
  }, [close])
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center md:p-6" style={{ background: '#05061299', animation: 'fadein 200ms' }} onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="frost w-full max-w-[540px] rounded-t-[24px] md:rounded-[24px] p-5 md:p-6 max-h-[92dvh] overflow-y-auto outline-none" style={{ animation: 'trayup 320ms var(--ease-out)', background: '#171A35FA' }}>{children}</div>
    </div>, document.body)
}
const PILL = { background: '#0E1024', boxShadow: 'inset 0 0 0 1px #2C3156' }

/** Task Hub, under Harbour Run: the member's town as one small row. A press opens the whole town. */
export function TownBanner() {
  const s = useStore(); const [open, setOpen] = useState(false); const shut = useCallback(() => setOpen(false), [])
  const me = s.me, got = townOf(me).open, have = [0, 1, 2].map((t) => TOWN_PARTS.filter((p, i) => p.tier === t && got.has(i)).length)
  return <>
    <button type="button" id="t-build" aria-haspopup="dialog" onClick={() => setOpen(true)} aria-label={s.joined ? `Build your town: ${count(me)} open. Open your town.` : 'Build your town: see a finished town.'}
      className="relative block w-full max-w-[560px] mt-4 text-left overflow-hidden cursor-pointer" style={{ borderRadius: 20, boxShadow: 'inset 0 0 0 1px #ffffff2e', background: '#14163A' }}>
      <span aria-hidden className="absolute inset-x-0 top-1/2 block" style={{ transform: 'translateY(-50%) scale(1.12)' }}><TownPlot u={me} sample={!s.joined} bare /></span>
      <span aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(90deg,#14163AF2 0%,#14163AD0 46%,#14163A40 100%)', zIndex: 1 }} />
      <span className="relative flex items-center gap-3 px-4 py-3.5" style={{ zIndex: 2 }}>
        <span className="min-w-0 flex-1"><span className="block text-[17px] font-extrabold text-chalk">Build your town</span>
          <span className="block text-[13.5px]" style={{ color: '#D5D7EA' }}>{s.joined ? `${count(me)} open` : 'See a finished town'}</span>
          {s.joined && <span className="flex gap-2 mt-5 max-w-[200px]">{have.map((n, t) => <span key={t} className="flex-1"><span className="block h-1.5 rounded-full overflow-hidden" style={{ background: '#ffffff26' }}><i className="block h-full rounded-full" style={{ width: `${(n / SIZE[t]) * 100}%`, background: INK[t] }} /></span><span className="block text-[11.5px] mt-1" style={{ color: '#C9CCE2' }}>{n}/{SIZE[t]}</span></span>)}</span>}</span>
        <span className="shrink-0 w-10 h-10 rounded-full inline-flex items-center justify-center" style={{ background: 'var(--holo)', boxShadow: 'inset 0 0 0 1.5px #ffffffd9, 0 6px 18px #F2A7E055', color: '#1E1B4B' }}><ChevronRight size={22} aria-hidden /></span>
      </span>
    </button>
    {open && <MyTownSheet close={shut} />}
  </>
}
/** The whole town, opened from the banner: every part at its place, and what opens the next one. A visitor sees a finished town. */
function MyTownSheet({ close }: { close: () => void }) {
  const s = useStore(); const me = s.me, { next } = townOf(me), can = claimable(me), title = s.joined ? 'Your town' : 'A finished town'
  return (
    <Sheet title={title} close={close}>
      <div className="flex items-center justify-between gap-3"><h2 className="text-[20px]">{title}</h2><span className="pill shrink-0" style={PILL}>{s.joined ? count(me) : `${TOWN_PARTS.length} parts to open`}</span></div>
      <div className="mt-4"><TownPlot u={me} sample={!s.joined} /></div>
      {s.joined ? <ul className="grid gap-2 mt-4">{TIERS.map((t, i) => { const n = next[i]
        return <li key={t} className="rounded-2xl px-3.5 py-2.5 text-[14px]" style={PILL}>
          <p className="font-extrabold flex items-center gap-2" style={{ color: INK[i] }}><i className="w-2 h-2 rounded-full" style={{ background: INK[i] }} />{t}</p>
          <p className="text-muted mt-0.5">{n ? <>Next: <b className="text-chalk">{n.name}</b>. {can[i] >= n.need ? `Claim ${n.need === 1 ? 'your voucher' : `${n.need} vouchers`} on this page to open it.` : `${n.need === 1 ? '1 more voucher' : `${n.need} more vouchers`} to claim.`}</> : `All ${SIZE[i]} parts open.`}</p></li> })}</ul>
        : <p className="mt-4 font-semibold">Members build a town of their own, part by part.</p>}
      <p className="text-[13px] text-muted mt-3">{PART_COST[0]} Common vouchers open one part. One Rare or one Legendary voucher opens one. Each part has its own place. Parts cannot be bought, sold or moved.</p>
      <div className="flex gap-3 mt-5">{!s.joined && <Link to="start" className="btn btn-primary flex-1">Get IOU Verified</Link>}<button type="button" className={`btn btn-secondary ${s.joined ? 'flex-1' : ''}`} onClick={close}><X size={16} aria-hidden />Close</button></div>
    </Sheet>
  )
}

/** What opens when a mascot in Promise Town is pressed: that member's town as it is, then their record. */
export function TownSheet({ u, close }: { u: User; close: () => void }) {
  const s = useStore(); const st = styleOf(u)
  const openIous = s.ious.filter((x) => x.debtor === u.address && x.status === 'Active').length
  const facts: [string | number, string, string?][] = [[score(u), 'Trust Score', '#9EE6C8'], [`L${levelOf(u)}`, 'Level', '#FFB23F'], [u.xp, 'XP'], [u.onTime, 'Paid on time'], [u.late, 'Paid late'], [openIous, openIous === 1 ? 'Open IOU' : 'Open IOUs']]
  const title = u.address === ME ? 'Your town' : `${u.nickname}'s town`
  return (
    <Sheet title={title} close={close}>
      <div className="flex items-center gap-3">
        <span className="shrink-0 w-12" aria-hidden><MascotMark address={u.address} pose={st.pose} look={st.look} shade={st.shade} width={0} fill /></span>
        <div className="min-w-0 flex-1"><h2 className="text-[20px] truncate">{title}</h2><AddressChip address={u.address} /></div>
        <span className="pill shrink-0" style={PILL}>{count(u)}</span>
      </div>
      <div className="mt-4"><TownPlot u={u} /></div>
      <dl className="grid grid-cols-3 gap-2 mt-4">{facts.map(([v, k, c]) => <div key={k} className="rounded-2xl px-3 py-2.5" style={{ background: '#ffffff0d', boxShadow: 'inset 0 0 0 1px #ffffff22' }}><dd className="text-[20px] font-extrabold leading-tight" style={{ color: c }}>{v}</dd><dt className="text-[12.5px] text-muted">{k}</dt></div>)}</dl>
      <div className="flex gap-3 mt-5"><Link to="u" param={u.address} className="btn btn-primary flex-1">Open full profile</Link><button type="button" className="btn btn-secondary" onClick={close}><X size={16} aria-hidden />Close</button></div>
    </Sheet>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, Minus, Plus, RotateCcw, Sailboat, X } from 'lucide-react'
import { DAY, ME, dueText, levelOf, rankPoints, styleOf, viewOf, type Iou, type User } from '../lib/data'
import { TOWN_STAGES } from '../lib/townstages'
import { useStore } from '../lib/store'
import { usePrefs } from '../lib/prefs'
import { Link } from '../lib/router'
import { MascotMark } from '../components/art'
import { img } from '../components/fx'
import { Sheet, TownBanner, TownSheet } from './MyTown'

/* Promise Town: the record, drawn. The picture is fixed; who stands where and which boats are out is read from the contract.
   Places are in percent of the picture: three terraces for the three levels, and the harbour for open IOUs. */
const SLOTS: Record<number, [number, number][]> = {
  3: [[56.4, 27.3], [66.0, 34.2], [51.7, 16.6], [79.5, 35.9], [79.5, 43.6], [42.1, 16.3], [51.0, 23.7], [70.6, 38.3], [88.0, 39.2], [58.1, 12.7]],
  2: [[38.2, 40.6], [53.2, 51.0], [61.0, 61.5], [28.3, 37.2], [51.0, 41.7], [21.5, 33.1], [38.2, 46.1], [53.5, 57.4], [68.1, 63.7], [58.1, 46.1]],
  1: [[25.8, 58.8], [41.8, 68.4], [33.6, 65.9], [54.6, 75.6], [19.0, 54.6], [10.5, 48.0], [29.3, 62.1], [42.1, 73.1], [53.2, 81.1], [42.5, 64.0]],
}
const GLASS = { background: 'linear-gradient(180deg,#ffffff30,#ffffff12)', boxShadow: 'inset 0 0 0 1.5px #ffffff66', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } as const
/** The short tag over a boat: days left only. The full line is in the label read aloud and on the town page. */
const dueTag = (x: Iou) => viewOf(x) === 'Overdue' ? 'late' : ((d) => (d <= 0 ? 'today' : `${d}d`))(Math.ceil((x.dueAt - Date.now()) / DAY))
type Pick = 'circle' | 'town' | ''
/** Who stands where and which boats are out, for one view of the town. */
function useTown(pick: Pick) {
  const s = useStore()
  const all = s.users.filter((u) => u.nickname !== 'promise-mart')
  // My circle: the people this address has an IOU with, newest first. Whole town: everyone the site has read, best record first.
  const met = new Map<string, number>()
  for (const x of s.ious) { if (x.status === 'Declined' || x.status === 'Cancelled') continue; const o = x.debtor === ME ? x.creditor : x.creditor === ME ? x.debtor : ''; if (o) met.set(o, Math.max(met.get(o) ?? 0, x.createdAt)) }
  const circle = all.filter((u) => u.address === ME || met.has(u.address)).sort((a, b) => Number(b.address === ME) - Number(a.address === ME) || (met.get(b.address) ?? 0) - (met.get(a.address) ?? 0)).slice(0, 13)
  const canCircle = s.joined && circle.length > 1
  const view = pick || (canCircle ? 'circle' : 'town')
  const people = view === 'circle' ? circle : [...all].sort((a, b) => Number(b.address === ME) - Number(a.address === ME) || rankPoints(b) - rankPoints(a))
  const cap = view === 'circle' ? 5 : 10, count: Record<number, number> = { 1: 0, 2: 0, 3: 0 }
  const placed: { u: User; at: [number, number] }[] = []; const used: Record<number, number> = { 1: 0, 2: 0, 3: 0 }
  for (const u of people) { const lv = levelOf(u), n = used[lv]; count[lv]++; if (n < cap) { placed.push({ u, at: SLOTS[lv][n] }); used[lv] = n + 1 } }
  const crowded = view === 'town' && Math.max(used[1], used[2], used[3]) > 5, hidden = people.length - placed.length
  const open = s.joined ? s.ious.filter((x) => x.status === 'Active' && (x.debtor === ME || x.creditor === ME)).sort((a, b) => a.dueAt - b.dueAt) : []
  // the harbour grows with the boats: the first picture holds 3, the second 8, the third 14
  const stage = TOWN_STAGES[open.length <= TOWN_STAGES[0].boats.length ? 0 : open.length <= TOWN_STAGES[1].boats.length ? 1 : 2]
  return { view, circle, canCircle, people, placed, crowded, hidden, count, open, stage }
}
type Town = ReturnType<typeof useTown>

/** The town itself: the picture, the boats and the mascots. With `press` the mascots are buttons (the town page); without it nothing here can be pressed (the box). */
function Scene({ t, press, names }: { t: Town; press?: (address: string) => void; names: boolean }) {
  const s = useStore(); const st = t.stage, k = st.k, boats = t.open.slice(0, st.boats.length)
  const move = ([x, y]: [number, number]) => [st.box[0] + (x * st.box[2]) / 100, st.box[1] + (y * st.box[3]) / 100]
  const bw = (boats.length <= 3 ? 8 : boats.length <= 8 ? 6.8 : 6) * k
  return (
    <div className="absolute inset-x-0 top-1/2" style={{ aspectRatio: String(st.ar), transform: 'translateY(-50%)' }}>
      <img src={img(st.img)} alt={press ? 'A small town on three terraces above a harbour. The higher the terrace, the higher the level.' : ''} className="absolute inset-0 w-full h-full max-w-none" draggable={false} />
      {boats.map((x, i) => { const late = viewOf(x) === 'Overdue', who = s.name(x.debtor === ME ? x.creditor : x.debtor)
        return <span key={x.id} role={press ? 'img' : undefined} aria-label={press ? `${x.debtor === ME ? `Pay ${who}` : `From ${who}`}, ${dueText(x.dueAt).toLowerCase()}` : undefined} data-boat className="absolute town-bob" style={{ animationDelay: `${i * -0.9}s`, left: `${st.boats[i][0]}%`, top: `${st.boats[i][1]}%`, transform: 'translate(-50%,-78%)', zIndex: 100 + Math.round(st.boats[i][1]), filter: late ? 'saturate(.2) brightness(.8)' : undefined }}>
          <span className="block mx-auto w-fit whitespace-nowrap rounded-full text-center font-extrabold" style={{ fontSize: `clamp(7px,${2.3 * k}cqw,12px)`, padding: '.12em .6em', marginBottom: '.15em', background: '#0E1024E6', border: `1px solid ${late ? '#FF8B7B' : '#3FBF8A'}`, color: late ? '#FF8B7B' : '#9EE6C8' }}>{dueTag(x)}</span>
          <svg aria-hidden viewBox="0 0 70 70" className="block mx-auto" style={{ width: `${bw}cqw` }}><rect x="33" y="6" width="3" height="46" fill="#5A3D30" /><path d="M38 9 L62 46 L38 46z" fill="#FFF6D8" /><path d="M31 18 L12 46 L31 46z" fill={late ? '#8A8FB5' : '#8CC8FF'} /><path d="M4 50 h62 l-9 14 h-44z" fill="#8A5A3C" /><path d="M4 50 h62 l-3 5 h-56z" fill="#C8905F" /></svg></span> })}
      {t.placed.map(({ u, at }) => { const sty = styleOf(u), od = s.hasOverdue(u.address), mine = u.address === ME, [x, y] = move(at)
        const inner = <>
          {(names || mine) && <span className="whitespace-nowrap rounded-full font-extrabold" style={{ fontSize: `clamp(7px,${2.2 * k}cqw,12px)`, padding: '.15em .65em', marginBottom: '.15em', background: '#0E1024E6', border: `1px solid ${mine ? '#FFB23F' : '#2C3156'}`, color: mine ? '#FFB23F' : '#F0F1F7' }}>{mine ? 'you' : u.nickname}</span>}
          <span className="town-hop" style={{ animationDelay: `${(at[0] % 7) * -0.5}s`, width: `${(mine ? 8.5 : t.crowded ? 5.2 : 7) * k}cqw`, filter: 'drop-shadow(0 .6cqw .5cqw #0009)' }}><MascotMark address={u.address} pose={od ? 'rest' : sty.pose} look={sty.look} shade={sty.shade} asleep={od} width={0} fill /></span></>
        const place = { left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-100%)', zIndex: Math.round(y) }
        return press ? <button type="button" key={u.address} onClick={() => press(u.address)} aria-haspopup="dialog" aria-label={`${u.nickname}, level ${levelOf(u)}${mine ? ' (you)' : ''}: see ${mine ? 'your' : 'their'} town`} className="absolute flex flex-col items-center cursor-pointer" style={place}>{inner}</button>
          : <span key={u.address} data-mascot className="absolute flex flex-col items-center" style={place}>{inner}</span> })}
    </div>
  )
}
function ViewPick({ view, set }: { view: string; set: (p: Pick) => void }) {
  return <div className="inline-flex p-1 rounded-full" style={{ background: '#0E1024', boxShadow: 'inset 0 0 0 1px #2C3156' }}>{([['circle', 'My circle'], ['town', 'Whole town']] as const).map(([k, label]) => <button key={k} type="button" aria-pressed={view === k} onClick={() => set(k)} className={`h-9 px-4 rounded-full text-[14px] font-bold cursor-pointer ${view === k ? 'text-[#1E1B4B]' : 'text-muted hover:text-chalk'}`} style={view === k ? { background: 'var(--holo)', boxShadow: 'inset 0 0 0 1.5px #ffffffd9' } : undefined}>{label}</button>)}</div>
}

/** The town page: the whole town, big. Two fingers zoom, one finger moves; the buttons do the same for anyone who cannot pinch. A short summary under it. */
function TownPage({ t, set, close, visit }: { t: Town; set: (p: Pick) => void; close: () => void; visit: (address: string) => void }) {
  const s = useStore(); const vp = useRef<HTMLDivElement>(null); const [v, setV] = useState({ z: 1, x: 0, y: 0 })
  const pts = useRef(new Map<number, { x: number; y: number }>()), gap = useRef(0), dragged = useRef(false), travel = useRef(0)
  const fit = useCallback((z: number, x: number, y: number) => { const el = vp.current; if (!el) return { z, x, y }
    z = Math.max(1, Math.min(4, z)); const w = el.clientWidth, h = el.clientHeight, mx = (w * z - w) / 2, my = Math.max(0, ((w / t.stage.ar) * z - h) / 2)
    return { z, x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) } }, [t.stage.ar])
  const zoom = useCallback((f: number) => setV((c) => { const z = Math.max(1, Math.min(4, c.z * f)); return fit(z, (c.x * z) / c.z, (c.y * z) / c.z) }), [fit])
  useEffect(() => { const el = vp.current; if (!el) return; const wheel = (e: WheelEvent) => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15) }; el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel) }, [zoom])
  const down = (e: React.PointerEvent) => { pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.current.size === 1) { dragged.current = false; travel.current = 0 } gap.current = 0 }
  const moveBy = (e: React.PointerEvent) => { const was = pts.current.get(e.pointerId); if (!was) return; pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.current.size === 1) { const dx = e.clientX - was.x, dy = e.clientY - was.y; travel.current += Math.abs(dx) + Math.abs(dy); if (travel.current > 6) dragged.current = true; setV((c) => fit(c.z, c.x + dx, c.y + dy)) }
    else if (pts.current.size === 2) { const [a, b] = [...pts.current.values()], d = Math.hypot(a.x - b.x, a.y - b.y); dragged.current = true; if (gap.current > 0 && d > 0) zoom(d / gap.current); gap.current = d } }
  const up = (e: React.PointerEvent) => { pts.current.delete(e.pointerId); gap.current = 0 }
  const press = (a: string) => { if (!dragged.current) visit(a) }
  const pay = t.open.filter((x) => x.debtor === ME), get = t.open.filter((x) => x.creditor === ME), soon = pay[0]
  const facts: [string | number, string, string?][] = [[t.people.length, t.people.length === 1 ? 'person' : 'people'], [pay.length, 'to pay', '#FFD98A'], [get.length, 'to receive', '#9EE6C8'], [soon ? dueTag(soon) : 'none', 'next due']]
  const round = 'w-10 h-10 rounded-full inline-flex items-center justify-center text-chalk cursor-pointer'
  return (
    <Sheet title="Promise Town" close={close}>
      <div className="flex items-center justify-between gap-3"><h2 className="text-[20px]">Promise Town</h2><button type="button" className="btn btn-secondary btn-sm" onClick={close}><X size={15} aria-hidden />Close</button></div>
      {t.canCircle && <div className="text-center mt-3"><ViewPick view={t.view} set={set} /></div>}
      <div ref={vp} data-zoom={v.z.toFixed(2)} className="relative mt-3 overflow-hidden select-none" style={{ borderRadius: 18, aspectRatio: '1.08', maxHeight: '58dvh', width: '100%', containerType: 'inline-size', isolation: 'isolate', background: '#0E1024', touchAction: 'none', cursor: v.z > 1 ? 'grab' : undefined }} onPointerDown={down} onPointerMove={moveBy} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}>
        <div className="absolute inset-0" style={{ transform: `translate(${v.x}px,${v.y}px) scale(${v.z})` }}><Scene t={t} press={press} names={t.view === 'circle' || v.z >= 1.6} /></div>
        <div className="absolute right-2.5 bottom-2.5 grid gap-2" style={{ zIndex: 400 }} onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" aria-label="Zoom in" className={round} style={GLASS} disabled={v.z >= 4} onClick={() => zoom(1.4)}><Plus size={20} aria-hidden /></button>
          <button type="button" aria-label="Zoom out" className={round} style={GLASS} disabled={v.z <= 1} onClick={() => zoom(1 / 1.4)}><Minus size={20} aria-hidden /></button>
          <button type="button" aria-label="Show the whole town" className={round} style={GLASS} disabled={v.z === 1} onClick={() => setV({ z: 1, x: 0, y: 0 })}><RotateCcw size={18} aria-hidden /></button></div>
        <span aria-live="polite" className="absolute left-2.5 bottom-2.5 rounded-full px-3 py-1 text-[12px] font-extrabold text-chalk pointer-events-none" style={{ ...GLASS, zIndex: 400 }}>{v.z.toFixed(1)}x</span>
      </div>
      <p className="text-[12.5px] text-muted mt-2">Two fingers zoom, one finger moves. Press a mascot to see their town.</p>
      <dl className="grid grid-cols-4 gap-2 mt-3">{facts.filter((_, i) => s.joined || i === 0).map(([n, k, c]) => <div key={k} className="rounded-2xl px-3 py-2" style={{ background: '#ffffff0d', boxShadow: 'inset 0 0 0 1px #ffffff22' }}><dd className="text-[19px] font-extrabold leading-tight" style={{ color: c }}>{n}</dd><dt className="text-[12px] text-muted">{k}</dt></div>)}</dl>
    </Sheet>
  )
}

export function TownBox({ checked, streak }: { checked: boolean; streak: number }) {
  const s = useStore(); const [game, setGame] = useState(false), [gate, setGate] = useState(false), [page, setPage] = useState(false)
  const [visit, setVisit] = useState(''); const guest = visit ? s.user(visit) : undefined; const shut = useCallback(() => setVisit(''), []), shutPage = useCallback(() => setPage(false), [])
  const [pick, setPick] = useState<Pick>(''); const t = useTown(pick), { view, circle, canCircle, count, hidden, open } = t
  const next = open.find((x) => x.debtor === ME), drawn = Math.min(open.length, t.stage.boats.length)
  return (
    <section aria-labelledby="t-town" className="panel p-4 md:p-6" style={{ borderRadius: 24 }}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2"><div><h2 id="t-town" className="text-[20px]">Promise Town</h2><p className="text-muted text-[14px]">Your record, drawn as a town. It follows what you already do below.</p></div>
        {!game && canCircle && <ViewPick view={view} set={setPick} />}</div>
      {game ? <HarbourRun streak={streak} close={() => setGame(false)} hint={next ? `Next to repay: ${s.name(next.creditor)}, ${dueText(next.dueAt)}` : 'Nothing to repay right now'} /> : <>
        <div className="relative mt-4 overflow-hidden" style={{ borderRadius: 18, aspectRatio: '1.5517', containerType: 'inline-size', isolation: 'isolate', background: '#0E1024' }}>
          <div aria-hidden className="absolute inset-0"><Scene t={t} names={view === 'circle'} /></div>
          <button type="button" id="t-open" aria-haspopup="dialog" onClick={() => setPage(true)} aria-label={`Promise Town: ${t.placed.length} ${t.placed.length === 1 ? 'person' : 'people'}${drawn ? `, ${drawn} ${drawn === 1 ? 'boat' : 'boats'}` : ''}. Open the town to zoom in.`} className="absolute inset-0 w-full h-full cursor-pointer" style={{ zIndex: 500, borderRadius: 18 }}>
            <span aria-hidden className="absolute right-2.5 top-2.5 w-9 h-9 rounded-full inline-flex items-center justify-center text-chalk" style={GLASS}><Maximize2 size={17} /></span></button>
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[13px] text-muted">{view === 'circle' ? <span>You and the {circle.length - 1} {circle.length === 2 ? 'person' : 'people'} you have an IOU with.</span> : <>{[3, 2, 1].map((lv) => <span key={lv} className="rounded-full px-2.5 py-0.5" style={{ background: '#0E1024', boxShadow: 'inset 0 0 0 1px #2C3156' }}>Level {lv} · <b className="text-chalk">{count[lv]}</b></span>)}{hidden > 0 && <span>{hidden} more not drawn.</span>}</>} <Link to="board" className="underline underline-offset-4 text-chalk">See everyone on the Leaderboard</Link></p>
        <div className="flex items-center gap-4 mt-4">
          {(!s.joined || !checked) && <div className="shrink-0 overflow-hidden" style={{ width: 104, aspectRatio: `${W} / ${H}`, borderRadius: 14, boxShadow: 'inset 0 0 0 1.5px #ffffff38, 0 8px 18px #0008' }} aria-hidden><Teaser /></div>}
          <div className="min-w-0"><h3 className="text-[17px] flex items-center gap-2"><Sailboat size={18} className="text-amber shrink-0" aria-hidden />Harbour Run</h3>
            <p className="text-[14px] text-muted mt-1 max-w-[46ch]">{!s.joined ? 'A 40-second run: catch promise notes, steer round the rocks. Open to members.' : checked ? 'You checked in today, so the harbour is open.' : 'Check in today to open the harbour for a run.'} {s.joined && (streak >= 7 ? 'A full week: you sail the Lantern Clipper.' : streak >= 3 ? 'Three days in a row: you sail the Sailboat.' : 'Three days in a row gives a faster boat.')}</p>
            {gate && !s.joined ? <p className="mt-3 flex flex-wrap items-center gap-3" role="status"><span className="font-semibold">Get IOU Verified first.</span><Link to="start" className="btn btn-primary btn-sm">Get IOU Verified</Link></p>
              : <button type="button" className="btn btn-primary mt-3" disabled={s.joined && !checked} onClick={() => (s.joined ? setGame(true) : setGate(true))}><Sailboat size={18} aria-hidden />Play Harbour Run</button>}</div>
        </div>
        <TownBanner /></>}
      {page && <TownPage t={t} set={setPick} close={shutPage} visit={setVisit} />}
      {guest && <TownSheet u={guest} close={shut} />}
    </section>
  )
}

/* Harbour Run: a 40-second run for fun. Catch promise notes, steer round the rocks: one hit ends the run. The boat comes from the check-in streak on the contract.
   The score is kept on this device only and counts for nothing: no XP, no rank. */
const KINDS = [{ name: 'Rowboat', speed: 170, reach: 24 }, { name: 'Sailboat', speed: 235, reach: 30 }, { name: 'Lantern Clipper', speed: 300, reach: 36 }]
const W = 360, H = 460, RUN = 40, BY = H - 104   // BY: where the boat rides
interface Thing { x: number; y: number; rock: boolean; v: number }
type Kind = (typeof KINDS)[number]
/** Draws and runs the game on a canvas. `auto` is the teaser: the boat steers itself and the run never ends. Returns the function that stops it. */
function sail(c: HTMLCanvasElement, kind: Kind, o: { auto?: boolean; still?: boolean; steer?: { current: number }; hud?: (left: number, notes: number) => void; over?: (notes: number, crashed: boolean) => void }) {
  const g = c.getContext('2d')!, dpr = Math.min(2, devicePixelRatio || 1); c.width = W * dpr; c.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0)
  let x = W / 2, left = RUN, notes = 0, spawn = 0, hit = 0, last = performance.now(), raf = 0, shown = -1, crashed = false; const things: Thing[] = o.still ? [{ x: 110, y: 150, rock: false, v: 0 }, { x: 250, y: 230, rock: true, v: 0 }, { x: 200, y: 60, rock: false, v: 0 }] : []
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const frame = (now: number) => {
    const dt = o.still ? 0 : Math.min(0.05, (now - last) / 1000); last = now; if (!o.auto) left -= dt; hit = Math.max(0, hit - dt); spawn -= dt
    let dir = o.steer?.current ?? 0
    if (o.auto) {   // head for the nearest note, and slide away from a rock that is close ahead
      const ahead = things.filter((t) => t.y < BY && t.y > H - 330).sort((p, q) => q.y - p.y), rock = ahead.find((t) => t.rock && Math.abs(t.x - x) < 40 && t.y > H - 200), note = ahead.find((t) => !t.rock)
      dir = rock ? (rock.x > x ? -1 : 1) * (x < 60 ? -1 : x > W - 60 ? -1 : 1) : note && Math.abs(note.x - x) > 6 ? Math.sign(note.x - x) : 0
    }
    x = Math.max(34, Math.min(W - 34, x + dir * kind.speed * dt))
    if (!o.still && spawn <= 0) { spawn = 0.55 + rnd() * 0.45; things.push({ x: 30 + rnd() * (W - 60), y: -20, rock: rnd() < 0.36, v: 120 + (o.auto ? 20 : (RUN - left) * 2.4) + rnd() * 40 }) }
    for (const t of things) t.y += t.v * dt
    for (let i = things.length - 1; i >= 0; i--) { const t = things[i]
      if (Math.abs(t.x - x) < (t.rock ? 26 : kind.reach) && Math.abs(t.y - (BY)) < 24) { if (t.rock) { hit = 0.5; if (!o.auto) crashed = true } else notes++; things.splice(i, 1) } else if (t.y > H + 30) things.splice(i, 1) }
    // a moonlit harbour: night water, a moon and its path on the sea, stars
    const sea = g.createLinearGradient(0, 0, 0, H); sea.addColorStop(0, '#0B0C2A'); sea.addColorStop(0.45, '#14205A'); sea.addColorStop(1, '#1B3A8C'); g.fillStyle = sea; g.fillRect(0, 0, W, H)
    g.fillStyle = '#ffffffb3'; for (let i = 0; i < 26; i++) { g.beginPath(); g.arc((i * 137) % W, (i * 53) % 110 + 6, i % 3 ? 1 : 1.5, 0, 7); g.fill() }
    g.fillStyle = '#FFF6D81a'; g.beginPath(); g.arc(252, 118, 46, 0, 7); g.fill(); g.fillStyle = '#FFF6D8'; g.beginPath(); g.arc(252, 118, 23, 0, 7); g.fill()
    g.strokeStyle = '#FFF6D824'; g.lineWidth = 3; g.lineCap = 'round'; for (let i = 0; i < 4; i++) { const ry = 190 + i * 58, rw = 9 + i * 7, sway = o.still ? 0 : Math.sin(now / 900 + i) * 4; g.beginPath(); g.moveTo(252 - rw + sway, ry); g.lineTo(252 + rw + sway, ry); g.stroke() }
    g.strokeStyle = '#BFD6FF59'; g.lineWidth = 1.6
    for (let i = 0; i < 16; i++) { const wx = (i * 97) % W, wy = ((i * 61 + (o.still ? 0 : now * 0.06)) % (H + 20)) - 10; g.beginPath(); g.moveTo(wx, wy); g.quadraticCurveTo(wx + 5, wy - 4, wx + 10, wy); g.quadraticCurveTo(wx + 15, wy + 4, wx + 20, wy); g.stroke() }
    for (const t of things) { g.save(); g.translate(t.x, t.y)
      if (t.rock) { g.fillStyle = '#BFD6FF33'; g.beginPath(); g.ellipse(0, 10, 24, 7, 0, 0, 7); g.fill(); g.fillStyle = '#1A1D45'; g.beginPath(); g.moveTo(-20, 9); g.lineTo(-12, -11); g.lineTo(2, -17); g.lineTo(16, -8); g.lineTo(22, 9); g.fill(); g.fillStyle = '#4A5196'; g.beginPath(); g.moveTo(-12, -11); g.lineTo(2, -17); g.lineTo(4, -4); g.lineTo(-8, 0); g.fill() }
      else { g.rotate(-0.14); g.shadowColor = '#FFE9A0'; g.shadowBlur = 14; g.fillStyle = '#FFF6D8'; g.strokeStyle = '#FFE9A0'; g.lineWidth = 1; g.beginPath(); g.roundRect(-14, -10, 28, 20, 3); g.fill(); g.shadowBlur = 0; g.stroke(); g.strokeStyle = '#B8892E'; g.lineWidth = 2; g.beginPath(); g.moveTo(-8, -3); g.lineTo(8, -3); g.moveTo(-8, 3); g.lineTo(2, 3); g.stroke(); g.fillStyle = '#FF6B57'; g.beginPath(); g.arc(8, 4, 3, 0, 7); g.fill() }
      g.restore() }
    g.save(); g.translate(x, BY); if (hit > 0) g.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(now / 45))
    const big = kind === KINDS[2], sl = kind !== KINDS[0], hw = big ? 34 : sl ? 28 : 23
    g.fillStyle = '#BFD6FF33'; g.beginPath(); g.ellipse(0, 22, hw + 6, 7, 0, 0, 7); g.fill()
    if (sl) { g.fillStyle = '#C9962E'; g.fillRect(-1.5, -44 - (big ? 12 : 0), 3, 48 + (big ? 12 : 0)); g.fillStyle = '#FFE9A0'; g.beginPath(); g.moveTo(3, -42 - (big ? 12 : 0)); g.lineTo(hw - 2, 2); g.lineTo(3, 2); g.fill(); if (big) { g.fillStyle = '#FFF6D8'; g.beginPath(); g.moveTo(-4, -34); g.lineTo(-hw + 4, 2); g.lineTo(-4, 2); g.fill() } }
    else { g.strokeStyle = '#E8D6A8'; g.lineWidth = 4; g.beginPath(); g.moveTo(-hw - 8, -2); g.lineTo(-8, 10); g.moveTo(hw + 8, -2); g.lineTo(8, 10); g.stroke() }
    g.fillStyle = '#2A1A10'; g.beginPath(); g.moveTo(-hw, 4); g.lineTo(hw, 4); g.lineTo(hw - 8, 22); g.lineTo(-hw + 8, 22); g.fill(); g.fillStyle = big ? '#F2C14E' : sl ? '#C9962E' : '#C8905F'; g.fillRect(-hw, 4, hw * 2, 5)
    g.fillStyle = '#FFE9A038'; g.beginPath(); g.arc(hw - 2, -2, 17, 0, 7); g.fill(); g.fillStyle = '#FFE9A0'; g.beginPath(); g.arc(hw - 2, -2, 5, 0, 7); g.fill()   // the lantern at the bow
    g.fillStyle = '#B9B2FF'; g.beginPath(); g.arc(-9, -5, 11, 0, 7); g.fill(); g.fillStyle = '#12131F'; g.beginPath(); g.roundRect(-17, -10, 15, 9, 3.5); g.fill(); g.fillStyle = '#FFB23F'; g.beginPath(); g.arc(-13, -6, 1.3, 0, 7); g.arc(-7, -6, 1.3, 0, 7); g.fill()
    g.restore()
    if (o.still) return
    const sec = Math.max(0, Math.ceil(left)); if (sec !== shown) { shown = sec; o.hud?.(sec, notes) }
    if (crashed) { o.hud?.(Math.max(0, Math.ceil(left)), notes); o.over?.(notes, true); return }   // one rock ends the run
    if (left <= 0) { o.hud?.(0, notes); o.over?.(notes, false); return }
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
  return () => cancelAnimationFrame(raf)
}
/** The teaser: the game playing itself, small, for anyone who cannot play yet. With motion reduced it is one still picture. */
function Teaser() {
  const cv = useRef<HTMLCanvasElement>(null); const { motionOff } = usePrefs()
  useEffect(() => sail(cv.current!, KINDS[1], motionOff ? { still: true } : { auto: true }), [motionOff])
  return <canvas ref={cv} aria-hidden className="block w-full h-full" />
}
function HarbourRun({ streak, close, hint }: { streak: number; close: () => void; hint: string }) {
  const kind = KINDS[streak >= 7 ? 2 : streak >= 3 ? 1 : 0]
  const cv = useRef<HTMLCanvasElement>(null), steer = useRef(0)
  const [phase, setPhase] = useState<'ready' | 'run' | 'over'>('ready'); const [hud, setHud] = useState({ left: RUN, notes: 0 }), [crash, setCrash] = useState(false)
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem('agentiou-run-best')) || 0 } catch { return 0 } })
  useEffect(() => {
    if (phase !== 'run') return
    const stop = sail(cv.current!, kind, { steer, hud: (left, notes) => setHud({ left, notes }), over: (notes, crashed) => { setCrash(crashed); setBest((b) => { const n = Math.max(b, notes); try { localStorage.setItem('agentiou-run-best', String(n)) } catch { /* private mode: the score simply is not kept */ } return n }); setPhase('over') } })
    const key = (e: KeyboardEvent) => { const d = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0; if (!d) return; e.preventDefault(); steer.current = e.type === 'keydown' ? d : steer.current === d ? 0 : steer.current }
    addEventListener('keydown', key); addEventListener('keyup', key)
    return () => { stop(); removeEventListener('keydown', key); removeEventListener('keyup', key); steer.current = 0 }
  }, [phase, kind])
  const hold = (d: number) => ({ onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); steer.current = d }, onPointerUp: () => { steer.current = 0 }, onPointerLeave: () => { steer.current = 0 }, onPointerCancel: () => { steer.current = 0 } })
  return (
    <div className="mt-4 mx-auto max-w-[420px]">
      <div className="flex items-center justify-between gap-3 mb-3"><p className="font-extrabold flex items-center gap-2"><Sailboat size={18} className="text-amber" aria-hidden />{kind.name}</p><button type="button" className="btn btn-secondary btn-sm" onClick={close}><X size={15} aria-hidden />Close</button></div>
      <div className="relative overflow-hidden select-none" style={{ borderRadius: 18, aspectRatio: `${W} / ${H}`, background: 'linear-gradient(#0B0C2A,#14205A 45%,#1B3A8C)', touchAction: 'none', boxShadow: 'inset 0 0 0 1.5px #ffffff2e' }}>
        <canvas ref={cv} role="img" aria-label="Harbour Run: a boat on the water, with promise notes to catch and rocks to steer round" className="absolute inset-0 w-full h-full" />
        {phase === 'run' && <><div className="absolute inset-x-3 top-3 flex justify-between pointer-events-none" aria-live="off"><span className="pill" style={{ background: 'linear-gradient(180deg,#ffffff26,#ffffff0d)', boxShadow: 'inset 0 0 0 1.5px #ffffff59', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', color: '#fff' }}><span className="led text-[18px]">0:{String(hud.left).padStart(2, '0')}</span></span><span className="pill" style={{ background: 'linear-gradient(180deg,#ffffff26,#ffffff0d)', boxShadow: 'inset 0 0 0 1.5px #ffffff59', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', color: '#fff' }}>Notes <span className="led text-[18px]">{hud.notes}</span></span></div>
          <div className="absolute inset-x-3 bottom-3 flex justify-between"><button type="button" aria-label="Steer left" className="w-14 h-14 rounded-full inline-flex items-center justify-center text-chalk cursor-pointer" style={{ background: 'linear-gradient(180deg,#ffffff26,#ffffff0d)', boxShadow: 'inset 0 0 0 1.5px #ffffff59', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} {...hold(-1)}><ChevronLeft size={26} aria-hidden /></button><button type="button" aria-label="Steer right" className="w-14 h-14 rounded-full inline-flex items-center justify-center text-chalk cursor-pointer" style={{ background: 'linear-gradient(180deg,#ffffff26,#ffffff0d)', boxShadow: 'inset 0 0 0 1.5px #ffffff59', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} {...hold(1)}><ChevronRight size={26} aria-hidden /></button></div></>}
        {phase !== 'run' && <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6" style={{ background: '#0E1024CC' }} role="status">
          {phase === 'over' ? <>{crash && <p className="text-coral text-[20px] font-extrabold mb-2">You hit a rock</p>}<p className="text-muted text-[14px]">Notes caught</p><p className="led text-amber text-[64px] leading-none mt-1">{hud.notes}</p><p className="text-[14px] text-muted mt-2">Best on this device: {best}</p></> : <><p className="text-[20px] font-extrabold">Catch the promise notes</p><p className="text-muted mt-2 max-w-[28ch]">Steer round the rocks: one hit ends the run. A full run lasts 40 seconds.</p></>}
          <button type="button" className="btn btn-primary mt-5" onClick={() => { setHud({ left: RUN, notes: 0 }); setPhase('run') }}><Sailboat size={18} aria-hidden />{phase === 'over' ? (crash ? 'Retry' : 'Sail again') : 'Start'}</button>
        </div>}
      </div>
      <p className="text-[14px] text-muted mt-3">{hint}. Use the two buttons or the arrow keys. The score stays on this device and gives no XP.</p>
    </div>
  )
}

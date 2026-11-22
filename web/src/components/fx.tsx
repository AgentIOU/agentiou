import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { assets } from '../lib/data'
import { usePrefs } from '../lib/prefs'
import { play } from '../lib/sound'

// absolute, because the holo sheen uses the picture as a CSS mask and a relative url() there would resolve against the stylesheet
export const img = (name: string) => new URL(`${import.meta.env.BASE_URL}img/${name}.webp`, document.baseURI).href

/* one shared pointer position for everything that looks at the cursor */
export const pointer = { x: -9999, y: -9999, subs: new Set<() => void>() }
if (typeof window !== 'undefined') {
  let raf = 0
  window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; if (!raf) raf = requestAnimationFrame(() => { raf = 0; pointer.subs.forEach((f) => f()) }) }, { passive: true })
}
function useLook(ref: React.RefObject<Element | null>, on: boolean) {
  const [d, setD] = useState<[number, number]>([0, 0])
  useEffect(() => {
    if (!on) { setD([0, 0]); return }
    const f = () => {
      const r = ref.current?.getBoundingClientRect(); if (!r) return
      const dx = pointer.x - (r.left + r.width / 2), dy = pointer.y - (r.top + r.height / 2)
      const n: [number, number] = [Math.abs(dx) < r.width * 0.6 ? 0 : Math.sign(dx), dy > r.height * 0.9 ? 1 : 0]
      setD((o) => (o[0] === n[0] && o[1] === n[1] ? o : n))
    }
    pointer.subs.add(f); return () => { pointer.subs.delete(f) }
  }, [on, ref])
  return d
}

/* the LED dot face: one system for the mascot, the avatar and the sign */
export type Expr = 'happy' | 'wink' | 'thinking' | 'success' | 'worried' | 'confused' | 'sleep'
type P = [number, number][]
const EYE: Record<string, P> = { tall: [[0, -1], [0, 0]], line: [[-1, 0], [0, 0], [1, 0]], sparkle: [[0, -1], [-1, 0], [1, 0], [0, 1]], sadL: [[-1, 1], [0, 0], [1, 0]], sadR: [[1, 1], [0, 0], [-1, 0]] }
const MOUTH: Record<string, P> = { smile: [[3, 3], [4, 4], [5, 3]], big: [[2, 3], [3, 4], [4, 4], [5, 4], [6, 3]], frown: [[3, 4], [4, 3], [5, 4]], none: [] }
const FACES: Record<Expr, { l: string; r: string; m: string; raw?: P }> = {
  happy: { l: 'tall', r: 'tall', m: 'smile' }, wink: { l: 'tall', r: 'line', m: 'smile' }, success: { l: 'sparkle', r: 'sparkle', m: 'big' },
  worried: { l: 'sadL', r: 'sadR', m: 'frown' }, sleep: { l: 'line', r: 'line', m: 'none' },
  confused: { l: 'tall', r: '', m: 'none', raw: [[5, 0], [6, 0], [7, 1], [6, 2], [6, 4]] }, thinking: { l: '', r: '', m: 'none' },
}
export function Face({ expr = 'happy', v, live = true }: { expr?: Expr; v: { cx: number; cy: number; w: number; h: number; rot: number }; live?: boolean }) {
  const { motionOff } = usePrefs()
  const ref = useRef<SVGSVGElement>(null)
  const [blink, setBlink] = useState(false)
  const [tick, setTick] = useState(0)
  const alive = live && !motionOff
  const [dx, dy] = useLook(ref, alive && expr !== 'thinking' && expr !== 'sleep')
  useEffect(() => {
    if (!alive) return
    let t: number, t2: number
    const loop = () => { t = window.setTimeout(() => { setBlink(true); t2 = window.setTimeout(() => setBlink(false), 120); loop() }, 3000 + Math.random() * 3000) }
    loop(); return () => { clearTimeout(t); clearTimeout(t2) }
  }, [alive])
  useEffect(() => { if (expr !== 'thinking' || motionOff) return; const i = setInterval(() => setTick((n) => n + 1), 260); return () => clearInterval(i) }, [expr, motionOff])
  const on = useMemo(() => {
    const f = FACES[expr], s = new Map<string, number>()
    const eye = (cx: number, k: string) => { if (!k) return; (blink && k !== 'line' ? EYE.line : EYE[k]).forEach(([x, y]) => s.set(`${cx + x + dx},${Math.max(0, 1 + y + (blink ? 0 : dy))}`, 1)) }
    eye(2, f.l); eye(6, f.r)
    f.raw?.forEach(([x, y]) => s.set(`${x},${y}`, 1)); MOUTH[f.m].forEach(([x, y]) => s.set(`${x},${y}`, 1))
    if (expr === 'thinking') [3, 4, 5].forEach((x, i) => s.set(`${x},2`, tick % 3 === i ? 1 : 0.35))
    return s
  }, [expr, blink, dx, dy, tick])
  const W = v.w * 1000, H = v.h * 1000, s = Math.min((W * 0.76) / 8, (H * 0.66) / 4)
  const dots = []
  for (let i = 0; i < 9; i++) for (let j = 0; j < 5; j++) {
    const a = on.get(`${i},${j}`)
    dots.push(<circle key={`${i},${j}`} cx={W / 2 + (i - 4) * s} cy={H / 2 + (j - 2) * s} r={a ? s * 0.34 : s * 0.22} fill={a ? '#FFB23F' : '#40342299'} opacity={a ?? 1} style={{ transition: 'r 180ms' }} />)
  }
  return (
    <svg ref={ref} aria-hidden viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: `${v.cx * 100}%`, top: `${v.cy * 100}%`, width: `${v.w * 100}%`, transform: `translate(-50%,-50%) rotate(${v.rot}deg)`, filter: 'drop-shadow(0 0 3px #FFB23Fb0)', pointerEvents: 'none' }}>{dots}</svg>
  )
}
export type Pose = keyof typeof assets.mascot
export function Mascot({ pose = 'wave', expr = 'happy', className = '', float = false, alt = '' }: { pose?: Pose; expr?: Expr; className?: string; float?: boolean; alt?: string }) {
  const v = assets.mascot[pose]
  return (
    <div className={`relative select-none ${float ? 'mascot-float' : ''} ${className}`} style={{ aspectRatio: String(v.ar) }} role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
      <img src={img('mascot-' + pose)} alt="" className="w-full h-full block" draggable={false} style={{ filter: 'drop-shadow(0 18px 30px #05061299)' }} />
      <Face expr={expr} v={v} />
    </div>
  )
}

/* the LED dot sky behind the whole site */
export function Sky() {
  const ref = useRef<HTMLCanvasElement>(null)
  const { motionOff } = usePrefs()
  useEffect(() => {
    const c = ref.current!, g = c.getContext('2d')!
    let W = 0, H = 0, raf = 0, base: HTMLCanvasElement | null = null, last = 0, waveAt = performance.now() + 2500
    const GAP = innerWidth < 700 ? 18 : 14, dpr = Math.min(devicePixelRatio || 1, 2)
    const build = () => {
      W = innerWidth; H = innerHeight; c.width = W * dpr; c.height = H * dpr
      base = document.createElement('canvas'); base.width = c.width; base.height = c.height
      const b = base.getContext('2d')!; b.scale(dpr, dpr); b.fillStyle = '#2C3156'
      for (let y = GAP / 2; y < H; y += GAP) for (let x = GAP / 2; x < W; x += GAP) b.fillRect(x - 1, y - 1, 2, 2)
      draw(performance.now(), true)
    }
    const draw = (t: number, force = false) => {
      if (!base) return
      const wave = (t - waveAt) / 3200          // 0..1 while a soft band of light crosses the sky
      const near = pointer.x > -1000 && !motionOff
      if (!force && !near && (wave < 0 || wave > 1)) return
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); g.drawImage(base, 0, 0); g.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (!motionOff && wave >= 0 && wave <= 1) {
        const front = wave * (W + H + 300) - 150
        g.fillStyle = '#8C96FF'
        for (let y = GAP / 2; y < H; y += GAP) for (let x = Math.max(GAP / 2, Math.floor((front - y - 150) / GAP) * GAP + GAP / 2); x < Math.min(W, front - y + 150); x += GAP) {
          const d = Math.abs(x + y - front) / 150; if (d < 1) { g.globalAlpha = (1 - d) * 0.5; g.fillRect(x - 1, y - 1, 2, 2) }
        }
      }
      if (near) {
        g.fillStyle = '#FFB23F'; const R = 120
        for (let y = Math.floor((pointer.y - R) / GAP) * GAP + GAP / 2; y < pointer.y + R; y += GAP) for (let x = Math.floor((pointer.x - R) / GAP) * GAP + GAP / 2; x < pointer.x + R; x += GAP) {
          const d = Math.hypot(x - pointer.x, y - pointer.y) / R; if (d < 1) { g.globalAlpha = (1 - d) * 0.9; g.fillRect(x - 1.25, y - 1.25, 2.5, 2.5) }
        }
      }
      g.globalAlpha = 1
    }
    const loop = (t: number) => { raf = requestAnimationFrame(loop); if (document.hidden || t - last < 33) return; last = t; if (t - waveAt > 3200) waveAt = t + 10000; draw(t) }
    build(); addEventListener('resize', build)
    if (!motionOff) raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', build) }
  }, [motionOff])
  return <canvas ref={ref} aria-hidden className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0, opacity: 0.75 }} />
}

/* floating jelly things; never placed behind forms, ledgers or the agent tray */
export interface Float { k: keyof typeof assets.jelly; w: number; style: CSSProperties; dur?: number; far?: boolean; desk?: boolean; mob?: boolean }
export function Floaters({ items }: { items: Float[] }) {
  return <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>{items.map((f, i) => <Floater key={i} f={f} i={i} />)}</div>
}
function Floater({ f, i }: { f: Float; i: number }) {
  const [sq, setSq] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { motionOff } = usePrefs()
  const [dx, dy] = useLook(ref, f.k === 'cloud' && !motionOff)
  const st = { width: f.w, '--dur': `${f.dur ?? 7 + (i * 1.7) % 5}s`, '--dy': `${f.far ? -8 : -16}px`, '--dx': `${i % 2 ? 6 : -6}px`, '--r0': `${(i % 3) * 3 - 3}deg`, '--r1': `${(i % 3) * 3 + 1}deg`, '--away': `${i % 2 ? -10 : 10}px`, opacity: f.far ? 0.5 : 0.92, animationDelay: `${-i * 1.3}s`, ...f.style } as CSSProperties
  return (
    <div ref={ref} className={`floater pointer-events-auto ${f.desk ? 'hidden lg:block' : ''} ${f.mob ? 'lg:hidden' : ''} ${sq ? 'squish' : ''}`} style={st}>
      <div className="relative">
        <img src={img('jelly-' + f.k)} alt="" draggable={false} onClick={() => { if (motionOff) return; setSq(false); requestAnimationFrame(() => setSq(true)); play('pop') }} onAnimationEnd={() => setSq(false)} />
        {f.k === 'cloud' && <svg viewBox="0 0 100 64" className="absolute inset-0 w-full h-full pointer-events-none" style={{ filter: 'drop-shadow(0 0 2px #FFB23F)' }}>
          {[38, 62].map((x) => [0, 5].map((y) => <circle key={`${x}${y}`} cx={x + dx * 2.5} cy={34 + y + dy * 2} r="2.1" fill="#FFB23F" />))}
        </svg>}
      </div>
    </div>
  )
}

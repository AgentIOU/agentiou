import { useEffect, useRef, useState } from 'react'
import { usePrefs } from '../lib/prefs'
import { play } from '../lib/sound'
import { Seal } from './art'

/* The hero sign. Dots fly in to write the tagline, "disappear" starts to fall apart, the IOU seal stamps down and the dots snap back.
   The real <h1> stays in the page for screen readers and search engines. */
interface Dot { tx: number; ty: number; sx: number; sy: number; line: number; fall: boolean; d: number; vy: number }
export function LedSign() {
  const wrap = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null)
  const { motionOff } = usePrefs()
  const [run, setRun] = useState(0), [stamped, setStamped] = useState(false)
  useEffect(() => {
    const c = cv.current!, g = c.getContext('2d')!, el = wrap.current!
    let raf = 0, alive = true
    const start = async () => {
      // reserve the sign's height before the font arrives, so nothing below it jumps
      { const w0 = el.clientWidth, n0 = w0 < 640; c.style.height = (w0 / (n0 ? 86 : 120)) * ((n0 ? 3 * 19 : 2 * 17) + 6) + 'px' }
      try { await document.fonts.load('800 40px "Atkinson Hyperlegible Next"') } catch { /* falls back to the system font */ }
      if (!alive) return
      const W = el.clientWidth, narrow = W < 640
      const lines = narrow ? ['Pay later.', "Can't", 'disappear.'] : ['Pay later.', "Can't disappear."]
      // about 8 LEDs per letter: fewer and the round letters (a, e, p) fill in and stop being readable
      const cols = narrow ? 86 : 120, step = W / cols, rowsPer = narrow ? 19 : 17, pad = 3
      const rows = lines.length * rowsPer + pad * 2, H = rows * step, dpr = Math.min(devicePixelRatio || 1, 2)
      c.width = W * dpr; c.height = H * dpr; c.style.height = H + 'px'
      // write the words small, one pixel per LED, then read back which LEDs are lit
      const o = document.createElement('canvas'); o.width = cols; o.height = rows; const og = o.getContext('2d', { willReadFrequently: true })!
      og.fillStyle = '#fff'; og.textBaseline = 'alphabetic'; og.textAlign = 'center'
      let fs = rowsPer * 1.02; og.font = `800 ${fs}px "Atkinson Hyperlegible Next", sans-serif`
      const widest = Math.max(...lines.map((l) => og.measureText(l).width)); if (widest > cols - 6) { fs *= (cols - 6) / widest; og.font = `800 ${fs}px "Atkinson Hyperlegible Next", sans-serif` }
      const fallX: [number, number, number][] = []
      lines.forEach((l, i) => { const y = pad + i * rowsPer + rowsPer * 0.8; og.fillText(l, cols / 2, y); const k = l.indexOf('disappear'); if (k >= 0) { const w = og.measureText(l).width, x0 = cols / 2 - w / 2 + og.measureText(l.slice(0, k)).width; fallX.push([i, x0 - 0.5, x0 + og.measureText('disappear.').width + 0.5]) } })
      const px = og.getImageData(0, 0, cols, rows).data, dots: Dot[] = []
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (px[(y * cols + x) * 4 + 3] > 128) {
        const line = Math.min(lines.length - 1, Math.max(0, Math.floor((y - pad) / rowsPer)))
        dots.push({ tx: x, ty: y, sx: Math.random() * cols, sy: Math.random() * rows * 1.6 - rows * 0.3, line, fall: fallX.some(([li, a, b]) => li === line && x >= a && x <= b), d: Math.random(), vy: 0.5 + Math.random() })
      }
      const t0 = performance.now(), L1 = narrow ? 2 : 1, still = motionOff
      const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)
      let ticked = 0, didStamp = false
      const frame = (now: number) => {
        const t = still ? 9999 : now - t0
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H)
        g.fillStyle = '#2C3156'; for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) g.fillRect(x * step + step / 2 - 0.9, y * step + step / 2 - 0.9, 1.8, 1.8)
        const fallT = (t - 1500) / 400, back = (t - 1900) / 160
        g.fillStyle = '#FFB23F'; g.shadowColor = '#FFB23F'; g.shadowBlur = step * 0.9
        const r = Math.max(1.3, step * 0.36)
        for (const d of dots) {
          const begin = d.line < L1 ? 0 : 520, p = ease((t - begin - d.d * 420) / 620)
          let x = d.sx + (d.tx - d.sx) * p, y = d.sy + (d.ty - d.sy) * p, a = 0.25 + 0.75 * p
          if (d.fall && fallT > 0 && back < 1) { const f = Math.min(1, fallT), k = 1 - ease(back); y += f * f * d.vy * 5 * k; x += Math.sin(d.d * 40) * f * 1.2 * k; a *= 1 - 0.55 * f * k }
          g.globalAlpha = a; g.beginPath(); g.arc(x * step + step / 2, y * step + step / 2, r, 0, 6.3); g.fill()
        }
        g.globalAlpha = 1; g.shadowBlur = 0
        if (!still) { const n = Math.floor(t / 90); if (t < 1300 && n > ticked) { ticked = n; play('tick') } if (t >= 1900 && !didStamp) { didStamp = true; setStamped(true); play('stamp') } }
        if (!still && t < 2400 && alive) raf = requestAnimationFrame(frame); else if (!didStamp) setStamped(true)
      }
      setStamped(still); raf = requestAnimationFrame(frame)
    }
    void start()
    let rt = 0; const onR = () => { clearTimeout(rt); rt = window.setTimeout(() => setRun((n) => n + 1), 200) }
    let w0 = innerWidth; const res = () => { if (innerWidth !== w0) { w0 = innerWidth; onR() } }
    addEventListener('resize', res)
    return () => { alive = false; cancelAnimationFrame(raf); removeEventListener('resize', res); clearTimeout(rt) }
  }, [run, motionOff])
  return (
    <div ref={wrap} className="relative rounded-[18px] border border-rule bg-[#0A0C1C]/85" style={{ boxShadow: 'inset 0 0 60px #05061280' }}>
      <h1 className="sr-only">Pay later. Can't disappear.</h1>
      <canvas ref={cv} aria-hidden className="block w-full" />
      <button type="button" aria-label="Play the sign again" title="Play the sign again" onClick={() => !motionOff && setRun((n) => n + 1)} onPointerEnter={(e) => e.pointerType === 'mouse' && stamped && !motionOff && setRun((n) => n + 1)}
        className="absolute right-[4%] bottom-[-40px] md:bottom-[-46px] cursor-pointer rounded-full" style={{ opacity: stamped ? 1 : 0, animation: stamped && !motionOff ? 'stamp 700ms var(--ease-out) both' : undefined, transform: 'rotate(-9deg)' }}>
        <span className="md:hidden"><Seal size={54} /></span><span className="hidden md:inline"><Seal size={84} /></span>
      </button>
    </div>
  )
}

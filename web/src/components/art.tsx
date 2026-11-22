import { memo, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import badgeArt from '../data/badges.json'
import { LEVELS, assets, dateShort, dateUtc, short, type Mint, type Tier, DEMO } from '../lib/data'
import { img } from './fx'
import { Lock } from 'lucide-react'

/* guilloche: security-print line work drawn with maths, like a promise note */
export function rosette(cx: number, cy: number, r0: number, amp: number, k: number, lines: number, phase0 = 0, spread = 1, steps = 240) {
  let d = ''
  for (let i = 0; i < lines; i++) {
    const ph = phase0 + (i * 2 * Math.PI * spread) / lines
    for (let s = 0; s <= steps; s++) { const t = (s / steps) * 2 * Math.PI, r = r0 + amp * Math.sin(k * t + ph); d += `${s ? 'L' : 'M'}${(cx + r * Math.cos(t)).toFixed(1)} ${(cy + r * Math.sin(t)).toFixed(1)}` }
  }
  return d
}
function spiro(R: number, r: number, dd: number, scale: number, rot: number, steps = 500) {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a), turns = r / gcd(R, r)
  let d = ''
  for (let s = 0; s <= steps; s++) {
    const t = (s / steps) * 2 * Math.PI * turns, x = (R - r) * Math.cos(t) + dd * Math.cos(((R - r) / r) * t), y = (R - r) * Math.sin(t) - dd * Math.sin(((R - r) / r) * t)
    d += `${s ? 'L' : 'M'}${((x * Math.cos(rot) - y * Math.sin(rot)) * scale).toFixed(1)} ${((x * Math.sin(rot) + y * Math.cos(rot)) * scale).toFixed(1)}`
  }
  return d
}
/* the flower is drawn once and reused everywhere with <use> */
export const ArtDefs = memo(function ArtDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <linearGradient id="holo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" /><stop offset="0.35" stopColor="#BFE3FF" /><stop offset="0.65" stopColor="#F6C8EC" /><stop offset="1" stopColor="#FFE3B0" /></linearGradient>
        <symbol id="flower" viewBox="-205 -205 410 410" fill="none">
          <path d={rosette(0, 0, 186, 13, 22, 30)} stroke="url(#holo)" strokeOpacity="0.32" strokeWidth="0.6" />
          <path d={rosette(0, 0, 148, 20, 14, 26, 0.2, 0.5)} stroke="url(#holo)" strokeOpacity="0.5" strokeWidth="0.65" />
          <path d={[0, 1, 2].map((i) => spiro(11, 7, 6.2, 7.6, (i * Math.PI) / 9)).join('')} stroke="#fff" strokeOpacity="0.38" strokeWidth="0.55" />
          <path d={[0, 1, 2, 3, 4, 5, 6].map((i) => spiro(7, 4, 2.7, 13.5, (i * Math.PI) / 14)).join('')} stroke="#fff" strokeOpacity="0.6" strokeWidth="0.6" />
          <path d={rosette(0, 0, 34, 8, 12, 12, 0.1, 0.5, 160)} stroke="url(#holo)" strokeOpacity="0.6" strokeWidth="0.55" />
          <circle r="8" stroke="#fff" strokeOpacity="0.75" strokeWidth="0.9" />
        </symbol>
      </defs>
    </svg>
  )
})
export const Flower = ({ className = '', style }: { className?: string; style?: CSSProperties }) => <svg aria-hidden viewBox="-205 -205 410 410" className={className} style={style}><use href="#flower" x="-205" y="-205" width="410" height="410" /></svg>
const waves = (n: number, w: number, gap: number, amp: number) => Array.from({ length: n }, (_, i) => Array.from({ length: w / 10 + 1 }, (_, j) => `${j ? 'L' : 'M'}${j * 10} ${(40 + i * gap + amp * Math.sin((j * 10) / 38 + i * 0.5)).toFixed(1)}`).join('')).join('')

export function Seal({ size = 28, text = true }: { size?: number; text?: boolean }) {
  return (
    <span aria-hidden className="inline-flex items-center justify-center rounded-full shrink-0" style={{ width: size, height: size, background: 'conic-gradient(from 30deg,#FFE1A8,#F2A7E0,#B9C0FF,#9EE2FF,#FFE1A8)', boxShadow: `0 0 0 ${Math.max(1.5, size / 22)}px #ffffffcc, 0 ${size / 10}px ${size / 4}px #0006` }}>
      {text && <b style={{ fontSize: size * 0.3, color: '#0E1024', fontWeight: 800, letterSpacing: '0.02em' }}>IOU</b>}
    </span>
  )
}
export const Logo = () => <span className="inline-flex items-center gap-2.5 font-extrabold text-[19px] tracking-tight"><Seal size={26} text={false} />AgentIOU</span>

/** Money in LED digits. The font's own full stop reads like a plus sign, so the decimal point is drawn as a dot. */
export function Money({ children }: { children: string }) {
  const [a, b] = children.split('.')
  return <span className="money">{a}{b != null && <><span className="dp" />{b}</>}</span>
}

export function Led({ children, className = '' }: { children: string; className?: string }) {
  const [a, b] = children.split('.')
  return <span className={`led ${className}`}>{a}{b != null && <><span className="dp" />{b}</>}</span>
}

/* IOU Card: a promise note at credit-card proportions. Tap to turn it over. */
export function IouCard({ nick, address, no, level, available, limit, back, overdue, restricted, demo, className = '' }: { nick: string; address: string; no: number; level: number; available: number; limit: number; back: [string, string][]; overdue?: boolean; restricted?: boolean; demo?: boolean; className?: string }) {
  const [flip, setFlip] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const L = LEVELS[level - 1]
  const w = useMemo(() => waves(22, 1000, 26, 7), [])
  const shell: CSSProperties = { borderRadius: '4.3cqw', overflow: 'hidden', color: '#fff', boxShadow: `0 5cqw 10cqw #00000073, inset 0 1px 0 #ffffff40${overdue ? ', 0 0 0 3px #FF6B57' : ''}`, background: restricted ? 'radial-gradient(120% 90% at 70% 10%, #FF8B7B 0%, #FF8B7B00 55%), linear-gradient(115deg, #7A0F12 0%, #B3201F 48%, #E0483A 100%)' : 'radial-gradient(120% 90% at 70% 10%, #6CB6FF 0%, #6CB6FF00 55%), linear-gradient(115deg, #0B3F9E 0%, #1C64D8 48%, #3D93F2 100%)' }
  return (
    <div className={`flip ${flip ? 'is-back' : ''} ${className}`} style={{ containerType: 'inline-size', aspectRatio: '85.6 / 54' }}
      onPointerMove={(e) => { if (e.pointerType !== 'mouse') return; const r = e.currentTarget.getBoundingClientRect(); setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * -7, y: ((e.clientX - r.left) / r.width - 0.5) * 9 }) }} onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
      <button type="button" aria-pressed={flip} aria-label={`IOU Card for ${nick}. ${restricted ? 'Restricted account. ' : ''}${flip ? 'Showing the back: repay record' : `Available $${available.toFixed(2)} of $${limit} limit`}. Press to turn the card over.`} onClick={() => setFlip(!flip)} className="block w-full h-full text-left cursor-pointer" style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transition: 'transform 200ms', transformStyle: 'preserve-3d' }}>
        <span className="flip-in block">
          <span className="face-front block" style={shell}>
            <svg aria-hidden viewBox="0 0 1000 630" preserveAspectRatio="none" className="absolute inset-0 w-full h-full"><path d={w} stroke="#fff" strokeOpacity="0.05" strokeWidth="0.8" fill="none" /></svg>
            <Flower className="absolute" style={{ width: '44%', right: '7%', top: '50%', transform: `translateY(-50%) rotate(${tilt.y * 2}deg)`, transition: 'transform 200ms' }} />
            <span className="absolute" style={{ inset: '2cqw', border: '1px solid #ffffff38', borderRadius: '3cqw' }} />
            <span className="absolute flex items-center font-extrabold" style={{ left: '5.3cqw', top: '4.6cqw', gap: '1.6cqw', fontSize: '3.7cqw' }}><Seal size={22} text={false} />AgentIOU</span>
            <span className="absolute text-right" style={{ right: '5cqw', top: '4.4cqw' }}>
              <span className="inline-flex overflow-hidden rounded-full" style={{ border: '1.5px solid #ffffffbf', fontSize: '2.8cqw' }}><b className="bg-white/90 text-ink" style={{ padding: '0.6cqw 1.5cqw' }}>L{level}</b><span style={{ padding: '0.6cqw 1.7cqw' }}>{L.name}</span></span>
              <span className="block opacity-80" style={{ fontSize: '2.5cqw', marginTop: '1.3cqw', letterSpacing: '0.04em' }}>No. {String(no).padStart(6, '0')}</span>
            </span>
            <span className="absolute" style={{ left: '5.3cqw', top: '18.5cqw' }}>
              <span className="block opacity-85" style={{ fontSize: '3cqw' }}>Available</span>
              <span className="block" style={{ fontSize: '10cqw', lineHeight: 1.05, textShadow: '0 0 14px #FFB23F8c' }}><Money>{'$' + available.toFixed(2)}</Money></span>
              <span className="block opacity-85" style={{ fontSize: '3cqw', marginTop: '0.4cqw' }}>of ${limit} limit</span>
            </span>
            <span className="absolute" style={{ left: '5.3cqw', bottom: '5cqw' }}>
              <span className="block font-extrabold" style={{ fontSize: '3.6cqw' }}>{nick}</span>
              <span className="block mono opacity-80" style={{ fontSize: '2.6cqw', marginTop: '0.5cqw' }}>{short(address)}</span>
            </span>
            <span className="absolute" style={{ right: '4.6cqw', bottom: '4.3cqw' }}><Seal size={44} /></span>
            {demo && DEMO && <span className="absolute demo-chip" style={{ left: '34%', bottom: '5cqw', color: '#fff', borderColor: '#fff', fontSize: '2.4cqw' }}>Demo data</span>}
            {(overdue || restricted) && <span className={`absolute stamp ${restricted ? 'text-white bg-[#7A0F12]/70' : 'text-coral'}`} style={{ right: '26%', top: '40%' }}>{restricted ? 'Restricted' : 'Overdue'}</span>}
          </span>
          <span className="face-back block" style={{ ...shell, background: restricted ? 'linear-gradient(115deg, #5E0B0E, #A01C1B)' : 'linear-gradient(115deg, #0A2F7A, #1552B8)' }}>
            <span className="absolute" style={{ inset: '2cqw', border: '1px solid #ffffff38', borderRadius: '3cqw' }} />
            <span className="absolute" style={{ inset: '6cqw 6cqw auto', fontSize: '2.6cqw' }}>
              <span className="block font-extrabold" style={{ fontSize: '3.2cqw', marginBottom: '2cqw' }}>Repay record</span>
              {back.map(([k, v]) => <span key={k} className="flex justify-between" style={{ padding: '1.25cqw 0', borderBottom: '1px solid #ffffff2e' }}><span className="opacity-85">{k}</span><b>{v}</b></span>)}
            </span>
          </span>
        </span>
      </button>
    </div>
  )
}

/* Credit Pass: an upright pass with a dashed edge, one picture per level */
const PASS_BG = ['linear-gradient(180deg,#232A5C,#141938)', `url(${img('pass-bokeh')}) center / cover`, `url(${img('pass-aurora')}) center / cover`]
export function CreditPass({ level, state, no, progress }: { level: 1 | 2 | 3; state: 'current' | 'open' | 'locked'; no?: number; progress?: ReactNode }) {
  const L = LEVELS[level - 1]
  const w = useMemo(() => waves(46, 1000, 24, 9), [])
  return (
    <div style={{ containerType: 'inline-size' }}>
      <div className="relative overflow-hidden" style={{ aspectRatio: '370 / 540', background: '#FBFBFA', borderRadius: '3.8cqw', color: '#23232B', boxShadow: state === 'current' ? '0 0 0 3px #FFB23F, 0 24px 50px #0008' : '0 24px 50px #0008', filter: state === 'locked' ? 'saturate(0.55) brightness(0.8)' : undefined }}>
        <div className="absolute overflow-hidden" style={{ left: '2.4cqw', right: '2.4cqw', bottom: '2.4cqw', top: '34%', borderRadius: '0 0 1.9cqw 1.9cqw', background: PASS_BG[level - 1] }}>
          {level === 1 && <svg aria-hidden viewBox="0 0 1000 1100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full"><path d={w} stroke="#9FA8FF" strokeOpacity="0.22" strokeWidth="1.4" fill="none" /></svg>}
          <Flower className="absolute" style={{ right: '-14%', bottom: '7%', width: '57%' }} />
        </div>
        <div className="absolute inset-x-0 top-0" style={{ height: '66%', padding: '8cqw 8.6cqw', background: 'linear-gradient(180deg,#FDFDFC 0%,#F7F6F3 52%,#F7F6F3d9 66%,#F7F6F300 100%)' }}>
          <div className="flex justify-between items-baseline" style={{ fontSize: '4.3cqw' }}><b style={{ color: '#55565f' }}>Credit Pass</b>{no != null && <span style={{ color: '#74757f', fontSize: '3.8cqw' }}>No {String(no).padStart(6, '0')}</span>}</div>
          <div className="led" style={{ fontSize: '32cqw', lineHeight: 0.92, marginTop: '5cqw' }}>L{level}</div>
          <div className="font-extrabold" style={{ fontSize: '8.6cqw', marginTop: '3cqw' }}>{L.name}</div>
        </div>
        <div className="absolute text-white" style={{ left: '8.6cqw', right: '40%', bottom: '8cqw' }}>
          <div style={{ fontSize: '4cqw', opacity: 0.9 }}>Credit limit</div>
          <div style={{ fontSize: '12cqw', lineHeight: 1.1, color: '#fff' }}><span className="led">${L.limit}</span></div>
          <div style={{ fontSize: '3.9cqw', lineHeight: 1.35, marginTop: '1cqw' }}>{L.rule}</div>
        </div>
        <div className="absolute pointer-events-none" style={{ inset: '1.9cqw', border: '0.7cqw dashed #3B3B42', borderRadius: '2.4cqw' }} />
        {state === 'locked' && <span className="absolute flex items-center justify-center rounded-full bg-ink text-chalk" style={{ right: '8cqw', top: '7cqw', width: '11cqw', height: '11cqw' }}><Lock style={{ width: '5.5cqw', height: '5.5cqw' }} aria-label="Locked" /></span>}
      </div>
      <div className="mt-3 text-[15px]">{state === 'current' ? <span className="pill pill-leaf">Your level now</span> : state === 'open' ? <span className="pill pill-muted">Passed</span> : progress}</div>
    </div>
  )
}

/* Season 1 collector card and voucher ticket: pictures from the mascot sheet, every word set by code */
const stars = { Common: 1, Rare: 2, Legendary: 3 }
const FOIL = {
  Common: { paper: 'linear-gradient(125deg,#DADDF6,#F6F7FF 22%,#B9BEE6 45%,#EEF0FF 62%,#A9AFDD 82%,#E2E5FB)', ink: '#343BA8', panel: 'radial-gradient(circle at 50% 40%,#3A418F,#171A45)' },
  Rare: { paper: 'linear-gradient(125deg,#F6D58A,#FFF3CF 22%,#E3A93F 45%,#FFE9AE 62%,#D2952C 82%,#F8DC98)', ink: '#7A4500', panel: 'radial-gradient(circle at 50% 40%,#7A4A08,#2E1B02)' },
  Legendary: { paper: 'linear-gradient(125deg,#C9CEFF,#F9C9EC 22%,#FFE0A8 42%,#BDF0E0 62%,#BFD0FF 80%,#F3C3EA)', ink: '#3B2A6E', panel: 'radial-gradient(circle at 50% 40%,#5B3C8F,#1B1440)' },
}
const band = (ink: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='16' height='12'><path d='M0 6Q4 0 8 6T16 6M0 6Q4 12 8 6T16 6' fill='none' stroke='${ink}' stroke-width='1'/></svg>`)}")`
/* Promise stamp: our own sticker format. A perforated stamp on metallic foil with a coin of the mascot. Every word is set by code. */
export function StickerCard({ k, name, tier, mint, owner, onFlip, dim, className = '' }: { k: string; name: string; tier: Tier; mint?: Mint; owner?: string; onFlip?: boolean; dim?: boolean; className?: string }) {
  const [flip, setFlip] = useState(false)
  const f = FOIL[tier], fresh = mint && Date.now() - mint.time < 6000
  const front = (
    <span className="stamp-paper block relative w-full h-full" style={{ background: f.paper, color: f.ink, filter: dim ? 'grayscale(1) brightness(0.42)' : undefined }}>
      <span className="absolute" style={{ inset: '4.6cqw', border: `0.4cqw solid ${f.ink}`, borderRadius: '2cqw' }} />
      <b className="absolute" style={{ left: '8cqw', top: '6.6cqw', fontSize: '5.4cqw' }}>AgentIOU</b>
      <span className="absolute" style={{ right: '8cqw', top: '6cqw', fontSize: '6cqw', letterSpacing: '0.1em' }} aria-hidden>{'✦'.repeat(stars[tier])}</span>
      <span className="absolute" style={{ left: '6.6cqw', right: '6.6cqw', top: '15.4cqw', height: '4cqw', background: `${band(f.ink)} 0 0 / 5.33cqw 4cqw` }} />
      <span className="absolute flex items-center justify-center" style={{ left: '6.6cqw', right: '6.6cqw', top: '19.4cqw', height: '86cqw', background: f.panel }}>
        <span className="block rounded-full" style={{ padding: '2.2cqw', background: f.paper, boxShadow: '0 3cqw 7cqw #0009, inset 0 0 0 0.5cqw #ffffffaa' }}><img src={img('coin-' + k)} alt="" draggable={false} className="block rounded-full" style={{ width: '68cqw', height: '68cqw' }} /></span>
      </span>
      <span className="absolute" style={{ left: '6.6cqw', right: '6.6cqw', top: '105.4cqw', height: '4cqw', background: `${band(f.ink)} 0 0 / 5.33cqw 4cqw` }} />
      <span className="absolute flex items-baseline justify-between" style={{ left: '8cqw', right: '8cqw', top: '111cqw', gap: '2cqw' }}><b style={{ fontSize: name.length > 10 ? '6.6cqw' : '7.6cqw', whiteSpace: 'nowrap' }}>{name}</b>{mint && <span className="led" style={{ fontSize: '5.4cqw', whiteSpace: 'nowrap' }}>No {String(mint.edition).padStart(3, '0')}</span>}</span>
      <span className="absolute" style={{ left: '8cqw', top: '121.5cqw', fontSize: '4.3cqw', opacity: 0.85 }}>{tier}, Season 1</span>
      {tier === 'Legendary' && !dim && <span className="stamp-sheen absolute inset-0" />}
    </span>
  )
  const label = `${name}, ${tier} stamp, ${stars[tier]} star${stars[tier] > 1 ? 's' : ''}${mint ? `, edition ${mint.edition}` : dim ? ', not minted yet' : ''}`
  const box = { containerType: 'inline-size', aspectRatio: '3 / 4', animation: fresh ? 'pop 700ms var(--ease-out) both' : undefined } as CSSProperties
  if (!onFlip || !mint) return <div role="img" aria-label={label} className={`pstamp ${className}`} style={box}>{front}</div>
  return (
    <div className={`pstamp flip ${flip ? 'is-back' : ''} ${className}`} style={box}>
      <button type="button" className="block w-full h-full cursor-pointer text-left" aria-pressed={flip} aria-label={`${label}. Press to see the mint proof.`} onClick={() => setFlip(!flip)}>
        <span className="flip-in block"><span className="face-front block">{front}</span><span className="face-back block"><Proof name={name} id={k} mint={mint} owner={owner} /></span></span>
      </button>
    </div>
  )
}
export function Proof({ name, mint, owner, token }: { name: string; id?: string; mint: Mint; owner?: string; token?: number }) {
  const rows: [string, string][] = [['Edition', `No ${String(mint.edition).padStart(3, '0')}`], ['Block', mint.block.toLocaleString('en-US')], ['Minted', dateUtc(mint.time)], ['Owner', owner ? short(owner) : '']]
  if (token) rows.unshift(['Token', `#${token}`])
  return (
    <span className="block w-full h-full panel" style={{ padding: '7cqw', fontSize: '5cqw', borderRadius: '9cqw' }}>
      <b className="block" style={{ fontSize: '6.4cqw' }}>Mint proof</b>
      <span className="block text-muted" style={{ marginBottom: '3cqw' }}>{name}</span>
      {rows.map(([a, b]) => <span key={a} className="flex justify-between border-b border-rule" style={{ padding: '2.4cqw 0' }}><span className="text-muted">{a}</span><span className="mono" style={{ fontSize: '4.4cqw' }}>{b}</span></span>)}
      <span className="block text-muted" style={{ marginTop: '4cqw', fontSize: '4.2cqw', lineHeight: 1.35 }}>Soulbound: can't be sold or sent. The block and time are stored in the contract; anyone can match them on BscScan once the contract is live.</span>
    </span>
  )
}
export function Ticket({ tier, code, className = '', style }: { tier: Tier; code?: string; className?: string; style?: CSSProperties }) {
  const k = tier.toLowerCase() as 'common', src = img('ticket-' + k)
  return (
    <div role="img" aria-label={`${tier} sticker voucher. Good for one sticker.`} className={`relative ${tier === 'Legendary' ? 'sheen' : ''} ${className}`} style={{ containerType: 'inline-size', aspectRatio: String(assets.tickets[k].ar), '--mask': `url(${src})`, ...style } as CSSProperties}>
      <img src={src} alt="" className="w-full h-full block" loading="lazy" draggable={false} />
      <span className="absolute" style={{ left: '11%', right: '11%', top: '75%', color: '#0F1226' }}>
        <span className="led block" style={{ fontSize: '8.4cqw', whiteSpace: 'nowrap' }}>Sticker voucher</span>
        <span className="flex justify-between items-baseline" style={{ marginTop: '1cqw' }}><b style={{ fontSize: '6.6cqw' }}>{tier}</b><span style={{ fontSize: '4.6cqw' }}>{code}</span></span>
        <span className="block" style={{ fontSize: '4.6cqw', color: '#3d4260' }}>Good for one sticker</span>
      </span>
    </div>
  )
}
export function Founder({ k, className = '', dim }: { k: string; className?: string; dim?: boolean }) {
  return <img src={img(k)} alt="" draggable={false} loading="lazy" className={className} style={{ filter: dim ? 'grayscale(1) brightness(0.32)' : 'drop-shadow(0 10px 18px #0008)' }} />
}

/* Avatar ring: drawn from the wallet address. Nobody uploads anything. */
function hash(a: string) { let h = 2166136261; const out: number[] = []; for (let r = 0; r < 8; r++) { for (const c of a.toLowerCase() + r) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } out.push((h >>> 8) & 255) } return out }
const AE: [number, number][][] = [[[0, -1], [0, 0]], [[-1, 0], [0, -1], [1, 0]], [[-1, -1], [0, 0], [1, -1]], [[0, -1], [-1, 0], [1, 0], [0, 1]], [[-1, 0], [0, 0], [1, 0]], [[0, 0], [1, 0], [0, -1], [1, -1]]]
const AM: [number, number][][] = [[[4, 5], [5, 6], [6, 5]], [[3, 5], [4, 6], [5, 6], [6, 6], [7, 5]], [[4, 5], [5, 5], [6, 5]], [[4, 5], [5, 5], [6, 5], [5, 6]], [[5, 5]]]
export function Avatar({ address, score, level, overdue, size = 96, mini }: { address: string; score: number; level: number; overdue?: boolean; size?: number; mini?: boolean }) {
  const g = useMemo(() => {
    const h = hash(address), on = new Set<string>()
    const eye = AE[h[0] % AE.length], wink = h[2] % 7 === 0
    eye.forEach(([x, y]) => on.add(`${3 + x},${2 + y}`)); (wink ? AE[4] : eye).forEach(([x, y]) => on.add(`${7 + x},${2 + y}`)); AM[h[1] % AM.length].forEach(([x, y]) => on.add(`${x},${y}`))
    return { on, blush: h[3] % 3 === 0, d1: rosette(50, 50, 31.5, 4.5, 6 + (h[4] % 6), 14, (h[6] / 255) * 6.28, 1, 120), d2: rosette(50, 50, 37.2, 1.6, 9 + (h[5] % 7), 8, 0, 1, 120) }
  }, [address])
  const lit = Math.round((score / 100) * 64)
  const col = (i: number) => (overdue && i >= lit - 6 ? '#FF6B57' : level === 1 ? '#8C96FF' : level === 2 ? '#FFB23F' : `hsl(${220 + i * 5.6} 90% 76%)`)
  return (
    <svg role="img" aria-label={`Avatar drawn from the address. Trust Score ${score} of 100, level ${level}${overdue ? ', has an overdue IOU' : ''}.`} viewBox="0 0 100 100" width={size} height={size} className="shrink-0">
      {!mini && <><path d={g.d1} stroke="#8C96FF" strokeOpacity="0.45" strokeWidth="0.35" fill="none" /><path d={g.d2} stroke="#FFB23F" strokeOpacity="0.35" strokeWidth="0.35" fill="none" /></>}
      {mini ? <circle cx="50" cy="50" r="45" fill="none" stroke={overdue ? '#FF6B57' : level === 1 ? '#8C96FF' : level === 2 ? '#FFB23F' : '#F2A7E0'} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(score / 100) * 283} 283`} transform="rotate(-90 50 50)" />
        : Array.from({ length: 64 }, (_, i) => { const a = (i / 64) * 2 * Math.PI - Math.PI / 2; return <circle key={i} cx={50 + 43.5 * Math.cos(a)} cy={50 + 43.5 * Math.sin(a)} r={1.35} fill={i < lit ? col(i) : '#2C3156'} /> })}
      <rect x={mini ? 12 : 24} y={mini ? 22 : 31} width={mini ? 76 : 52} height={mini ? 56 : 38} rx={mini ? 20 : 13} fill="#06070F" stroke="#2C3156" strokeWidth="0.6" />
      <g transform={mini ? 'translate(50 50) scale(1.75) translate(-50 -50)' : undefined}>
        {Array.from({ length: 77 }, (_, n) => { const i = n % 11, j = Math.floor(n / 11), o = g.on.has(`${i},${j}`); return (o || !mini) && <circle key={n} cx={50 + (i - 5) * 4} cy={50 + (j - 3) * 4} r={o ? (mini ? 1.9 : 1.35) : 0.8} fill={o ? '#FFB23F' : '#40342299'} /> })}
        {g.blush && !mini && <><circle cx="33" cy="58" r="2.2" fill="#FF6B57" opacity="0.55" /><circle cx="67" cy="58" r="2.2" fill="#FF6B57" opacity="0.55" /></>}
      </g>
      {!mini && <g><rect x="33" y="84" width="34" height="14" rx="7" fill="#0E1024" stroke={overdue ? '#FF6B57' : '#2C3156'} /><text x="50" y="94.6" textAnchor="middle" fontFamily="Doto" fontWeight="800" fontSize="10.5" fill={overdue ? '#FF6B57' : '#F0F1F7'}>L{level}</text></g>}
    </svg>
  )
}
export const PaidStamp = ({ text = 'Paid', className = 'text-leaf' }: { text?: string; className?: string }) => <span className={`stamp ${className}`}>{text}</span>
export { dateShort }

/* Badges: the approved drawings (gold seal, laurel and winged shields) */
export function Badge({ name, size = 52, dim }: { name: string; size?: number; dim?: boolean }) {
  const b = (badgeArt as Record<string, { vb: string; svg: string }>)[name]
  if (!b) return null
  const src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.vb}">${b.svg}</svg>`)}`
  return <img src={src} width={size} height={size} alt={`${name} badge${dim ? ', not yet' : ''}`} draggable={false} className="shrink-0" style={{ filter: dim ? 'grayscale(1) opacity(0.5)' : 'drop-shadow(0 4px 8px #0008)' }} />
}
/* Promise Mart logo: an awning whose scallops spell an M */
export function MartLogo({ size = 48 }: { size?: number }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden className="shrink-0">
      <defs><linearGradient id="mart-h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9FA8FF" /><stop offset="0.55" stopColor="#F2A7E0" /><stop offset="1" stopColor="#FFC46B" /></linearGradient></defs>
      <rect x="12" y="20" width="96" height="12" rx="6" fill="#F0F1F7" /><path d="M14 32h23v34a11.5 11.5 0 0 1-23 0z" fill="url(#mart-h)" /><path d="M37 32h23v20a11.5 11.5 0 0 1-23 0z" fill="#F0F1F7" /><path d="M60 32h23v20a11.5 11.5 0 0 1-23 0z" fill="url(#mart-h)" /><path d="M83 32h23v34a11.5 11.5 0 0 1-23 0z" fill="#F0F1F7" /><rect x="14" y="92" width="92" height="8" rx="4" fill="#FFB23F" />
    </svg>
  )
}

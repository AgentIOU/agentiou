import { soundOn } from './prefs'

// Every sound is made in the browser with the Web Audio API: no audio files. Off until the visitor turns it on.
let ctx: AudioContext | null = null
function ac() { if (!ctx) { try { ctx = new AudioContext() } catch { return null } } if (ctx.state === 'suspended') void ctx.resume(); return ctx }
function tone(f: number, t0: number, d: number, type: OscillatorType = 'sine', g = 0.3, f2?: number) {
  const c = ac(); if (!c) return
  const o = c.createOscillator(), a = c.createGain(), t = c.currentTime + t0
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d)
  a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(g * 0.3, t + 0.008); a.gain.exponentialRampToValueAtTime(0.0001, t + d)
  o.connect(a).connect(c.destination); o.start(t); o.stop(t + d + 0.02)
}
function noise(t0: number, d: number, g = 0.2, hp = 800) {
  const c = ac(); if (!c) return
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * d), c.sampleRate), ch = b.getChannelData(0)
  for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length)
  const s = c.createBufferSource(), f = c.createBiquadFilter(), a = c.createGain()
  f.type = 'highpass'; f.frequency.value = hp; a.gain.value = g * 0.3; s.buffer = b
  s.connect(f).connect(a).connect(c.destination); s.start(c.currentTime + t0)
}
const S = {
  tick: () => tone(2400, 0, 0.04, 'square', 0.08),
  copy: () => tone(1200, 0, 0.06, 'triangle', 0.3),
  swish: () => noise(0, 0.2, 0.25, 1800),
  stamp: () => { tone(110, 0, 0.25, 'sine', 0.9, 55); noise(0, 0.12, 0.3, 400) },
  chime: () => { tone(660, 0, 0.22, 'sine', 0.4); tone(990, 0.16, 0.3, 'sine', 0.4) },
  levelup: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.14, 0.5, 'sine', 0.35)); noise(0.5, 0.6, 0.06, 6000) },
  error: () => { tone(196, 0, 0.11, 'sine', 0.5); tone(165, 0.13, 0.12, 'sine', 0.5) },
  on: () => tone(880, 0, 0.08, 'sine', 0.4),
  print: () => [0, 0.2, 0.4].forEach((t) => tone(1800, t, 0.03, 'square', 0.1)),
  tear: () => noise(0, 0.35, 0.3, 2500),
  pop: () => tone(520, 0, 0.09, 'sine', 0.5, 880),
}
export type Sound = keyof typeof S
export function play(name: Sound, force = false) { if (soundOn || force) S[name]() }

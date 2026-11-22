import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

// Only an address and settings are ever kept on the device. No cookies, no account.
function read<T>(k: string, d: T): T { try { const v = localStorage.getItem('agentiou.' + k); return v == null ? d : (JSON.parse(v) as T) } catch { return d } }
function write(k: string, v: unknown) { try { localStorage.setItem('agentiou.' + k, JSON.stringify(v)) } catch { /* storage may be unavailable */ } }

interface Prefs { sound: boolean; reduce: boolean; motionOff: boolean; set: (p: Partial<Pick<Prefs, 'sound' | 'reduce'>>) => void }
const Ctx = createContext<Prefs>(null as unknown as Prefs)
export const usePrefs = () => useContext(Ctx)
export let soundOn = false

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState(() => ({ sound: read('sound', false), reduce: read('reduce', false) }))
  const [sys, setSys] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => { const m = matchMedia('(prefers-reduced-motion: reduce)'); const f = () => setSys(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f) }, [])
  const motionOff = s.reduce || sys
  useEffect(() => { document.documentElement.classList.toggle('motion-off', motionOff) }, [motionOff])
  soundOn = s.sound
  const v = useMemo<Prefs>(() => ({ ...s, motionOff, set: (p) => setS((o) => { const n = { ...o, ...p }; (Object.keys(p) as (keyof typeof p)[]).forEach((k) => write(k, n[k])); return n }) }), [s, motionOff])
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>
}

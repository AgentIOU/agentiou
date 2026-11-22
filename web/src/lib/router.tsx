import { useEffect, useState, type AnchorHTMLAttributes } from 'react'

// One router, two address styles: real paths on the public site (/tasks, /u/0x…),
// plain #names inside the preview (#tasks, #u-0x…), because a preview frame only passes a plain hash.
const HASH = import.meta.env.VITE_ROUTER === 'hash'
export const ROUTES = ['home', 'start', 'me', 'mart', 'tasks', 'new', 'board', 'proof', 'about', 'legal', 'u'] as const
export type RouteName = (typeof ROUTES)[number] | 'notfound'
export interface Route { name: RouteName; param?: string }

function parse(): Route {
  let s = HASH ? location.hash.replace(/^#/, '') : location.pathname.replace(/^\/+|\/+$/g, '')
  if (!s || s === 'home') return { name: 'home' }
  const m = s.match(HASH ? /^u-(.+)$/ : /^u\/(.+)$/)
  if (m) return { name: 'u', param: m[1] }
  return (ROUTES as readonly string[]).includes(s) && s !== 'u' ? { name: s as RouteName } : { name: 'notfound' }
}
export function href(name: RouteName, param?: string) {
  const p = name === 'home' ? '' : name === 'u' ? (HASH ? `u-${param}` : `u/${param}`) : name
  return HASH ? `#${p || 'home'}` : `/${p}`
}
let pendingScroll: string | undefined
export function go(name: RouteName, param?: string, scrollTo?: string) {
  pendingScroll = scrollTo
  const h = href(name, param)
  if (HASH) { if (location.hash === h) window.dispatchEvent(new Event('hashchange')); else location.hash = h }
  else { if (location.pathname !== h) history.pushState(null, '', h); window.dispatchEvent(new Event('popstate')) }
}
// After a page change: go to the section a link asked for, or to the top. This runs once per change (not once per component
// that reads the route), and it waits for the new page to be on screen, so a link to a section works from any other page.
function afterNav() {
  const id = pendingScroll; pendingScroll = undefined; let tries = 0
  const look = () => {
    const el = id ? document.getElementById(id) : null
    if (el) {
      // the page above the section keeps growing for a moment (pictures, the pinned story), so line it up again a few times,
      // and stop at once if the visitor starts scrolling themselves
      let mine = true; const stop = () => { mine = false }
      for (const ev of ['wheel', 'touchstart', 'keydown'] as const) window.addEventListener(ev, stop, { once: true, passive: true })
      for (const ms of [0, 150, 350, 700, 1200, 1800]) setTimeout(() => { if (mine && el.isConnected) el.scrollIntoView({ block: 'start' }) }, ms)
    }
    else if (id && tries++ < 40) requestAnimationFrame(look)
    else window.scrollTo(0, 0)
  }
  requestAnimationFrame(look)
}
if (typeof window !== 'undefined') { window.addEventListener('hashchange', afterNav); window.addEventListener('popstate', afterNav) }
export function useRoute(): Route {
  const [r, setR] = useState(parse)
  useEffect(() => {
    const on = () => setR(parse())
    window.addEventListener('hashchange', on); window.addEventListener('popstate', on)
    return () => { window.removeEventListener('hashchange', on); window.removeEventListener('popstate', on) }
  }, [])
  return r
}
export function Link({ to, param, scrollTo, onClick, ...p }: { to: RouteName; param?: string; scrollTo?: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...p} href={href(to, param)} onClick={(e) => { onClick?.(e); if (e.metaKey || e.ctrlKey) return; e.preventDefault(); go(to, param, scrollTo) }} />
}

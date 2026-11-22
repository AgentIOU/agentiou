import { useEffect, useState, type AnchorHTMLAttributes } from 'react'

// One router, two address styles: real paths on the public site (/tasks, /u/0x…),
// plain #names inside the preview (#tasks, #u-0x…), because a preview frame only passes a plain hash.
const HASH = import.meta.env.VITE_ROUTER === 'hash'
export const ROUTES = ['home', 'start', 'me', 'mart', 'tasks', 'new', 'board', 'proof', 'judges', 'legal', 'u'] as const
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
export function useRoute(): Route {
  const [r, setR] = useState(parse)
  useEffect(() => {
    const on = () => {
      setR(parse())
      const id = pendingScroll; pendingScroll = undefined
      requestAnimationFrame(() => { const el = id && document.getElementById(id); if (el) el.scrollIntoView({ block: 'start' }); else window.scrollTo(0, 0) })
    }
    window.addEventListener('hashchange', on); window.addEventListener('popstate', on)
    return () => { window.removeEventListener('hashchange', on); window.removeEventListener('popstate', on) }
  }, [])
  return r
}
export function Link({ to, param, scrollTo, onClick, ...p }: { to: RouteName; param?: string; scrollTo?: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...p} href={href(to, param)} onClick={(e) => { onClick?.(e); if (e.metaKey || e.ctrlKey) return; e.preventDefault(); go(to, param, scrollTo) }} />
}

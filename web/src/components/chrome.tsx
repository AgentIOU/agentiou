import { useEffect, useState } from 'react'
import { ArrowUpRight, Home, ShoppingBag, ListChecks, BookOpen, User as UserIcon, Volume2, VolumeX } from 'lucide-react'
import { Link, type RouteName } from '../lib/router'
import { usePrefs } from '../lib/prefs'
import { play } from '../lib/sound'
import { useStore } from '../lib/store'
import { DEMO, ME, claimable, levelOf, score } from '../lib/data'
import { Avatar, Logo } from './art'

export function Header({ route }: { route: RouteName }) {
  const { sound, set } = usePrefs(); const { me, hasOverdue, joined } = useStore()
  const [top, setTop] = useState(true); const [hide, setHide] = useState(false)
  useEffect(() => { let y = scrollY; const f = () => { const n = scrollY; setTop(n < 24); setHide(n > 160 && n > y + 4 ? true : n < y - 4 ? false : (h) => h); y = n }; addEventListener('scroll', f, { passive: true }); return () => removeEventListener('scroll', f) }, [])
  const dot = claimable(me).some((n) => n > 0)
  const nav = 'text-[15px] font-semibold text-muted hover:text-chalk px-3 py-2 rounded-lg aria-[current=page]:text-chalk'
  return (
    <header className="fixed top-0 inset-x-0 z-50 h-16 transition-[transform,background] duration-200" style={{ transform: hide ? 'translateY(-100%)' : 'none', background: top && route === 'home' ? 'transparent' : '#0E1024F2', borderBottom: top ? '1px solid transparent' : '1px solid #2C3156' }}>
      <div className="wrap h-full flex items-center gap-2">
        <Link to="home" aria-label="AgentIOU home" className="mr-auto lg:mr-6"><Logo /></Link>
        <nav aria-label="Main" className="hidden lg:flex items-center mr-auto">
          <Link to="home" scrollTo="how" className={nav}>How it works</Link>
          <Link to="mart" className={nav} aria-current={route === 'mart' ? 'page' : undefined}>Promise Mart</Link>
          <Link to="tasks" className={nav + ' relative'} aria-current={route === 'tasks' ? 'page' : undefined}>Task Hub{dot && <i className="absolute top-2 right-0.5 w-2 h-2 rounded-full bg-amber" title="A voucher is ready to claim" />}</Link>
          <Link to="proof" className={nav} aria-current={route === 'proof' ? 'page' : undefined}>Proof &amp; Safety</Link>
          <Link to="home" scrollTo="faq" className={nav + ' hidden xl:block'}>FAQ</Link>
          <Link to="me" className={nav} aria-current={route === 'me' ? 'page' : undefined}>My IOUs</Link>
        </nav>
        <button type="button" aria-pressed={sound} aria-label={sound ? 'Turn sound off' : 'Turn sound on'} onClick={() => { set({ sound: !sound }); if (!sound) play('on', true) }} className="w-11 h-11 inline-flex items-center justify-center rounded-full text-muted hover:text-chalk cursor-pointer">{sound ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
        {joined ? <Link to="u" param={ME} aria-label={`Profile: ${me.nickname}`} title="Profile" aria-current={route === 'u' ? 'page' : undefined} className="inline-flex items-center gap-2 rounded-full border border-rule pl-1 pr-1 sm:pr-3 h-11 font-semibold text-[15px] hover:bg-ledger aria-[current=page]:border-amber"><Avatar address={ME} score={score(me)} level={levelOf(me)} overdue={hasOverdue(ME)} size={34} mini /><span className="hidden sm:inline">{me.nickname}</span></Link>
          : <Link to="start" className="btn btn-primary btn-sm md:min-h-[44px] md:px-5 md:text-[16px]">Get IOU Verified</Link>}
      </div>
    </header>
  )
}
const TABS: [RouteName, string, typeof Home, string?][] = [['home', 'Home', Home], ['mart', 'Mart', ShoppingBag], ['tasks', 'Tasks', ListChecks], ['me', 'My IOUs', BookOpen], ['u', 'Profile', UserIcon, ME]]
export function TabBar({ route }: { route: RouteName }) {
  const { me } = useStore(); const dot = claimable(me).some((n) => n > 0)
  return (
    <nav aria-label="App" className="lg:hidden fixed bottom-0 inset-x-0 z-50 h-16 frost border-x-0 border-b-0 grid grid-cols-5" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {TABS.map(([to, label, I, param]) => <Link key={label} to={to} param={param} aria-current={route === to ? 'page' : undefined} className="relative flex flex-col items-center justify-center gap-0.5 text-[12px] font-semibold text-muted aria-[current=page]:text-amber"><I size={20} aria-hidden />{label}{to === 'tasks' && dot && <i className="absolute top-2 left-[58%] w-2 h-2 rounded-full bg-amber" />}</Link>)}
    </nav>
  )
}
export function Footer() {
  const { motionOff } = usePrefs()
  const l = 'text-muted hover:text-chalk hover:underline underline-offset-4'
  return (
    <footer className="relative border-t border-rule mt-10 pb-24 lg:pb-10 bg-ink">
      <div className="wrap pt-10 grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div><Logo /><p className="text-muted mt-3 text-[13px] max-w-[44ch]">Independent project, not affiliated with Binance. Not financial advice.</p><p className="text-muted mt-2 text-[13px]">XP has no cash value. Vouchers and stickers can't be sold or transferred.</p></div>
        <nav aria-label="Pages" className="grid gap-2 content-start"><Link to="start" className={l}>Get IOU Verified</Link><Link to="mart" className={l}>Promise Mart</Link><Link to="tasks" className={l}>Task Hub</Link><Link to="new" className={l}>New IOU</Link><Link to="board" className={l}>Leaderboard</Link></nav>
        <nav aria-label="Trust" className="grid gap-2 content-start"><Link to="proof" className={l}>Proof &amp; Safety</Link><Link to="judges" className={l}>For judges</Link><Link to="legal" className={l}>Terms, privacy and risks</Link><span className="text-muted text-[14px]">GitHub, BscScan and X links go here at launch.</span></nav>
      </div>
      <div className="wrap mt-8 pt-6 border-t border-rule flex flex-wrap items-center gap-x-6 gap-y-3 text-[14px] text-muted">
        <span className="inline-flex items-center gap-2"><i className={`w-2.5 h-2.5 rounded-full ${DEMO ? 'bg-iris' : 'bg-leaf'}`} aria-hidden />{DEMO ? 'Demo data: not reading BNB Smart Chain yet' : 'Reading BNB Smart Chain'}</span>
        {motionOff && <span>Motion is reduced</span>}
        <a href="https://x.com/AgentIOU" target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-2 min-h-[44px] hover:text-chalk hover:underline underline-offset-4"><ArrowUpRight size={16} aria-hidden />@AgentIOU on X</a>
        <span>A TUKU project</span>
      </div>
    </footer>
  )
}

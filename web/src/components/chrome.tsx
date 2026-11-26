import { useEffect, useState } from 'react'
import { Home, ShoppingBag, Building2, BookOpen, Volume2, VolumeX } from 'lucide-react'
import { Link, go, href, type RouteName } from '../lib/router'
import { usePrefs } from '../lib/prefs'
import { play } from '../lib/sound'
import { useStore } from '../lib/store'
import { CONTRACT, DEMO, ME, claimable, levelOf, score, styleOf } from '../lib/data'
import { Avatar, Logo } from './art'
import { img } from './fx'

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
          <Link to="trust" className={nav} aria-current={route === 'trust' ? 'page' : undefined}>Open Trust</Link>
          <Link to="home" scrollTo="faq" className={nav + ' hidden xl:block'}>FAQ</Link>
          <Link to="me" className={nav} aria-current={route === 'me' ? 'page' : undefined}>My IOUs</Link>
        </nav>
        <button type="button" aria-pressed={sound} aria-label={sound ? 'Turn sound off' : 'Turn sound on'} onClick={() => { set({ sound: !sound }); if (!sound) play('on', true) }} className="w-11 h-11 inline-flex items-center justify-center rounded-full text-muted hover:text-chalk cursor-pointer">{sound ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
        {joined ? <ProfileChip route={route} />
          : <Link to="start" className="btn btn-primary btn-sm md:min-h-[44px] md:px-5 md:text-[16px]">Get IOU Verified</Link>}
      </div>
    </header>
  )
}
/* The corner button: only the mascot until it is pressed. A press opens it to show the name, then goes to My IOUs.
   It stays open while that page is showing. An amber dot means something waits in the Inbox; who sent it is on the page itself. */
function ProfileChip({ route }: { route: RouteName }) {
  const { me, ious, hasOverdue } = useStore(); const { motionOff } = usePrefs()
  const [open, setOpen] = useState(false)
  const here = route === 'me', wide = here || open
  const waiting = ious.filter((x) => x.status === 'Pending' && x.debtor === ME).length
  useEffect(() => { if (!open) return; const t = setTimeout(() => { go('me'); setOpen(false) }, motionOff ? 0 : 420); return () => clearTimeout(t) }, [open, motionOff])
  return (
    <a href={href('me')} aria-label={`My profile: ${me.nickname}${waiting ? `. ${waiting} waiting in your Inbox` : ''}`} title="My profile" aria-current={here ? 'page' : undefined} data-open={wide || undefined}
      onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); if (!here) setOpen(true) }} className="chip-me">
      <Avatar address={ME} score={score(me)} level={levelOf(me)} style={styleOf(me)} overdue={hasOverdue(ME)} size={40} mini />
      <span className="chip-me-text" aria-hidden><span className="block text-[10.5px] font-bold text-muted leading-tight">My profile</span><b className="block text-[14px] leading-tight truncate max-w-[110px]">{me.nickname}</b></span>
      {waiting > 0 && <i className="absolute -right-0.5 -top-0.5 w-3 h-3 rounded-full bg-amber" style={{ boxShadow: '0 0 0 2.5px #0E1024' }} aria-hidden />}
    </a>
  )
}
const TABS: [RouteName, string, typeof Home][] = [['home', 'Home', Home], ['mart', 'Mart', ShoppingBag], ['tasks', 'Town', Building2], ['me', 'My IOUs', BookOpen]]
export function TabBar({ route }: { route: RouteName }) {
  const { me, ious, joined } = useStore(); const dot = joined && claimable(me).some((n) => n > 0), waiting = joined && ious.some((x) => x.status === 'Pending' && x.debtor === ME)   // a guest has nothing waiting
  return (
    <nav aria-label="App" className="lg:hidden fixed z-50 inset-x-2.5 dock" style={{ bottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
      {TABS.map(([to, label, I]) => { const on = route === to, mark = (to === 'tasks' && dot) || (to === 'me' && waiting)
        return <Link key={label} to={to} aria-current={on ? 'page' : undefined} className={on ? 'dock-on' : 'dock-off'}><span className="relative"><I size={on ? 21 : 22} strokeWidth={on ? 2.3 : 2} aria-hidden />{mark && !on && <i className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-amber" style={{ boxShadow: '0 0 0 2px #1B1E45' }} aria-hidden />}</span>{label}{mark && on && <i className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber" style={{ boxShadow: '0 0 0 2.5px #1B1E45' }} aria-hidden />}{mark && <span className="sr-only">{to === 'me' ? ', something waits in your Inbox' : ', a voucher is ready'}</span>}</Link> })}
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
        <nav aria-label="Pages" className="grid gap-2 content-start"><Link to="start" className={l}>Get IOU Verified</Link><Link to="mart" className={l}>Promise Mart</Link><Link to="tasks" className={l}>Task Hub</Link><Link to="new" className={l}>New IOU</Link><Link to="board" className={l}>Leaderboard</Link><Link to="trust" className={l}>Open Trust: Trust Check for DeFi &amp; CEX</Link><Link to="home" scrollTo="faq" className={l}>FAQs</Link></nav>
        <nav aria-label="Trust" className="grid gap-2 content-start"><Link to="proof" className={l}>Proof &amp; Safety</Link><Link to="about" className={l}>About AgentIOU</Link><Link to="legal" className={l}>Terms, privacy and risks</Link><a href="https://github.com/AgentIOU/agentiou" target="_blank" rel="noopener noreferrer" className={l}>Source code on GitHub</a>{CONTRACT ? <a href={`https://bscscan.com/address/${CONTRACT}#code`} target="_blank" rel="noopener noreferrer" className={l}>Contract on BscScan</a> : <span className="text-muted text-[14px]">The BscScan link appears here when the contract is deployed.</span>}</nav>
      </div>
      <div className="wrap mt-8 pt-6 border-t border-rule flex flex-wrap items-center gap-x-6 gap-y-3 text-[14px] text-muted">
        <span className="inline-flex items-center gap-2"><i className={`w-2.5 h-2.5 rounded-full ${DEMO ? 'bg-iris' : 'bg-leaf'}`} aria-hidden />{DEMO ? 'Demo data: not reading BNB Smart Chain yet' : 'Reading BNB Smart Chain'}</span>
        {motionOff && <span>Motion is reduced</span>}
        <span className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-3">
          <a href="https://x.com/AgentIOU" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2.5 min-h-[44px] pl-3 pr-5 rounded-full border border-rule bg-ledger/60 text-chalk font-semibold hover:border-muted hover:bg-ledger"><img src={img('x-mark')} alt="" width={26} height={26} className="rounded-full" />Follow @AgentIOU on X</a>
          <span className="inline-flex items-center gap-3 text-[12px] font-semibold tracking-[0.2em]"><i className="w-6 h-px bg-rule" aria-hidden />A TUKU PROJECT</span>
        </span>
      </div>
    </footer>
  )
}

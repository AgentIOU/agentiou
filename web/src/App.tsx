import { useEffect } from 'react'
import { useRoute } from './lib/router'
import { PrefsProvider } from './lib/prefs'
import { StoreProvider, useStore } from './lib/store'
import { DEMO, HAS_ME, LEVELS, ME } from './lib/data'
import { Link } from './lib/router'
import { Mascot } from './components/fx'
import { Eye } from 'lucide-react'
import { play } from './lib/sound'
import { Sky } from './components/fx'
import { ArtDefs } from './components/art'
import { Footer, Header, TabBar } from './components/chrome'
import { Toasts, Tray } from './components/ui'
import Home from './pages/Home'
import Mart from './pages/Mart'
import Tasks from './pages/Tasks'
import { Me, Public } from './pages/Profile'
import { Board, About, Legal, NewIou, NotFound, ProofPage, Start } from './pages/More'
import TrustPage from './pages/Trust'

const TITLES: Record<string, string> = { home: "AgentIOU: pay later, can't disappear", start: 'Get IOU Verified', me: 'My IOUs', mart: 'Promise Mart', tasks: 'Task Hub', new: 'New IOU', board: 'Leaderboard', proof: 'Proof & Safety', about: 'About AgentIOU', legal: 'Terms, privacy and risks', trust: 'Open Trust', u: 'Profile', notfound: 'Page not found' }
function Shell() {
  const r = useRoute(); const { last, toast, joined, loaded, chainDown } = useStore()
  // live: My IOUs, New IOU and my own profile exist only once this device's address has joined
  const needMe = loaded && !joined && (r.name === 'me' || r.name === 'new' || (r.name === 'u' && (r.param ?? '').toLowerCase() === ME.toLowerCase()))
  useEffect(() => { document.title = r.name === 'home' ? TITLES.home : `${TITLES[r.name]} | AgentIOU` }, [r.name])
  useEffect(() => { if (last.levelUp) { toast(`Level up. You are now L${last.levelUp} ${LEVELS[last.levelUp - 1].name} with a $${LEVELS[last.levelUp - 1].limit} limit.`); play('levelup') } }, [last.levelUp, toast])
  useEffect(() => { if (last.badge) toast(`New badge: ${last.badge}`) }, [last.badge, toast])
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:z-[80] focus:top-3 focus:left-3 btn btn-secondary bg-ink" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }}>Skip to content</a>
      <ArtDefs /><Sky /><Header route={r.name} />
      <main id="main" tabIndex={-1} className="relative z-[1] min-h-[80vh] outline-none">
        {!DEMO && chainDown && <p role="status" className="wrap pt-20 -mb-16 text-coral text-[14px] font-semibold">Can't reach BNB Smart Chain right now. Numbers may be out of date; the site keeps trying.</p>}
        {loaded && !joined && r.name !== 'start' && !needMe && <p role="note" className="wrap pt-[76px] -mb-[60px] relative z-[2]"><span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-rule bg-ledger/90 px-3.5 py-2 text-[14px]"><span className="pill pill-muted"><Eye size={14} aria-hidden />Guest</span><span className="text-muted">You can look at everything. Actions switch on once you get IOU Verified.</span><Link to="start" className="font-semibold underline underline-offset-4">Get IOU Verified</Link><Link to="home" scrollTo="faq" className="font-semibold underline underline-offset-4">FAQs</Link></span></p>}
        {needMe ? <div className="wrap pt-32 pb-24 flex flex-wrap items-center gap-8"><Mascot pose="wave" className="w-40" /><div><h1 className="h2">Get IOU Verified first</h1><p className="lead mt-3">{DEMO ? 'You are browsing as a guest. Your own IOUs and profile appear here once you join.' : HAS_ME ? 'This address has not joined AgentIOU yet. Joining takes one transaction.' : 'Your IOUs and profile appear here once you are IOU Verified. Five short steps, no wallet connection and no key.'}</p><Link to="start" className="btn btn-primary mt-6">Get IOU Verified</Link></div></div>
          : r.name === 'home' ? <Home /> : r.name === 'start' ? <Start /> : r.name === 'me' ? <Me /> : r.name === 'mart' ? <Mart /> : r.name === 'tasks' ? <Tasks /> : r.name === 'new' ? <NewIou /> : r.name === 'board' ? <Board /> : r.name === 'proof' ? <ProofPage /> : r.name === 'about' ? <About /> : r.name === 'legal' ? <Legal /> : r.name === 'trust' ? <TrustPage /> : r.name === 'u' ? <Public address={r.param ?? ''} /> : <NotFound />}
      </main>
      <div className="relative z-[1]"><Footer /></div>
      <TabBar route={r.name} /><Tray /><Toasts />
      {import.meta.env.VITE_PREVIEW_SWITCH === '1' && DEMO && <div role="group" aria-label="Preview as" className="fixed z-[55] left-2 bottom-[92px] inline-flex items-center p-0.5 rounded-full text-[11px] font-bold opacity-90" style={{ background: '#0E1024F2', boxShadow: 'inset 0 0 0 1px #FFB23F' }}>{([['Guest', false], ['Member', true]] as const).map(([t, m]) => <button key={t} type="button" aria-pressed={joined === m} onClick={() => dispatchEvent(new CustomEvent('agentiou-preview', { detail: m }))} className={`h-6 px-2 rounded-full cursor-pointer ${joined === m ? 'text-[#1E1B4B]' : 'text-muted'}`} style={joined === m ? { background: 'var(--holo)' } : undefined}>{t}</button>)}</div>}
    </>
  )
}
export default function App() { return <PrefsProvider><StoreProvider><Shell /></StoreProvider></PrefsProvider> }

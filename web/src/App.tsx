import { useEffect } from 'react'
import { useRoute } from './lib/router'
import { PrefsProvider } from './lib/prefs'
import { StoreProvider, useStore } from './lib/store'
import { LEVELS } from './lib/data'
import { play } from './lib/sound'
import { Sky } from './components/fx'
import { ArtDefs } from './components/art'
import { Footer, Header, TabBar } from './components/chrome'
import { Toasts, Tray } from './components/ui'
import Home from './pages/Home'
import Mart from './pages/Mart'
import Tasks from './pages/Tasks'
import { Me, Public } from './pages/Profile'
import { Board, Judges, Legal, NewIou, NotFound, ProofPage, Start } from './pages/More'

const TITLES: Record<string, string> = { home: "AgentIOU: pay later, can't disappear", start: 'Get IOU Verified', me: 'My IOUs', mart: 'Promise Mart', tasks: 'Task Hub', new: 'New IOU', board: 'Leaderboard', proof: 'Proof & Safety', judges: 'For judges', legal: 'Terms, privacy and risks', u: 'Profile', notfound: 'Page not found' }
function Shell() {
  const r = useRoute(); const { last, toast } = useStore()
  useEffect(() => { document.title = r.name === 'home' ? TITLES.home : `${TITLES[r.name]} | AgentIOU` }, [r.name])
  useEffect(() => { if (last.levelUp) { toast(`Level up. You are now L${last.levelUp} ${LEVELS[last.levelUp - 1].name} with a $${LEVELS[last.levelUp - 1].limit} limit.`); play('levelup') } }, [last.levelUp, toast])
  useEffect(() => { if (last.badge) toast(`New badge: ${last.badge}`) }, [last.badge, toast])
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:z-[80] focus:top-3 focus:left-3 btn btn-secondary bg-ink" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }}>Skip to content</a>
      <ArtDefs /><Sky /><Header route={r.name} />
      <main id="main" tabIndex={-1} className="relative z-[1] min-h-[80vh] outline-none">
        {r.name === 'home' ? <Home /> : r.name === 'start' ? <Start /> : r.name === 'me' ? <Me /> : r.name === 'mart' ? <Mart /> : r.name === 'tasks' ? <Tasks /> : r.name === 'new' ? <NewIou /> : r.name === 'board' ? <Board /> : r.name === 'proof' ? <ProofPage /> : r.name === 'judges' ? <Judges /> : r.name === 'legal' ? <Legal /> : r.name === 'u' ? <Public address={r.param ?? ''} /> : <NotFound />}
      </main>
      <div className="relative z-[1]"><Footer /></div>
      <TabBar route={r.name} /><Tray /><Toasts />
    </>
  )
}
export default function App() { return <PrefsProvider><StoreProvider><Shell /></StoreProvider></PrefsProvider> }

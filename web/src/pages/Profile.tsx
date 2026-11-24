import { useState } from 'react'
import { BADGES, DEMO, saveMe, plain, DESIGNS, LEVELS, ME, SEASON, TIERS, dateShort, dueText, usd, isAddr, levelOf, nickError, score, viewOf, type User } from '../lib/data'
import { useStore } from '../lib/store'
import { useFlows } from '../lib/flows'
import { usePrefs } from '../lib/prefs'
import { Link, go, href } from '../lib/router'
import { Avatar, Badge, Founder, IouCard, Proof, StickerCard, Ticket } from '../components/art'
import { AddressChip, DemoChip, Empty, InfoTip, IouLine, LevelChip, RestrictedTag, Risk, useCopy } from '../components/ui'
import { Mascot } from '../components/fx'
import { Mail, Send, Share2 } from 'lucide-react'

export function ProfileHead({ u, own }: { u: User; own?: boolean }) {
  const s = useStore(); const copy = useCopy(); const lv = levelOf(u), od = s.hasOverdue(u.address)
  return (
    <div className="flex flex-wrap items-center gap-5">
      <Avatar address={u.address} score={score(u)} level={lv} overdue={od} size={128} />
      <div className="mr-auto"><div className="flex flex-wrap items-center gap-3"><h1 className="text-[28px] md:text-[40px]">{u.nickname}</h1>{u.badges['IOU Verified'] && <Badge name="IOU Verified" size={34} />}{s.restricted(u.address) && <RestrictedTag />}{DEMO && <DemoChip />}</div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2"><AddressChip address={u.address} /><LevelChip level={lv} now /><span className="text-muted">Trust Score <b className="led text-chalk text-[20px]">{score(u)}</b> of 100 <InfoTip label="How the Trust Score works">Starts at 50. On-time repay +5, late −10, default −25, each new person you deal with +2 (up to +10). Always between 0 and 100.</InfoTip></span></div>
        <p className="text-muted text-[14px] mt-2">Member No. {String(u.no).padStart(6, '0')}, since {dateShort(u.joinedAt)}</p></div>
      <div className="flex flex-wrap gap-3">
        {own ? (s.whyNotSend() ? <button type="button" className="btn btn-primary" disabled title={s.whyNotSend()}><Send size={16} aria-hidden />Send an IOU to a friend</button> : <Link to="new" className="btn btn-primary"><Send size={16} aria-hidden />Send an IOU to a friend</Link>) : u.address !== ME && <button type="button" className="btn btn-primary" disabled={s.restricted(u.address) || !!s.whyNotSend()} title={s.whyNotSend() || undefined} onClick={() => { s.setDraftTo(u.address); go('new') }}><Send size={16} aria-hidden />Send {u.nickname} an IOU</button>}
        <button type="button" className="btn btn-secondary" onClick={() => copy(new URL(href('u', u.address), location.href).href, 'Profile link copied')}><Share2 size={16} aria-hidden />{own ? 'Share my profile' : 'Share'}</button>
      </div>
    </div>
  )
}
export function Card({ u }: { u: User }) {
  const s = useStore(); const lv = levelOf(u), limit = LEVELS[lv - 1].limit
  return <IouCard nick={u.nickname} address={u.address} no={u.no} level={lv} available={Math.max(0, limit - s.owed(u.address))} limit={limit} demo={DEMO} overdue={s.hasOverdue(u.address)} restricted={s.restricted(u.address)}
    back={[['On-time repays', String(u.onTime)], ['Late', String(u.late)], ['Defaults', String(u.defaults)], ['People dealt with', String(u.people)], ['Member since', new Date(u.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })]]} />
}
export function BadgeBoard({ u }: { u: User }) {
  const [open, setOpen] = useState('')
  return (
    <section aria-labelledby="t-badges"><h2 id="t-badges" className="text-[20px]">Badges</h2>
      {Object.keys(u.badges).length === 0 && <p className="text-muted mt-2">Repay on time to get your first badge.</p>}
      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 max-w-[760px]">{BADGES.map((b) => { const got = u.badges[b.key]; return <li key={b.key}><button type="button" aria-expanded={open === b.key} onClick={() => setOpen(open === b.key ? '' : b.key)} className={`w-full h-full flex flex-col items-center gap-2 rounded-2xl border p-4 cursor-pointer ${got ? 'border-amber/60 bg-ledger' : 'border-dashed border-rule text-muted'}`}><Badge name={b.key} size={76} dim={!got} /><span className="font-semibold text-center">{b.key}</span><span className="text-[13px] text-muted">{got ? dateShort(got) : 'Not yet'}</span></button></li> })}</ul>
      {open && <p className="text-muted mt-3" role="status">{u.badges[open] ? `Got on ${dateShort(u.badges[open])}. ` : 'Not yet. '}{BADGES.find((b) => b.key === open)!.how}</p>}
    </section>
  )
}
export function Shelf({ u }: { u: User }) {
  return (
    <section aria-labelledby="t-stickers"><h2 id="t-stickers" className="text-[20px]">Stickers</h2><p className="text-muted mt-1">Tap a sticker you hold to see its mint proof.</p>
      <h3 className="text-[16px] text-muted font-semibold mt-6">Founders, from Promise Mart</h3>
      <ul className="grid grid-cols-3 gap-4 mt-3 max-w-[560px]">{DESIGNS.filter((d) => d.tier === 'Founders').map((d) => <li key={d.id}><FounderSlot u={u} id={d.id} k={d.key} name={d.name} /></li>)}</ul>
      <h3 className="text-[16px] text-muted font-semibold mt-8">Season 1</h3>
      <ul className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3 mt-3">{SEASON.map((d) => <li key={d.id}><StickerCard k={d.key} name={d.name} tier={d.tier as never} mint={u.stickers[d.id]} owner={u.address} dim={!u.stickers[d.id]} onFlip /></li>)}</ul>
    </section>
  )
}
function FounderSlot({ u, id, k, name }: { u: User; id: number; k: string; name: string }) {
  const m = u.stickers[id]; const [flip, setFlip] = useState(false)
  if (!m) return <div className="text-center"><div className="aspect-square flex items-center justify-center"><Founder k={k} dim className="max-h-full max-w-full" /></div><p className="text-muted text-[14px] mt-1">{name}, not held</p></div>
  return <div className="text-center"><button type="button" aria-pressed={flip} aria-label={`${name}, edition ${m.edition}. Press to see the mint proof.`} onClick={() => setFlip(!flip)} className="block w-full aspect-square cursor-pointer" style={{ containerType: 'inline-size' }}>{flip ? <Proof name={name} mint={m} owner={u.address} token={id} /> : <span className="flex w-full h-full items-center justify-center"><Founder k={k} className="max-h-full max-w-full" /></span>}</button><p className="text-[14px] mt-1 font-semibold">{name} <span className="led text-muted">No {String(m.edition).padStart(3, '0')}</span></p></div>
}
export function Pocket({ u, own }: { u: User; own?: boolean }) {
  const total = u.pocket.reduce((a, b) => a + b, 0)
  return (
    <section aria-labelledby="t-pocket"><h2 id="t-pocket" className="text-[20px]">Vouchers</h2>
      {total === 0 ? <p className="text-muted mt-2">No vouchers in the pocket.{own && <> <Link to="tasks" className="underline underline-offset-4 text-chalk">Claim one in Task Hub</Link>.</>}</p> :
        <ul className="flex flex-wrap gap-5 mt-4">{TIERS.map((t, i) => u.pocket[i] > 0 && <li key={t} className="w-[120px]"><Ticket tier={t} code={`x${u.pocket[i]}`} /></li>)}</ul>}
    </section>
  )
}

export function Me() {
  const s = useStore(), f = useFlows(), p = usePrefs(), me = s.me
  const mine = s.ious.filter((x) => x.debtor === ME || x.creditor === ME)
  const inbox = mine.filter((x) => x.status === 'Pending' && x.debtor === ME)
  const open = mine.filter((x) => x.status === 'Active' || (x.status === 'Pending' && x.creditor === ME)).sort((a, b) => a.dueAt - b.dueAt)
  const past = mine.filter((x) => x.status === 'Repaid' || x.status === 'Declined' || x.status === 'Cancelled').sort((a, b) => (b.repaidAt ?? b.createdAt) - (a.repaidAt ?? a.createdAt))
  const owe = open.filter((x) => x.debtor === ME && x.status === 'Active'), owed = open.filter((x) => x.creditor === ME && x.status === 'Active')
  const [nick, setNick] = useState(me.nickname)
  const bad = nick ? nickError(nick) : 'Use 2 to 20 characters.'
  return (
    <div className="wrap pt-28 pb-16 grid gap-14">
      <ProfileHead u={me} own />
      {s.hasOverdue(ME) && <div className="panel border-coral p-4 flex items-center gap-4"><Mascot pose="rest" expr="worried" className="w-16 shrink-0" /><p>{s.restricted(ME) ? 'Your account is Restricted: you can only repay. Press Repay on the overdue IOUs below and it opens again at once.' : 'You have an IOU past due. Your level is one lower until you repay it. A second one makes the account Restricted.'}</p></div>}
      {s.credit > 0 && <div className="panel p-4 flex flex-wrap items-center justify-between gap-3 border-amber"><p><b className="money">{s.credit} BNB</b> is waiting for you. A repayment could not be delivered to your wallet, so the contract is keeping it under your address.</p><button type="button" className="btn btn-primary btn-sm" onClick={() => f.withdraw(s.credit)}>Collect it</button></div>}
      {DEMO && !s.hasOverdue(ME) && owe.length >= 2 && <div className="panel p-4 flex flex-wrap items-center justify-between gap-3 border-dashed"><p className="max-w-[60ch]"><b>Demo only.</b> Want to see what Restricted looks like, and how repaying lifts it? This makes two of your demo IOUs overdue.</p><button type="button" className="btn btn-secondary btn-sm" onClick={() => { s.act.demoOverdue(); window.scrollTo({ top: 0 }) }}>Show me Restricted</button></div>}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,470px)_1fr] items-start">
        <div><Card u={me} /><p className="text-muted text-[14px] mt-3">Press the card to turn it over.</p></div>
        <section aria-labelledby="t-inbox"><h2 id="t-inbox" className="text-[20px] flex items-center gap-2"><Mail size={19} aria-hidden />Inbox{inbox.length > 0 && <><i className="w-2 h-2 rounded-full bg-amber" aria-hidden /><span className="sr-only">{inbox.length} new</span></>}</h2>
          {inbox.length === 0 ? <p className="text-muted mt-3">No requests right now.</p> : <ul className="grid gap-3 mt-3">{inbox.map((x) => <li key={x.id} className="panel p-4" style={{ borderRadius: '4px 16px 16px 16px' }}>
            <p><b>{s.name(x.creditor)}</b> says you owe <b className="money">{x.amount} {x.asset}</b></p><p className="text-muted text-[15px] mt-1">For: {plain(x.memo) || 'no note'}. Due {dateShort(x.dueAt)}.</p>
            <div className="flex gap-3 mt-4"><button type="button" className="btn btn-primary btn-sm" disabled={!!(Date.now() >= x.dueAt ? 'x' : s.whyNotBorrow(x.usd))} onClick={() => f.accept(x)}>Accept</button><button type="button" className="btn btn-secondary btn-sm" onClick={() => f.decline(x)}>Decline</button></div>{(Date.now() >= x.dueAt || s.whyNotBorrow(x.usd)) && <p className="text-coral text-[14px] mt-2 font-semibold">{Date.now() >= x.dueAt ? 'This request has passed its due date and can only be declined.' : s.whyNotBorrow(x.usd)}</p>}</li>)}</ul>}
          <Risk>Accept only what you really owe. An accepted IOU counts toward your limit.</Risk>
        </section>
      </div>
      <section aria-labelledby="t-open"><div className="flex flex-wrap items-center justify-between gap-3"><h2 id="t-open" className="text-[20px]">Open IOUs</h2>{s.whyNotSend() ? <button type="button" className="btn btn-secondary btn-sm" disabled title={s.whyNotSend()}>New IOU</button> : <Link to="new" className="btn btn-secondary btn-sm">New IOU</Link>}</div>
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">{[['You owe', `${owe.length} active`, usd(owe.reduce((n, x) => n + x.usd, 0)), owe.some((x) => viewOf(x) === 'Overdue') ? 'text-coral' : ''], ['Next due', owe.length ? dateShort(owe[0].dueAt) : 'Nothing due', owe.length ? dueText(owe[0].dueAt) : '', ''], ['Owed to you', `${owed.length} active`, usd(owed.reduce((n, x) => n + x.usd, 0)), ''], ['Waiting for accept', `${inbox.length} for you`, `${open.filter((x) => x.status === 'Pending').length} you sent`, '']].map(([k, a, b, cl]) => <div key={k} className="panel p-4"><dt className="text-muted text-[14px]">{k}</dt><dd className={`font-extrabold text-[20px] mt-1 ${cl}`}>{a}</dd><dd className="text-muted text-[14px]">{b}</dd></div>)}</dl>
        {open.length === 0 ? <Empty text="Your IOU list is empty. Take your first promise at Promise Mart." cta="Open Promise Mart" to="mart" /> : <ul className="ledger mt-4">{open.map((x) => <IouLine key={x.id} x={x} action={x.debtor === ME && x.status === 'Active' ? <button type="button" className="btn btn-primary btn-sm" onClick={() => f.repay(x)}>Repay</button> : x.status === 'Pending' ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => f.cancel(x)}>Cancel</button> : <span className="text-muted text-[14px]">They repay you</span>} />)}</ul>}
        <Risk />
      </section>
      <section aria-labelledby="t-past"><h2 id="t-past" className="text-[20px]">History</h2><p className="text-muted mt-1">{past.filter((x) => viewOf(x) === 'Repaid').length} repaid on time, {past.filter((x) => viewOf(x) === 'Repaid late').length} late, {past.filter((x) => x.status === 'Declined' || x.status === 'Cancelled').length} declined or cancelled. Press Details on any line for the full record.</p>{past.length === 0 ? <p className="text-muted mt-3">Nothing repaid yet.</p> : <ul className="ledger mt-4">{past.map((x) => <IouLine key={x.id} x={x} action={<span className="text-muted text-[14px]">{x.repaidAt ? dateShort(x.repaidAt) : ''}</span>} />)}</ul>}</section>
      <Pocket u={me} own /><Shelf u={me} /><BadgeBoard u={me} />
      <section aria-labelledby="t-set" className="max-w-[560px]"><h2 id="t-set" className="text-[20px]">Settings</h2>
        <div className="mt-5"><label className="label" htmlFor="nick">Nickname</label><div className="flex gap-3"><input id="nick" className="input" value={nick} onChange={(e) => setNick(e.target.value)} maxLength={20} aria-describedby="nick-h" /><button type="button" className="btn btn-secondary" disabled={!!bad || nick === me.nickname} onClick={() => f.setNick(nick)}>Save</button></div><p id="nick-h" className={`hint ${bad ? 'text-coral' : ''}`}>{bad || 'Not unique and not searchable. It always shows next to your short address.'}</p></div>
        {!DEMO && <div className="flex items-start justify-between gap-6 py-4 border-b border-rule mt-1"><div><p className="font-semibold">Wallet proved on this device</p><p className="hint mt-0.5 mono break-all">{ME}</p><p className="hint mt-0.5">It signed a message for this device, so the site shows it as yours here. Kept in your browser only: the address, this device's code and that signature. No key, no connection.</p></div><button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={() => saveMe(null)}>Forget it</button></div>}
        <Toggle label="Reduce motion" on={p.reduce} set={(v) => p.set({ reduce: v })} hint="Stops the moving background, floating things and stamps." />
        <Toggle label="Sound" on={p.sound} set={(v) => p.set({ sound: v })} hint="On by default. Short, soft sounds made in your browser." />
        <p className="hint mt-5">Settings, your address and its proof stay on this device. No cookies, no account.</p>
      </section>
    </div>
  )
}
function Toggle({ label, on, set, hint }: { label: string; on: boolean; set: (v: boolean) => void; hint: string }) {
  return <div className="flex items-start justify-between gap-6 py-4 border-b border-rule mt-1"><div><p className="font-semibold">{label}</p><p className="hint mt-0.5">{hint}</p></div><button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} className="w-[52px] h-8 rounded-full shrink-0 relative cursor-pointer transition-colors" style={{ background: on ? '#3FBF8A' : '#2C3156' }}><i className="absolute top-1 w-6 h-6 rounded-full bg-chalk transition-[left] duration-150" style={{ left: on ? 24 : 4 }} /></button></div>
}

export function Public({ address }: { address: string }) {
  const f2 = useFlows(); const s = useStore(); const u = isAddr(address) ? s.user(address) : undefined
  if (!isAddr(address)) return <div className="wrap pt-32 pb-24"><h1 className="h2">Profile</h1><p className="text-coral mt-4">This doesn't look like a BNB Smart Chain address.</p><Link to="board" className="btn btn-secondary mt-6">Open the leaderboard</Link></div>
  if (!u) return <div className="wrap pt-32 pb-24 flex flex-wrap items-center gap-8"><Mascot pose="search" expr="confused" className="w-40" /><div><h1 className="h2">No AgentIOU profile here</h1><p className="lead mt-3">This address hasn't joined yet.{DEMO && ' The demo only knows the demo members.'}</p><Link to="board" className="btn btn-secondary mt-6">Open the leaderboard</Link></div></div>
  const self = u.address === ME
  const list = s.ious.filter((x) => x.debtor === u.address && x.status !== 'Pending' && x.status !== 'Declined').sort((a, b) => b.createdAt - a.createdAt)
  return (
    <div className="wrap pt-28 pb-16 grid gap-14">
      <ProfileHead u={u} />
      {s.restricted(u.address) && <div className="panel border-coral p-4 flex items-center gap-4"><Mascot pose="rest" expr="worried" className="w-16 shrink-0" /><p><b className="text-coral">Restricted.</b> This account has IOUs past due. It can't borrow or send IOUs until it repays.{!self && ' Only the owner of this account can repay, from their own My IOUs page.'}</p></div>}
      {self && <div className="panel p-4 flex flex-wrap items-center justify-between gap-3"><p>This is how others see you. To accept, repay or change settings, open My IOUs.</p><Link to="me" className="btn btn-primary btn-sm">Open My IOUs</Link></div>}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,470px)_1fr] items-start"><Card u={u} /><BadgeBoard u={u} /></div>
      <section aria-labelledby="t-rec"><h2 id="t-rec" className="text-[20px]">Promise record</h2>{list.length === 0 ? <p className="text-muted mt-3">No promises on record yet.</p> : <ul className="ledger mt-4">{list.map((x) => <IouLine key={x.id} x={x} action={self && x.status === 'Active' ? <button type="button" className="btn btn-primary btn-sm" onClick={() => f2.repay(x)}>Repay</button> : <span className="text-muted text-[14px]">{viewOf(x) === 'Repaid' ? 'On time' : ''}</span>} />)}</ul>}</section>
      <Pocket u={u} /><Shelf u={u} />
    </div>
  )
}

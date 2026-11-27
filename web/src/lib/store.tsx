import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BNB_USD, DAY, DEMO, HAS_ME, saveMe, storedProof, setBnbUsd, baseLevel, dayOf, isRestricted, live, DESIGNS, LEVELS, ME, MART, TIERS, claimable, levelOf, score, seedIous, seedOffers, seedUsers, viewOf, type Asset, type Iou, type Offer, type User } from './data'


// One store, two sources. Live (a contract address was set at build time): every number is read from the contract and nothing here changes it.
// Demo store. It follows the contract's rules (limits, XP, vouchers, soulbound stickers) in memory,
// so every flow can be tried before the contract is live. Reloading the page resets it.
export interface TrayStep { label: string; prompt: string; /** live only: has this step landed on-chain? Default: my own record changed. */ seen?: () => Promise<boolean>; /** shown on the stop screen once this step has landed and another follows */ landed?: string }
export interface TrayReq { title: string; note?: string; steps: TrayStep[]; done: string; apply: () => string | void; after?: ReactNode; pose?: string }
export interface Toast { id: number; text: string; kind?: 'ok' | 'bad' }
interface Store {
  users: User[]; ious: Iou[]; offers: Offer[]; me: User; joined: boolean
  /** live only */ loaded: boolean; chainDown: boolean; holdsAgentId: boolean | null; credit: number; /** USDT the shop can lend right now; Infinity in the demo */ shopFunds: number; print: string; refresh: () => Promise<string>
  user: (a: string) => User | undefined; name: (a: string) => string
  owed: (a: string) => number; hasOverdue: (a: string) => boolean; restricted: (a: string) => boolean
  /** Why I cannot borrow this amount right now, or '' if I can. Mirrors the contract's checks, so no prompt is written for a call that would fail. */
  whyNotBorrow: (usd: number) => string; whyNotSend: () => string
  /** Why I cannot take another shop loan today, or ''. The contract allows two a day per wallet. */
  whyNotTake: () => string
  tray: TrayReq | null; openTray: (t: TrayReq) => void; closeTray: () => void
  toasts: Toast[]; toast: (text: string, kind?: Toast['kind']) => void; dropToast: (id: number) => void
  act: { join: (nick: string) => void; takeOffer: (id: number) => string | void; repay: (id: number) => string | void; accept: (id: number) => string | void; decline: (id: number) => void; cancel: (id: number) => void
    create: (debtor: string, asset: Asset, amount: number, days: number, memo: string) => string | void; claim: (tier: number) => string | void; checkIn: () => string | void; mint: (design: number) => string | void; setNick: (n: string) => void; demoOverdue: () => void }
  last: { levelUp?: number; badge?: string }
  draftTo: string; setDraftTo: (a: string) => void
}
/** Shown as "me" on the live site until this device's address has joined. */
const BLANK: User = { address: ME, nickname: 'guest', no: 0, joinedAt: 0, onTime: 0, late: 0, defaults: 0, people: 0, xp: 0, claimed: [0, 0, 0], pocket: [0, 0, 0], stickers: {}, badges: {}, checkDays: 0, lastCheck: 0 }
const Ctx = createContext<Store>(null as unknown as Store)
export const useStore = () => useContext(Ctx)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>(DEMO ? seedUsers : [])
  const [ious, setIous] = useState<Iou[]>(DEMO ? seedIous : [])
  const [offers, setOffers] = useState<Offer[]>(DEMO ? seedOffers : [])
  const [chainState, setChainState] = useState<{ loaded: boolean; down: boolean; holds: boolean | null; credit: number; shop: number; print: string }>({ loaded: DEMO, down: false, holds: null, credit: 0, shop: DEMO ? Infinity : 0, print: '' })
  // a visitor starts as a guest: free to look at everything, with every action switched off until they join.
  // (tests open the demo as an existing member with ?demo=member)
  const [demoJoined, setJoined] = useState(() => DEMO && ['member', 'busy', 'restricted', 'crowd'].includes(new URLSearchParams(location.search).get('demo') ?? ''))   // joining happens once; after it the header shows the profile instead of the join button
  // the clickable preview build carries a Guest / Member switch (App.tsx); it tells the demo which one to be. Never in the real site: the flag is off there.
  useEffect(() => { if (import.meta.env.VITE_PREVIEW_SWITCH !== '1' || !DEMO) return; const on = (e: Event) => setJoined(!!(e as CustomEvent).detail); addEventListener('agentiou-preview', on); return () => removeEventListener('agentiou-preview', on) }, [])
  const [tray, setTray] = useState<TrayReq | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [last, setLast] = useState<Store['last']>({})
  const [draftTo, setDraftTo] = useState('')
  const seq = useRef(100)
  // which accounts have IOUs past due right now (the contract works this out the same way)
  live.overdue = new Map()
  if (DEMO) for (const x of ious) if (x.status === 'Active' && Date.now() > x.dueAt) { const o = live.overdue.get(x.debtor) ?? { n: 0, def: false }; live.overdue.set(x.debtor, { n: o.n + 1, def: o.def || Date.now() > x.dueAt + 7 * DAY }) }
  const RESTRICTED = 'Your account is Restricted. Repay your overdue IOUs to unlock it.'
  const found = users.find((x) => x.address === ME)
  const joined = DEMO ? demoJoined : !!found && found.joinedAt > 0
  const me = joined && found ? found : BLANK   // a guest has no record of their own
  const user = useCallback((a: string) => users.find((x) => x.address.toLowerCase() === a.toLowerCase()), [users])
  const name = useCallback((a: string) => (a === MART ? 'Promise Mart' : user(a)?.nickname ?? 'unknown'), [user])
  const owed = useCallback((a: string) => live.chain.get(a)?.owed ?? ious.filter((x) => x.debtor === a && x.status === 'Active').reduce((s, x) => s + x.usd, 0), [ious])
  const hasOverdue = useCallback((a: string) => live.chain.get(a)?.overdue ?? ious.some((x) => x.debtor === a && viewOf(x) === 'Overdue'), [ious])
  const patchMe = (f: (m: User) => User) => setUsers((us) => us.map((x) => (x.address === ME ? f(x) : x)))
  const toast = useCallback((text: string, kind?: Toast['kind']) => { const id = ++seq.current; setToasts((t) => [...t.slice(-2), { id, text, kind }]); if (kind !== 'bad') setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000) }, [])
  const room = () => LEVELS[levelOf(me) - 1].limit - owed(ME)
  const repayDay = useRef({ day: -1, n: 0 })
  const mintRec = (m: User, design: number) => ({ ...m.stickers, [design]: { edition: 20 + ((design * 37 + seq.current) % 60), block: 52_600_000 + seq.current * 13, time: Date.now() } })

  const NOT_YET = 'Get IOU Verified first'
  const whyNotBorrow = (usd: number) => !joined ? NOT_YET : isRestricted(ME) ? 'Restricted: repay your overdue IOUs first' : ious.filter((x) => x.debtor === ME && x.status === 'Active').length >= 10 ? 'You already have 10 active IOUs' : usd > room() + 1e-9 ? `Over your $${LEVELS[levelOf(me) - 1].limit} limit` : ''
  const demoTakes = useRef({ day: -1, n: 0 })
  const takesToday = DEMO ? (demoTakes.current.day === dayOf(Date.now()) ? demoTakes.current.n : 0) : me.takesToday ?? 0
  const whyNotTake = () => (takesToday >= 2 ? 'You have taken 2 shop loans today. Come back tomorrow.' : '')
  const whyNotSend = () => !joined ? NOT_YET : isRestricted(ME) ? 'Restricted: repay your overdue IOUs first' : ious.filter((x) => x.creditor === ME && x.status === 'Pending').length >= 20 ? 'You have 20 IOUs waiting for accept. Cancel one first.' : ''
  const demoAct: Store['act'] = {
    join: (nick) => { setJoined(true); patchMe((m) => ({ ...m, nickname: nick || m.nickname })) },
    takeOffer: (id) => {
      const o = offers.find((x) => x.id === id)!; const usd = o.asset === 'BNB' ? o.price * BNB_USD : o.price
      if (isRestricted(ME)) return RESTRICTED
      if (usd > room() + 1e-9) return `This goes over your Credit Pass limit ($${LEVELS[levelOf(me) - 1].limit}). Repay first or pick a smaller amount.`
      if (whyNotTake()) return whyNotTake()
      const now = Date.now()
      demoTakes.current = { day: dayOf(now), n: takesToday + 1 }
      setIous((l) => [...l, { id: ++seq.current, creditor: MART, debtor: ME, asset: o.asset, amount: o.price, usd, createdAt: now, dueAt: now + o.termDays * DAY, status: 'Active', memo: o.title, offerId: id }])
      setOffers((l) => l.map((x) => (x.id === id ? { ...x, taken: x.taken + 1 } : x)))
      patchMe((m) => (m.stickers[o.design] ? m : { ...m, stickers: mintRec(m, o.design) }))   // the sticker comes with the first loan only
    },
    repay: (id) => {
      // the same rules as the contract's _settle, line for line
      const x = ious.find((q) => q.id === id)!; const now = Date.now(); const onTime = now <= x.dueAt, isDefault = now > x.dueAt + 7 * DAY
      const firstWith = !ious.some((q) => q.id !== id && q.status === 'Repaid' && q.debtor === ME && q.creditor === x.creditor)
      setIous((l) => l.map((q) => (q.id === id ? { ...q, status: 'Repaid', repaidAt: now } : q)))
      if (x.offerId) setOffers((l) => l.map((o) => (o.id === x.offerId ? { ...o, taken: Math.max(0, o.taken - 1) } : o)))   // a repaid shop loan goes back in stock
      if (repayDay.current.day !== dayOf(now)) repayDay.current = { day: dayOf(now), n: 0 }
      const before = baseLevel(me), good0 = me.good ?? me.onTime
      const next: User = { ...me, badges: { ...me.badges }, good: good0 }
      let xp = 0
      const give = (b: string, bonus = 0) => { if (!next.badges[b]) { next.badges[b] = now; xp += 25 + bonus; setLast((s) => ({ ...s, badge: b })); return true } return false }
      if (onTime) {
        next.onTime++
        if (repayDay.current.n < 3) { repayDay.current.n++; next.good = good0 + 1; xp += 30 + (x.dueAt - now >= DAY ? 10 : 0) }   // at most 3 repays a day count
        give('First Promise')
      } else if (!isDefault) { next.late++; next.good = before === 3 ? 3 : 0 }      // late: one level down
      else { next.defaults++; next.good = 0 }                                        // default: back to L1
      if (firstWith) { next.people++; if (next.people <= 10) xp += 15 }
      const after = baseLevel(next)
      if (after >= 2 && give('Trusted', 100)) setLast((s) => ({ ...s, levelUp: 2 }))
      if (after === 3 && give('Highly Trusted', 200)) setLast((s) => ({ ...s, levelUp: 3 }))
      next.xp = me.xp + xp
      patchMe(() => next)
      toast(onTime ? (xp ? `Repaid. +${xp} XP` : 'Repaid on time. Today\'s 3 XP repays are used up.') : isDefault ? 'Repaid after a default. It stays on your record.' : `Repaid late. ${xp ? `+${xp} XP for someone new, none for the repay.` : 'No XP this time.'}`)
    },
    accept: (id) => {
      const x = ious.find((q) => q.id === id)!
      if (isRestricted(ME)) return RESTRICTED
      if (x.usd > room() + 1e-9) return `This goes over your Credit Pass limit ($${LEVELS[levelOf(me) - 1].limit}). Repay first or pick a smaller amount.`
      setIous((l) => l.map((q) => (q.id === id ? { ...q, status: 'Active' } : q)))
    },
    decline: (id) => setIous((l) => l.map((q) => (q.id === id ? { ...q, status: 'Declined' } : q))),
    cancel: (id) => setIous((l) => l.map((q) => (q.id === id && q.status === 'Pending' ? { ...q, status: 'Cancelled' } : q))),
    create: (debtor, asset, amount, days, memo) => { if (isRestricted(ME)) return RESTRICTED; const now = Date.now(); setIous((l) => [...l, { id: ++seq.current, creditor: ME, debtor, asset, amount, usd: asset === 'BNB' ? amount * BNB_USD : amount, createdAt: now, dueAt: now + days * DAY, status: 'Pending', memo }]) },
    claim: (tier) => {
      if (hasOverdue(ME)) return 'You have an overdue IOU. Repay it to unlock vouchers.'
      if (claimable(me)[tier] < 1) return `You need more XP for a ${TIERS[tier]} voucher.`
      patchMe((m) => { const c = [...m.claimed] as User['claimed'], p = [...m.pocket] as User['pocket']; c[tier]++; p[tier]++; return { ...m, claimed: c, pocket: p } })
    },
    checkIn: () => {
      if (dayOf(me.lastCheck) === dayOf(Date.now())) return 'You already checked in today. Come back tomorrow.'
      // the contract's rule: day after day fills the card; a missed day, or a full card, starts again at 1; day 7 pays 5 + 20
      const n = dayOf(me.lastCheck) + 1 === dayOf(Date.now()) && me.checkDays < 7 ? me.checkDays + 1 : 1, xp = n === 7 ? 25 : 5
      patchMe((m) => ({ ...m, xp: m.xp + xp, checkDays: n, lastCheck: Date.now() }))
      toast(n === 7 ? 'Day 7! +25 XP (5 and a 20 XP streak bonus)' : `Checked in, day ${n} of 7. +5 XP`)
    },
    mint: (design) => {
      const d = DESIGNS.find((x) => x.id === design)!; const t = TIERS.indexOf(d.tier as never)
      if (hasOverdue(ME)) return 'You have an overdue IOU. Repay it to unlock minting.'
      if (me.stickers[design]) return 'You already hold this sticker. Each design is once per wallet.'
      if (me.pocket[t] < 1) return `Claim a ${d.tier} voucher first.`
      patchMe((m) => { const p = [...m.pocket] as User['pocket']; p[t]--; return { ...m, pocket: p, stickers: mintRec(m, design) } })
    },
    // demo only: push two of my active IOUs past their due date, to show the Restricted state and the way out of it
    demoOverdue: () => { let n = 0; setIous((l) => l.map((q) => (q.debtor === ME && q.status === 'Active' && n < 2 ? (n++, { ...q, dueAt: Date.now() - (n === 1 ? 2 : 1) * DAY }) : q))) },
    setNick: (n) => patchMe((m) => ({ ...m, nickname: n })),
  }
  // live: the contract is the only thing that changes state. The site re-reads it now and then, and right after each confirmed step.
  const act = DEMO ? demoAct : Object.fromEntries(Object.keys(demoAct).map((k) => [k, () => undefined])) as unknown as Store['act']
  const seen = useRef<{ level: number; badges: number } | null>(null)
  // a member's own record is asked for on its own, alongside the full read, and shown the moment it arrives: the profile does not wait for the whole town.
  // Nothing is kept between visits; it is a fresh answer from the contract each time, and the full read replaces it.
  const full = useRef(false)
  useEffect(() => { if (DEMO || !HAS_ME) return; let on = true
    import('./chain').then((m) => m.loadMe()).then((mine) => { if (!on || !mine || full.current) return; live.chain.set(ME, mine.view); setUsers((u) => (full.current || u.some((x) => x.address === ME) ? u : [...u, mine.user])) }).catch(() => undefined)
    return () => { on = false } }, [])
  const refresh = useCallback(async () => {
    try {
      const d = await (await import('./chain')).loadAll()   // loaded only on the live site, so the demo and the first paint stay light
      full.current = true; live.chain = d.chain; setBnbUsd(d.bnbUsd)
      const mine = d.users.find((x) => x.address === ME)
      if (mine) { const now = { level: d.chain.get(ME)?.level ?? 1, badges: Object.keys(mine.badges).length }
        if (seen.current && now.level > seen.current.level) setLast((l) => ({ ...l, levelUp: now.level }))
        if (seen.current && now.badges > seen.current.badges) setLast((l) => ({ ...l, badge: Object.keys(mine.badges)[now.badges - 1] }))
        seen.current = now }
      setUsers(d.users); setIous(d.ious); setOffers(d.offers); setChainState({ loaded: true, down: false, holds: d.holdsAgentId, credit: d.credit, shop: d.shopFunds, print: d.print })
      return d.print
    } catch (e) { setChainState((c) => ({ ...c, down: true })); throw e }
  }, [])
  // the proof kept on this device is checked again on every load; one that does not hold is forgotten
  useEffect(() => { if (DEMO || !HAS_ME || !storedProof) return; let live = true; import('./proof').then((m) => m.proofHolds(storedProof!)).then((ok) => { if (live && !ok) saveMe(null) }).catch(() => undefined); return () => { live = false } }, [])
  useEffect(() => { if (DEMO) return; const go = () => { if (!document.hidden) refresh().catch(() => undefined) }; go(); const id = setInterval(go, 20_000); return () => clearInterval(id) }, [refresh])
  const v = useMemo<Store>(() => ({ users, ious, offers, me, joined, loaded: chainState.loaded, chainDown: chainState.down, holdsAgentId: chainState.holds, credit: chainState.credit, shopFunds: chainState.shop, print: chainState.print, refresh, user, name, owed, hasOverdue, restricted: isRestricted, whyNotBorrow, whyNotSend, whyNotTake, tray, openTray: setTray, closeTray: () => setTray(null), toasts, toast, dropToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)), act, last, draftTo, setDraftTo }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [users, ious, offers, joined, chainState, refresh, tray, toasts, last, draftTo])
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>
}
export { score, levelOf }

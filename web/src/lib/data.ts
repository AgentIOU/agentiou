import { getAddress, isAddress } from 'viem'
import { TOWN_PARTS } from './townmap'
import assets from '../data/assets.json'
export { assets }

// Live or demo is decided when the site is built: with VITE_CONTRACT set, every number comes from that contract on BNB Smart Chain.
// Without it the site runs on demo data, and every screen says "Demo data".
const env = import.meta.env
export const CONTRACT: `0x${string}` | null = env.VITE_CONTRACT && isAddress(env.VITE_CONTRACT) ? getAddress(env.VITE_CONTRACT) : null
export const DEMO = !CONTRACT
export const RPCS: string[] = env.VITE_RPC ? [env.VITE_RPC] : ['https://bsc-dataseed.bnbchain.org', 'https://bsc-dataseed1.bnbchain.org', 'https://bsc-rpc.publicnode.com']
export const AGENT_ID = '0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F'
export const USDT = '0x55d398326f99059fF775485246999027B3197955'
export const BNB_FEED = '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE'
export let BNB_USD = 600                     // demo price; the live site replaces it with the Chainlink feed's price
export const setBnbUsd = (n: number) => { if (n > 0) BNB_USD = n }
export const DAY = 86400_000

export type Asset = 'BNB' | 'USDT'
export type Status = 'Pending' | 'Active' | 'Repaid' | 'Declined' | 'Cancelled'
export type Tier = 'Common' | 'Rare' | 'Legendary'
export interface Iou { id: number; creditor: string; debtor: string; asset: Asset; amount: number; /** the exact on-chain amount in wei, on the live site */ raw?: string; usd: number; createdAt: number; dueAt: number; repaidAt?: number; status: Status; memo: string; offerId?: number }
export interface Mint { edition: number; block: number; time: number }
export interface User { address: string; nickname: string; no: number; joinedAt: number; onTime: number; late: number; defaults: number; people: number; xp: number; claimed: [number, number, number]; pocket: [number, number, number]; stickers: Record<number, Mint>; badges: Record<string, number>; checkDays: number; lastCheck: number; good?: number; /** shop loans taken today (the contract allows two a day) */ takesToday?: number }
export interface Offer { id: number; design: number; title: string; asset: Asset; price: number; termDays: number; stock: number; taken: number }

export const LEVELS = [
  { n: 1, name: 'Starter', limit: 1, rule: 'Opens when you join', badge: 'IOU Verified' },
  { n: 2, name: 'Trusted', limit: 5, rule: '3 on-time repays, nothing past due', badge: 'Trusted' },
  { n: 3, name: 'Highly Trusted', limit: 10, rule: '10 on-time repays, never a default, 3+ people', badge: 'Highly Trusted' },
] as const
export const TIERS: Tier[] = ['Common', 'Rare', 'Legendary']
export const TIER_XP = [50, 150, 300]
export const BADGES = [
  { key: 'IOU Verified', how: 'Join with your Agent ID.' },
  { key: 'First Promise', how: 'Repay your first IOU on time.' },
  { key: 'Trusted', how: 'Reach Credit Pass L2.' },
  { key: 'Highly Trusted', how: 'Reach Credit Pass L3.' },
]
export const DESIGNS: { id: number; key: string; name: string; tier: Tier | 'Founders' }[] = [
  { id: 1, key: 'founder-wave', name: 'Day one', tier: 'Founders' },
  { id: 2, key: 'founder-search', name: 'Night owl', tier: 'Founders' },
  { id: 3, key: 'founder-jump', name: 'Good word', tier: 'Founders' },
  { id: 4, key: 'hello', name: 'Hello', tier: 'Common' },
  { id: 5, key: 'on-it', name: 'On it', tier: 'Common' },
  { id: 6, key: 'noted', name: 'Noted', tier: 'Common' },
  { id: 7, key: 'stamped', name: 'Stamped', tier: 'Rare' },
  { id: 8, key: 'checked', name: 'Checked', tier: 'Rare' },
  { id: 9, key: 'cloud-nap', name: 'Cloud nap', tier: 'Rare' },
  { id: 10, key: 'good-for-one', name: 'Good for one', tier: 'Legendary' },
  { id: 11, key: 'paid-in-full', name: 'Paid in full', tier: 'Legendary' },
  { id: 12, key: 'kept-my-word', name: 'Kept my word', tier: 'Legendary' },
]
export const SEASON = DESIGNS.filter((d) => d.tier !== 'Founders')
export const XP_TASKS = [
  { key: 'checkin', label: 'Daily check-in', xp: '5', cap: 'Once a day' },
  { key: 'streak', label: 'Check in 7 days in a row', xp: '+20', cap: 'Each full card' },
  { key: 'join', label: 'Join (Get IOU Verified)', xp: '50', cap: 'Once' },
  { key: 'repay', label: 'Repay on time', xp: '30', cap: '3 a day' },
  { key: 'early', label: 'Repay 24 hours before it is due', xp: '+10', cap: 'With those 3' },
  { key: 'paidback', label: 'An IOU you gave comes back on time', xp: '10', cap: '5 a day' },
  { key: 'newperson', label: 'Finish a first IOU with someone new', xp: '15', cap: '10 people in total' },
  { key: 'badge', label: 'Get a badge', xp: '25', cap: 'Once per badge' },
  { key: 'level', label: 'Reach Credit Pass L2, then L3', xp: '100, then 200', cap: 'Once each' },
]

const addr = (n: number) => '0x' + n.toString(16).padStart(40, '0').replace(/^0{4}/, 'de30')   // demo-only addresses
// "Me" on the live site is a wallet the visitor has PROVED they control on this device: its own Agentic Wallet signed a message
// naming this device (lib/proof.ts). Typing an address alone never makes a profile "mine". No key, no connection, no server.
// It is read once when the page loads; proving or forgetting reloads the page.
const ME_KEY = 'agentiou.me', PROOF_KEY = 'agentiou.proof', DEVICE_KEY = 'agentiou.device'
/** The signed proof kept on the device. */
export interface Proof { wallet: string; device: string; issued: number; expires: number; sig: `0x${string}` }
const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
/** This device's own random code. A proof is signed for one device and is no use on another. */
export function deviceId(): string {
  const have = read(DEVICE_KEY); if (have && /^[A-Z2-7]{4}-[A-Z2-7]{4}$/.test(have)) return have
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', r = crypto.getRandomValues(new Uint8Array(8)); let d = ''
  r.forEach((x, i) => { d += abc[x % 32] + (i === 3 ? '-' : '') })
  try { localStorage.setItem(DEVICE_KEY, d) } catch { /* storage may be unavailable */ }
  return d
}
const savedMe = (() => { const v = read(ME_KEY); return v && isAddress(v) ? getAddress(v) : null })()
export const storedProof: Proof | null = (() => { try { const x = JSON.parse(read(PROOF_KEY) ?? 'null'); return x && typeof x.wallet === 'string' && isAddress(x.wallet) && typeof x.device === 'string' && Number.isInteger(x.issued) && Number.isInteger(x.expires) && /^0x[0-9a-fA-F]{130}$/.test(x.sig) ? x as Proof : null } catch { return null } })()
// shape check here; the signature itself is re-checked right after load (store.tsx), and a proof that fails is forgotten
const proven = !DEMO && !!savedMe && !!storedProof && getAddress(storedProof.wallet) === savedMe && storedProof.device === read(DEVICE_KEY)
export const HAS_ME = DEMO || proven
/** Make a wallet "mine" on this device with its proof, or forget it (no argument). */
export const saveMe = (proof?: Proof | null) => {
  try {
    if (proof) { localStorage.setItem(ME_KEY, getAddress(proof.wallet)); localStorage.setItem(PROOF_KEY, JSON.stringify(proof)) }
    else { localStorage.removeItem(ME_KEY); localStorage.removeItem(PROOF_KEY); localStorage.removeItem('agentiou.ask') }
  } catch { /* storage may be unavailable */ }
  location.reload()
}
export const ME: string = DEMO ? addr(0x142) : proven && savedMe ? savedMe : '0x0000000000000000000000000000000000000000'
export const MART: string = DEMO ? addr(0xa11) : env.VITE_MART && isAddress(env.VITE_MART) ? getAddress(env.VITE_MART) : '0x0000000000000000000000000000000000000000'
export const MIRA = addr(0x2b7), SAM = addr(0x3c9), RAFI = addr(0x4d1), LINA = addr(0x5e3), OMAR = addr(0x9c5)
const T0 = Date.now()
const BUSY = DEMO && typeof location !== 'undefined' && new URLSearchParams(location.search).get('demo') === 'busy'
const u = (address: string, nickname: string, no: number, onTime: number, people: number, late = 0, extra: Partial<User> = {}): User => ({
  address, nickname, no, joinedAt: T0 - (160 - no) * DAY * 0.2 - 3 * DAY, onTime, late, defaults: 0, people, xp: 50 + onTime * 30, claimed: [Math.floor((50 + onTime * 30) / 50), Math.floor((50 + onTime * 30) / 150), Math.floor((50 + onTime * 30) / 300)], pocket: [0, 0, 0], stickers: {}, badges: onTime >= 0 && nickname !== 'promise-mart' ? { 'IOU Verified': T0 - 20 * DAY, ...(onTime > 0 ? { 'First Promise': T0 - 12 * DAY } : {}), ...(onTime >= 3 ? { Trusted: T0 - 8 * DAY } : {}), ...(onTime >= 10 && people >= 3 ? { 'Highly Trusted': T0 - 3 * DAY } : {}) } : {}, checkDays: 0, lastCheck: 0, ...extra })
export const seedUsers = (): User[] => [
  u(ME, 'tuku', 142, 4, 2, 0, { xp: 350, checkDays: 2, lastCheck: T0 - DAY, claimed: [2, 1, 0], pocket: [1, 0, 0],
    stickers: { 1: { edition: 9, block: 52_340_118, time: T0 - 6 * DAY }, 4: { edition: 42, block: 52_512_904, time: T0 - 2 * DAY }, 7: { edition: 17, block: 52_540_377, time: T0 - DAY } },
    badges: { 'IOU Verified': T0 - 9 * DAY, 'First Promise': T0 - 6 * DAY, Trusted: T0 - 2 * DAY } }),
  u(MART, 'promise-mart', 1, 0, 0), u(MIRA, 'mira', 12, 11, 5), u(SAM, 'sam', 57, 3, 2), u(RAFI, 'rafi', 31, 6, 3, 1), u(LINA, 'lina', 88, 1, 1),
  u(OMAR, 'omar', 71, 2, 2, 1),
  u(addr(0x6f2), 'kojo', 19, 9, 4), u(addr(0x7a8), 'ines', 23, 12, 6), u(addr(0x8b4), 'dev-han', 64, 2, 1),
]
/** "1 day", "2 days": a term or a count of days in words. */
export const dayWord = (n: number) => (n === 1 ? '1 day' : `${n} days`)
export const seedOffers = (): Offer[] => [
  { id: 1, design: 1, title: 'Day one sticker', asset: 'USDT', price: 0.01, termDays: 1, stock: 100, taken: 31 },
  { id: 2, design: 2, title: 'Night owl sticker', asset: 'USDT', price: 0.03, termDays: 2, stock: 100, taken: 22 },
  { id: 3, design: 3, title: 'Good word sticker', asset: 'USDT', price: 0.05, termDays: 3, stock: 100, taken: 100 },
]
const i = (id: number, creditor: string, debtor: string, asset: Asset, amount: number, created: number, due: number, status: Status, memo: string, repaid?: number, offerId?: number): Iou => ({
  id, creditor, debtor, asset, amount, usd: asset === 'BNB' ? amount * BNB_USD : amount, createdAt: T0 + created * DAY, dueAt: T0 + due * DAY, status, memo, repaidAt: repaid != null ? T0 + repaid * DAY : status === 'Repaid' ? T0 + (due - 0.3) * DAY : undefined, offerId })
export const seedIous = (): Iou[] => [
  i(1, MART, ME, 'USDT', 0.01, -8, -7, 'Repaid', 'Day one sticker', -7.4, 1),
  i(2, MIRA, ME, 'USDT', 1, -6, -3, 'Repaid', 'Tea'),
  i(3, RAFI, ME, 'BNB', 0.0005, -5, -2, 'Repaid', 'Bus fare', -3.5),
  i(4, MIRA, ME, 'USDT', 2, -3, -1, 'Repaid', 'Lunch', -1.6),
  i(5, RAFI, ME, 'BNB', 0.0004, -0.2, 1.8, 'Active', 'Phone top-up'),
  i(6, MIRA, ME, 'USDT', 2, -1, 5, 'Active', 'Notebook'),
  i(7, SAM, ME, 'USDT', 1.5, -0.1, 7, 'Pending', 'Coffee beans'),
  i(8, ME, LINA, 'USDT', 0.5, -2, 4, 'Active', 'Print shop'),
  i(9, MIRA, OMAR, 'USDT', 0.5, -9, -2, 'Active', 'Groceries'),
  i(10, RAFI, OMAR, 'USDT', 0.3, -6, -1, 'Active', 'Data pack'),
  // ?demo=busy: a member with many open IOUs, to see the harbour at its biggest (tests use it; nothing links to it)
  ...(BUSY ? [i(11, addr(0x6f2), ME, 'USDT', 0.2, -1, 1, 'Active', 'Snacks'), i(12, ME, addr(0x7a8), 'USDT', 0.4, -1, 2, 'Active', 'Stickers'), i(13, addr(0x7a8), ME, 'USDT', 0.3, -2, 3, 'Active', 'Bus card'), i(14, ME, SAM, 'USDT', 0.6, -1, 6, 'Active', 'Coffee'),
    i(15, ME, addr(0x8b4), 'USDT', 0.2, -3, 7, 'Active', 'Pens'), i(16, addr(0x6f2), ME, 'USDT', 0.1, -1, 8, 'Active', 'Gum'), i(17, ME, OMAR, 'USDT', 0.5, -2, 9, 'Active', 'Charger'), i(18, SAM, ME, 'USDT', 0.2, -1, 10, 'Active', 'Tea')] : []),
]

/** IOUs past due right now, per address. The demo store fills this in; on the live site the contract returns the same numbers. */
export const live = { overdue: new Map<string, { n: number; def: boolean }>(), chain: new Map<string, { level: number; score: number; restricted: boolean; overdue: boolean; owed: number }>() }
const od = (a: string) => live.overdue.get(a) ?? { n: 0, def: false }
// on the live site level, score and Restricted are the contract's own answers; the formulas below are the demo's copy of them
export const isRestricted = (a: string) => live.chain.get(a)?.restricted ?? (od(a).def || od(a).n >= 2)
export const score = (x: User) => live.chain.get(x.address)?.score ?? Math.max(0, Math.min(100, 50 + 5 * x.onTime - 10 * (x.late + od(x.address).n) - 25 * x.defaults + Math.min(10, 2 * x.people)))
/** The level before overdue IOUs are looked at. `good` is the contract's counter: on-time repays that count (3 a day at most); a late repay cuts it. */
export function baseLevel(x: User) { const g = x.good ?? x.onTime; return g >= 10 && x.defaults === 0 && x.people >= 3 ? 3 : g >= 3 ? 2 : 1 }
export function levelOf(x: User) {
  const c = live.chain.get(x.address); if (c?.level) return c.level
  const base = baseLevel(x)
  return isRestricted(x.address) ? 1 : od(x.address).n === 1 ? Math.max(1, base - 1) : base
}
/** Leaderboard points. Trust Score counts ten times over, so honest repaying outweighs XP that check-ins alone can collect. */
export const rankPoints = (x: User) => score(x) * 10 + x.xp
export const claimable = (x: User) => TIER_XP.map((step, t) => Math.floor(x.xp / step) - x.claimed[t])
export type View = 'Repaid' | 'Repaid late' | 'Pending' | 'Active' | 'Due soon' | 'Overdue' | 'Declined' | 'Cancelled'
export function viewOf(x: Iou, now = Date.now()): View {
  if (x.status === 'Repaid') return (x.repaidAt ?? 0) > x.dueAt ? 'Repaid late' : 'Repaid'
  if (x.status !== 'Active') return x.status
  return now > x.dueAt ? 'Overdue' : x.dueAt - now < 3 * DAY ? 'Due soon' : 'Active'
}
export const short = (a: string) => a.slice(0, 6) + '…' + a.slice(-4)
export const usd = (n: number) => '$' + n.toFixed(2)
export const amt = (x: { amount: number; asset: Asset }) => `${+x.amount.toFixed(6)} ${x.asset}`
export const dateShort = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
/** Month and year someone joined; a guest has no join date, so it shows a dash instead of Jan 1970. */
export const memberSince = (t: number) => (t > 0 ? new Date(t).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—')
export const dateUtc = (t: number) => new Date(t).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
export function dueText(t: number, now = Date.now()) {
  const d = Math.round(Math.abs(t - now) / DAY), h = Math.round(Math.abs(t - now) / 3600_000)
  const span = h < 36 ? `${h} hour${h === 1 ? '' : 's'}` : `${d} days`
  return t >= now ? `Due in ${span}` : `Overdue by ${span}`
}
export const dayOf = (t: number) => Math.floor(t / DAY)
/** A BNB Smart Chain address. Mixed-case input must pass the checksum, so a mistyped character is caught. */
export const isAddr = (s: string) => isAddress(s.trim(), { strict: true })
/** Nicknames and notes go on-chain and into the prompt for the agent, so only plain characters are allowed: no line breaks, quotes or code. */
export const SAFE_TEXT = /^[A-Za-z0-9 .,!?()'\-_]*$/
/** Notes and offer titles come from other people, straight from the chain. Anything that is not plain text is shown as a warning instead. */
export const plain = (t: string) => (SAFE_TEXT.test(t) ? t : '(hidden: unusual characters)')
export const BANNED_NICK = /binance|bnb|official|admin|support/i
export function nickError(n: string) { return !n ? '' : BANNED_NICK.test(n) ? 'That word is not allowed in a nickname.' : !/^[A-Za-z0-9_\-]*$/.test(n) ? 'Use letters, numbers, - and _ only.' : n.length < 2 || n.length > 20 ? 'Use 2 to 20 characters.' : '' }

/* Looks. Nothing here is stored: the card metal, the avatar's pose and its colour are all worked out from what the contract already keeps
   (which stamps an address holds, when they were minted, and its XP), so every device draws the same member the same way. */
export type Look = 'classic' | 'silver' | 'gold' | 'aurora'
export const LOOKS: Look[] = ['classic', 'silver', 'gold', 'aurora']
export const LOOK_NAME: Record<Look, string> = { classic: 'Classic', silver: 'Silver', gold: 'Gold', aurora: 'Aurora' }
/** XP between two colour steps of the avatar */
export const SHADE_XP = 100
export const SHADES: Record<Look, [string, string, string]> = { classic: ['Lavender', 'Lavender', 'Lavender'], silver: ['Silver', 'Ice blue', 'Lilac pearl'], gold: ['Gold', 'Rose gold', 'Champagne'], aurora: ['Aurora', 'Ocean aurora', 'Sunset aurora'] }
const STAMP_POSE: Record<number, string> = { 4: 'wave', 5: 'card', 6: 'read', 7: 'stamp', 8: 'search', 9: 'rest', 10: 'ticket', 11: 'coin', 12: 'jump' }
export interface Style { look: Look; /** 0 none, 1 Common, 2 Rare, 3 Legendary */ tier: number; pose: string; shade: number; design: number }
/** The highest tier of stamp held sets the metal; the stamp minted last in that tier sets the pose; XP sets the colour step. */
export function styleOf(u?: Pick<User, 'stickers' | 'xp'> | null): Style {
  let tier = 0, design = 0, at = -1
  for (const [k, m] of Object.entries(u?.stickers ?? {})) {
    const id = Number(k), t = id >= 10 ? 3 : id >= 7 ? 2 : id >= 4 ? 1 : 0
    if (!t) continue
    if (t > tier || (t === tier && (m.time > at || (m.time === at && id > design)))) { tier = t; design = id; at = m.time }
  }
  return { look: LOOKS[tier], tier, pose: STAMP_POSE[design] ?? 'wave', shade: tier ? Math.floor((u?.xp ?? 0) / SHADE_XP) % 3 : 0, design }
}

/* Build your own town. Nothing is stored for it: the contract's own count of claimed vouchers is the whole state.
   Two claimed Common vouchers open one part; one Rare voucher opens one; one Legendary voucher opens one. Parts open in a fixed order and each has its own place. */
export const PART_COST = [2, 1, 1] as const
export function townOf(u: User) {
  const seen = [0, 0, 0], open = new Set<number>()
  TOWN_PARTS.forEach((p, i) => { if (seen[p.tier]++ < Math.floor(u.claimed[p.tier] / PART_COST[p.tier])) open.add(i) })
  /** per tier: the next part still closed and how many more vouchers have to be claimed for it; null when the tier is complete */
  const next = [0, 1, 2].map((t) => { const part = TOWN_PARTS.filter((p) => p.tier === t)[Math.floor(u.claimed[t] / PART_COST[t])]; return part ? { name: part.name, need: PART_COST[t] - (u.claimed[t] % PART_COST[t]) } : null })
  return { open, next }
}

import { getAddress, isAddress } from 'viem'
import assets from '../data/assets.json'
export { assets }

// Live or demo is decided when the site is built: with VITE_CONTRACT set, every number comes from that contract on BNB Smart Chain.
// Without it the site runs on demo data, and every screen says "Demo data".
const env = import.meta.env
export const CONTRACT: `0x${string}` | null = env.VITE_CONTRACT && isAddress(env.VITE_CONTRACT) ? getAddress(env.VITE_CONTRACT) : null
export const DEMO = !CONTRACT
export const RPCS: string[] = env.VITE_RPC ? [env.VITE_RPC] : ['https://bsc-dataseed.bnbchain.org', 'https://bsc-dataseed1.bnbchain.org', 'https://bsc-rpc.publicnode.com']
export const AGENT_ID = '0x60b9262456de011f7d15a54cdd8c48baaa8b022f'
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
// "Me" on the live site is the public address the visitor saved on this device (never a key, never a connection).
// It is read once when the page loads; saving or forgetting an address reloads the page.
const ME_KEY = 'agentiou.me'
const savedMe = (() => { try { const v = localStorage.getItem(ME_KEY); return v && isAddress(v) ? getAddress(v) : null } catch { return null } })()
export const HAS_ME = DEMO || !!savedMe
export const saveMe = (a: string | null) => { try { if (a && isAddress(a)) localStorage.setItem(ME_KEY, getAddress(a)); else localStorage.removeItem(ME_KEY) } catch { /* storage may be unavailable */ } location.reload() }
export const ME: string = DEMO ? addr(0x142) : savedMe ?? '0x0000000000000000000000000000000000000000'
export const MART: string = DEMO ? addr(0xa11) : env.VITE_MART && isAddress(env.VITE_MART) ? getAddress(env.VITE_MART) : '0x0000000000000000000000000000000000000000'
export const MIRA = addr(0x2b7), SAM = addr(0x3c9), RAFI = addr(0x4d1), LINA = addr(0x5e3), OMAR = addr(0x9c5)
const T0 = Date.now()
const u = (address: string, nickname: string, no: number, onTime: number, people: number, late = 0, extra: Partial<User> = {}): User => ({
  address, nickname, no, joinedAt: T0 - (160 - no) * DAY * 0.2 - 3 * DAY, onTime, late, defaults: 0, people, xp: 50 + onTime * 30, claimed: [0, 0, 0], pocket: [0, 0, 0], stickers: {}, badges: onTime >= 0 && nickname !== 'promise-mart' ? { 'IOU Verified': T0 - 20 * DAY, ...(onTime > 0 ? { 'First Promise': T0 - 12 * DAY } : {}), ...(onTime >= 3 ? { Trusted: T0 - 8 * DAY } : {}), ...(onTime >= 10 && people >= 3 ? { 'Highly Trusted': T0 - 3 * DAY } : {}) } : {}, checkDays: 0, lastCheck: 0, ...extra })
export const seedUsers = (): User[] => [
  u(ME, 'tuku', 142, 4, 2, 0, { xp: 350, checkDays: 2, lastCheck: T0 - DAY, claimed: [2, 1, 0], pocket: [1, 0, 0],
    stickers: { 1: { edition: 9, block: 52_340_118, time: T0 - 6 * DAY }, 4: { edition: 42, block: 52_512_904, time: T0 - 2 * DAY }, 7: { edition: 17, block: 52_540_377, time: T0 - DAY } },
    badges: { 'IOU Verified': T0 - 9 * DAY, 'First Promise': T0 - 6 * DAY, Trusted: T0 - 2 * DAY } }),
  u(MART, 'promise-mart', 1, 0, 0), u(MIRA, 'mira', 12, 11, 5), u(SAM, 'sam', 57, 3, 2), u(RAFI, 'rafi', 31, 6, 3, 1), u(LINA, 'lina', 88, 1, 1),
  u(OMAR, 'omar', 71, 2, 2, 1),
  u(addr(0x6f2), 'kojo', 19, 9, 4), u(addr(0x7a8), 'ines', 23, 12, 6), u(addr(0x8b4), 'dev-han', 64, 2, 1),
]
export const seedOffers = (): Offer[] => [
  { id: 1, design: 1, title: 'Day one sticker', asset: 'USDT', price: 0.01, termDays: 2, stock: 100, taken: 31 },
  { id: 2, design: 2, title: 'Night owl sticker', asset: 'USDT', price: 0.03, termDays: 3, stock: 100, taken: 22 },
  { id: 3, design: 3, title: 'Good word sticker', asset: 'USDT', price: 0.05, termDays: 5, stock: 100, taken: 100 },
]
const i = (id: number, creditor: string, debtor: string, asset: Asset, amount: number, created: number, due: number, status: Status, memo: string, repaid?: number, offerId?: number): Iou => ({
  id, creditor, debtor, asset, amount, usd: asset === 'BNB' ? amount * BNB_USD : amount, createdAt: T0 + created * DAY, dueAt: T0 + due * DAY, status, memo, repaidAt: repaid != null ? T0 + repaid * DAY : status === 'Repaid' ? T0 + (due - 0.3) * DAY : undefined, offerId })
export const seedIous = (): Iou[] => [
  i(1, MART, ME, 'USDT', 0.01, -8, -6, 'Repaid', 'Day one sticker', -6.4, 1),
  i(2, MIRA, ME, 'USDT', 1, -6, -3, 'Repaid', 'Tea'),
  i(3, RAFI, ME, 'BNB', 0.0005, -5, -2, 'Repaid', 'Bus fare', -3.5),
  i(4, MIRA, ME, 'USDT', 2, -3, -1, 'Repaid', 'Lunch', -1.6),
  i(5, RAFI, ME, 'BNB', 0.0004, -0.2, 1.8, 'Active', 'Phone top-up'),
  i(6, MIRA, ME, 'USDT', 2, -1, 5, 'Active', 'Notebook'),
  i(7, SAM, ME, 'USDT', 1.5, -0.1, 7, 'Pending', 'Coffee beans'),
  i(8, ME, LINA, 'USDT', 0.5, -2, 4, 'Active', 'Print shop'),
  i(9, MIRA, OMAR, 'USDT', 0.5, -9, -2, 'Active', 'Groceries'),
  i(10, RAFI, OMAR, 'USDT', 0.3, -6, -1, 'Active', 'Data pack'),
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

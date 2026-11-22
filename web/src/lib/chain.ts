import { createPublicClient, defineChain, fallback, formatEther, getAddress, http, parseAbi, type Abi } from 'viem'
import abiJson from '../data/abi.json'
import { AGENT_ID, BADGES, BNB_FEED, CONTRACT, DAY, MART, ME, HAS_ME, RPCS, USDT, type Iou, type Offer, type Status, type User } from './data'

/* Live mode: everything the site shows is read from the AgentIOU contract. The site only reads; it never signs or sends anything. */
const ABI = abiJson as Abi
const EXTRA = parseAbi(['function balanceOf(address) view returns (uint256)', 'function allowance(address owner, address spender) view returns (uint256)', 'function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)'])
// our own short description of the chain, so the site carries no RPC or explorer addresses other than the ones it is allowed to use
const bsc = defineChain({ id: 56, name: 'BNB Smart Chain', nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }, rpcUrls: { default: { http: RPCS } } })
const client = createPublicClient({ chain: bsc, transport: fallback(RPCS.map((u) => http(u, { batch: { wait: 20 }, timeout: 12_000 }))) })
const C = CONTRACT as `0x${string}`
const read = <T,>(functionName: string, args: unknown[] = []) => client.readContract({ address: C, abi: ABI, functionName, args }) as Promise<T>

interface RawUser { joinedAt: number; no: number; onTime: number; late: number; defaults: number; people: number; good: number; owedCents: number; xp: number; badges: number; claimed: readonly number[]; pocket: readonly number[]; checkDay: number; checkDays: number; xpDay: number; takesToday: number; nickname: string }
interface RawIou { creditor: string; debtor: string; asset: number; status: number; createdAt: number; dueAt: number; repaidAt: number; usdCents: number; offerId: number; amount: bigint; memo: string }
interface RawOffer { shop: string; asset: number; active: boolean; termDays: number; stock: number; taken: number; designId: number; price: bigint; title: string }
export interface ChainView { level: number; score: number; restricted: boolean; overdue: boolean; owed: number }
export interface Snapshot { users: User[]; ious: Iou[]; offers: Offer[]; chain: Map<string, ChainView>; bnbUsd: number; holdsAgentId: boolean | null; /** BNB the contract is keeping for me because a repayment could not be delivered to my wallet */ credit: number; /** USDT the shop can lend right now: the smaller of its balance and its approval */ shopFunds: number; print: string }

const STATUS: Status[] = ['Pending', 'Active', 'Repaid', 'Declined', 'Cancelled']
const num = (v: bigint) => Number(formatEther(v))
const iou = (id: bigint, x: RawIou): Iou => ({ id: Number(id), creditor: getAddress(x.creditor), debtor: getAddress(x.debtor), asset: x.asset === 0 ? 'BNB' : 'USDT', amount: num(x.amount), raw: x.amount.toString(), usd: x.usdCents / 100,
  createdAt: x.createdAt * 1000, dueAt: x.dueAt * 1000, repaidAt: x.repaidAt ? x.repaidAt * 1000 : undefined, status: STATUS[x.status], memo: x.memo, offerId: x.offerId || undefined })

export async function loadAll(): Promise<Snapshot> {
  const usdt = (functionName: 'balanceOf' | 'allowance', args: `0x${string}`[]) => client.readContract({ address: USDT as `0x${string}`, abi: EXTRA, functionName, args } as never) as Promise<bigint>
  const [members, offersRaw, recent, mine, feed, holds, credit, shopBal, shopOk, head] = await Promise.all([
    read<string[]>('getUsers', [0n, 200n]), read<RawOffer[]>('getOffers', [0n, 60n]), read<[bigint[], RawIou[]]>('getRecentIOUs', [300n]),
    HAS_ME ? read<[bigint[], RawIou[]]>('getUserIOUs', [ME, 0n, 300n]) : Promise.resolve<[bigint[], RawIou[]]>([[], []]),
    client.readContract({ address: BNB_FEED as `0x${string}`, abi: EXTRA, functionName: 'latestRoundData' }).catch(() => null),
    HAS_ME ? client.readContract({ address: AGENT_ID as `0x${string}`, abi: EXTRA, functionName: 'balanceOf', args: [ME as `0x${string}`] }).then((n) => n > 0n).catch(() => null) : Promise.resolve(null),
    HAS_ME ? read<bigint>('credits', [ME]) : Promise.resolve(0n),
    usdt('balanceOf', [MART as `0x${string}`]).catch(() => 0n), usdt('allowance', [MART as `0x${string}`, C]).catch(() => 0n),
    client.getBlock().catch(() => null),
  ])
  const chainDay = Math.floor((head ? Number(head.timestamp) * 1000 : Date.now()) / DAY)   // the contract's own calendar day
  const addrs = [...new Set([...members.map((a) => getAddress(a)), ...(HAS_ME ? [ME] : [])])]
  const got = await Promise.all(addrs.map((a) => read<[RawUser, number, number, number, boolean, boolean]>('getUser', [a])))
  // sticker shelves: every design for me, and for the rest while the member list is small enough to ask in one go
  const shelfFor = addrs.filter((a, i) => got[i][0].joinedAt && (a === ME || addrs.length <= 60))
  const mints = await Promise.all(shelfFor.flatMap((a) => Array.from({ length: 12 }, (_, d) => read<[number, bigint, number]>('mintInfo', [a, BigInt(d + 1)]))))
  const chain = new Map<string, ChainView>(), users: User[] = []
  addrs.forEach((a, i) => {
    const [u, level, score, , overdue, restricted] = got[i]
    if (!u.joinedAt) return
    const t = u.joinedAt * 1000, stickers: User['stickers'] = {}, k = shelfFor.indexOf(a)
    if (k >= 0) for (let d = 0; d < 12; d++) { const m = mints[k * 12 + d]; if (m[0]) stickers[d + 1] = { edition: m[0], block: Number(m[1]), time: m[2] * 1000 } }
    const badges: User['badges'] = {}; BADGES.forEach((b, n) => { if (u.badges & (1 << n)) badges[b.key] = t })
    users.push({ address: a, nickname: u.nickname, no: u.no, joinedAt: t, onTime: u.onTime, late: u.late, defaults: u.defaults, people: u.people, xp: u.xp, good: u.good,
      claimed: [u.claimed[0], u.claimed[1], u.claimed[2]], pocket: [u.pocket[0], u.pocket[1], u.pocket[2]], stickers, badges, checkDays: u.checkDays, lastCheck: u.checkDay ? u.checkDay * DAY + DAY / 2 : 0, takesToday: u.xpDay === chainDay ? u.takesToday : 0 })
    chain.set(a, { level, score, restricted, overdue, owed: u.owedCents / 100 })
  })
  const byId = new Map<number, Iou>()
  for (const [ids, list] of [recent, mine]) ids.forEach((id, i) => byId.set(Number(id), iou(id, list[i])))
  const ious = [...byId.values()].sort((a, b) => a.id - b.id)
  const offers: Offer[] = offersRaw.map((o, i) => ({ o, id: i + 1 })).filter(({ o }) => o.active && getAddress(o.shop) === MART)
    .map(({ o, id }) => ({ id, design: o.designId, title: o.title, asset: o.asset === 0 ? 'BNB' as const : 'USDT' as const, price: num(o.price), termDays: o.termDays, stock: o.stock, taken: o.taken }))
  const me = users.find((x) => x.address === ME)
  // what would change when one of my own transactions lands; the tray waits for this to move
  const print = JSON.stringify([me && [me.nickname, me.xp, me.onTime, me.late, me.defaults, me.claimed, me.pocket, me.lastCheck, Object.keys(me.stickers)], credit.toString(), ious.filter((x) => x.creditor === ME || x.debtor === ME).map((x) => [x.id, x.status])])
  return { users, ious, offers, chain, bnbUsd: feed && feed[1] > 0n ? Number(feed[1]) / 1e8 : 0, holdsAgentId: holds, credit: num(credit), shopFunds: num(shopBal < shopOk ? shopBal : shopOk), print }
}
/** Has my wallet approved the contract to move at least this much USDT? (The first of the two repay steps.) */
export const usdtAllowanceAtLeast = async (raw: string) => (await client.readContract({ address: USDT as `0x${string}`, abi: EXTRA, functionName: 'allowance', args: [ME as `0x${string}`, C] })) >= BigInt(raw)

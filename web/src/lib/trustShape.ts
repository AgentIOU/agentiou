// One shape for a wallet's AgentIOU record, used by the Open Trust page and by the web API (functions/api/trust),
// so the page and the API always show the same numbers for the same answer from the contract.
// Pure: no browser, no environment, so the Cloudflare function can import it too.

/** The contract this site reads (BNB Smart Chain mainnet). Public, verified on BscScan. */
export const AGENTIOU_MAINNET = '0x75DE83b3CE69c8eE363BE702FD3cd02e9Ab7F3f8'
export const SITE = 'https://agentiou.pages.dev'

export interface Trust {
  address: string
  /** Joined AgentIOU (IOU Verified). When false, every number below is 0 and every flag false. */
  verified: boolean
  trustScore: number
  level: number
  limitUsd: number
  /** At least one IOU past its due date and not repaid. */
  overdue: boolean
  /** Two IOUs past due, or one more than 7 days late: cannot borrow on AgentIOU until repaid. */
  restricted: boolean
  onTimeRepays: number
  late: number
  defaults: number
  peopleDealtWith: number
}

/** What getUser(address) returns: the member record, then level, score, limit in cents, overdue, restricted. */
export type GetUserResult = readonly [
  { joinedAt: number; onTime: number; late: number; defaults: number; people: number },
  number, number, number, boolean, boolean,
]

export function toTrust(address: string, r: GetUserResult): Trust {
  const [u, level, score, limitCents, overdue, restricted] = r
  const verified = u.joinedAt > 0
  return {
    address, verified,
    trustScore: verified ? score : 0, level: verified ? level : 0, limitUsd: verified ? limitCents / 100 : 0,
    overdue: verified && overdue, restricted: verified && restricted,
    onTimeRepays: verified ? u.onTime : 0, late: verified ? u.late : 0, defaults: verified ? u.defaults : 0, peopleDealtWith: verified ? u.people : 0,
  }
}

// Proof that a visitor controls a wallet, without a login, a wallet connection or a server.
// The site writes an EIP-712 message; the visitor's own Agentic Wallet signs it (a signature only: no transaction, no gas);
// the visitor pastes the signature back, and the site checks it here in the browser. Nothing is sent anywhere.
// The message names this device's code and an expiry, so a signature made for one device or one request is no use on another.
import { getAddress, hashTypedData, recoverAddress } from 'viem'
import { CONTRACT, deviceId, type Proof } from './data'

export const STATEMENT = 'I own this wallet. Show its AgentIOU profile as mine on this device. This signature moves no money and approves nothing.'
/** How long a request stays open: long enough to visit the agent app and come back. */
export const ASK_SECONDS = 15 * 60
const ASK_KEY = 'agentiou.ask'
const TYPES = { Proof: [{ name: 'statement', type: 'string' }, { name: 'wallet', type: 'address' }, { name: 'device', type: 'string' }, { name: 'issued', type: 'uint256' }, { name: 'expires', type: 'uint256' }] } as const
const DOMAIN_TYPE = [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' }]
const domain = () => ({ name: 'AgentIOU', version: '1', chainId: 56, verifyingContract: (CONTRACT ?? '0x0000000000000000000000000000000000000000') as `0x${string}` })

/** One open request: which wallet, for which device, until when. */
export interface Ask { wallet: string; device: string; issued: number; expires: number }
const validAsk = (a: unknown): a is Ask => { const x = a as Ask; return !!x && typeof x.wallet === 'string' && /^0x[0-9a-fA-F]{40}$/.test(x.wallet) && typeof x.device === 'string' && Number.isInteger(x.issued) && Number.isInteger(x.expires) }
const nowS = () => Math.floor(Date.now() / 1000)

/** Start a request for this wallet on this device. It is kept on the device so the same prompt is still there after a visit to the agent app. */
export function newAsk(wallet: string): Ask {
  const issued = nowS(); const a: Ask = { wallet: getAddress(wallet), device: deviceId(), issued, expires: issued + ASK_SECONDS }
  try { localStorage.setItem(ASK_KEY, JSON.stringify(a)) } catch { /* storage may be unavailable */ }
  return a
}
/** The open request, if it is for this device and has not run out. */
export function openAsk(): Ask | null {
  try { const a = JSON.parse(localStorage.getItem(ASK_KEY) ?? 'null'); return validAsk(a) && a.device === deviceId() && a.expires > nowS() ? a : null } catch { return null }
}
export const dropAsk = () => { try { localStorage.removeItem(ASK_KEY) } catch { /* nothing to drop */ } }

const message = (a: Ask) => ({ statement: STATEMENT, wallet: getAddress(a.wallet), device: a.device, issued: BigInt(a.issued), expires: BigInt(a.expires) })
const digest = (a: Ask) => hashTypedData({ domain: domain(), types: TYPES, primaryType: 'Proof', message: message(a) })
/** The request exactly as the Agentic Wallet's sign-message command takes it. */
export const signRequest = (a: Ask) => JSON.stringify({ method: 'eth_signTypedData_v4', params: [getAddress(a.wallet), JSON.stringify({ domain: domain(), primaryType: 'Proof', types: { EIP712Domain: DOMAIN_TYPE, ...TYPES }, message: { statement: STATEMENT, wallet: getAddress(a.wallet), device: a.device, issued: String(a.issued), expires: String(a.expires) } })] })

/** Does this signature (r and s, with either recovery value) come from the request's wallet? Returns the full signature if so. */
async function signedBy(a: Ask, rs: string): Promise<`0x${string}` | null> {
  const hash = digest(a)
  for (const v of ['1b', '1c']) {
    const signature = `0x${rs.toLowerCase()}${v}` as `0x${string}`
    try { if ((await recoverAddress({ hash, signature })) === getAddress(a.wallet)) return signature } catch { /* not a valid signature with this recovery value */ }
  }
  return null
}
export type CheckResult = { ok: true; proof: Proof } | { ok: false; why: 'none' | 'expired' | 'wrong' }
/** Check what the visitor pasted: their agent's whole answer, or just the signature. */
export async function checkPasted(a: Ask, pasted: string): Promise<CheckResult> {
  const m = pasted.match(/(?<![0-9a-fA-F])(?:0x)?([0-9a-fA-F]{128})(?:[0-9a-fA-F]{2})?(?![0-9a-fA-F])/)
  if (!m) return { ok: false, why: 'none' }
  if (a.expires <= nowS()) return { ok: false, why: 'expired' }
  const sig = await signedBy(a, m[1])
  return sig ? { ok: true, proof: { ...a, sig } } : { ok: false, why: 'wrong' }
}
/** Re-check a proof kept on this device (at page load): right device, right wallet, real signature. */
export async function proofHolds(p: Proof): Promise<boolean> {
  if (p.device !== deviceId()) return false
  return (await signedBy(p, p.sig.slice(2, 130))) !== null
}

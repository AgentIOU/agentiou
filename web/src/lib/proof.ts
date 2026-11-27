// Proof that a visitor controls a wallet, without a login, a wallet connection or a server.
// The proof is one of the wallet's own transactions to the AgentIOU contract: joining, checking in, or setting the same nickname again.
// The site adds a few extra bytes to the end of that call's data: the mark of a long random seal that this device made and keeps to itself.
// The contract ignores the extra bytes. The site then reads the transaction from the chain and keeps it, whole and signed, on the device.
// Only the wallet could have signed it, and only the device that holds the seal can show that the mark is its own, so a transaction that
// anyone can read on-chain is no use on another device. Checking it needs no server and no chain call: it is done here in the browser.
// (Devices that proved earlier with a signed message keep working: that first kind of proof is still checked below.)
import { getAddress, hashTypedData, keccak256, parseTransaction, recoverAddress, recoverTransactionAddress, serializeTransaction, stringToHex, toHex, type Transaction } from 'viem'
import { CONTRACT, deviceId, isTxProof, sealOf, type AnyProof, type Proof, type TxProof } from './data'

/** How long a request stays open: long enough to visit the agent app and come back. */
export const ASK_SECONDS = 15 * 60
const ASK_KEY = 'agentiou.ask'
const MARK = stringToHex('AGENTIOU1').slice(2)
/** What is added to the end of the call's data: a fixed word and the hash of the device's seal (hex, no 0x). The seal cannot be worked out from it. */
export const markOf = (seal: `0x${string}`) => (MARK + keccak256(seal).slice(2)).toLowerCase()

/** Which call carries the mark: joining (a new member), today's check-in (a member who has not checked in), or the same nickname again (a member who has). */
export type Carrier = 'join' | 'checkIn' | 'nick'
/** One open request: which wallet, this device's new seal, the call that carries its mark, and where the wallet stood when it was made. */
export interface Ask { v: 2; wallet: string; seal: `0x${string}`; issued: number; expires: number; carrier: Carrier; nick: string; nonce: number; block: number }
const validAsk = (a: unknown): a is Ask => { const x = a as Ask; return !!x && x.v === 2 && typeof x.wallet === 'string' && /^0x[0-9a-fA-F]{40}$/.test(x.wallet) && typeof x.seal === 'string' && /^0x[0-9a-f]{64}$/.test(x.seal) && Number.isInteger(x.issued) && Number.isInteger(x.expires) && ['join', 'checkIn', 'nick'].includes(x.carrier) && typeof x.nick === 'string' && Number.isInteger(x.nonce) && Number.isInteger(x.block) }
const nowS = () => Math.floor(Date.now() / 1000)

/** Start a request for this wallet on this device. It is kept on the device so the same prompt is still there after a visit to the agent app. */
export function newAsk(wallet: string, carrier: Carrier, nick: string, nonce: number, block: number): Ask {
  const issued = nowS(); const a: Ask = { v: 2, wallet: getAddress(wallet), seal: toHex(crypto.getRandomValues(new Uint8Array(32))), issued, expires: issued + ASK_SECONDS, carrier, nick, nonce, block }
  try { localStorage.setItem(ASK_KEY, JSON.stringify(a)) } catch { /* storage may be unavailable */ }
  return a
}
/** The open request, if it has not run out. */
export function openAsk(): Ask | null {
  try { const a = JSON.parse(localStorage.getItem(ASK_KEY) ?? 'null'); return validAsk(a) && a.expires > nowS() ? a : null } catch { return null }
}
export const dropAsk = () => { try { localStorage.removeItem(ASK_KEY) } catch { /* nothing to drop */ } }

/** A transaction read from the chain, put back into the exact bytes its wallet signed. Null if they do not hash to the transaction's own hash. */
export function rawOf(tx: Transaction): `0x${string}` | null {
  try {
    const base = { chainId: tx.chainId, nonce: tx.nonce, gas: tx.gas, to: tx.to ?? undefined, value: tx.value, data: tx.input }, sig = { r: tx.r, s: tx.s, v: tx.v, yParity: tx.yParity }
    const ser = tx.type === 'legacy' ? serializeTransaction({ ...base, gasPrice: tx.gasPrice, type: 'legacy' }, sig as never)
      : tx.type === 'eip2930' ? serializeTransaction({ ...base, gasPrice: tx.gasPrice, accessList: tx.accessList, type: 'eip2930' } as never, sig as never)
      : tx.type === 'eip1559' ? serializeTransaction({ ...base, maxFeePerGas: tx.maxFeePerGas, maxPriorityFeePerGas: tx.maxPriorityFeePerGas, accessList: tx.accessList, type: 'eip1559' } as never, sig as never) : null
    return ser && keccak256(ser) === tx.hash ? ser : null
  } catch { return null }
}
/** Is this signed transaction a call to the AgentIOU contract, signed by this wallet, whose data ends with the mark of this seal? */
async function madeBy(raw: `0x${string}`, wallet: string, seal: `0x${string}`): Promise<boolean> {
  try {
    const t = parseTransaction(raw)
    if (!CONTRACT || !t.to || getAddress(t.to) !== getAddress(CONTRACT) || !t.data || !t.data.toLowerCase().endsWith(markOf(seal))) return false
    return (await recoverTransactionAddress({ serializedTransaction: raw as never })) === getAddress(wallet)
  } catch { return false }
}
export type CheckResult = { ok: true; proof: TxProof } | { ok: false; why: 'other' | 'mark' | 'unreadable' }
/** Check a transaction found on the chain against an open request. */
export async function checkTx(a: Ask, tx: Transaction): Promise<CheckResult> {
  if (tx.from.toLowerCase() !== a.wallet.toLowerCase() || !tx.to || !CONTRACT || tx.to.toLowerCase() !== CONTRACT.toLowerCase()) return { ok: false, why: 'other' }
  if (!tx.input.toLowerCase().endsWith(markOf(a.seal))) return { ok: false, why: 'mark' }
  const raw = rawOf(tx)
  return raw && (await madeBy(raw, a.wallet, a.seal)) ? { ok: true, proof: { v: 2, wallet: getAddress(a.wallet), raw } } : { ok: false, why: 'unreadable' }
}
/** Every transaction hash in a pasted text (the agent's whole answer, or the hash alone). Invisible characters some apps add when copying are removed first. */
export function hashesIn(pasted: string): `0x${string}`[] {
  const out: `0x${string}`[] = []
  for (const m of pasted.replace(/[\u00AD\u180E\u200B-\u200F\u2060-\u2064\uFEFF]/g, '').matchAll(/(?<![0-9a-fA-Fx])(?:0x)?([0-9a-fA-F]{64})(?![0-9a-fA-F])/g)) { const h = ('0x' + m[1].toLowerCase()) as `0x${string}`; if (!out.includes(h)) out.push(h) }
  return out
}

// ---- the first kind of proof: a signed EIP-712 message that names the device's code. No new ones are made; kept ones are still checked.
const TYPES = { Proof: [{ name: 'statement', type: 'string' }, { name: 'wallet', type: 'address' }, { name: 'device', type: 'string' }, { name: 'issued', type: 'uint256' }, { name: 'expires', type: 'uint256' }] } as const
const STATEMENT = 'I own this wallet. Show its AgentIOU profile as mine on this device. This signature moves no money and approves nothing.'
const domain = () => ({ name: 'AgentIOU', version: '1', chainId: 56, verifyingContract: (CONTRACT ?? '0x0000000000000000000000000000000000000000') as `0x${string}` })
type Signed = Pick<Proof, 'wallet' | 'device' | 'issued' | 'expires'>
const digest = (a: Signed) => hashTypedData({ domain: domain(), types: TYPES, primaryType: 'Proof', message: { statement: STATEMENT, wallet: getAddress(a.wallet), device: a.device, issued: BigInt(a.issued), expires: BigInt(a.expires) } })
/** Does this signature (r and s, with either recovery value) come from the request's wallet? Returns the full signature if so. */
async function signedBy(a: Signed, rs: string): Promise<`0x${string}` | null> {
  const hash = digest(a)
  for (const v of ['1b', '1c']) {
    const signature = `0x${rs.toLowerCase()}${v}` as `0x${string}`
    try { if ((await recoverAddress({ hash, signature })) === getAddress(a.wallet)) return signature } catch { /* not a valid signature with this recovery value */ }
  }
  return null
}
/** Re-check a proof kept on this device (at page load). It is checked here in the browser; nothing is asked of the chain or of a server. */
export async function proofHolds(p: AnyProof): Promise<boolean> {
  if (isTxProof(p)) { const seal = sealOf(); return !!seal && madeBy(p.raw, p.wallet, seal) }
  if (p.device !== deviceId()) return false
  return (await signedBy(p, p.sig.slice(2, 130))) !== null
}

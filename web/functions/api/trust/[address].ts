// GET /api/trust/0x… : one wallet's AgentIOU record as plain JSON, read from the contract at the moment of the request.
// Read only: no key, no account, nothing stored. Any app or exchange may call it; CORS is open.
// Runs as a Cloudflare Pages Function. If it is ever unavailable, the same numbers can be read from the contract directly.
import { createPublicClient, defineChain, fallback, getAddress, http, isAddress, type Abi } from 'viem'
import abiJson from '../../../src/data/abi.json'
import { AGENTIOU_MAINNET, SITE, toTrust, type GetUserResult } from '../../../src/lib/trustShape'

interface Env { RPC_URL?: string; CONTRACT?: string }
interface Ctx { request: Request; params: Record<string, string | string[]>; env: Env; waitUntil(p: Promise<unknown>): void }

const RPCS = ['https://bsc-dataseed.bnbchain.org', 'https://bsc-dataseed1.bnbchain.org', 'https://bsc-rpc.publicnode.com']
const CACHE_SECONDS = 30
const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
}
const json = (body: unknown, status: number, cache = 'no-store') =>
  new Response(JSON.stringify(body, null, 2) + '\n', { status, headers: { ...HEADERS, 'Cache-Control': cache } })

export async function onRequestGet({ request, params, env, waitUntil }: Ctx): Promise<Response> {
  const raw = String(Array.isArray(params.address) ? params.address[0] : params.address ?? '').trim()
  // all lowercase, or mixed case with a correct checksum; a mixed-case address whose checksum is wrong is most likely a typo, so it is refused
  if (!isAddress(raw)) {
    return json({ error: 'invalid_address', message: 'Use a BNB Smart Chain wallet address: 0x followed by 40 hex characters, all lowercase or with a correct checksum. Lookups are by address only.' }, 400)
  }
  const address = getAddress(raw.toLowerCase())
  const contract = env.CONTRACT && isAddress(env.CONTRACT) ? getAddress(env.CONTRACT) : AGENTIOU_MAINNET

  // the same wallet asked again within 30 seconds gets the same answer without another chain read
  const key = new Request(new URL(`/api/trust/${address.toLowerCase()}`, request.url).toString())
  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default
  try { const hit = await cache?.match(key); if (hit) return hit } catch { /* no cache here: read the chain */ }

  const rpcs = env.RPC_URL ? [env.RPC_URL] : RPCS
  const chain = defineChain({ id: 56, name: 'BNB Smart Chain', nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }, rpcUrls: { default: { http: rpcs } } })
  const client = createPublicClient({ chain, transport: fallback(rpcs.map((u) => http(u, { timeout: 6_000, retryCount: 0 })), { retryCount: 1 }) })
  let r: GetUserResult
  try {
    r = (await client.readContract({ address: contract as `0x${string}`, abi: abiJson as Abi, functionName: 'getUser', args: [address] })) as unknown as GetUserResult
  } catch {
    return json({ error: 'chain_unavailable', message: 'Could not read BNB Smart Chain just now. Try again, or read the contract directly.', contract }, 502)
  }
  const body = { ...toTrust(address, r), readAt: new Date().toISOString(), contract, chain: 'BNB Smart Chain (56)', docs: `${SITE}/trust` }
  const res = json(body, 200, `public, max-age=${CACHE_SECONDS}`)
  try { if (cache) waitUntil(cache.put(key, res.clone())) } catch { /* caching is optional */ }
  return res
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: { ...HEADERS, 'Access-Control-Max-Age': '86400' } })
}

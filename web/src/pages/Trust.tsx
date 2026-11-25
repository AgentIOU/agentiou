import { useRef, useState } from 'react'
import { ChevronDown, Copy } from 'lucide-react'
import { DEMO, LEVELS, isAddr, levelOf, score } from '../lib/data'
import { useStore } from '../lib/store'
import { Link } from '../lib/router'
import { useCopy, DemoChip } from '../components/ui'
import { AGENTIOU_MAINNET, SITE, type Trust } from '../lib/trustShape'

/* /trust: Open Trust. Any lender, on-chain or off, can read an Agent ID wallet's AgentIOU record before it lends. Read only. */
const EXAMPLE = '0x54D9a0D1811D32bF68B523A7Aa293D3Ab4e8e325'   // made up for the example (valid checksum, nobody's wallet); the numbers below follow the contract's own formula: 50 + 5×5 on time + 2×3 people = 81
const SOL = `interface IAgentIOU {
    // 0 to 100; 0 if the wallet is not a member
    function trustScore(address wallet) external view returns (uint8);
    // 1 to 3; 0 if the wallet is not a member
    function levelOf(address wallet) external view returns (uint8);
}

contract YourLender {
    IAgentIOU constant IOU = IAgentIOU(${AGENTIOU_MAINNET});

    function checkBorrower(address borrower) internal view {
        require(IOU.levelOf(borrower) > 0, "Not IOU Verified");
        // your own rule:
        require(IOU.trustScore(borrower) >= 60, "Trust Score too low");
    }
}`
const JS = `import { createPublicClient, http } from 'viem'
import { bsc } from 'viem/chains'

// the ABI is public: download it once from ${SITE}/agentiou-abi.json
// (or BscScan) and keep it in your project
import abi from './agentiou-abi.json' with { type: 'json' }
const client = createPublicClient({ chain: bsc, transport: http() })

const [, level, score, , overdue, restricted] = await client.readContract({
  address: '${AGENTIOU_MAINNET}',
  abi,
  functionName: 'getUser',
  args: [wallet],
})
// your own rule, for example:
if (level === 0 || restricted) { /* no loan */ }`

function Block({ title, code, copyText, what }: { title: string; code: string; copyText?: string; what: string }) {
  const copy = useCopy()
  return <div className="mt-5"><div className="flex items-center justify-between gap-3"><h3 className="text-[16px]">{title}</h3><button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(copyText ?? code, what)}><Copy size={15} aria-hidden />Copy</button></div><pre className="code mt-2 overflow-x-auto" style={{ whiteSpace: 'pre', wordBreak: 'normal' }} tabIndex={0}>{code}</pre></div>
}

function Result({ t }: { t: Trust }) {
  const who = <p className="text-[13px] text-muted mb-3">Record for <span className="mono text-chalk break-all">{t.address}</span></p>
  if (!t.verified) return <div className="mt-5 pt-5 border-t border-dashed border-rule" role="status">{who}<span className="pill pill-muted">Not IOU Verified</span><p className="text-muted mt-3">This wallet has not joined AgentIOU, so there is no repayment record to read. Every number reads as 0.</p></div>
  const cells: [string, number][] = [['On-time repays', t.onTimeRepays], ['Late', t.late], ['Defaults', t.defaults], ['People dealt with', t.peopleDealtWith]]
  return (
    <div className="mt-5 pt-5 border-t border-dashed border-rule" role="status">
      {who}
      <p className="flex items-baseline gap-3"><span className="led text-amber text-[56px] leading-none">{String(t.trustScore)}</span><span className="text-muted">Trust Score, out of 100</span></p>
      <div className="flex flex-wrap gap-2 mt-4">
        <span className="pill pill-leaf">IOU Verified</span>
        {t.restricted ? <span className="pill pill-coral">Restricted</span> : <span className="pill pill-leaf">Not restricted</span>}
        {t.overdue ? <span className="pill pill-coral">Has an overdue IOU</span> : <span className="pill pill-leaf">No overdue IOUs</span>}
        <span className="pill pill-iris">Level {t.level}, ${t.limitUsd} limit</span>
      </div>
      <dl className="grid grid-cols-2 gap-2.5 mt-4">{cells.map(([k, v]) => <div key={k} className="rounded-xl border border-rule bg-ink px-3 py-2.5"><dt className="text-[13px] text-muted">{k}</dt><dd className="text-[18px] font-bold">{v}</dd></div>)}</dl>
      <p className="hint mt-3">{DEMO ? 'Demo data in this preview. The live site reads the AgentIOU contract on BNB Smart Chain.' : 'Read live from the AgentIOU contract on BNB Smart Chain. Nothing is saved.'} <Link to="u" param={t.address} className="underline underline-offset-4">Open the profile</Link></p>
    </div>
  )
}

export default function TrustPage() {
  const s = useStore()
  const [addr, setAddr] = useState(''); const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<Trust | null>(null); const [err, setErr] = useState(''); const [at, setAt] = useState(''); const [dev, setDev] = useState(false)
  const bad = addr.trim() !== '' && !isAddr(addr)
  const req = useRef(0)   // each check gets a number; an answer that comes back after the address was changed is thrown away
  const check = async () => {
    const a = addr.trim(); if (!isAddr(a)) return
    const id = ++req.current
    setBusy(true); setErr(''); setRes(null)
    try {
      if (DEMO) {
        const u = s.users.find((x) => x.address.toLowerCase() === a.toLowerCase())
        const lv = u ? levelOf(u) : 0
        setRes(u ? { address: u.address, verified: true, trustScore: score(u), level: lv, limitUsd: LEVELS[lv - 1].limit, overdue: s.hasOverdue(u.address), restricted: s.restricted(u.address), onTimeRepays: u.onTime, late: u.late, defaults: u.defaults, peopleDealtWith: u.people }
          : { address: a, verified: false, trustScore: 0, level: 0, limitUsd: 0, overdue: false, restricted: false, onTimeRepays: 0, late: 0, defaults: 0, peopleDealtWith: 0 })
      } else { const t = await (await import('../lib/chain')).readTrust(a); if (id !== req.current) return; setRes(t) }
    } catch { if (id !== req.current) return; setErr("Can't reach BNB Smart Chain right now. Try again in a moment.") }
    setAt(new Date().toISOString()); setBusy(false)
  }
  const apiUrl = `${SITE}/api/trust/${res?.address ?? EXAMPLE}`
  const extra = { contract: AGENTIOU_MAINNET, chain: 'BNB Smart Chain (56)', docs: `${SITE}/trust` }
  const sample = res ? { ...res, readAt: at, ...extra } : { address: EXAMPLE, verified: true, trustScore: 81, level: 2, limitUsd: 5, overdue: false, restricted: false, onTimeRepays: 5, late: 0, defaults: 0, peopleDealtWith: 3, readAt: '2026-11-25T10:45:00.000Z', ...extra }
  return (
    <div className="wrap relative pt-28 pb-16">
      <div className="grid gap-10 gap-y-8 lg:grid-cols-[1.05fr_1fr] items-start">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="flex flex-wrap items-center gap-3"><h1 className="h2 md:text-[40px]">Open Trust</h1><DemoChip /></div>
          <p className="text-amber font-bold text-[17px] mt-1">Trust Check for DeFi &amp; CEX</p>
          <p className="lead mt-4">Before any app on BNB Chain lends to an Agent ID wallet, it can read that wallet's repayment record from AgentIOU: Trust Score, level, overdue IOUs and whether it is restricted.</p>
        </div>
        <form className="panel p-5 min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2" onSubmit={(e) => { e.preventDefault(); void check() }} aria-labelledby="t-check">
          <h2 id="t-check" className="sr-only">Check a wallet</h2>
          <label className="label" htmlFor="tw">Agentic Wallet address</label>
          <div className="flex gap-2.5"><input id="tw" className="input mono" placeholder="0x…" value={addr} onChange={(e) => { setAddr(e.target.value); req.current++; setRes(null); setErr(''); setBusy(false) }} autoComplete="off" spellCheck={false} aria-describedby="tw-h" /><button className="btn btn-primary" disabled={busy || !isAddr(addr)}>{busy ? 'Reading' : 'Check'}</button></div>
          <p id="tw-h" className={`hint ${bad ? 'text-coral' : ''}`}>{bad ? "This doesn't look like a BNB Smart Chain address." : 'By wallet address only. Nothing is saved.'}</p>
          {err && <p className="text-coral mt-4" role="alert">{err}</p>}
          {res && <Result t={res} />}
        </form>
        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <h2 className="text-[22px] lg:mt-2">How an app uses it</h2>
          <ol className="grid gap-2.5 mt-4">{([['Get the borrower\'s wallet address', 'The Agentic Wallet that holds their Agent ID.'], ['Read their record', 'With the web API or straight from the contract (tap API for developers below). Free: no permission from us, no gas, no account.'], ['Apply your own rule', 'For example: no loan if restricted, a smaller limit under a Trust Score of 60.']] as const).map(([t, d], i) => <li key={t} className="panel p-4 flex gap-3"><span className="w-7 h-7 shrink-0 rounded-full border-[1.5px] border-amber text-amber font-bold text-[14px] inline-flex items-center justify-center">{i + 1}</span><div><p className="font-semibold">{t}</p><p className="text-muted text-[15px] mt-0.5">{d}</p></div></li>)}</ol>
        </div>
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-3">
        <button type="button" className="btn font-extrabold" style={{ borderRadius: 999, minHeight: 48, padding: '0 22px', color: '#2A1A00', background: 'linear-gradient(100deg,#FFC93C,#FFB23F)', boxShadow: '0 8px 20px #FFB23F33' }} aria-expanded={dev} aria-controls="t-dev" onClick={() => setDev(!dev)}><span aria-hidden className="mono text-[14px] rounded-lg px-1.5 py-0.5" style={{ background: '#2A1A0022' }}>{'</>'}</span>API for developers<ChevronDown size={18} aria-hidden className="transition-transform duration-200" style={{ transform: dev ? 'rotate(180deg)' : 'none' }} /></button>
        <span className="text-muted text-[15px]">Free, read only, no key. Web API, contract code and setup for apps and exchanges.</span>
      </div>
      {dev && <div id="t-dev" style={{ animation: 'fadein 200ms' }}>
      <div className="grid gap-10 lg:grid-cols-2 items-start mt-10">
        <section aria-labelledby="t-api" className="min-w-0">
          <h2 id="t-api" className="text-[22px]">Web API</h2>
          <p className="text-muted mt-2">One link, plain JSON. No key, no sign-up, read only. Open to any website or app.</p>
          <Block title="Request" code={`GET ${apiUrl}`} copyText={apiUrl} what="API link copied" />
          <Block title={res ? 'Response for this wallet' : 'Response (example)'} code={JSON.stringify(sample, null, 2)} what="Example copied" />
          <p className="hint mt-3">The API reads the contract at the moment you ask and keeps nothing. The same wallet asked again within 30 seconds gets the same answer. A wrong address gets an error with status 400. If the API is ever down, read the contract directly: same numbers, no server.</p>
        </section>
        <section aria-labelledby="t-direct" className="min-w-0">
          <h2 id="t-direct" className="text-[22px]">Or read the chain directly</h2>
          <p className="text-muted mt-2">No server in between, so it works even if this website is offline.</p>
          <Block title="In a contract (Solidity)" code={SOL} what="Solidity copied" />
          <Block title="In an app or exchange backend (JavaScript, viem)" code={JS} what="JavaScript copied" />
        </section>
      </div>

      <div className="grid gap-10 lg:grid-cols-2 items-start mt-14">
        <section aria-labelledby="t-read" className="min-w-0 overflow-x-auto">
          <h2 id="t-read" className="text-[22px]">What you can read</h2>
          <table className="w-full mt-3 text-[15px]"><thead><tr className="text-left text-muted text-[13px]"><th className="py-2 pr-3 font-semibold">Contract function</th><th className="py-2 font-semibold">Returns</th></tr></thead>
            <tbody>{[['getUser(address)', 'The full record: score, level, limit, overdue, restricted, repay counts'], ['trustScore(address)', '0 to 100 (0 if not a member)'], ['levelOf(address)', '1 to 3 (0 if not a member)']].map(([f, r]) => <tr key={f} className="border-t border-rule"><td className="py-2.5 pr-3 mono text-[13px] text-[#FFD9A0] whitespace-nowrap">{f}</td><td className="py-2.5">{r}</td></tr>)}</tbody></table>
          <p className="hint mt-3">Contract: <a className="mono underline underline-offset-4 break-all" href={`https://bscscan.com/address/${AGENTIOU_MAINNET}#code`} target="_blank" rel="noopener noreferrer">{AGENTIOU_MAINNET}</a> (verified source on BscScan).</p>
        </section>
      </div>
      </div>}
      <div className="mt-10 max-w-[760px]">
        <section aria-label="Rules">
          <p className="border-l-[3px] border-amber pl-4 text-muted">Looks up by wallet address only, never by nickname or Agent ID name. Each app decides its own rules; AgentIOU does not block anyone outside AgentIOU. A record only shows what happened on AgentIOU: it is not a credit rating or financial advice.</p>
        </section>
      </div>
    </div>
  )
}

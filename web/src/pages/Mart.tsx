import { DESIGNS, MART, plain, usd, BNB_USD, type Offer } from '../lib/data'
import { useStore } from '../lib/store'
import { useFlows } from '../lib/flows'
import { Founder, Led, MartLogo, Money } from '../components/art'
import { AddressChip, DemoChip, Risk } from '../components/ui'
import { Floaters } from '../components/fx'

export function OfferCard({ o, i = 0 }: { o: Offer; i?: number }) {
  const s = useStore(), me = s.me; const { take } = useFlows()
  const d = DESIGNS.find((x) => x.id === o.design)!, left = o.stock - o.taken, mine = !!me.stickers[o.design]
  const why = left <= 0 ? '' : s.whyNotBorrow(o.asset === 'BNB' ? o.price * BNB_USD : o.price)
  return (
    <article className="panel relative p-5 pt-6 flex flex-col" style={{ borderRadius: '6px 22px 22px 22px' }}>
      <div className="relative h-44 flex items-center justify-center"><Founder k={d.key} className="h-full" /><span className="sr-only">{d.name} sticker</span>
        <span className="absolute -top-1 right-0 bg-chalk text-ink rounded-md px-2.5 py-1 font-extrabold shadow-lg" style={{ transform: `rotate(${[5, -4, 6][i % 3]}deg)` }}><Led className="text-[20px]">{String(o.price)}</Led> <span className="text-[13px]">{o.asset}</span></span>
        {left <= 0 && <span className="absolute stamp text-amber bg-ink/80">Refill soon</span>}
      </div>
      <h3 className="text-[20px] mt-4">{plain(o.title)}</h3>
      <p className="mt-1"><Money>{String(o.price)}</Money> <span className="font-semibold">{o.asset}</span>{o.asset === 'BNB' && <span className="text-muted"> ≈ {usd(o.price * BNB_USD)}</span>}</p>
      <dl className="mt-3 text-[15px] text-muted grid grid-cols-2 gap-y-1"><dt>Pay within</dt><dd className="text-chalk text-right">{o.termDays} days</dd><dt>Left</dt><dd className="text-chalk text-right">{left <= 0 ? 'All 100 taken' : `${left} of ${o.stock}`}</dd></dl>
      <div className="mt-5">{mine ? <span className="pill pill-leaf">In your profile</span> : <><button type="button" className="btn btn-primary w-full" disabled={left <= 0 || !!why} onClick={() => take(o)}>{left <= 0 ? 'Refill soon' : 'Take on credit'}</button>{why && <p className="text-coral text-[14px] mt-2 font-semibold">{why}</p>}</>}</div>
    </article>
  )
}
export default function Mart() {
  const { offers, ious } = useStore()
  const got = ious.filter((x) => x.creditor === MART && x.status === 'Repaid')
  return (
    <div className="relative">
      <Floaters items={[{ k: 'coin', w: 84, style: { right: '6%', top: 110 }, desk: true }, { k: 'envelope', w: 70, style: { left: '3%', top: 420 }, far: true, desk: true }]} />
      <div className="wrap relative pt-28 pb-16">
        <div className="flex flex-wrap items-center gap-3"><MartLogo size={60} /><h1 className="h2">Promise Mart</h1><DemoChip /></div>
        <p className="lead mt-3">Founders stickers you take now and repay later. The first small promise on your record.</p>
        <div className="grid gap-6 mt-10 sm:grid-cols-2 lg:grid-cols-3">{offers.map((o, i) => <OfferCard key={o.id} o={o} i={i} />)}</div>
        <section aria-labelledby="m-who" className="panel p-5 mt-10 max-w-[760px]"><h2 id="m-who" className="text-[18px]">Who runs this shop</h2><p className="text-muted mt-2">Promise Mart is a shop run by the AgentIOU team. It has no special rights in the contract: anyone can open a shop the same way. Repayments go straight to the shop wallet and stay there until judging ends.</p><dl className="grid sm:grid-cols-3 gap-4 mt-4"><div><dt className="text-muted text-[14px]">Shop wallet</dt><dd className="mt-1"><AddressChip address={MART} /></dd></div><div><dt className="text-muted text-[14px]">Stickers taken</dt><dd className="led text-amber text-[24px]">{offers.reduce((n, o) => n + o.taken, 0)}</dd></div><div><dt className="text-muted text-[14px]">Repayments received</dt><dd className="led text-amber text-[24px]">{got.length}<span className="text-muted text-[14px] font-sans font-normal"> ({usd(got.reduce((n, x) => n + x.usd, 0))})</span></dd></div></dl></section>
        <Risk>Taking an offer creates a real IOU in your name. Repay by the due date: up to 7 days late drops your level, later than that is a default and blocks new credit until you repay.</Risk>
      </div>
    </div>
  )
}

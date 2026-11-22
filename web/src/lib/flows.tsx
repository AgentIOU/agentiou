import { DEMO, DESIGNS, HAS_ME, MART, TIERS, amt, short, type Iou, type Offer } from './data'
import { go } from './router'
import { prompts } from './prompt'
import { useStore } from './store'
import { Link } from './router'

/* Every action is the same five steps: the site writes the call, the visitor's agent previews it, they confirm, the site reads the result. */
export function useFlows() {
  const s = useStore()
  const see = (text: string, to: 'me' | 'tasks' = 'me', label = 'Open My IOUs') => <><p>{text}</p><Link to={to} onClick={s.closeTray} className="btn-text inline-block mt-2 underline underline-offset-4">{label}</Link></>
  const flows = {
    join: (nick: string) => s.openTray({ title: 'Get IOU Verified', note: 'One transaction, gas only. The contract checks that this wallet holds an Agent ID.', steps: [{ label: 'Join', prompt: prompts.join(nick) }], done: 'IOU Verified', pose: 'stamp', apply: () => s.act.join(nick), after: see('You have 50 XP, enough for your first Common sticker voucher.', 'tasks', 'Open Task Hub') }),
    take: (o: Offer) => s.openTray({ title: `Take the ${o.title.toLowerCase()} on credit`, note: `The shop lends you ${amt({ amount: o.price, asset: o.asset })}: it arrives in your wallet${s.me.stickers[o.design] ? '' : ' with the sticker'}. You repay exactly ${amt({ amount: o.price, asset: o.asset })} within ${o.termDays} days. No interest, no fees.`, steps: [{ label: 'Take the offer', prompt: prompts.takeOffer(o.id, o.price, MART, o.termDays) }], done: 'Promise made', pose: 'card', apply: () => s.act.takeOffer(o.id), after: see(`${amt({ amount: o.price, asset: o.asset })} is in your wallet${s.me.stickers[o.design] ? '' : ', the sticker is in your profile,'} and the IOU is on your list with its due date.`) }),
    repay: (x: Iou) => s.openTray({ title: `Repay ${amt(x)}`, note: `${x.asset === 'USDT' ? 'USDT takes two steps: approve this exact amount, then repay.' : 'One step.'} The money goes straight to ${s.name(x.creditor)} (${short(x.creditor)}). Nothing else is sent.`,
      steps: x.asset === 'USDT' ? [{ label: 'Approve the exact amount', prompt: prompts.approveUsdt(x.amount, x.raw), seen: !DEMO && x.raw ? async () => (await import('./chain')).usdtAllowanceAtLeast(x.raw!) : undefined }, { label: 'Repay', prompt: prompts.repayUsdt(x.id, x.amount, x.creditor, s.name(x.creditor)) }] : [{ label: 'Repay', prompt: prompts.repayBnb(x.id, x.amount, x.creditor, s.name(x.creditor), x.raw) }],
      done: 'Paid', pose: 'stamp', apply: () => s.act.repay(x.id), after: <p>Repaid. Your Trust Score and XP are updated.</p> }),
    accept: (x: Iou) => s.openTray({ title: `Accept ${amt(x)} from ${s.name(x.creditor)}`, note: 'Accepting makes this IOU active and counts toward your Credit Pass limit.', steps: [{ label: 'Accept', prompt: prompts.accept(x.id) }], done: 'Accepted', pose: 'card', apply: () => s.act.accept(x.id) }),
    decline: (x: Iou) => s.openTray({ title: `Decline ${amt(x)} from ${s.name(x.creditor)}`, steps: [{ label: 'Decline', prompt: prompts.decline(x.id) }], done: 'Declined', pose: 'rest', apply: () => s.act.decline(x.id) }),
    cancel: (x: Iou) => s.openTray({ title: `Cancel the IOU to ${s.name(x.debtor)}`, note: 'Only possible while it is still waiting for them to accept.', steps: [{ label: 'Cancel', prompt: prompts.cancel(x.id) }], done: 'Cancelled', pose: 'rest', apply: () => s.act.cancel(x.id) }),
    create: (debtor: string, asset: 'BNB' | 'USDT', amount: number, days: number, memo: string) => s.openTray({ title: 'Send this IOU', note: 'Your friend sees it in their Inbox. It only becomes active when they accept.', steps: [{ label: 'Create', prompt: prompts.createIOU(debtor, asset, amount, days, memo) }], done: 'Sent', pose: 'wave', apply: () => s.act.create(debtor, asset, amount, days, memo), after: see('It is on your list as Pending until your friend accepts.') }),
    claim: (tier: number) => s.openTray({ title: `Claim a ${TIERS[tier]} voucher`, note: 'One transaction, gas only. No token approval.', steps: [{ label: 'Claim', prompt: prompts.claim(tier) }], done: 'Claimed', pose: 'ticket', apply: () => s.act.claim(tier), after: <p>The voucher is in your pocket. Pick any {TIERS[tier]} sticker to mint.</p> }),
    checkIn: () => s.openTray({ title: 'Daily check-in', note: 'One small transaction, gas only. It adds 5 XP once a day.', steps: [{ label: 'Check in', prompt: prompts.checkIn() }], done: 'Checked in', pose: 'stamp', apply: () => s.act.checkIn() }),
    setNick: (nick: string) => s.openTray({ title: 'Change your nickname', note: 'One transaction, gas only. Your nickname is public on-chain.', steps: [{ label: 'Save the nickname', prompt: prompts.setNickname(nick) }], done: 'Saved', pose: 'stamp', apply: () => s.act.setNick(nick) }),
    withdraw: (bnb: number) => s.openTray({ title: `Collect ${bnb} BNB`, note: 'A repayment could not be delivered to your wallet, so the contract kept it under your address. This sends it to you. Gas only.', steps: [{ label: 'Collect', prompt: prompts.withdraw() }], done: 'Collected', pose: 'coin', apply: () => undefined }),
    mint: (design: number) => { const d = DESIGNS.find((q) => q.id === design)!; s.openTray({ title: `Mint "${d.name}"`, note: `Uses one ${d.tier} voucher. Gas only, no token approval. The sticker is soulbound: it can't be sold or sent.`, steps: [{ label: 'Mint', prompt: prompts.mint(design) }], done: 'Minted', pose: 'coin', apply: () => s.act.mint(design), after: <p>It is on your shelf with its edition number and mint proof.</p> }) },
  }
  // a guest can look, not act: every action except joining needs a joined wallet, so no prompt is written that the contract would refuse
  if (s.joined) return flows
  const first = () => { s.toast(HAS_ME ? 'Get IOU Verified first. It takes one transaction.' : 'Add your Agentic Wallet address first.', 'bad'); go('start') }
  return Object.fromEntries(Object.entries(flows).map(([k, f]) => [k, k === 'join' ? f : first])) as typeof flows
}

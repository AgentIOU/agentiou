import { encodeFunctionData, formatEther, parseAbi, parseEther } from 'viem'
import { CONTRACT, USDT, type Asset } from './data'

// The interface the AgentIOU contract will expose. The site builds exact calldata from it, so the agent never has to guess.
export const ABI = parseAbi([
  'function join(string nickname)',
  'function takeOffer(uint256 offerId)',
  'function createIOU(address debtor, uint8 asset, uint256 amount, uint16 dueDays, string memo)',
  'function acceptIOU(uint256 id)',
  'function declineIOU(uint256 id)',
  'function cancelIOU(uint256 id)',
  'function repay(uint256 id) payable',
  'function claimVoucher(uint8 tier)',
  'function mintSticker(uint256 designId)',
  'function checkIn()',
  'function setNickname(string nickname)',
  'function withdraw()',
])
const ERC20 = parseAbi(['function approve(address spender, uint256 amount) returns (bool)'])
const SPENDER = (CONTRACT ?? '0x0000000000000000000000000000000000000000') as `0x${string}`
const target = CONTRACT ?? '0x… (the AgentIOU address appears here after the contract is deployed)'
// 9 decimals, not 18: a typed 0.03 is stored by the browser as 0.02999…, and 18 digits would send that tail on-chain
export const wei = (n: number) => parseEther(n.toFixed(9).replace(/0+$/, '').replace(/\.$/, ''))
const assetId = (a: Asset) => (a === 'BNB' ? 0 : 1)

function text(to: string, name: string, sig: string, args: string, value: string, data: string, extra = '') {
  return `Use my Binance Agentic Wallet on BNB Smart Chain (Developer Mode).
Call contract ${to} (${name}).
Function: ${sig}${args ? ', ' + args : ''}. Value: ${value} BNB.
Calldata: ${data}
${extra}Show me the preview and risks first. Do not execute until I confirm.`
}
const mine = (sig: string, args: string, data: string, value = '0', extra = '') => text(target, 'AgentIOU, verified on BscScan', sig, args, value, data, extra)

export const prompts = {
  join: (nick: string) => mine('join(string)', `nickname = "${nick}"`, encodeFunctionData({ abi: ABI, functionName: 'join', args: [nick] })),
  takeOffer: (id: number) => mine('takeOffer(uint256)', `offerId = ${id}`, encodeFunctionData({ abi: ABI, functionName: 'takeOffer', args: [BigInt(id)] })),
  createIOU: (debtor: string, asset: Asset, amount: number, days: number, memo: string) =>
    mine('createIOU(address,uint8,uint256,uint16,string)', `debtor = ${debtor}, asset = ${asset}, amount = ${amount} ${asset}, dueDays = ${days}, memo = "${memo}"`,
      encodeFunctionData({ abi: ABI, functionName: 'createIOU', args: [debtor as `0x${string}`, assetId(asset), wei(amount), days, memo] })),
  accept: (id: number) => mine('acceptIOU(uint256)', `id = ${id}`, encodeFunctionData({ abi: ABI, functionName: 'acceptIOU', args: [BigInt(id)] })),
  decline: (id: number) => mine('declineIOU(uint256)', `id = ${id}`, encodeFunctionData({ abi: ABI, functionName: 'declineIOU', args: [BigInt(id)] })),
  cancel: (id: number) => mine('cancelIOU(uint256)', `id = ${id}`, encodeFunctionData({ abi: ABI, functionName: 'cancelIOU', args: [BigInt(id)] })),
  repayBnb: (id: number, amount: number, to: string, name: string, raw?: string) => mine('repay(uint256)', `id = ${id}`, encodeFunctionData({ abi: ABI, functionName: 'repay', args: [BigInt(id)] }), raw ? formatEther(BigInt(raw)) : String(amount), `This pays exactly ${amount} BNB to ${to} (${name}). Nothing else is sent.\n`),
  approveUsdt: (amount: number, raw?: string) => text(USDT, 'USDT, BSC-USD', 'approve(address,uint256)', `spender = ${target}, amount = ${amount} USDT (exact, not unlimited)`, '0',
    encodeFunctionData({ abi: ERC20, functionName: 'approve', args: [SPENDER, raw ? BigInt(raw) : wei(amount)] }), 'Approve this exact amount only. Never an unlimited approval.\n'),
  repayUsdt: (id: number, amount: number, to: string, name: string) => mine('repay(uint256)', `id = ${id}`, encodeFunctionData({ abi: ABI, functionName: 'repay', args: [BigInt(id)] }), '0', `This moves exactly ${amount} USDT from my wallet to ${to} (${name}). Nothing else is sent.\n`),
  claim: (tier: number) => mine('claimVoucher(uint8)', `tier = ${tier}`, encodeFunctionData({ abi: ABI, functionName: 'claimVoucher', args: [tier] })),
  checkIn: () => mine('checkIn()', '', encodeFunctionData({ abi: ABI, functionName: 'checkIn' })),
  setNickname: (nick: string) => mine('setNickname(string)', `nickname = "${nick}"`, encodeFunctionData({ abi: ABI, functionName: 'setNickname', args: [nick] })),
  withdraw: () => mine('withdraw()', '', encodeFunctionData({ abi: ABI, functionName: 'withdraw' }), '0', 'This only collects BNB that is already kept under my own address. Nothing leaves my wallet.\n'),
  mint: (design: number) => mine('mintSticker(uint256)', `designId = ${design}`, encodeFunctionData({ abi: ABI, functionName: 'mintSticker', args: [BigInt(design)] })),
}

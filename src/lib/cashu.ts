/**
 * 0xPrivacy Casino — Real Cashu wallet layer using @cashu/cashu-ts
 *
 * Uses real Cashu mint interactions:
 *  - Deposit: Lightning invoice from mint → user pays → mint issues proofs
 *  - Withdraw: melt proofs to pay a Lightning invoice
 *  - Token import/export: paste cashuA/cashuB tokens to move funds
 *
 * Revenue model:
 *  - HOUSE_EDGE_PCT  = 2%   (prize pool)
 *  - DEV_FUND_PCT    = 0.5% (dev fund → 0xPrivaxy@cake.cash)
 *  Together = 2.5% total rake.
 *
 * Pool starts at 0 sats. Admin seeds it via Cashu token on the admin dashboard.
 */

import { CashuMint, CashuWallet as SDKWallet, getDecodedToken, getEncodedTokenV4, MintQuoteState } from '@cashu/cashu-ts';
import type { Proof, MintQuoteResponse, MeltQuoteResponse } from '@cashu/cashu-ts';

export { ADMIN_PUBKEY as DEV_FUND_PUBKEY } from './admin';

// ─── Config ──────────────────────────────────────────────────────────────────

export const HOUSE_EDGE_PCT = 0.02;
export const DEV_FUND_PCT = 0.005;
export const TOTAL_RAKE = HOUSE_EDGE_PCT + DEV_FUND_PCT;
export const DEFAULT_MINT_URL = 'https://mint.minibits.cash/Bitcoin';

// Re-export types
export type { Proof, MintQuoteResponse, MeltQuoteResponse };
export { MintQuoteState, getDecodedToken, getEncodedTokenV4 };

// ─── House stats ─────────────────────────────────────────────────────────────

export interface HouseStats {
  poolBalance: number;
  devFundBalance: number;
  totalWagered: number;
  totalPaidOut: number;
}

export function loadHouseStats(): HouseStats {
  try {
    const raw = localStorage.getItem('casino:house');
    if (raw) return JSON.parse(raw) as HouseStats;
  } catch { /* ignore */ }
  return { poolBalance: 0, devFundBalance: 0, totalWagered: 0, totalPaidOut: 0 };
}

export function saveHouseStats(stats: HouseStats): void {
  localStorage.setItem('casino:house', JSON.stringify(stats));
}

// ─── Provably-fair RNG ───────────────────────────────────────────────────────

export async function provablyFairRandom(
  serverSeed: string, clientSeed: string, nonce: number,
): Promise<number> {
  const data = `${serverSeed}:${clientSeed}:${nonce}`;
  const encoded = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = new Uint8Array(hashBuffer);
  const intVal = (hashArray[0] << 24) | (hashArray[1] << 16) | (hashArray[2] << 8) | hashArray[3];
  return (intVal >>> 0) / 0x100000000;
}

export function generateSeed(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Real Cashu Wallet ──────────────────────────────────────────────────────

/**
 * CasinoWallet holds two kinds of balances:
 *
 *  1. Real proofs — actual Cashu ecash minted by the mint. These can be
 *     melted via Lightning or exported as tokens at any time.
 *
 *  2. House credit — an IOU for game winnings. In this client-side model
 *     there is no house server to sign real ecash for payouts, so winnings
 *     are tracked as spendable credit. They can be used to keep playing,
 *     but they cannot be melted/exported until the operator pays them out
 *     (e.g. by sending a real Cashu token to the player).
 *
 * Mixing synthetic proofs with real ones breaks mint operations (the mint
 * rejects invalid commitments), so credit is kept as a plain number.
 */
export class CasinoWallet {
  private proofs: Proof[] = [];
  private _houseCredit = 0;
  private mintUrl: string;
  private sdkWallet: SDKWallet | null = null;

  constructor(mintUrl: string = DEFAULT_MINT_URL) {
    this.mintUrl = mintUrl;
  }

  async init(): Promise<void> {
    if (this.sdkWallet) return;
    const mint = new CashuMint(this.mintUrl);
    this.sdkWallet = new SDKWallet(mint);
    await this.sdkWallet.loadMint();
  }

  /** Real ecash balance (minted proofs only). */
  get realBalance(): number {
    return this.proofs.reduce((s, p) => s + p.amount, 0);
  }

  /** House credit from winnings (IOU, playable but not melt-able). */
  get houseCredit(): number {
    return this._houseCredit;
  }

  /** Total playable balance = real ecash + house credit. */
  get balance(): number {
    return this.realBalance + this._houseCredit;
  }

  getMintUrl(): string { return this.mintUrl; }
  getProofs(): Proof[] { return [...this.proofs]; }

  /** Add playable house credit (e.g. game winnings). */
  addHouseCredit(amount: number): void {
    if (amount > 0) this._houseCredit += amount;
  }

  // ── Deposit (Lightning) ────────────────────────────────────────────────

  async requestMintQuote(amount: number): Promise<MintQuoteResponse> {
    await this.init();
    return this.sdkWallet!.createMintQuote(amount);
  }

  async checkMintQuote(quoteId: string): Promise<MintQuoteResponse> {
    await this.init();
    return this.sdkWallet!.checkMintQuote(quoteId);
  }

  async mintProofs(amount: number, quoteId: string): Promise<Proof[]> {
    await this.init();
    const proofs = await this.sdkWallet!.mintProofs(amount, quoteId);
    this.proofs.push(...proofs);
    return proofs;
  }

  // ── Withdraw (Lightning) ───────────────────────────────────────────────

  async requestMeltQuote(invoice: string): Promise<MeltQuoteResponse> {
    await this.init();
    return this.sdkWallet!.createMeltQuote(invoice);
  }

  async meltProofs(quote: MeltQuoteResponse): Promise<boolean> {
    await this.init();
    const amount = quote.amount + quote.fee_reserve;
    const { keep, send } = await this.sdkWallet!.send(amount, this.proofs);
    this.proofs = keep;
    try {
      const result = await this.sdkWallet!.meltProofs(quote, send);
      if (result.change && result.change.length > 0) {
        this.proofs.push(...result.change);
      }
      return true;
    } catch (e) {
      // Return send proofs on failure
      this.proofs.push(...send);
      throw e;
    }
  }

  // ── Token import / export ──────────────────────────────────────────────

  async receiveToken(tokenStr: string): Promise<number> {
    await this.init();
    const received = await this.sdkWallet!.receive(tokenStr);
    this.proofs.push(...received);
    return received.reduce((s, p) => s + p.amount, 0);
  }

  async exportToken(amount: number): Promise<string> {
    await this.init();
    const { keep, send } = await this.sdkWallet!.send(amount, this.proofs);
    this.proofs = keep;
    return getEncodedTokenV4({ mint: this.mintUrl, proofs: send });
  }

  exportBackup(): string {
    if (this.proofs.length === 0) return '';
    return getEncodedTokenV4({ mint: this.mintUrl, proofs: this.proofs });
  }

  // ── Game operations ────────────────────────────────────────────────────

  /**
   * Deduct a bet. Spends house credit first; only touches real proofs
   * (via the mint) for the remainder. Real ecash is never contaminated.
   */
  async deductBet(amount: number): Promise<void> {
    if (this.balance < amount) throw new Error('Insufficient balance');

    const fromCredit = Math.min(this._houseCredit, amount);
    const fromProofs = amount - fromCredit;

    this._houseCredit -= fromCredit;

    if (fromProofs > 0) {
      await this.init();
      const { keep } = await this.sdkWallet!.send(fromProofs, this.proofs);
      this.proofs = keep;
    }
  }

  addProofs(proofs: Proof[]): void {
    this.proofs.push(...proofs);
  }

  // ── Serialisation ──────────────────────────────────────────────────────

  toJSON(): { proofs: Proof[]; mintUrl: string; houseCredit: number } {
    return { proofs: this.proofs, mintUrl: this.mintUrl, houseCredit: this._houseCredit };
  }

  static fromJSON(data: { proofs: Proof[]; mintUrl: string; houseCredit?: number }): CasinoWallet {
    const w = new CasinoWallet(data.mintUrl);
    w.proofs = data.proofs ?? [];
    w._houseCredit = data.houseCredit ?? 0;
    return w;
  }
}

// ─── Wager processing ────────────────────────────────────────────────────────

export function processWager(betAmount: number, multiplier: number): {
  payout: number; houseEdgeTaken: number; devFundTaken: number; netToPool: number;
} {
  const houseEdgeTaken = Math.floor(betAmount * HOUSE_EDGE_PCT);
  const devFundTaken = Math.floor(betAmount * DEV_FUND_PCT);
  const rake = houseEdgeTaken + devFundTaken;
  const effectiveBet = betAmount - rake;

  const stats = loadHouseStats();
  stats.totalWagered += betAmount;
  stats.devFundBalance += devFundTaken;

  let payout = 0;
  let netToPool = 0;

  if (multiplier > 0) {
    payout = Math.floor(effectiveBet * multiplier);
    payout = Math.min(payout, stats.poolBalance);
    stats.poolBalance -= payout;
    stats.totalPaidOut += payout;
    netToPool = houseEdgeTaken - payout;
  } else {
    netToPool = effectiveBet + houseEdgeTaken;
    stats.poolBalance += netToPool;
  }

  saveHouseStats(stats);
  return { payout, houseEdgeTaken, devFundTaken, netToPool };
}

// ─── Admin operations ────────────────────────────────────────────────────────

export function adjustPoolBalance(amount: number): HouseStats {
  const stats = loadHouseStats();
  stats.poolBalance = Math.max(0, stats.poolBalance + amount);
  saveHouseStats(stats);
  return stats;
}

export function withdrawDevFund(amount?: number): { withdrawn: number; stats: HouseStats } {
  const stats = loadHouseStats();
  const toWithdraw = amount ? Math.min(amount, stats.devFundBalance) : stats.devFundBalance;
  stats.devFundBalance -= toWithdraw;
  saveHouseStats(stats);
  return { withdrawn: toWithdraw, stats };
}

export function resetHouseStats(initialPool = 0): HouseStats {
  const stats: HouseStats = { poolBalance: initialPool, devFundBalance: 0, totalWagered: 0, totalPaidOut: 0 };
  saveHouseStats(stats);
  return stats;
}

// ─── Token helpers ───────────────────────────────────────────────────────────

export function decodeTokenAmount(tokenStr: string): number {
  try {
    const decoded = getDecodedToken(tokenStr);
    return decoded.proofs.reduce((s: number, p: Proof) => s + p.amount, 0);
  } catch { return 0; }
}

export function isValidCashuToken(str: string): boolean {
  const trimmed = str.trim();
  return trimmed.startsWith('cashuA') || trimmed.startsWith('cashuB');
}

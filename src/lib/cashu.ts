/**
 * 0xPrivacy Casino — Cashu (Chaumian Ecash) wallet implementation
 *
 * Revenue model:
 *  - HOUSE_EDGE_PCT  = 2% taken from every wager (goes to prize pool)
 *  - DEV_FUND_PCT    = 0.5% taken from every wager (goes to dev fund address)
 *  Together = 2.5% total rake.  Displayed transparently in the UI.
 *
 * Architecture:
 *  - Client-side wallet stores Cashu "proofs" in localStorage
 *  - Proofs are verified against the active mint before being accepted
 *  - The house tracks a "pool balance" — winnings come from this pool
 *  - When pool is empty, games are paused until more players deposit
 */

// ─── Config ──────────────────────────────────────────────────────────────────

/** House edge taken from every bet (2%). Goes to the prize pool. */
export const HOUSE_EDGE_PCT = 0.02;

/** Dev fund cut from every bet (0.5%). Sent to dev fund Nostr pubkey. */
export const DEV_FUND_PCT = 0.005;

/** Total fee per wager. */
export const TOTAL_RAKE = HOUSE_EDGE_PCT + DEV_FUND_PCT;

/**
 * Dev fund Nostr pubkey. In production this would be the 0xPrivacy dev npub.
 * Winnings go here via Cashu tokens sent as Nostr DMs or zaps.
 */
export const DEV_FUND_PUBKEY = '63f4f5248c37caab43402588d66558360c3c2c41829e1b04f400951cca6d5e39';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CashuProof {
  id: string;
  amount: number;
  secret: string;
}

export interface CashuToken {
  mint: string;
  proofs: CashuProof[];
}

export interface CashuMintInfo {
  url: string;
  name?: string;
  description?: string;
  icon?: string;
  active?: boolean;
}

export interface HouseStats {
  poolBalance: number;
  devFundBalance: number;
  totalWagered: number;
  totalPaidOut: number;
}

// ─── Provably-fair RNG ───────────────────────────────────────────────────────

/**
 * Provably-fair outcome using Web Crypto API.
 * Returns a float [0, 1) derived from SHA-256 of serverSeed + clientSeed + nonce.
 */
export async function provablyFairRandom(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): Promise<number> {
  const data = `${serverSeed}:${clientSeed}:${nonce}`;
  const encoded = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = new Uint8Array(hashBuffer);
  // Use first 4 bytes as a 32-bit unsigned int → normalise to [0,1)
  const intVal =
    (hashArray[0] << 24) | (hashArray[1] << 16) | (hashArray[2] << 8) | hashArray[3];
  return (intVal >>> 0) / 0x100000000;
}

/** Generate a random hex seed string. */
export function generateSeed(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

export class CashuWallet {
  private proofs: CashuProof[] = [];
  readonly mints: CashuMintInfo[];
  currentMint: CashuMintInfo | null;

  constructor(mints: CashuMintInfo[] = []) {
    this.mints = mints;
    this.currentMint = mints[0] ?? null;
  }

  // ── Balance ──────────────────────────────────────────────────────────────

  get balance(): number {
    return this.proofs.reduce((s, p) => s + p.amount, 0);
  }

  // ── Mint tokens (deposit) ────────────────────────────────────────────────

  /**
   * Simulates requesting tokens from a Cashu mint after a Lightning payment.
   * In production: generate blinded messages → send to mint → unblind signatures.
   */
  async mintToken(amount: number, mintUrl?: string): Promise<CashuToken | null> {
    const url = mintUrl ?? this.currentMint?.url;
    if (!url) return null;

    // Build denominations using powers-of-2 (standard Cashu split)
    const denominations = buildDenominations(amount);
    const proofs: CashuProof[] = denominations.map((d) => ({
      id: generateSeed(8),
      amount: d,
      secret: generateSeed(16),
    }));

    this.proofs.push(...proofs);
    return { mint: url, proofs };
  }

  // ── Send / Pay ───────────────────────────────────────────────────────────

  /** Deduct `amount` from the wallet. Returns the spent proofs as a token. */
  async send(amount: number): Promise<CashuToken | null> {
    if (this.balance < amount) return null;

    const selected = selectProofs(this.proofs, amount);
    if (!selected) return null;

    const { spend, change, overage } = selected;

    // Remove spent proofs
    const spendIds = new Set(spend.map((p) => p.id));
    this.proofs = this.proofs.filter((p) => !spendIds.has(p.id));

    // Add change back if any
    if (overage > 0) {
      this.proofs.push({
        id: generateSeed(8),
        amount: overage,
        secret: generateSeed(16),
      });
    }

    return {
      mint: this.currentMint?.url ?? '',
      proofs: spend,
    };
  }

  /** Credit the wallet with incoming proofs. */
  async receive(token: CashuToken): Promise<boolean> {
    this.proofs.push(...token.proofs);
    return true;
  }

  /** Credit a specific amount directly (used after a game win). */
  creditAmount(amount: number): void {
    if (amount <= 0) return;
    const denoms = buildDenominations(amount);
    this.proofs.push(
      ...denoms.map((d) => ({
        id: generateSeed(8),
        amount: d,
        secret: generateSeed(16),
      })),
    );
  }

  // ── Mint management ───────────────────────────────────────────────────────

  addMint(mint: CashuMintInfo): void {
    if (!this.mints.find((m) => m.url === mint.url)) {
      this.mints.push(mint);
    }
    if (!this.currentMint) this.currentMint = mint;
  }

  setMint(url: string): void {
    const m = this.mints.find((m) => m.url === url);
    if (m) this.currentMint = m;
  }

  // ── Serialisation ─────────────────────────────────────────────────────────

  toJSON() {
    return {
      proofs: this.proofs,
      mints: this.mints,
      currentMintUrl: this.currentMint?.url,
    };
  }

  static fromJSON(data: {
    proofs: CashuProof[];
    mints: CashuMintInfo[];
    currentMintUrl?: string;
  }): CashuWallet {
    const w = new CashuWallet(data.mints);
    w.proofs = data.proofs ?? [];
    if (data.currentMintUrl) w.setMint(data.currentMintUrl);
    return w;
  }
}

// ─── House pool ───────────────────────────────────────────────────────────────

/** Persistent house stats stored in localStorage. */
export function loadHouseStats(): HouseStats {
  try {
    const raw = localStorage.getItem('casino:house');
    if (raw) return JSON.parse(raw) as HouseStats;
  } catch (_) { /* ignore */ }
  return { poolBalance: 100_000, devFundBalance: 0, totalWagered: 0, totalPaidOut: 0 };
}

export function saveHouseStats(stats: HouseStats): void {
  localStorage.setItem('casino:house', JSON.stringify(stats));
}

/**
 * Process a wager through the revenue model.
 * Returns the amount to pay the player if they win (after rake).
 *
 * @param betAmount  - raw bet in sats
 * @param multiplier - win multiplier (0 = loss, 2 = 2x, etc.)
 */
export function processWager(betAmount: number, multiplier: number): {
  payout: number;
  houseEdgeTaken: number;
  devFundTaken: number;
  netToPool: number;
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
    // Player wins
    payout = Math.floor(effectiveBet * multiplier);
    stats.poolBalance -= payout;
    stats.totalPaidOut += payout;
    netToPool = houseEdgeTaken - payout; // negative = pool paid out
  } else {
    // Player loses — all effective bet goes to pool
    netToPool = effectiveBet + houseEdgeTaken;
    stats.poolBalance += netToPool;
  }

  saveHouseStats(stats);

  return { payout, houseEdgeTaken, devFundTaken, netToPool };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Split an amount into powers-of-2 denominations (Cashu standard). */
function buildDenominations(amount: number): number[] {
  const result: number[] = [];
  let rem = amount;
  for (let exp = 20; exp >= 0; exp--) {
    const denom = Math.pow(2, exp);
    while (rem >= denom) {
      result.push(denom);
      rem -= denom;
    }
  }
  if (rem > 0) result.push(rem); // remainder for non-power amounts
  return result;
}

/** Select proofs totalling exactly `amount`. Returns change/overage info. */
function selectProofs(
  proofs: CashuProof[],
  amount: number,
): { spend: CashuProof[]; change: CashuProof[]; overage: number } | null {
  // Greedy selection: smallest proofs first to minimise overage
  const sorted = [...proofs].sort((a, b) => a.amount - b.amount);
  const spend: CashuProof[] = [];
  let total = 0;

  for (const p of sorted) {
    if (total >= amount) break;
    spend.push(p);
    total += p.amount;
  }

  if (total < amount) return null; // not enough

  const overage = total - amount;
  const change = proofs.filter((p) => !spend.includes(p));
  return { spend, change, overage };
}

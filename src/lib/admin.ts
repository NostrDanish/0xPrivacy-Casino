/**
 * 0xPrivacy Casino — Admin Configuration
 *
 * The admin pubkey controls the casino treasury, can adjust the prize pool,
 * withdraw accrued dev fund fees, and access the admin dashboard.
 *
 * Fees (dev fund) are paid out via Lightning to the configured LN address.
 */

/** 0xPrivacy admin hex pubkey (decoded from npub1xlldje77ptnnkhtzaspecvmch6wjmlf8u85xfrg8auutquuxl23s5c9up3) */
export const ADMIN_PUBKEY = '37fed967de0ae73b5d62ec039c3378be9d2dfd27e1e8648d07ef38b07386faa3';

/** Lightning address for fee payouts */
export const FEE_LIGHTNING_ADDRESS = '0xPrivaxy@cake.cash';

/** Check if a given pubkey is the casino admin */
export function isAdminPubkey(pubkey: string | undefined): boolean {
  if (!pubkey) return false;
  return pubkey === ADMIN_PUBKEY;
}

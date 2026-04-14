# 0xPrivacy Casino - Nostr Protocol Events

## Event Kinds

### Kind 4817: Casino Game Result (Regular)

Regular event (1000-9999 range) for recording casino game results.
This kind was generated to avoid collisions with any existing NIP kinds.

**Content**: JSON object with game-specific data:

```json
{
  "game": "slots|dice|roulette|blackjack|coinflip",
  "bet": 1000,
  "payout": 2500,
  "multiplier": 2.5,
  "serverSeed": "abc123...",
  "nonce": 42
}
```

Game-specific fields are included (e.g. `reels` for slots, `roll` for dice, etc.)

**Tags**:
- `["d", "<unique-game-id>"]` - Unique game round identifier
- `["t", "casino"]` - Main category tag (relay-queryable)
- `["t", "<game_type>"]` - Game type: slots, dice, roulette, blackjack, coinflip
- `["t", "win"]` or `["t", "loss"]` - Outcome tag
- `["amount", "<bet_sats>"]` - Bet amount in sats
- `["payout", "<win_sats>"]` - Payout amount (0 for losses)
- `["alt", "<human-readable>"]` - NIP-31 alt tag for unknown-event-aware clients

**Query examples**:
```json
{ "kinds": [4817], "#t": ["casino"], "limit": 50 }
{ "kinds": [4817], "#t": ["slots"], "limit": 20 }
{ "kinds": [4817], "authors": ["<pubkey>"], "#t": ["win"] }
```

### Kind 9347: Casino Transaction (Regular)

Regular event for recording Cashu transactions related to gaming.

**Content**: JSON object with transaction details.

**Tags**:
- `["d", "<tx-id>"]`
- `["t", "casino_transaction"]`
- `["t", "<type>"]` - deposit, withdrawal, game_payment, payout
- `["amount", "<sats>"]`
- `["status", "<status>"]`
- `["alt", "<human-readable>"]`

## Cashu Integration (NIP-60 & NIP-61)

The casino uses Cashu (Chaumian ecash) for payments. Relevant NIPs:

### NIP-60 — Cashu Wallet
- **Kind 17375**: Wallet event (replaceable, stores mints + encrypted P2PK privkey)
- **Kind 7375**: Token events (encrypted Cashu proofs)
- **Kind 7376**: Spending history events
- **Kind 7374**: Reserved wallet tokens (quote tracking)

### NIP-61 — Nutzaps
- **Kind 10019**: Nutzap informational event (mints, relays, P2PK pubkey)
- **Kind 9321**: Nutzap event (P2PK-locked Cashu token payment)

### NIP-87 — Ecash Mint Discoverability
- **Kind 38172**: Cashu Mint Announcement

## Revenue Model

Every wager carries a **2.5% total rake**:
- **2.0%** goes to the house prize pool (funds player payouts)
- **0.5%** goes to the dev fund (funds 0xPrivacy development)

This is applied transparently via the `processWager()` function in `lib/cashu.ts`.

## Provably Fair

Game outcomes use SHA-256 HMAC:
```
outcome = SHA-256(serverSeed + ":" + clientSeed + ":" + nonce)
```

- `serverSeed`: Generated per session, hash published before play
- `clientSeed`: Generated per session on client side
- `nonce`: Incremented per game round
- After session, full server seed is revealed for verification

All seeds and nonces are included in the kind 4817 event content for public verification.

## Privacy

- No KYC / no accounts — authenticate with Nostr keys only
- Cashu ecash tokens are unlinkable (blind signatures)
- The mint cannot correlate deposits to withdrawals
- Game results are published to Nostr for transparency but contain no PII

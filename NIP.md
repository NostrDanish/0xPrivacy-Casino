# 0xPrivacy Casino - Custom Nostr Event Kinds

## Kind 8867: Casino Game Result

`draft` `optional`

A **regular event** (kind 8867) used by the 0xPrivacy Casino to record provably-fair casino game outcomes on the Nostr network. Each event represents a single game round and contains all the data needed to independently verify the outcome.

### Event Format

```json
{
  "kind": 8867,
  "content": "<JSON string with game data>",
  "tags": [
    ["t", "casino"],
    ["t", "<game-type>"],
    ["t", "<result>"],
    ["amount", "<bet-in-sats>"],
    ["payout", "<payout-in-sats>"],
    ["alt", "<human-readable summary>"]
  ]
}
```

### Tags (required)

| Tag      | Description                                                              |
| -------- | ------------------------------------------------------------------------ |
| `t`      | `"casino"` - Identifies the event as a casino game result               |
| `t`      | Game type: `"slots"`, `"dice"`, `"roulette"`, `"blackjack"`, `"coinflip"` |
| `t`      | Result: `"win"` or `"loss"`                                             |
| `amount` | Bet amount in satoshis                                                  |
| `payout` | Payout amount in satoshis (0 for losses)                                |
| `alt`    | Human-readable summary of the game outcome (NIP-31 style)               |

### Content

The `.content` field is a JSON string containing game-specific data and provably-fair verification information:

```json
{
  "game": "slots",
  "bet": 1000,
  "payout": 5000,
  "multiplier": 5,
  "serverSeed": "<hex-encoded server seed>",
  "clientSeed": "<hex-encoded client seed>",
  "nonce": 42
}
```

#### Content Fields

| Field        | Type   | Description                                              |
| ------------ | ------ | -------------------------------------------------------- |
| `game`       | string | Game type identifier                                     |
| `bet`        | number | Bet amount in satoshis                                   |
| `payout`     | number | Amount won in satoshis (0 for losses)                    |
| `multiplier` | number | Win multiplier applied (0 for losses)                    |
| `serverSeed` | string | Server seed used for provably-fair RNG                   |
| `clientSeed` | string | Client seed used for provably-fair RNG                   |
| `nonce`      | number | Nonce value for the specific game round                  |

Additional game-specific fields may be present depending on the game type.

#### Game-Specific Extra Fields

**Slots:**
- `reels`: Array of emoji symbols shown on each reel

**Dice:**
- `roll`: The dice roll result (1-100)
- `target`: The target number
- `mode`: `"under"` or `"over"`

**Roulette:**
- `result`: The winning number (0-36)
- `color`: `"red"`, `"black"`, or `"green"`
- `bets`: Array of placed bets

**Blackjack:**
- `playerValue`: Final hand value of the player
- `dealerValue`: Final hand value of the dealer

**Coin Flip:**
- `result`: `"heads"` or `"tails"`
- `choice`: The player's chosen side

### Provably Fair Verification

Game outcomes are determined using SHA-256:

```
outcome = SHA-256(serverSeed + ":" + clientSeed + ":" + nonce)
```

The first 4 bytes of the hash are converted to a 32-bit unsigned integer and normalized to [0, 1) to determine the game result. This allows anyone to independently verify that the outcome was fair by re-computing the hash.

### Querying

To fetch casino game results:

```json
{
  "kinds": [8867],
  "#t": ["casino"],
  "limit": 50
}
```

To fetch a specific game type:

```json
{
  "kinds": [8867],
  "#t": ["casino", "slots"],
  "limit": 20
}
```

To fetch a specific user's history:

```json
{
  "kinds": [8867],
  "authors": ["<pubkey>"],
  "#t": ["casino"],
  "limit": 20
}
```

### Revenue Model

All wagers carry a 2.5% total rake:
- **2.0%** goes to the house prize pool (funds player winnings)
- **0.5%** goes to the developer fund

The effective payout multiplier is calculated as:

```
effectivePayout = (betAmount - rake) * multiplier
```

### Relationship to Other NIPs

- **NIP-60 (Cashu Wallet):** The casino uses Cashu ecash (Chaumian Ecash) for deposits and withdrawals. Player balances are stored client-side as Cashu proofs.
- **NIP-87 (Cashu Discoverability):** Mints used by the casino can be discovered via NIP-87 events.
- **NIP-61 (Nutzaps):** Future integration could allow nutzaps as a deposit mechanism.

### Example Events

#### Slots Win

```json
{
  "kind": 8867,
  "content": "{\"game\":\"slots\",\"bet\":1000,\"payout\":4875,\"multiplier\":5,\"serverSeed\":\"a1b2c3...\",\"clientSeed\":\"d4e5f6...\",\"nonce\":7,\"reels\":[\"cherry\",\"cherry\",\"cherry\"]}",
  "tags": [
    ["t", "casino"],
    ["t", "slots"],
    ["t", "win"],
    ["amount", "1000"],
    ["payout", "4875"],
    ["alt", "0xPrivacy Casino - slots: cherry cherry cherry (won 4875 sats)"]
  ]
}
```

#### Dice Loss

```json
{
  "kind": 8867,
  "content": "{\"game\":\"dice\",\"bet\":500,\"payout\":0,\"multiplier\":0,\"serverSeed\":\"f1e2d3...\",\"clientSeed\":\"c4b5a6...\",\"nonce\":12,\"roll\":67,\"target\":50,\"mode\":\"under\"}",
  "tags": [
    ["t", "casino"],
    ["t", "dice"],
    ["t", "loss"],
    ["amount", "500"],
    ["payout", "0"],
    ["alt", "0xPrivacy Casino - dice: rolled 67 (under 50) (lost)"]
  ]
}
```

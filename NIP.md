# NIP-??: Casino Gaming Events

## Abstract
This NIP defines event kinds for decentralized casino gaming on the Nostr protocol, supporting provably fair games with Cashu payments.

## Events

### Kind 31383: Casino Game Result
Addressable event (30000-39999) for recording casino game results.

#### Content
The `content` field contains a JSON object with game-specific information:
```json
{
  "game_type": "slots|dice|roulette|blackjack|coinflip|poker",
  "bet_amount": 1000,
  "win_amount": 2500,
  "result": "win|loss|draw",
  "game_data": {
    // Game-specific data (e.g., dice roll, slot symbols, card hands)
  },
  "provably_fair": {
    "seed": "random_seed_hash",
    "server_seed": "server_seed_hash",
    "client_seed": "client_seed_hash"
  }
}
```

#### Tags
- `["d", "<game_id>"]` - Unique game identifier (required)
- `["t", "casino"]` - Main category tag
- `["t", "<game_type>"]` - Game type tag (e.g., "slots", "dice")
- `["t", "<result>"]` - Result tag (e.g., "win", "loss")
- `["amount", "<bet_amount>"]` - Bet amount in sats
- `["payout", "<win_amount>"]` - Win amount in sats (0 for losses)
- `["cashu_token", "<token_id>"]` - Optional Cashu token ID for payment verification
- `["relay", "<relay_url>"]` - Recommended relay for game verification

#### Example Event
```json
{
  "kind": 31383,
  "pubkey": "user_pubkey",
  "content": "{\"game_type\":\"dice\",\"bet_amount\":1000,\"win_amount\":2500,\"result\":\"win\",\"game_data\":{\"prediction\":25,\"roll\":12},\"provably_fair\":{\"seed\":\"abc123...\",\"server_seed\":\"def456...\",\"client_seed\":\"user_seed...\"}}",
  "tags": [
    ["d", "dice_123456789"],
    ["t", "casino"],
    ["t", "dice"],
    ["t", "win"],
    ["amount", "1000"],
    ["payout", "2500"]
  ]
}
```

### Kind 31384: Casino Transaction
Addressable event (30000-39999) for recording Cashu transactions related to gaming.

#### Content
The `content` field contains a JSON object with transaction details:
```json
{
  "transaction_type": "deposit|withdrawal|game_payment|payout",
  "amount": 1000,
  "status": "pending|completed|failed",
  "cashu_mint": "https://mint.url",
  "token_id": "cashu_token_id",
  "description": "Optional description"
}
```

#### Tags
- `["d", "<tx_id>"]` - Unique transaction identifier (required)
- `["t", "casino_transaction"]` - Main category tag
- `["t", "<transaction_type>"]` - Transaction type tag
- `["amount", "<amount>"]` - Amount in sats
- `["status", "<status>"]` - Transaction status
- `["mint", "<mint_url>"]` - Cashu mint URL

## Provably Fair Gaming

### Randomness Generation
Games should use a provably fair random number generation system:
1. Server generates a server seed and publishes its hash
2. Client provides a client seed
3. Game outcome is determined by: `HMAC_SHA256(server_seed, client_seed)`
4. After game, server reveals the server seed for verification

### Verification
Players can verify game fairness by:
1. Checking the server seed hash published before the game
2. Verifying the HMAC_SHA256 calculation
3. Confirming the game outcome matches the calculated result

## Cashu Integration

### Payment Flow
1. User deposits sats to Cashu mint
2. User receives Cashu tokens
3. Game uses tokens for bets
4. Winnings are paid in Cashu tokens
5. User can withdraw tokens to Lightning

### Security Considerations
- Game operators should not hold user funds directly
- Cashu tokens provide privacy and instant settlement
- Users maintain control of their funds via Cashu wallets

## Client Implementation

### Querying Game History
Clients can query a user's game history:
```json
{
  "kinds": [31383],
  "authors": ["user_pubkey"],
  "#t": ["casino"],
  "limit": 50
}
```

### Querying Specific Game Types
```json
{
  "kinds": [31383],
  "authors": ["user_pubkey"],
  "#t": ["slots"],
  "limit": 20
}
```

### Querying Transactions
```json
{
  "kinds": [31384],
  "authors": ["user_pubkey"],
  "#t": ["casino_transaction"],
  "limit": 50
}
```

## Recommendations

### User Experience
- Show game history with timestamps and results
- Display provably fair verification links
- Provide deposit/withdrawal status
- Implement responsible gambling features

### Security
- Use secure random number generation
- Implement proper Cashu token handling
- Protect user privacy where possible
- Follow Cashu security best practices

### Compliance
- Implement age verification if required
- Provide responsible gambling resources
- Follow local gambling regulations
- Consider implementing loss limits

## Future Extensions
- Multiplayer casino games
- Tournament systems
- Achievement systems
- Social features (sharing wins, challenges)
- NFT integration for collectibles
# 0xPrivacy Casino - Setup & Development Guide

This guide covers everything you need to set up, develop, and understand the 0xPrivacy Casino.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the App](#running-the-app)
- [How to Play](#how-to-play)
- [Architecture Overview](#architecture-overview)
- [Game Mechanics](#game-mechanics)
- [Provably Fair System](#provably-fair-system)
- [Cashu Wallet](#cashu-wallet)
- [Nostr Integration](#nostr-integration)
- [Customization](#customization)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js** 18+ and npm
- A **Nostr browser extension** (NIP-07 signer) such as:
  - [Alby](https://getalby.com/) (recommended)
  - [nos2x](https://github.com/nickhntv/nos2x)
  - [Nostr Connect](https://nsec.app/)
- Or use the built-in key generation (no extension needed)

---

## Installation

### Option 1: Shakespeare (Recommended)

Click the button below to open the project in Shakespeare:

[![Edit with Shakespeare](https://shakespeare.diy/badge.svg)](https://shakespeare.diy/clone?url=https%3A%2F%2Fgithub.com%2FNostrDanish%2F0xPrivacy-Casino.git)

No local setup needed. Everything runs in your browser.

### Option 2: Local Development

```bash
# Clone the repository
git clone https://github.com/NostrDanish/0xPrivacy-Casino.git
cd 0xPrivacy-Casino

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Option 3: Build for Production

```bash
npm run build
```

Output files will be in the `dist/` directory. Serve them with any static file server.

---

## Running the App

### Development Mode

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

### Run Tests

```bash
npm run test
```

This runs TypeScript type checking, ESLint, Vitest tests, and a production build.

---

## How to Play

### 1. Log In

Click **"Log in"** in the header. You can:
- **Sign in** with an existing Nostr key (via browser extension or nsec)
- **Sign up** to generate a new Nostr keypair

### 2. Initialize Your Wallet

After logging in, click **"Initialize Cashu Wallet"**. This creates a client-side Cashu wallet in your browser's localStorage.

### 3. Deposit Sats

Click the wallet balance button in the header to open the wallet panel. Go to the **Deposit** tab and add sats to your wallet.

> **Note:** In the current demo, deposits are simulated (tokens are minted locally). In production, this would involve a Lightning invoice from a real Cashu mint.

### 4. Choose a Game

Navigate to any of the 5 available games from the dashboard:

- **Slots** - Spin 3 reels and match symbols
- **Dice** - Roll over or under a target number
- **Roulette** - Bet on numbers, colors, or ranges
- **Blackjack** - Beat the dealer to 21
- **Coin Flip** - Pick heads or tails

### 5. Place Your Bet

Each game has configurable bet amounts. Select your bet size and play!

### 6. Verify Fairness

Every game round shows the server seed and nonce used to generate the outcome. You can verify any result using the provably-fair formula:

```
SHA-256(serverSeed + ":" + clientSeed + ":" + nonce)
```

### 7. Withdraw

Open the wallet panel and go to the **Withdraw** tab. Enter an amount and a Cashu token will be generated that you can redeem at a compatible mint.

---

## Architecture Overview

```
Browser (Client-Side Only)
    |
    +-- React App (Vite + TypeScript)
    |       |
    |       +-- Casino Games (provably-fair RNG)
    |       +-- Cashu Wallet (localStorage)
    |       +-- Nostr Events (kind 8867)
    |
    +-- Nostr Relays (event publishing/querying)
    |       |
    |       +-- wss://relay.ditto.pub
    |       +-- wss://relay.primal.net
    |       +-- wss://relay.damus.io
    |
    +-- Cashu Mints (deposits/withdrawals)
            |
            +-- https://mint.minibits.cash/Bitcoin
            +-- https://mint.coinos.io
            +-- https://legend.lnbits.com/cashu/...
```

**Key principle:** Everything runs in the browser. There is no server. Game logic, wallet state, and random number generation all happen client-side.

---

## Game Mechanics

### Slots

- 3 reels with 7 symbols each
- Payouts range from 2x (any diamond) to 100x (triple 7s)
- Matching 3 of any symbol pays out the corresponding multiplier
- 2 cherries pay 2x, any single diamond pays 2x

### Dice

- Roll a number from 1-100
- Choose "over" or "under" a target number
- Win chance = target% (for under) or (100 - target)% (for over)
- Multiplier = 100 / winChance * 0.975 (after house edge)
- Adjustable risk: lower target = higher payout, lower chance

### Roulette

- European single-zero roulette (numbers 0-36)
- Bet types: straight number (36x), dozens (3x), even money (2x)
- Multiple simultaneous bets allowed
- Visual wheel animation

### Blackjack

- Standard rules: dealer stands on soft 17
- Blackjack pays 2.5x
- Actions: Hit, Stand, Double Down
- Single deck, reshuffled when low

### Coin Flip

- 50/50 chance
- Pick heads or tails
- Effective payout: ~1.95x (after 2.5% rake)

---

## Provably Fair System

The provably-fair system ensures that neither the house nor the player can predict or manipulate outcomes.

### How It Works

1. **Server Seed** - A random hex string generated at session start
2. **Client Seed** - A separate random hex string generated at session start
3. **Nonce** - Incremented for each game round

### Verification Formula

```javascript
const data = `${serverSeed}:${clientSeed}:${nonce}`;
const hash = SHA-256(data);
const result = first4bytes(hash) / 0x100000000; // [0, 1)
```

### Implementation

```typescript
// From src/lib/cashu.ts
async function provablyFairRandom(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): Promise<number> {
  const data = `${serverSeed}:${clientSeed}:${nonce}`;
  const encoded = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = new Uint8Array(hashBuffer);
  const intVal =
    (hashArray[0] << 24) | (hashArray[1] << 16) |
    (hashArray[2] << 8) | hashArray[3];
  return (intVal >>> 0) / 0x100000000;
}
```

### Transparency

- Seeds and nonces are displayed in each game's "Provably Fair" panel
- Game results are published to Nostr (kind 8867) with full seed data
- Anyone can query these events and independently verify outcomes

---

## Cashu Wallet

The casino uses a client-side Cashu wallet implementation.

### Key Concepts

- **Proofs** - Cryptographic tokens representing value. Stored in localStorage.
- **Mints** - Services that issue and redeem Cashu tokens. The casino supports multiple mints.
- **Denominations** - Proofs are split into powers of 2 (standard Cashu protocol).

### Wallet Operations

| Operation | Description |
| --------- | ----------- |
| **Deposit** | Mint new tokens (simulated in demo) |
| **Withdraw** | Create a Cashu token string for redemption |
| **Bet** | Deduct proofs from wallet |
| **Win** | Credit new proofs to wallet |

### Revenue Flow

```
Player Bet (1000 sats)
    |
    +-- House Edge (20 sats, 2.0%)  --> Prize Pool
    +-- Dev Fund  (5 sats, 0.5%)   --> Dev Fund
    +-- Effective Bet (975 sats)    --> Game outcome
         |
         +-- Win: payout = 975 * multiplier
         +-- Loss: 975 sats --> Prize Pool
```

---

## Nostr Integration

### Event Kind 8867

All game results are published to Nostr as kind 8867 events. See [NIP.md](./NIP.md) for the full specification.

### Tag Structure

```
t:casino     - All casino events
t:<game>     - Specific game type (slots, dice, etc.)
t:<result>   - win or loss
amount       - Bet in sats
payout       - Payout in sats
alt          - Human-readable summary
```

### Querying Game History

The `useGameHistory` hook queries kind 8867 events for the current user:

```typescript
import { useGameHistory } from '@/hooks/useCasinoEvents';

function MyComponent() {
  const { data: history, isLoading } = useGameHistory(20);
  // history = NostrEvent[] filtered and validated
}
```

### Global Casino Feed

The `useCasinoFeed` hook queries all casino events:

```typescript
import { useCasinoFeed } from '@/hooks/useCasinoEvents';

function LiveFeed() {
  const { data: feed } = useCasinoFeed(50);
  // feed = all kind 8867 events from any player
}
```

---

## Customization

### Adding a New Game

1. Create a new component in `src/components/games/`
2. Use the `GameLayout` wrapper for consistent headers and wallet access
3. Use `useCashu()` for wallet operations (`placeBet`, `creditWin`)
4. Use `useCasinoEvents()` to publish results
5. Add a route in `AppRouter.tsx`
6. Add the game card to `CasinoDashboard.tsx`

### Example Game Template

```typescript
import GameLayout from '@/components/casino/GameLayout';
import { useCashu } from '@/contexts/CashuContext';
import { processWager, generateSeed, provablyFairRandom } from '@/lib/cashu';
import { useCasinoEvents } from '@/hooks/useCasinoEvents';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function MyNewGame() {
  const { balance, placeBet, creditWin, isInitialized } = useCashu();
  const { user } = useCurrentUser();
  const { publishGameResult } = useCasinoEvents();

  const play = async () => {
    // 1. Deduct bet
    const ok = await placeBet(betAmount);
    if (!ok) return;

    // 2. Generate provably-fair outcome
    const r = await provablyFairRandom(serverSeed, clientSeed, nonce);

    // 3. Calculate result
    const multiplier = /* your game logic */;
    const { payout } = processWager(betAmount, multiplier);

    // 4. Credit winnings
    if (payout > 0) creditWin(payout);

    // 5. Publish to Nostr
    publishGameResult({
      game: 'mynewgame',
      bet: betAmount,
      payout,
      multiplier,
      outcome: 'description of outcome',
      serverSeed,
      clientSeed,
      nonce,
    });
  };

  return (
    <GameLayout title="My New Game" emoji="..." subtitle="...">
      {/* Game UI */}
    </GameLayout>
  );
}
```

### Changing Mints

Edit the `DEFAULT_MINTS` array in `src/contexts/CashuContext.tsx`:

```typescript
const DEFAULT_MINTS: CashuMintInfo[] = [
  { url: 'https://your-mint.com', name: 'Your Mint', active: true },
];
```

### Changing the House Edge

Edit the constants in `src/lib/cashu.ts`:

```typescript
export const HOUSE_EDGE_PCT = 0.02;  // 2%
export const DEV_FUND_PCT = 0.005;   // 0.5%
```

---

## Troubleshooting

### "Initialize wallet" button does nothing

- Make sure you're logged in with a Nostr key first
- Check browser console for errors

### Balance shows 0 after deposit

- The wallet stores state in localStorage. Try refreshing the page.
- If you cleared browser data, the wallet state is lost.

### Game results not appearing on Nostr

- Make sure you're logged in (events are only published when a user is authenticated)
- Check your relay connections in the app
- Some relays may reject events from unknown pubkeys

### Provably fair seeds not matching

- Seeds are generated per-session. A page refresh generates new seeds.
- The nonce increments with each game round within a session.

### Wallet state lost

The wallet is stored in your browser's localStorage. It will be lost if:
- You clear browser data
- You switch browsers
- You use incognito/private mode

To back up your balance, use the **Withdraw** function to create Cashu tokens before clearing data.

---

## Security Considerations

- **Client-side RNG:** All randomness uses the Web Crypto API (`crypto.subtle.digest` and `crypto.getRandomValues`). No Math.random() for game outcomes.
- **No private keys:** The app never handles or stores Nostr private keys. Authentication is done via NIP-07 browser signers.
- **Local wallet:** Cashu proofs are stored only in your browser. The app has no backend and cannot access your funds.
- **Open source:** All game logic is visible in the source code for audit.

---

## Links

- **Live App:** [https://0xCasino.shakespeare.wtf](https://0xCasino.shakespeare.wtf)
- **Repository:** [https://github.com/NostrDanish/0xPrivacy-Casino.git](https://github.com/NostrDanish/0xPrivacy-Casino.git)
- **0xPrivacy:** [https://0xprivacy.online](https://0xprivacy.online)
- **Nostr Protocol:** [https://github.com/nostr-protocol/nips](https://github.com/nostr-protocol/nips)
- **Cashu Protocol:** [https://cashu.space](https://cashu.space)

# 0xPrivacy Casino

**Decentralized, privacy-first Bitcoin casino built on Nostr + Cashu ecash.**

[![Edit with Shakespeare](https://shakespeare.diy/badge.svg)](https://shakespeare.diy/clone?url=https%3A%2F%2Fgithub.com%2FNostrDanish%2F0xPrivacy-Casino.git)

> No KYC. No tracking. Provably fair. Your keys, your sats.

---

## Overview

0xPrivacy Casino is a fully client-side, decentralized casino that runs on the Nostr protocol and uses Cashu ecash tokens for payments. Every game outcome is provably fair via SHA-256 seeded randomness, and all results are published as Nostr events (kind 8867) for public auditability.

### Live Demo

**[https://0xCasino.shakespeare.wtf](https://0xCasino.shakespeare.wtf)**

---

## Features

### 5 Provably Fair Games

| Game       | Type               | House Edge | RTP   | Min Bet |
| ---------- | ------------------ | ---------- | ----- | ------- |
| Slots      | 3-reel slot machine | 2.5%       | 97.5% | 100 sats |
| Dice       | Over/under roll    | 2.5%       | 97.5% | 100 sats |
| Roulette   | European single-zero | 2.5%     | 97.5% | 100 sats |
| Blackjack  | Classic 21         | 2.5%       | 97.5% | 100 sats |
| Coin Flip  | Heads or tails     | 2.5%       | 97.5% | 100 sats |

### Privacy & Security

- **Nostr Login** - No email, no passwords, no KYC. Sign in with your Nostr key.
- **Cashu Ecash** - Chaumian ecash tokens are unlinkable. The mint cannot connect deposits to withdrawals.
- **Client-Side** - All game logic runs in your browser. No server-side house advantage manipulation.
- **Provably Fair** - Every outcome uses `SHA-256(serverSeed:clientSeed:nonce)` and is published to Nostr for anyone to verify.

### Nostr Integration

- Game results published as **kind 8867** events (see [NIP.md](./NIP.md))
- Results are tagged with `t:casino` and the specific game type for relay-level filtering
- Full provably-fair seed data included in every event
- Human-readable `alt` tags for non-supporting clients

### Cashu Wallet

- Built-in client-side Cashu wallet with proof management
- Power-of-2 denomination splitting (standard Cashu protocol)
- Support for multiple mints (Minibits, Coinos, LNbits)
- Deposit and withdraw via Cashu tokens

---

## Technology Stack

| Technology        | Purpose                                |
| ----------------- | -------------------------------------- |
| React 19          | UI framework                           |
| TypeScript        | Type-safe development                  |
| TailwindCSS 3     | Utility-first styling                  |
| Vite              | Build tooling                          |
| shadcn/ui         | Accessible UI components               |
| Nostrify          | Nostr protocol integration             |
| TanStack Query    | Data fetching and caching              |
| React Router      | Client-side routing                    |
| Web Crypto API    | Provably-fair SHA-256 RNG              |

---

## Revenue Model

All wagers carry a transparent **2.5% total rake**:

| Component   | Percentage | Purpose                              |
| ----------- | ---------- | ------------------------------------ |
| House Edge  | 2.0%       | Funds the prize pool (player winnings) |
| Dev Fund    | 0.5%       | Funds continued development          |
| **Total**   | **2.5%**   |                                      |

The prize pool and dev fund balances are displayed transparently in the UI.

---

## Project Structure

```
src/
  components/
    casino/         # GameLayout, WalletPanel
    games/          # SlotMachine, DiceRoll, Roulette, Blackjack, CoinFlip
    auth/           # LoginArea, LoginDialog, SignupDialog
    ui/             # shadcn/ui components
  contexts/
    CashuContext.tsx # Cashu wallet state management
    AppContext.ts    # Global app configuration
    NWCContext.tsx   # Nostr Wallet Connect
  hooks/
    useCasinoEvents.ts # Nostr event publishing & querying (kind 8867)
    useCurrentUser.ts  # Current logged-in user
    useAuthor.ts       # Profile data fetching
    useNostrPublish.ts # Event publishing
  lib/
    cashu.ts         # Cashu wallet implementation & provably-fair RNG
  pages/
    CasinoDashboard.tsx # Main landing page
```

---

## Custom Nostr Event Kind

This project defines **kind 8867** for casino game results. See [NIP.md](./NIP.md) for the complete specification.

### Quick Reference

```json
{
  "kind": 8867,
  "content": "{\"game\":\"slots\",\"bet\":1000,\"payout\":5000,...}",
  "tags": [
    ["t", "casino"],
    ["t", "slots"],
    ["t", "win"],
    ["amount", "1000"],
    ["payout", "5000"],
    ["alt", "0xPrivacy Casino - slots: ... (won 5000 sats)"]
  ]
}
```

---

## Getting Started

See [GUIDE.md](./GUIDE.md) for detailed setup and development instructions.

### Quick Start

1. Clone the repository
2. Open in [Shakespeare](https://shakespeare.diy/clone?url=https%3A%2F%2Fgithub.com%2FNostrDanish%2F0xPrivacy-Casino.git) or run locally with Vite
3. Log in with your Nostr key
4. Initialize your Cashu wallet
5. Start playing!

---

## Related NIPs

| NIP | Title | Relevance |
| --- | ----- | --------- |
| [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md) | Basic Protocol | Core event structure |
| [NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md) | Browser Signer | Login via browser extension |
| [NIP-60](https://github.com/nostr-protocol/nips/blob/master/60.md) | Cashu Wallet | Ecash wallet standard |
| [NIP-61](https://github.com/nostr-protocol/nips/blob/master/61.md) | Nutzaps | Future: zap-based deposits |
| [NIP-65](https://github.com/nostr-protocol/nips/blob/master/65.md) | Relay List | Relay management |
| [NIP-87](https://github.com/nostr-protocol/nips/blob/master/87.md) | Cashu Discovery | Mint discoverability |

---

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## Links

- **Live App:** [https://0xCasino.shakespeare.wtf](https://0xCasino.shakespeare.wtf)
- **0xPrivacy:** [https://0xprivacy.online](https://0xprivacy.online)
- **Built with:** [Shakespeare](https://shakespeare.diy)

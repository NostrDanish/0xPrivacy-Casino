import { useState, useRef, useCallback } from 'react';
import GameLayout from '@/components/casino/GameLayout';
import { Badge } from '@/components/ui/badge';
import { useCashu } from '@/contexts/CashuContext';
import { processWager, generateSeed, provablyFairRandom } from '@/lib/cashu';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Zap } from 'lucide-react';

// ── Card types ──────────────────────────────────────────────────────────────

type Suit = '♠' | '♥' | '♦' | '♣';
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

interface Card { rank: Rank; suit: Suit; hidden?: boolean }

const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  return deck;
}

function cardValue(rank: Rank): number {
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  if (rank === 'A') return 11;
  return parseInt(rank);
}

function handValue(hand: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    if (c.hidden) continue;
    total += cardValue(c.rank);
    if (c.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isBust(hand: Card[]): boolean { return handValue(hand) > 21; }
function isBlackjack(hand: Card[]): boolean { return hand.length === 2 && handValue(hand) === 21; }

type Phase = 'idle' | 'playing' | 'dealer' | 'done';

const BET_AMOUNTS = [100, 500, 1_000, 5_000, 10_000];

// ── Card display ─────────────────────────────────────────────────────────────

function CardView({ card }: { card: Card }) {
  const red = card.suit === '♥' || card.suit === '♦';
  if (card.hidden) {
    return (
      <div className="w-14 h-20 md:w-16 md:h-24 rounded-xl border-2 border-border/60 bg-gradient-to-br from-blue-900/60 to-indigo-950/80 flex items-center justify-center text-2xl select-none">
        🂠
      </div>
    );
  }
  return (
    <div className={`w-14 h-20 md:w-16 md:h-24 rounded-xl border-2 border-border/60 bg-card flex flex-col items-start justify-start p-1.5 select-none shadow-md`}>
      <div className={`text-sm font-black leading-none ${red ? 'text-red-400' : 'text-foreground'}`}>
        {card.rank}
      </div>
      <div className={`text-lg leading-none ${red ? 'text-red-400' : 'text-foreground'}`}>
        {card.suit}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Blackjack() {
  const { balance, placeBet, creditWin, isInitialized } = useCashu();
  const { user } = useCurrentUser();
  const { mutate: publish } = useNostrPublish();

  const [phase, setPhase] = useState<Phase>('idle');
  const [deck, setDeck] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [betAmount, setBetAmount] = useState(1_000);
  const [result, setResult] = useState('');
  const [payout, setPayout] = useState(0);
  const [stats, setStats] = useState({ played: 0, won: 0, wagered: 0 });

  const serverSeedRef = useRef(generateSeed());
  const clientSeedRef = useRef(generateSeed());
  const nonceRef = useRef(0);
  const deckRef = useRef<Card[]>([]);
  const deckIdxRef = useRef(0);

  // Deal a card from deck
  const dealCard = useCallback(async (hidden = false): Promise<Card> => {
    if (deckIdxRef.current >= deckRef.current.length - 5) {
      // Reshuffle
      const newDeck = buildDeck().sort(() => Math.random() - 0.5);
      deckRef.current = newDeck;
      deckIdxRef.current = 0;
    }
    nonceRef.current++;
    const r = await provablyFairRandom(serverSeedRef.current, clientSeedRef.current, nonceRef.current);
    const idx = Math.floor(r * (deckRef.current.length - deckIdxRef.current)) + deckIdxRef.current;
    // Swap
    [deckRef.current[idx], deckRef.current[deckIdxRef.current]] = [deckRef.current[deckIdxRef.current], deckRef.current[idx]];
    const card = { ...deckRef.current[deckIdxRef.current], hidden };
    deckIdxRef.current++;
    return card;
  }, []);

  const startGame = async () => {
    if (!isInitialized || balance < betAmount) return;
    const ok = await placeBet(betAmount);
    if (!ok) return;

    // Init deck if needed
    if (deckRef.current.length === 0) {
      deckRef.current = buildDeck().sort(() => Math.random() - 0.5);
    }

    const c1 = await dealCard();
    const c2 = await dealCard(true); // dealer hole card
    const c3 = await dealCard();
    const c4 = await dealCard();

    const pHand = [c1, c3];
    const dHand = [c2, c4];

    setPlayerHand(pHand);
    setDealerHand(dHand);
    setResult('');
    setPayout(0);
    setPhase('playing');

    // Check immediate blackjack
    if (isBlackjack(pHand)) {
      // Reveal dealer and check
      const revealedDealer = dHand.map((c) => ({ ...c, hidden: false }));
      setDealerHand(revealedDealer);
      if (isBlackjack(revealedDealer)) {
        endGame(pHand, revealedDealer, 'push');
      } else {
        endGame(pHand, revealedDealer, 'blackjack');
      }
    }
  };

  const hit = async () => {
    if (phase !== 'playing') return;
    const card = await dealCard();
    const newHand = [...playerHand, card];
    setPlayerHand(newHand);
    if (isBust(newHand)) {
      endGame(newHand, dealerHand, 'bust');
    }
  };

  const runDealer = async (pHand: Card[], betMult = 1): Promise<void> => {
    setPhase('dealer');

    // Reveal hole card and dealer draws to 17
    let dHand = dealerHand.map((c) => ({ ...c, hidden: false }));
    setDealerHand(dHand);

    while (handValue(dHand) < 17) {
      await new Promise((r) => setTimeout(r, 500));
      const card = await dealCard();
      dHand = [...dHand, card];
      setDealerHand([...dHand]);
    }

    const pv = handValue(pHand);
    const dv = handValue(dHand);

    let outcome: string;
    if (isBust(dHand)) outcome = 'dealer_bust';
    else if (pv > dv) outcome = 'win';
    else if (pv < dv) outcome = 'lose';
    else outcome = 'push';

    endGame(pHand, dHand, outcome, betMult);
  };

  const stand = async () => {
    if (phase !== 'playing') return;
    await runDealer(playerHand, 1);
  };

  const double = async () => {
    if (phase !== 'playing') return;
    const ok = await placeBet(betAmount);
    if (!ok) return;
    const card = await dealCard();
    const newHand = [...playerHand, card];
    setPlayerHand(newHand);
    if (isBust(newHand)) {
      endGame(newHand, dealerHand, 'bust', 2);
    } else {
      await runDealer(newHand, 2);
    }
  };

  const endGame = async (pHand: Card[], dHand: Card[], outcome: string, betMultiplier = 1) => {
    const effectiveBet = betAmount * betMultiplier;
    let mult = 0;
    let label = '';

    if (outcome === 'blackjack') { mult = 2.5; label = '🃏 Blackjack! +'; }
    else if (outcome === 'win' || outcome === 'dealer_bust') { mult = 2; label = '✅ You win! +'; }
    else if (outcome === 'push') { mult = 1; label = '🤝 Push — '; }
    else { mult = 0; label = '❌ You lose — '; }

    const { payout: p } = processWager(effectiveBet, mult);
    if (p > 0) creditWin(p);
    setPayout(p);
    setResult(`${label}${p.toLocaleString()} sats`);
    setPhase('done');
    setStats((s) => ({
      played: s.played + 1,
      won: s.won + (mult >= 2 ? 1 : 0),
      wagered: s.wagered + effectiveBet,
    }));

    if (user) {
      publish({
        kind: 4817,
        content: JSON.stringify({ game: 'blackjack', outcome, playerValue: handValue(pHand), dealerValue: handValue(dHand), bet: effectiveBet, payout: p }),
        tags: [
          ['d', `bj_${Date.now()}`], ['t', 'casino'], ['t', 'blackjack'],
          ['t', mult >= 2 ? 'win' : mult > 0 ? 'push' : 'loss'],
          ['amount', effectiveBet.toString()], ['payout', p.toString()],
          ['alt', `0xPrivacy Casino — Blackjack: ${outcome} — ${p > 0 ? `+${p} sats` : 'lost'}`],
        ],
      });
    }
  };

  const pv = handValue(playerHand);
  const dv = handValue(dealerHand.filter((c) => !c.hidden));

  return (
    <GameLayout title="Blackjack" emoji="🃏" subtitle="Beat the dealer to 21 · Blackjack pays 2.5× · 97.5% RTP">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main table */}
        <div className="lg:col-span-2 space-y-5">

          {/* Felt table */}
          <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-green-950/40 to-emerald-950/60 p-6 space-y-6 min-h-[360px]">
            {/* Dealer */}
            <div>
              <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">
                Dealer {phase !== 'idle' && phase !== 'playing' && `— ${dv}`}
              </div>
              <div className="flex gap-2 flex-wrap">
                {dealerHand.map((card, i) => <CardView key={i} card={card} />)}
              </div>
            </div>

            {/* Divider */}
            {(phase !== 'idle') && (
              <div className="border-t border-white/5" />
            )}

            {/* Player */}
            {phase !== 'idle' && (
              <div>
                <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">
                  You — {pv}{pv > 21 ? ' BUST' : ''}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {playerHand.map((card, i) => <CardView key={i} card={card} />)}
                </div>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className={`text-center py-3 px-4 rounded-xl text-base font-bold
                               ${payout > 0 ? 'bg-gold/10 text-gold border border-gold/30' : 'bg-secondary/60 text-muted-foreground'}`}>
                {result}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="casino-card rounded-2xl p-5 space-y-4">
            {/* Bet amount */}
            {(phase === 'idle' || phase === 'done') && (
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Bet Amount</span>
                  <span className="font-bold text-gold">{betAmount.toLocaleString()} sats</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {BET_AMOUNTS.map((a) => (
                    <button
                      key={a}
                      onClick={() => setBetAmount(a)}
                      className={`bet-btn ${betAmount === a ? 'bet-btn-active' : ''}`}
                    >
                      {a >= 1000 ? `${a / 1000}k` : a}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {phase === 'idle' && (
              <button
                onClick={startGame}
                disabled={!isInitialized || balance < betAmount}
                className="spin-btn"
              >
                <Zap className="mr-2 w-5 h-5 inline" />
                DEAL — {betAmount.toLocaleString()} sats
              </button>
            )}

            {phase === 'playing' && (
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={hit}
                  className="py-3.5 rounded-xl font-bold text-sm bg-blue-700/30 hover:bg-blue-700/50 border border-blue-600/40 text-blue-300 transition-all"
                >
                  Hit
                </button>
                <button
                  onClick={stand}
                  className="py-3.5 rounded-xl font-bold text-sm bg-orange-700/30 hover:bg-orange-700/50 border border-orange-600/40 text-orange-300 transition-all"
                >
                  Stand
                </button>
                <button
                  onClick={double}
                  disabled={balance < betAmount || playerHand.length !== 2}
                  className="py-3.5 rounded-xl font-bold text-sm bg-purple-700/30 hover:bg-purple-700/50 border border-purple-600/40 text-purple-300 transition-all disabled:opacity-40"
                >
                  Double
                </button>
              </div>
            )}

            {phase === 'done' && (
              <button
                onClick={startGame}
                disabled={!isInitialized || balance < betAmount}
                className="spin-btn"
              >
                <Zap className="mr-2 w-5 h-5 inline" />
                DEAL AGAIN
              </button>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="casino-card rounded-2xl p-5">
            <div className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Session</div>
            <div className="space-y-1">
              {[
                { l: 'Hands Played', v: stats.played },
                { l: 'Hands Won', v: stats.won },
                { l: 'Win Rate', v: stats.played > 0 ? `${Math.round(stats.won / stats.played * 100)}%` : '—' },
                { l: 'Wagered', v: `${stats.wagered.toLocaleString()} sats` },
              ].map((r) => (
                <div key={r.l} className="stat-row text-sm">
                  <span className="text-muted-foreground">{r.l}</span>
                  <span className="font-bold">{r.v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="casino-card rounded-2xl p-5">
            <div className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Rules & Payouts</div>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              {[
                { l: 'Blackjack', v: '2.5×' },
                { l: 'Win', v: '2×' },
                { l: 'Push', v: '1× (refund)' },
                { l: 'Loss', v: '0×' },
                { l: 'Dealer stands on', v: 'Soft 17' },
                { l: 'Decks', v: '1 (reshuffled)' },
              ].map((r) => (
                <div key={r.l} className="flex justify-between">
                  <span>{r.l}</span>
                  <span className="font-semibold text-foreground">{r.v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="casino-card rounded-2xl p-5">
            <div className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Strategy Hint</div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              Always hit on 8 or below. Stand on 17+. Double on 10 or 11 if dealer shows 2–9.
              Never take insurance.
            </div>
          </div>
        </div>
      </div>
    </GameLayout>
  );
}

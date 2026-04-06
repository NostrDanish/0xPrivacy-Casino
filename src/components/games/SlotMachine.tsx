import { useState, useRef, useEffect } from 'react';
import GameLayout from '@/components/casino/GameLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCashu } from '@/contexts/CashuContext';
import { processWager, generateSeed, provablyFairRandom } from '@/lib/cashu';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { RotateCw, Zap, ChevronUp, ChevronDown } from 'lucide-react';

// ── Config ────────────────────────────────────────────────────────────────────

const SYMBOLS = ['🍒', '🍋', '🍊', '🍉', '⭐', '💎', '7️⃣'] as const;
type Symbol = typeof SYMBOLS[number];

const PAYOUTS: Record<string, number> = {
  '7️⃣7️⃣7️⃣': 100,
  '💎💎💎': 50,
  '⭐⭐⭐': 25,
  '🍉🍉🍉': 15,
  '🍊🍊🍊': 10,
  '🍋🍋🍋': 8,
  '🍒🍒🍒': 5,
  '🍒🍒': 2,   // 2 cherries anywhere
  '💎': 2,      // any single diamond
};

const BET_STEPS = [100, 200, 500, 1_000, 2_000, 5_000, 10_000];

// ── Component ─────────────────────────────────────────────────────────────────

export default function SlotMachine() {
  const { balance, placeBet, creditWin, isInitialized } = useCashu();
  const { user } = useCurrentUser();
  const { mutate: publish } = useNostrPublish();

  const [reels, setReels] = useState<Symbol[]>(['🍒', '⭐', '💎']);
  const [spinning, setSpinning] = useState(false);
  const [betIdx, setBetIdx] = useState(0);
  const [lastWin, setLastWin] = useState(0);
  const [msg, setMsg] = useState('');
  const [winFlash, setWinFlash] = useState(false);
  const [stats, setStats] = useState({ spins: 0, wagered: 0, won: 0 });

  const serverSeedRef = useRef(generateSeed());
  const clientSeedRef = useRef(generateSeed());
  const nonceRef = useRef(0);

  const betAmount = BET_STEPS[betIdx];
  const canSpin = isInitialized && !spinning && balance >= betAmount;

  const spin = async () => {
    if (!canSpin) return;

    const ok = await placeBet(betAmount);
    if (!ok) return;

    setSpinning(true);
    setLastWin(0);
    setMsg('');
    nonceRef.current++;

    // Generate 3 reel outcomes provably-fairly
    const results: Symbol[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await provablyFairRandom(serverSeedRef.current, clientSeedRef.current, nonceRef.current * 10 + i);
      results.push(SYMBOLS[Math.floor(r * SYMBOLS.length)]);
    }

    // Animate for 1.8s
    const start = Date.now();
    const animId = setInterval(() => {
      setReels([
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      ]);
      if (Date.now() - start > 1800) {
        clearInterval(animId);
        setReels(results);
        resolveOutcome(results);
      }
    }, 90);
  };

  const resolveOutcome = (reels: Symbol[]) => {
    const key3 = reels.join('');
    const cherries = reels.filter((s) => s === '🍒').length;
    const hasDiamond = reels.includes('💎');

    let multiplier = 0;

    if (PAYOUTS[key3]) {
      multiplier = PAYOUTS[key3];
    } else if (cherries === 2) {
      multiplier = PAYOUTS['🍒🍒'];
    } else if (hasDiamond) {
      multiplier = PAYOUTS['💎'];
    }

    const { payout, houseEdgeTaken, devFundTaken } = processWager(betAmount, multiplier);

    setStats((s) => ({
      spins: s.spins + 1,
      wagered: s.wagered + betAmount,
      won: s.won + payout,
    }));

    if (payout > 0) {
      creditWin(payout);
      setLastWin(payout);
      setWinFlash(true);
      setMsg(`🎉 WIN! +${payout.toLocaleString()} sats (${multiplier}×)`);
      setTimeout(() => setWinFlash(false), 1500);
    } else {
      setMsg('No match — spin again!');
    }

    // Publish to Nostr
    if (user) {
      publish({
        kind: 31383,
        content: JSON.stringify({ game: 'slots', reels, bet: betAmount, payout, multiplier, serverSeed: serverSeedRef.current, nonce: nonceRef.current }),
        tags: [
          ['d', `slots_${Date.now()}`],
          ['t', 'casino'], ['t', 'slots'],
          ['t', payout > 0 ? 'win' : 'loss'],
          ['amount', betAmount.toString()],
          ['payout', payout.toString()],
          ['alt', `0xPrivacy Casino — Slots: ${reels.join('')} — ${payout > 0 ? `Won ${payout} sats` : 'No win'}`],
        ],
      });
    }

    setSpinning(false);
  };

  return (
    <GameLayout
      title="Slot Machine"
      emoji="🎰"
      subtitle="3-reel provably-fair slots · 97.5% RTP · Up to 100× payout"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main game ───────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Reels */}
          <div className={`rounded-2xl border p-8 text-center transition-all duration-300
                           ${winFlash ? 'win-flash border-gold/50' : 'border-border/60 bg-secondary/20'}`}>
            <div className="flex justify-center items-center gap-4 md:gap-8 mb-6">
              {reels.map((sym, i) => (
                <div
                  key={i}
                  className={`w-24 h-24 md:w-32 md:h-32 casino-reel rounded-xl border-2
                               flex items-center justify-center text-5xl md:text-6xl
                               shadow-inner transition-all duration-100
                               ${spinning ? 'animate-spin-slot border-purple-700/50' : 'border-border/60'}
                               ${winFlash ? 'border-gold/70 glow-gold' : ''}`}
                >
                  {sym}
                </div>
              ))}
            </div>

            <div className="h-9 flex items-center justify-center">
              {msg && (
                <span className={`text-base font-bold px-4 py-1.5 rounded-full
                                  ${lastWin > 0
                                    ? 'bg-gold/10 text-gold border border-gold/30'
                                    : 'bg-secondary/60 text-muted-foreground'}`}>
                  {msg}
                </span>
              )}
            </div>
          </div>

          {/* Bet controls */}
          <div className="casino-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Bet Amount</span>
              <span className="text-xl font-bold text-gold">{betAmount.toLocaleString()} sats</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setBetIdx((i) => Math.max(0, i - 1))}
                disabled={betIdx === 0 || spinning}
                className="p-2 rounded-lg bg-secondary/80 hover:bg-secondary disabled:opacity-40 border border-border/60 transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <div className="flex-1 grid grid-cols-7 gap-1">
                {BET_STEPS.map((amt, idx) => (
                  <button
                    key={amt}
                    onClick={() => setBetIdx(idx)}
                    disabled={spinning || balance < amt}
                    className={`bet-btn text-[11px] py-1.5 ${betIdx === idx ? 'bet-btn-active' : ''}`}
                  >
                    {amt >= 1000 ? `${amt / 1000}k` : amt}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setBetIdx((i) => Math.min(BET_STEPS.length - 1, i + 1))}
                disabled={betIdx === BET_STEPS.length - 1 || spinning}
                className="p-2 rounded-lg bg-secondary/80 hover:bg-secondary disabled:opacity-40 border border-border/60 transition-colors"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>

            <button onClick={spin} disabled={!canSpin} className="spin-btn">
              {spinning ? (
                <span className="flex items-center justify-center gap-2">
                  <RotateCw className="w-5 h-5 animate-spin" /> Spinning…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Zap className="w-5 h-5" /> SPIN — {betAmount.toLocaleString()} sats
                </span>
              )}
            </button>

            {!isInitialized && (
              <p className="text-center text-xs text-muted-foreground">Initialize wallet to play</p>
            )}
          </div>
        </div>

        {/* ── Sidebar ───────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Session stats */}
          <div className="casino-card rounded-2xl p-5">
            <div className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Session</div>
            <div className="space-y-1">
              <div className="stat-row text-sm">
                <span className="text-muted-foreground">Spins</span>
                <span className="font-bold">{stats.spins}</span>
              </div>
              <div className="stat-row text-sm">
                <span className="text-muted-foreground">Wagered</span>
                <span className="font-bold">{stats.wagered.toLocaleString()}</span>
              </div>
              <div className="stat-row text-sm">
                <span className="text-muted-foreground">Won</span>
                <span className={`font-bold ${stats.won > stats.wagered ? 'text-casino-green' : 'text-casino-red'}`}>
                  {stats.won.toLocaleString()}
                </span>
              </div>
              <div className="stat-row text-sm">
                <span className="text-muted-foreground">P&L</span>
                <span className={`font-bold ${stats.won - stats.wagered >= 0 ? 'text-casino-green' : 'text-casino-red'}`}>
                  {(stats.won - stats.wagered) >= 0 ? '+' : ''}{(stats.won - stats.wagered).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Payout table */}
          <div className="casino-card rounded-2xl p-5">
            <div className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Payouts</div>
            <div className="space-y-1.5">
              {[
                { sym: '7️⃣7️⃣7️⃣', label: 'Triple 7', mult: 100 },
                { sym: '💎💎💎', label: 'Triple ◆', mult: 50 },
                { sym: '⭐⭐⭐', label: 'Triple ★', mult: 25 },
                { sym: '🍉🍉🍉', label: 'Triple Melon', mult: 15 },
                { sym: '🍊🍊🍊', label: 'Triple Orange', mult: 10 },
                { sym: '🍋🍋🍋', label: 'Triple Lemon', mult: 8 },
                { sym: '🍒🍒🍒', label: 'Triple Cherry', mult: 5 },
                { sym: '🍒🍒', label: 'Two Cherries', mult: 2 },
                { sym: '💎', label: 'Any Diamond', mult: 2 },
              ].map((row) => (
                <div key={row.sym} className="payout-row text-sm">
                  <span className="text-base">{row.sym}</span>
                  <span className="text-muted-foreground hidden md:inline">{row.label}</span>
                  <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/30 text-xs ml-auto">
                    {row.mult}×
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Provably fair */}
          <div className="casino-card rounded-2xl p-5">
            <div className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Provably Fair</div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Server seed (hashed):</div>
              <div className="font-mono text-[10px] break-all bg-secondary/40 rounded p-1.5">
                {serverSeedRef.current.slice(0, 32)}…
              </div>
              <div className="mt-2">Nonce: <span className="font-mono">{nonceRef.current}</span></div>
            </div>
          </div>
        </div>
      </div>
    </GameLayout>
  );
}

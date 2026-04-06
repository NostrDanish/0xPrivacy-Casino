import { useState, useRef } from 'react';
import GameLayout from '@/components/casino/GameLayout';
import { Badge } from '@/components/ui/badge';
import { useCashu } from '@/contexts/CashuContext';
import { processWager, generateSeed, provablyFairRandom } from '@/lib/cashu';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Zap, RotateCw } from 'lucide-react';

// European single-zero roulette
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const BLACK_NUMBERS = new Set([2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]);

const NUMBER_COLORS = Array.from({ length: 37 }, (_, i) => {
  if (i === 0) return 'green';
  if (RED_NUMBERS.has(i)) return 'red';
  return 'black';
});

// Wheel order (standard European)
const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];

type BetType = 'number' | 'red' | 'black' | 'odd' | 'even' | '1-18' | '19-36' | '1st12' | '2nd12' | '3rd12';

interface PlacedBet {
  type: BetType;
  value: number | string;
  amount: number;
}

const BET_AMOUNTS = [100, 500, 1_000, 5_000, 10_000];

function getColor(n: number): string {
  return NUMBER_COLORS[n];
}

function isBetWin(bet: PlacedBet, result: number): boolean {
  switch (bet.type) {
    case 'number': return result === bet.value;
    case 'red': return result > 0 && getColor(result) === 'red';
    case 'black': return result > 0 && getColor(result) === 'black';
    case 'odd': return result > 0 && result % 2 !== 0;
    case 'even': return result > 0 && result % 2 === 0;
    case '1-18': return result >= 1 && result <= 18;
    case '19-36': return result >= 19 && result <= 36;
    case '1st12': return result >= 1 && result <= 12;
    case '2nd12': return result >= 13 && result <= 24;
    case '3rd12': return result >= 25 && result <= 36;
    default: return false;
  }
}

function getBetMultiplier(betType: BetType): number {
  if (betType === 'number') return 36;
  if (['1st12', '2nd12', '3rd12'].includes(betType)) return 3;
  return 2; // even money bets
}

export default function Roulette() {
  const { balance, placeBet, creditWin, isInitialized } = useCashu();
  const { user } = useCurrentUser();
  const { mutate: publish } = useNostrPublish();

  const [result, setResult] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [selectedBetAmt, setSelectedBetAmt] = useState(500);
  const [bets, setBets] = useState<PlacedBet[]>([]);
  const [msg, setMsg] = useState('');
  const [winFlash, setWinFlash] = useState(false);
  const [wheelAngle, setWheelAngle] = useState(0);
  const [history, setHistory] = useState<number[]>([]);

  const serverSeedRef = useRef(generateSeed());
  const clientSeedRef = useRef(generateSeed());
  const nonceRef = useRef(0);

  const totalBet = bets.reduce((s, b) => s + b.amount, 0);
  const canSpin = isInitialized && !spinning && bets.length > 0 && balance >= totalBet;

  const addBet = (type: BetType, value: number | string) => {
    if (spinning || !isInitialized) return;
    setBets((prev) => {
      const existing = prev.find((b) => b.type === type && b.value === value);
      if (existing) {
        return prev.map((b) =>
          b.type === type && b.value === value
            ? { ...b, amount: b.amount + selectedBetAmt }
            : b,
        );
      }
      return [...prev, { type, value, amount: selectedBetAmt }];
    });
  };

  const clearBets = () => setBets([]);

  const doSpin = async () => {
    if (!canSpin) return;
    // Try to deduct all bets at once
    let deducted = 0;
    for (const bet of bets) {
      const ok = await placeBet(bet.amount);
      if (!ok) {
        // Refund partial
        creditWin(deducted);
        setMsg('Insufficient balance for all bets');
        return;
      }
      deducted += bet.amount;
    }

    setSpinning(true);
    setMsg('');
    nonceRef.current++;

    // Animate wheel
    const extraSpins = 5;
    const r = await provablyFairRandom(serverSeedRef.current, clientSeedRef.current, nonceRef.current);
    const winNumber = Math.floor(r * 37); // 0–36
    const winWheelIdx = WHEEL_ORDER.indexOf(winNumber);
    const targetAngle = wheelAngle + extraSpins * 360 + (winWheelIdx / 37) * 360;
    setWheelAngle(targetAngle);

    setTimeout(() => {
      setResult(winNumber);
      setHistory((h) => [winNumber, ...h.slice(0, 14)]);

      // Calculate total payout
      let totalPayout = 0;
      for (const bet of bets) {
        if (isBetWin(bet, winNumber)) {
          const mult = getBetMultiplier(bet.type);
          const { payout } = processWager(bet.amount, mult);
          totalPayout += payout;
        } else {
          processWager(bet.amount, 0);
        }
      }

      if (totalPayout > 0) {
        creditWin(totalPayout);
        setWinFlash(true);
        setMsg(`🎉 ${winNumber} ${getColor(winNumber) === 'green' ? '🟢' : getColor(winNumber) === 'red' ? '🔴' : '⚫'} — You won ${totalPayout.toLocaleString()} sats!`);
        setTimeout(() => setWinFlash(false), 1500);
      } else {
        setMsg(`${winNumber} ${getColor(winNumber) === 'green' ? '🟢' : getColor(winNumber) === 'red' ? '🔴' : '⚫'} — No winning bets`);
      }

      if (user) {
        publish({
          kind: 31383,
          content: JSON.stringify({ game: 'roulette', result: winNumber, bets, payout: totalPayout }),
          tags: [
            ['d', `roulette_${Date.now()}`],
            ['t', 'casino'], ['t', 'roulette'], ['t', totalPayout > 0 ? 'win' : 'loss'],
            ['amount', totalBet.toString()], ['payout', totalPayout.toString()],
            ['alt', `0xPrivacy Casino — Roulette: ${winNumber} — ${totalPayout > 0 ? `won ${totalPayout} sats` : 'no win'}`],
          ],
        });
      }

      setSpinning(false);
    }, 3200);
  };

  const EvenBetBtn = ({ label, type, value, color }: { label: string; type: BetType; value: string; color?: string }) => {
    const bet = bets.find((b) => b.type === type);
    return (
      <button
        onClick={() => addBet(type, value)}
        disabled={spinning}
        className={`flex-1 py-3 text-sm font-bold rounded-xl border transition-all
                     ${bet ? 'border-purple-500/70 bg-purple-600/20 text-purple-300' : `border-border/60 bg-secondary/60 hover:bg-secondary ${color || 'text-foreground'}`}
                     disabled:opacity-40`}
      >
        {label}
        {bet && <span className="ml-1 text-xs">({bet.amount.toLocaleString()})</span>}
      </button>
    );
  };

  return (
    <GameLayout title="Roulette" emoji="🎡" subtitle="European single-zero roulette · 97.5% RTP">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">

          {/* Wheel + result */}
          <div className={`rounded-2xl border p-6 text-center transition-all ${winFlash ? 'win-flash border-gold/50' : 'border-border/60 bg-secondary/20'}`}>
            {/* Animated wheel (CSS only) */}
            <div className="relative inline-flex items-center justify-center mb-4">
              <div
                className={`w-40 h-40 rounded-full border-8 border-border/60 bg-gradient-to-br from-green-900/60 to-emerald-950/80
                             flex items-center justify-center text-5xl font-black shadow-2xl transition-transform duration-[3200ms] ease-out`}
                style={{ transform: `rotate(${wheelAngle}deg)` }}
              >
                {spinning ? '🎡' : result !== null ? (
                  <span className={result === 0 ? 'text-green-400' : getColor(result) === 'red' ? 'text-red-400' : 'text-white'}>
                    {result}
                  </span>
                ) : '🎡'}
              </div>
            </div>

            {msg && (
              <div className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold
                               ${winFlash ? 'bg-gold/10 text-gold border border-gold/30' : 'bg-secondary/60 text-muted-foreground'}`}>
                {msg}
              </div>
            )}

            {/* History strip */}
            {history.length > 0 && (
              <div className="flex gap-1.5 justify-center mt-4 flex-wrap">
                {history.map((n, i) => (
                  <span
                    key={i}
                    className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center
                                 ${n === 0 ? 'bg-green-700 text-white' : getColor(n) === 'red' ? 'bg-red-700 text-white' : 'bg-gray-800 text-white'}`}
                  >
                    {n}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Bet controls */}
          <div className="casino-card rounded-2xl p-5 space-y-4">
            {/* Chip selector */}
            <div>
              <div className="text-xs text-muted-foreground mb-2">Chip value</div>
              <div className="flex gap-2 flex-wrap">
                {BET_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setSelectedBetAmt(a)}
                    className={`bet-btn ${selectedBetAmt === a ? 'bet-btn-active' : ''}`}
                  >
                    {a >= 1000 ? `${a / 1000}k` : a}
                  </button>
                ))}
              </div>
            </div>

            {/* Even-money bets */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <EvenBetBtn label="🔴 Red" type="red" value="red" color="text-red-400" />
                <EvenBetBtn label="⚫ Black" type="black" value="black" />
                <EvenBetBtn label="Zero 0" type="number" value={0} color="text-green-400" />
              </div>
              <div className="flex gap-2">
                <EvenBetBtn label="Odd" type="odd" value="odd" />
                <EvenBetBtn label="Even" type="even" value="even" />
              </div>
              <div className="flex gap-2">
                <EvenBetBtn label="1–18" type="1-18" value="1-18" />
                <EvenBetBtn label="19–36" type="19-36" value="19-36" />
              </div>
              <div className="flex gap-2">
                <EvenBetBtn label="1st 12" type="1st12" value="1st12" />
                <EvenBetBtn label="2nd 12" type="2nd12" value="2nd12" />
                <EvenBetBtn label="3rd 12" type="3rd12" value="3rd12" />
              </div>
            </div>

            {/* Number grid */}
            <div className="grid grid-cols-13 gap-0.5" style={{ gridTemplateColumns: 'repeat(13, 1fr)' }}>
              {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => {
                const betOnNum = bets.find((b) => b.type === 'number' && b.value === n);
                const c = getColor(n);
                return (
                  <button
                    key={n}
                    onClick={() => addBet('number', n)}
                    disabled={spinning}
                    className={`aspect-square rounded text-[11px] font-bold flex items-center justify-center
                                 border transition-all ${betOnNum ? 'border-gold ring-1 ring-gold/50' : 'border-transparent'}
                                 ${c === 'red' ? 'bg-red-800/70 hover:bg-red-700/80 text-white' : 'bg-gray-800/80 hover:bg-gray-700/80 text-white'}
                                 disabled:opacity-40`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>

            {/* Current bets + spin */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {bets.length > 0 ? (
                  <span>
                    {bets.length} bet{bets.length > 1 ? 's' : ''} ·{' '}
                    <span className="text-gold font-bold">{totalBet.toLocaleString()} sats</span>
                  </span>
                ) : 'No bets placed'}
              </div>
              <button
                onClick={clearBets}
                disabled={spinning || bets.length === 0}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
              >
                Clear bets
              </button>
            </div>

            <button onClick={doSpin} disabled={!canSpin} className="spin-btn">
              {spinning ? (
                <span className="flex items-center justify-center gap-2">
                  <RotateCw className="w-5 h-5 animate-spin" /> Spinning…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Zap className="w-5 h-5" /> SPIN — {totalBet.toLocaleString()} sats
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="casino-card rounded-2xl p-5">
            <div className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Active Bets</div>
            {bets.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-4">Click the board to place bets</div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {bets.map((b, i) => (
                  <div key={i} className="flex justify-between text-sm items-center">
                    <span className="text-muted-foreground capitalize">
                      {b.type === 'number' ? `#${b.value}` : b.type}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{getBetMultiplier(b.type)}×</span>
                      <span className="font-bold text-gold">{b.amount.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="casino-card rounded-2xl p-5">
            <div className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Payouts</div>
            <div className="space-y-1.5 text-sm">
              {[
                { l: 'Straight (number)', v: '36×' },
                { l: 'Dozen (1-12/13-24/25-36)', v: '3×' },
                { l: 'Red / Black', v: '2×' },
                { l: 'Odd / Even', v: '2×' },
                { l: 'Low (1-18) / High', v: '2×' },
              ].map((r) => (
                <div key={r.l} className="flex justify-between">
                  <span className="text-muted-foreground text-xs">{r.l}</span>
                  <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/30 text-xs">{r.v}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </GameLayout>
  );
}

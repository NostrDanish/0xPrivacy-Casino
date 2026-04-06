import { useState, useRef } from 'react';
import GameLayout from '@/components/casino/GameLayout';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useCashu } from '@/contexts/CashuContext';
import { processWager, generateSeed, provablyFairRandom } from '@/lib/cashu';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Dices, Zap, ChevronDown, ChevronUp } from 'lucide-react';

const BET_STEPS = [100, 200, 500, 1_000, 2_000, 5_000, 10_000];

export default function DiceRoll() {
  const { balance, placeBet, creditWin, isInitialized } = useCashu();
  const { user } = useCurrentUser();
  const { mutate: publish } = useNostrPublish();

  const [target, setTarget] = useState(50);
  const [roll, setRoll] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [betIdx, setBetIdx] = useState(0);
  const [lastWin, setLastWin] = useState(0);
  const [msg, setMsg] = useState('');
  const [winFlash, setWinFlash] = useState(false);
  const [mode, setMode] = useState<'under' | 'over'>('under');
  const [stats, setStats] = useState({ rolls: 0, wagered: 0, won: 0 });
  const [history, setHistory] = useState<{ roll: number; win: boolean; amount: number }[]>([]);

  const serverSeedRef = useRef(generateSeed());
  const clientSeedRef = useRef(generateSeed());
  const nonceRef = useRef(0);

  const betAmount = BET_STEPS[betIdx];

  // Win chance & multiplier
  const winChance = mode === 'under' ? target : 100 - target;
  const rawMultiplier = winChance > 0 ? 100 / winChance : 0;
  // Apply 2.5% house edge to multiplier
  const effectiveMultiplier = rawMultiplier * (1 - 0.025);
  const potentialPayout = Math.floor(betAmount * effectiveMultiplier);

  const canRoll = isInitialized && !rolling && balance >= betAmount && winChance > 0 && winChance < 100;

  const doRoll = async () => {
    if (!canRoll) return;
    const ok = await placeBet(betAmount);
    if (!ok) return;

    setRolling(true);
    setMsg('');
    nonceRef.current++;

    // Animate
    const start = Date.now();
    const anim = setInterval(() => {
      setRoll(Math.floor(Math.random() * 100) + 1);
      if (Date.now() - start > 900) {
        clearInterval(anim);
        finalise();
      }
    }, 60);
  };

  const finalise = async () => {
    const r = await provablyFairRandom(serverSeedRef.current, clientSeedRef.current, nonceRef.current);
    const result = Math.floor(r * 100) + 1; // 1–100
    setRoll(result);

    const isWin = mode === 'under' ? result <= target : result >= target;
    const multiplier = isWin ? effectiveMultiplier : 0;
    const { payout } = processWager(betAmount, multiplier);

    setStats((s) => ({ rolls: s.rolls + 1, wagered: s.wagered + betAmount, won: s.won + payout }));
    setHistory((h) => [{ roll: result, win: isWin, amount: isWin ? payout : -betAmount }, ...h.slice(0, 9)]);

    if (isWin) {
      creditWin(payout);
      setLastWin(payout);
      setWinFlash(true);
      setMsg(`🎉 WIN! Rolled ${result} — +${payout.toLocaleString()} sats`);
      setTimeout(() => setWinFlash(false), 1200);
    } else {
      setLastWin(0);
      setMsg(`Rolled ${result} — Better luck next time`);
    }

    if (user) {
      publish({
        kind: 31383,
        content: JSON.stringify({ game: 'dice', roll: result, target, mode, bet: betAmount, payout, win: isWin }),
        tags: [
          ['d', `dice_${Date.now()}`],
          ['t', 'casino'], ['t', 'dice'], ['t', isWin ? 'win' : 'loss'],
          ['amount', betAmount.toString()], ['payout', payout.toString()],
          ['alt', `0xPrivacy Casino — Dice: rolled ${result}, ${isWin ? `won ${payout} sats` : 'lost'}`],
        ],
      });
    }

    setRolling(false);
  };

  return (
    <GameLayout title="Dice" emoji="🎲" subtitle="Roll over or under your target · Provably fair · 97.5% RTP">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">

          {/* Dice display */}
          <div className={`rounded-2xl border p-8 text-center transition-all duration-300
                           ${winFlash ? 'win-flash border-gold/50' : 'border-border/60 bg-secondary/20'}`}>
            <div className={`text-8xl md:text-9xl font-black mb-4 transition-all
                              ${rolling ? 'animate-pulse text-muted-foreground' : lastWin > 0 ? 'text-gold' : 'text-foreground'}`}>
              {roll ?? '?'}
            </div>
            <div className="text-sm text-muted-foreground">
              {mode === 'under' ? `Roll ≤ ${target}` : `Roll ≥ ${target}`}
              {' '}to win
            </div>
            {msg && (
              <div className={`mt-3 inline-block px-4 py-1.5 rounded-full text-sm font-bold
                               ${lastWin > 0 ? 'bg-gold/10 text-gold border border-gold/30' : 'bg-secondary/60 text-muted-foreground'}`}>
                {msg}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="casino-card rounded-2xl p-5 space-y-5">
            {/* Over/under toggle */}
            <div className="flex gap-2">
              {(['under', 'over'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all
                               ${mode === m
                                 ? 'bg-purple-600/30 border-purple-500/70 text-purple-300'
                                 : 'bg-secondary/60 border-border/60 text-muted-foreground hover:text-foreground'}`}
                >
                  Roll {m === 'under' ? '⬇ Under' : '⬆ Over'}
                </button>
              ))}
            </div>

            {/* Target slider */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Target number</span>
                <span className="font-bold text-lg">{target}</span>
              </div>
              <Slider
                value={[target]}
                min={2}
                max={98}
                step={1}
                onValueChange={([v]) => setTarget(v)}
                disabled={rolling}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                <span>2 (high risk)</span>
                <span>50 (balanced)</span>
                <span>98 (high risk)</span>
              </div>
            </div>

            {/* Bet amount */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Bet Amount</span>
                <span className="text-xl font-bold text-gold">{betAmount.toLocaleString()} sats</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBetIdx((i) => Math.max(0, i - 1))}
                  disabled={betIdx === 0 || rolling}
                  className="p-2 rounded-lg bg-secondary/80 disabled:opacity-40 border border-border/60 hover:bg-secondary transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <div className="flex-1 grid grid-cols-7 gap-1">
                  {BET_STEPS.map((a, idx) => (
                    <button
                      key={a}
                      onClick={() => setBetIdx(idx)}
                      disabled={rolling || balance < a}
                      className={`bet-btn text-[11px] py-1.5 ${betIdx === idx ? 'bet-btn-active' : ''}`}
                    >
                      {a >= 1000 ? `${a / 1000}k` : a}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setBetIdx((i) => Math.min(BET_STEPS.length - 1, i + 1))}
                  disabled={betIdx === BET_STEPS.length - 1 || rolling}
                  className="p-2 rounded-lg bg-secondary/80 disabled:opacity-40 border border-border/60 hover:bg-secondary transition-colors"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Potential payout info */}
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-xl bg-secondary/40 py-2.5 px-2">
                <div className="font-bold text-lg text-foreground">{winChance}%</div>
                <div className="text-xs text-muted-foreground">Win chance</div>
              </div>
              <div className="rounded-xl bg-secondary/40 py-2.5 px-2">
                <div className="font-bold text-lg text-foreground">{effectiveMultiplier.toFixed(2)}×</div>
                <div className="text-xs text-muted-foreground">Multiplier</div>
              </div>
              <div className="rounded-xl bg-secondary/40 py-2.5 px-2">
                <div className="font-bold text-lg text-casino-green">+{potentialPayout.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Payout sats</div>
              </div>
            </div>

            <button onClick={doRoll} disabled={!canRoll} className="spin-btn">
              {rolling ? (
                <span className="flex items-center justify-center gap-2">
                  <Dices className="w-5 h-5 animate-spin" /> Rolling…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Zap className="w-5 h-5" /> ROLL — {betAmount.toLocaleString()} sats
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="casino-card rounded-2xl p-5">
            <div className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Session</div>
            <div className="space-y-1">
              {[
                { l: 'Rolls', v: stats.rolls, c: '' },
                { l: 'Wagered', v: `${stats.wagered.toLocaleString()} sats`, c: '' },
                { l: 'Won', v: `${stats.won.toLocaleString()} sats`, c: 'text-casino-green' },
                {
                  l: 'P&L', v: `${stats.won - stats.wagered >= 0 ? '+' : ''}${(stats.won - stats.wagered).toLocaleString()} sats`,
                  c: stats.won - stats.wagered >= 0 ? 'text-casino-green' : 'text-casino-red',
                },
              ].map((row) => (
                <div key={row.l} className="stat-row text-sm">
                  <span className="text-muted-foreground">{row.l}</span>
                  <span className={`font-bold ${row.c}`}>{row.v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="casino-card rounded-2xl p-5">
            <div className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Last 10 Rolls</div>
            <div className="space-y-1.5">
              {history.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4">No rolls yet</div>
              )}
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${h.win ? 'bg-casino-green' : 'bg-casino-red'}`} />
                    <span className="font-mono font-bold">{String(h.roll).padStart(3, ' ')}</span>
                  </div>
                  <span className={`font-semibold text-xs ${h.win ? 'text-casino-green' : 'text-casino-red'}`}>
                    {h.win ? `+${h.amount.toLocaleString()}` : `${h.amount.toLocaleString()}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="casino-card rounded-2xl p-5">
            <div className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Provably Fair</div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Server seed:</div>
              <div className="font-mono text-[10px] break-all bg-secondary/40 rounded p-1.5">
                {serverSeedRef.current.slice(0, 32)}…
              </div>
              <div className="mt-1.5">Nonce: <span className="font-mono">{nonceRef.current}</span></div>
            </div>
          </div>
        </div>
      </div>
    </GameLayout>
  );
}

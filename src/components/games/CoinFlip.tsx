import { useState, useRef } from 'react';
import GameLayout from '@/components/casino/GameLayout';
import { useCashu } from '@/contexts/CashuContext';
import { processWager, generateSeed, provablyFairRandom } from '@/lib/cashu';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Zap } from 'lucide-react';

const BET_STEPS = [100, 200, 500, 1_000, 2_000, 5_000, 10_000];

type Side = 'heads' | 'tails';

export default function CoinFlip() {
  const { balance, placeBet, creditWin, isInitialized } = useCashu();
  const { user } = useCurrentUser();
  const { mutate: publish } = useNostrPublish();

  const [betIdx, setBetIdx] = useState(2);
  const [choice, setChoice] = useState<Side>('heads');
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<Side | null>(null);
  const [lastWin, setLastWin] = useState(0);
  const [msg, setMsg] = useState('');
  const [coinFace, setCoinFace] = useState<Side>('heads');
  const [stats, setStats] = useState({ flips: 0, wagered: 0, won: 0 });
  const [history, setHistory] = useState<{ side: Side; win: boolean }[]>([]);

  const serverSeedRef = useRef(generateSeed());
  const clientSeedRef = useRef(generateSeed());
  const nonceRef = useRef(0);

  const betAmount = BET_STEPS[betIdx];
  const payout = Math.floor(betAmount * (2 * 0.975)); // ~1.95× (after 2.5% rake)
  const canFlip = isInitialized && !flipping && balance >= betAmount;

  const doFlip = async () => {
    if (!canFlip) return;
    const ok = await placeBet(betAmount);
    if (!ok) return;

    setFlipping(true);
    setMsg('');
    nonceRef.current++;

    // Animate coin for 1.5s
    const start = Date.now();
    const anim = setInterval(() => {
      setCoinFace((prev) => (prev === 'heads' ? 'tails' : 'heads'));
      if (Date.now() - start > 1500) {
        clearInterval(anim);
        finalise();
      }
    }, 100);
  };

  const finalise = async () => {
    const r = await provablyFairRandom(serverSeedRef.current, clientSeedRef.current, nonceRef.current);
    const flip: Side = r < 0.5 ? 'heads' : 'tails';
    setCoinFace(flip);
    setResult(flip);

    const isWin = flip === choice;
    const { payout: p } = processWager(betAmount, isWin ? 2 : 0);

    setStats((s) => ({
      flips: s.flips + 1,
      wagered: s.wagered + betAmount,
      won: s.won + (isWin ? p : 0),
    }));
    setHistory((h) => [{ side: flip, win: isWin }, ...h.slice(0, 14)]);

    if (isWin) {
      creditWin(p);
      setLastWin(p);
      setMsg(`🎉 ${flip.toUpperCase()}! You win +${p.toLocaleString()} sats`);
    } else {
      setLastWin(0);
      setMsg(`${flip.toUpperCase()} — Better luck next time`);
    }

    if (user) {
      publish({
        kind: 31383,
        content: JSON.stringify({ game: 'coinflip', result: flip, choice, bet: betAmount, payout: p, win: isWin }),
        tags: [
          ['d', `flip_${Date.now()}`], ['t', 'casino'], ['t', 'coinflip'],
          ['t', isWin ? 'win' : 'loss'],
          ['amount', betAmount.toString()], ['payout', p.toString()],
          ['alt', `0xPrivacy Casino — Coin Flip: ${flip} — ${isWin ? `won ${p} sats` : 'lost'}`],
        ],
      });
    }

    setFlipping(false);
  };

  return (
    <GameLayout title="Coin Flip" emoji="🪙" subtitle="Heads or tails · 97.5% RTP · Provably fair">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">

          {/* Coin display */}
          <div className={`rounded-2xl border p-10 text-center transition-all duration-300
                           ${lastWin > 0 && !flipping ? 'win-flash border-gold/50' : 'border-border/60 bg-secondary/20'}`}>
            <div
              className={`text-[100px] leading-none mb-4 inline-block select-none
                           ${flipping ? 'animate-coin-flip' : 'transition-all duration-300'}`}
            >
              {coinFace === 'heads' ? '🌕' : '🌑'}
            </div>
            <div className="text-sm text-muted-foreground">
              {flipping ? 'Flipping…' : result ? result.toUpperCase() : 'Pick a side and flip!'}
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
            {/* Heads / Tails */}
            <div>
              <div className="text-sm text-muted-foreground mb-2">Your pick</div>
              <div className="flex gap-3">
                {(['heads', 'tails'] as Side[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setChoice(s)}
                    disabled={flipping}
                    className={`flex-1 py-4 rounded-xl border text-base font-bold transition-all
                                 ${choice === s
                                   ? 'bg-purple-600/30 border-purple-500/70 text-purple-300 glow-purple'
                                   : 'bg-secondary/60 border-border/60 text-muted-foreground hover:text-foreground'}
                                 disabled:opacity-50`}
                  >
                    {s === 'heads' ? '🌕 HEADS' : '🌑 TAILS'}
                  </button>
                ))}
              </div>
            </div>

            {/* Bet */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-muted-foreground">Bet Amount</span>
                <span className="font-bold text-gold text-xl">{betAmount.toLocaleString()} sats</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {BET_STEPS.map((a, idx) => (
                  <button
                    key={a}
                    onClick={() => setBetIdx(idx)}
                    disabled={flipping || balance < a}
                    className={`bet-btn ${betIdx === idx ? 'bet-btn-active' : ''}`}
                  >
                    {a >= 1000 ? `${a / 1000}k` : a}
                  </button>
                ))}
              </div>
            </div>

            {/* Payout info */}
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-xl bg-secondary/40 py-2.5">
                <div className="font-bold text-lg">50%</div>
                <div className="text-xs text-muted-foreground">Win chance</div>
              </div>
              <div className="rounded-xl bg-secondary/40 py-2.5">
                <div className="font-bold text-lg">1.95×</div>
                <div className="text-xs text-muted-foreground">Multiplier</div>
              </div>
              <div className="rounded-xl bg-secondary/40 py-2.5">
                <div className="font-bold text-lg text-casino-green">+{payout.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Win sats</div>
              </div>
            </div>

            <button onClick={doFlip} disabled={!canFlip} className="spin-btn">
              {flipping ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin text-lg">🪙</span> Flipping…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Zap className="w-5 h-5" /> FLIP — {betAmount.toLocaleString()} sats
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
                { l: 'Flips', v: stats.flips },
                { l: 'Wagered', v: `${stats.wagered.toLocaleString()} sats` },
                { l: 'Won', v: `${stats.won.toLocaleString()} sats` },
                {
                  l: 'P&L',
                  v: `${stats.won - stats.wagered >= 0 ? '+' : ''}${(stats.won - stats.wagered).toLocaleString()} sats`,
                  c: stats.won - stats.wagered >= 0 ? 'text-casino-green' : 'text-casino-red',
                },
              ].map((r) => (
                <div key={r.l} className="stat-row text-sm">
                  <span className="text-muted-foreground">{r.l}</span>
                  <span className={`font-bold ${'c' in r ? r.c : ''}`}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="casino-card rounded-2xl p-5">
            <div className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">History</div>
            {history.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-4">No flips yet</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {history.map((h, i) => (
                  <span
                    key={i}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-base
                                 ${h.win ? 'bg-casino-green/20 ring-1 ring-casino-green/40' : 'bg-secondary/60'}`}
                    title={`${h.side} — ${h.win ? 'Win' : 'Loss'}`}
                  >
                    {h.side === 'heads' ? '🌕' : '🌑'}
                  </span>
                ))}
              </div>
            )}
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

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoginArea } from '@/components/auth/LoginArea';
import { useCashu } from '@/contexts/CashuContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { HOUSE_EDGE_PCT, DEV_FUND_PCT, TOTAL_RAKE } from '@/lib/cashu';
import WalletPanel from '@/components/casino/WalletPanel';
import {
  Wallet, Zap, Shield, Eye, Lock, TrendingUp,
  ChevronRight, Bitcoin, Activity,
} from 'lucide-react';

// ── Game catalogue ────────────────────────────────────────────────────────────

const GAMES = [
  {
    id: 'slots', name: 'Slots', path: '/games/slots',
    emoji: '🎰', tagline: 'Spin to win up to 100×',
    houseEdge: '2.5%', rtp: '97.5%', minBet: 100, hot: true,
    bg: 'from-yellow-900/40 to-amber-950/60',
    border: 'border-yellow-800/40',
    glow: 'hover:shadow-yellow-900/30',
  },
  {
    id: 'dice', name: 'Dice', path: '/games/dice',
    emoji: '🎲', tagline: 'Pick your odds, win big',
    houseEdge: '2.5%', rtp: '97.5%', minBet: 100, hot: false,
    bg: 'from-blue-900/40 to-indigo-950/60',
    border: 'border-blue-800/40',
    glow: 'hover:shadow-blue-900/30',
  },
  {
    id: 'roulette', name: 'Roulette', path: '/games/roulette',
    emoji: '🎡', tagline: 'European single-zero roulette',
    houseEdge: '2.5%', rtp: '97.5%', minBet: 100, hot: false,
    bg: 'from-green-900/40 to-emerald-950/60',
    border: 'border-green-800/40',
    glow: 'hover:shadow-green-900/30',
  },
  {
    id: 'blackjack', name: 'Blackjack', path: '/games/blackjack',
    emoji: '🃏', tagline: 'Beat the dealer to 21',
    houseEdge: '2.5%', rtp: '97.5%', minBet: 100, hot: false,
    bg: 'from-red-900/40 to-rose-950/60',
    border: 'border-red-800/40',
    glow: 'hover:shadow-red-900/30',
  },
  {
    id: 'coinflip', name: 'Coin Flip', path: '/games/coinflip',
    emoji: '🪙', tagline: '50/50 — near-zero house edge',
    houseEdge: '2.5%', rtp: '97.5%', minBet: 100, hot: false,
    bg: 'from-purple-900/40 to-violet-950/60',
    border: 'border-purple-800/40',
    glow: 'hover:shadow-purple-900/30',
  },
];

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function CasinoDashboard() {
  useSeoMeta({
    title: '0xPrivacy Casino — Decentralized Bitcoin Gaming',
    description: 'Privacy-first, censorship-resistant casino on Nostr. Pay with Cashu ecash. Provably fair.',
  });

  const { user } = useCurrentUser();
  const { balance, isInitialized, initializeWallet, houseStats } = useCashu();
  const [showWallet, setShowWallet] = useState(false);

  const author = useAuthor(user?.pubkey ?? '');
  const displayName = author.data?.metadata?.name ?? (user ? genUserName(user.pubkey) : null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-violet-700 flex items-center justify-center text-lg shadow-lg glow-purple">
              ♠
            </div>
            <div className="leading-none">
              <div className="font-bold text-lg tracking-tight">0xPrivacy</div>
              <div className="text-[11px] text-muted-foreground font-medium tracking-widest uppercase">Casino</div>
            </div>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#games" className="hover:text-foreground transition-colors">Games</a>
            <a href="#about" className="hover:text-foreground transition-colors">About</a>
            <a
              href="https://0xprivacy.online"
              target="_blank"
              rel="noopener"
              className="hover:text-foreground transition-colors"
            >
              0xPrivacy.online ↗
            </a>
          </nav>

          {/* Right cluster */}
          <div className="flex items-center gap-3">
            {user && (
              <button
                onClick={() => setShowWallet(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/60 bg-secondary/80
                           hover:bg-secondary hover:border-purple-500/40 transition-all text-sm font-medium"
              >
                <Zap className="w-4 h-4 text-gold" />
                <span className="text-gold font-bold">
                  {isInitialized ? `${balance.toLocaleString()} sats` : '—'}
                </span>
              </button>
            )}
            <LoginArea className="shrink-0" />
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border/40">
        {/* Background glow orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-purple-800/10 blur-3xl" />
          <div className="absolute -top-20 right-0 w-80 h-80 rounded-full bg-violet-700/8 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 w-64 h-64 -translate-x-1/2 rounded-full bg-purple-900/10 blur-2xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-16 md:py-24">
          {/* Privacy badge */}
          <div className="flex justify-center mb-6">
            <Badge className="gap-1.5 bg-purple-500/10 text-purple-300 border border-purple-500/30 px-3 py-1">
              <Shield className="w-3.5 h-3.5" />
              Privacy-first · Censorship-resistant · Bitcoin-native
            </Badge>
          </div>

          <h1 className="text-center text-4xl md:text-6xl font-bold tracking-tight mb-4">
            The{' '}
            <span className="bg-gradient-to-r from-purple-400 via-violet-400 to-purple-300 bg-clip-text text-transparent">
              Decentralized
            </span>
            <br />Bitcoin Casino
          </h1>

          <p className="text-center text-muted-foreground text-lg max-w-xl mx-auto mb-10">
            Log in with Nostr. Pay with Cashu ecash. Every outcome is provably fair.
            No KYC. No tracking. Your keys, your sats.
          </p>

          {/* CTA */}
          {!user ? (
            <div className="flex justify-center">
              <LoginArea className="flex" />
            </div>
          ) : !isInitialized ? (
            <div className="flex justify-center">
              <Button
                onClick={initializeWallet}
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-bold px-10 glow-purple"
              >
                <Wallet className="mr-2 w-5 h-5" />
                Initialize Cashu Wallet
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                onClick={() => setShowWallet(true)}
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-bold px-8 glow-purple"
              >
                <Zap className="mr-2 w-5 h-5" />
                Deposit Sats
              </Button>
              <div className="text-muted-foreground text-sm">
                Balance:{' '}
                <span className="text-gold font-bold text-base">{balance.toLocaleString()} sats</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Stats strip ─────────────────────────────────────────────────── */}
      <section className="border-b border-border/40 bg-secondary/20">
        <div className="mx-auto max-w-7xl px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[
            { label: 'House Edge', value: `${(HOUSE_EDGE_PCT * 100).toFixed(1)}%`, color: 'text-purple-400' },
            { label: 'Dev Fund', value: `${(DEV_FUND_PCT * 100).toFixed(1)}%`, color: 'text-violet-400' },
            { label: 'Prize Pool', value: `${houseStats.poolBalance.toLocaleString()} sats`, color: 'text-gold' },
            { label: 'Total Wagered', value: `${houseStats.totalWagered.toLocaleString()} sats`, color: 'text-casino-green' },
          ].map((s) => (
            <div key={s.label} className="py-2">
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Games ───────────────────────────────────────────────────────── */}
      <section id="games" className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">Games</h2>
            <p className="text-muted-foreground text-sm mt-1">All games are provably fair via Nostr events</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground border border-border/50 rounded-lg px-3 py-1.5">
            <Activity className="w-3.5 h-3.5 text-casino-green" />
            {GAMES.length} games live
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {GAMES.map((g) => (
            <Link
              key={g.id}
              to={user && isInitialized ? g.path : '#'}
              onClick={(e) => {
                if (!user) { e.preventDefault(); return; }
                if (!isInitialized) { e.preventDefault(); initializeWallet(); }
              }}
              className={`group relative flex flex-col p-5 rounded-2xl border bg-gradient-to-br ${g.bg} ${g.border}
                          transition-all duration-200 hover:scale-[1.02] hover:shadow-xl ${g.glow}
                          ${!user || !isInitialized ? 'opacity-70 cursor-pointer' : ''}`}
            >
              {g.hot && (
                <div className="absolute -top-2.5 -right-2.5">
                  <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-[10px] px-2 py-0.5">
                    🔥 HOT
                  </Badge>
                </div>
              )}

              <div className="flex items-start justify-between mb-4">
                <div className="text-5xl leading-none">{g.emoji}</div>
                <ChevronRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-foreground/70 group-hover:translate-x-0.5 transition-all mt-1" />
              </div>

              <div className="font-bold text-xl mb-1">{g.name}</div>
              <div className="text-sm text-muted-foreground mb-4">{g.tagline}</div>

              <div className="mt-auto grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="rounded-lg bg-black/20 py-1.5 px-1">
                  <div className="font-bold text-foreground/90">{g.rtp}</div>
                  <div className="text-muted-foreground">RTP</div>
                </div>
                <div className="rounded-lg bg-black/20 py-1.5 px-1">
                  <div className="font-bold text-foreground/90">{g.houseEdge}</div>
                  <div className="text-muted-foreground">Edge</div>
                </div>
                <div className="rounded-lg bg-black/20 py-1.5 px-1">
                  <div className="font-bold text-foreground/90">{g.minBet.toLocaleString()}</div>
                  <div className="text-muted-foreground">Min sats</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── About / Trust section ────────────────────────────────────────── */}
      <section id="about" className="border-t border-border/40">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <h2 className="text-2xl font-bold text-center mb-12">Why 0xPrivacy Casino?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <Lock className="w-6 h-6 text-purple-400" />,
                title: 'No KYC',
                desc: 'Log in with your Nostr key. No email, no ID, no surveillance.',
              },
              {
                icon: <Eye className="w-6 h-6 text-violet-400" />,
                title: 'Cashu Privacy',
                desc: 'Cashu ecash tokens are untraceable. The mint cannot link deposits to withdrawals.',
              },
              {
                icon: <Shield className="w-6 h-6 text-blue-400" />,
                title: 'Provably Fair',
                desc: 'Every game result is derived from SHA-256 of public server + client seeds published on Nostr.',
              },
              {
                icon: <Bitcoin className="w-6 h-6 text-gold" />,
                title: 'Bitcoin-native',
                desc: 'All balances in sats. Instant Lightning deposits and withdrawals via Cashu mints.',
              },
            ].map((f) => (
              <div key={f.title} className="casino-card p-6 rounded-2xl">
                <div className="mb-3">{f.icon}</div>
                <div className="font-bold mb-2">{f.title}</div>
                <div className="text-sm text-muted-foreground leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Revenue transparency ──────────────────────────────────────────── */}
      <section className="border-t border-border/40 bg-secondary/10">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-casino-green" />
                Transparent Revenue Model
              </h3>
              <p className="text-sm text-muted-foreground">
                Every wager carries a{' '}
                <span className="text-foreground font-semibold">{(TOTAL_RAKE * 100).toFixed(1)}% total rake</span>.
                Of that,{' '}
                <span className="text-purple-400 font-semibold">{(HOUSE_EDGE_PCT * 100).toFixed(1)}%</span> goes to
                the prize pool (funds your winnings), and{' '}
                <span className="text-violet-400 font-semibold">{(DEV_FUND_PCT * 100).toFixed(1)}%</span> funds
                continued development of 0xPrivacy tools.
              </p>
            </div>
            <div className="flex gap-4">
              <div className="casino-card rounded-xl p-4 text-center min-w-[110px]">
                <div className="text-2xl font-bold text-purple-400">
                  {(HOUSE_EDGE_PCT * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">Prize Pool</div>
              </div>
              <div className="casino-card rounded-xl p-4 text-center min-w-[110px]">
                <div className="text-2xl font-bold text-violet-400">
                  {(DEV_FUND_PCT * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">Dev Fund</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto max-w-7xl px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">0xPrivacy Casino</span>
            <span>·</span>
            <span>Powered by Nostr + Cashu</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://0xprivacy.online" target="_blank" rel="noopener" className="hover:text-foreground transition-colors">
              0xPrivacy.online
            </a>
            <a href="https://shakespeare.diy" target="_blank" rel="noopener" className="hover:text-foreground transition-colors">
              Vibed with Shakespeare ♟
            </a>
          </div>
        </div>
      </footer>

      {/* ── Wallet modal ─────────────────────────────────────────────────── */}
      {showWallet && <WalletPanel onClose={() => setShowWallet(false)} />}
    </div>
  );
}

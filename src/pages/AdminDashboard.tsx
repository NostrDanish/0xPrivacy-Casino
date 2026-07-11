import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCashu } from '@/contexts/CashuContext';
import { isAdminPubkey, FEE_LIGHTNING_ADDRESS, ADMIN_PUBKEY } from '@/lib/admin';
import { HOUSE_EDGE_PCT, DEV_FUND_PCT, TOTAL_RAKE } from '@/lib/cashu';
import { useCasinoFeed } from '@/hooks/useCasinoEvents';
import { useToast } from '@/hooks/useToast';
import {
  ChevronLeft, Shield, Zap, TrendingUp, ArrowUpFromLine,
  Plus, Minus, RotateCcw, Copy, Check,
  Activity, Users, DollarSign, BarChart3,
} from 'lucide-react';

export default function AdminDashboard() {
  useSeoMeta({
    title: '0xPrivacy Casino — Admin Dashboard',
    description: 'Casino treasury and admin controls.',
  });

  const { user } = useCurrentUser();
  const { toast } = useToast();
  const {
    houseStats, refreshBalance,
    adminAdjustPool, adminWithdrawDevFund, adminResetHouse, adminSeedPool,
    isLoading,
  } = useCashu();

  const { data: globalFeed } = useCasinoFeed(100);

  const [poolAdjustAmt, setPoolAdjustAmt] = useState(10_000);
  const [withdrawAmt, setWithdrawAmt] = useState<number | ''>('');
  const [resetPoolAmt, setResetPoolAmt] = useState(0);
  const [lnCopied, setLnCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [lastPayout, setLastPayout] = useState<{ amount: number; timestamp: number } | null>(null);
  const [seedTokenPaste, setSeedTokenPaste] = useState('');

  // Guard: only admin can see this page
  if (!user || !isAdminPubkey(user.pubkey)) {
    return <Navigate to="/" replace />;
  }

  // Feed stats
  const totalGames = globalFeed?.length ?? 0;
  const totalWins = globalFeed?.filter(e => e.tags.some(([n, v]) => n === 't' && v === 'win')).length ?? 0;
  const uniquePlayers = new Set(globalFeed?.map(e => e.pubkey) ?? []).size;

  const handleWithdrawFees = () => {
    const amt = withdrawAmt === '' ? undefined : withdrawAmt;
    const withdrawn = adminWithdrawDevFund(amt);
    if (withdrawn > 0) {
      setLastPayout({ amount: withdrawn, timestamp: Date.now() });
      toast({
        title: `${withdrawn.toLocaleString()} sats ready for payout`,
        description: `Send to ${FEE_LIGHTNING_ADDRESS} via Lightning`,
      });
    } else {
      toast({
        title: 'Nothing to withdraw',
        description: 'Dev fund balance is 0.',
        variant: 'destructive',
      });
    }
    setWithdrawAmt('');
  };

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 5000);
      return;
    }
    adminResetHouse(resetPoolAmt);
    setConfirmReset(false);
  };

  const copyLnAddress = () => {
    navigator.clipboard.writeText(FEE_LIGHTNING_ADDRESS);
    setLnCopied(true);
    toast({ title: 'Copied!', description: `${FEE_LIGHTNING_ADDRESS} copied to clipboard.` });
    setTimeout(() => setLnCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Casino
            </Link>
            <span className="text-border/60">/</span>
            <span className="font-bold text-sm flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-purple-400" />
              Admin Dashboard
            </span>
          </div>
          <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/30 gap-1.5">
            <Shield className="w-3 h-3" />
            0xPrivacy Admin
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">

        {/* ── Overview Stats ── */}
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            Treasury Overview
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: 'Prize Pool',
                value: `${houseStats.poolBalance.toLocaleString()} sats`,
                icon: <DollarSign className="w-4 h-4" />,
                color: 'text-gold',
                bgColor: 'from-yellow-900/20 to-amber-900/10',
                borderColor: 'border-yellow-800/30',
              },
              {
                label: 'Dev Fund (Accrued)',
                value: `${houseStats.devFundBalance.toLocaleString()} sats`,
                icon: <Zap className="w-4 h-4" />,
                color: 'text-violet-400',
                bgColor: 'from-violet-900/20 to-purple-900/10',
                borderColor: 'border-violet-800/30',
              },
              {
                label: 'Total Wagered',
                value: `${houseStats.totalWagered.toLocaleString()} sats`,
                icon: <TrendingUp className="w-4 h-4" />,
                color: 'text-casino-green',
                bgColor: 'from-green-900/20 to-emerald-900/10',
                borderColor: 'border-green-800/30',
              },
              {
                label: 'Total Paid Out',
                value: `${houseStats.totalPaidOut.toLocaleString()} sats`,
                icon: <ArrowUpFromLine className="w-4 h-4" />,
                color: 'text-blue-400',
                bgColor: 'from-blue-900/20 to-indigo-900/10',
                borderColor: 'border-blue-800/30',
              },
            ].map((s) => (
              <div
                key={s.label}
                className={`rounded-2xl border ${s.borderColor} bg-gradient-to-br ${s.bgColor} p-5`}
              >
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  {s.icon}
                  <span className="text-xs font-medium uppercase tracking-wide">{s.label}</span>
                </div>
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Secondary stats row */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="casino-card rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                <Activity className="w-3.5 h-3.5" />
                <span className="text-xs">Games Played</span>
              </div>
              <div className="text-xl font-bold">{totalGames}</div>
            </div>
            <div className="casino-card rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                <Users className="w-3.5 h-3.5" />
                <span className="text-xs">Unique Players</span>
              </div>
              <div className="text-xl font-bold">{uniquePlayers}</div>
            </div>
            <div className="casino-card rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="text-xs">Win Rate</span>
              </div>
              <div className="text-xl font-bold">
                {totalGames > 0 ? `${Math.round((totalWins / totalGames) * 100)}%` : '---'}
              </div>
            </div>
          </div>

          {/* Rake info */}
          <div className="mt-4 p-4 rounded-xl bg-secondary/30 border border-border/40 text-sm text-muted-foreground flex flex-wrap gap-4">
            <span>House Edge: <span className="text-foreground font-semibold">{(HOUSE_EDGE_PCT * 100).toFixed(1)}%</span></span>
            <span>Dev Fund: <span className="text-foreground font-semibold">{(DEV_FUND_PCT * 100).toFixed(1)}%</span></span>
            <span>Total Rake: <span className="text-foreground font-semibold">{(TOTAL_RAKE * 100).toFixed(1)}%</span></span>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── Fee Withdrawal (Lightning) ── */}
          <section className="casino-card rounded-2xl p-6 space-y-5">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-gold" />
              Fee Payout (Lightning)
            </h3>

            <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-900/15 to-amber-900/10 border border-yellow-800/20 space-y-3">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Payout Address</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono text-gold bg-black/20 rounded-lg px-3 py-2 truncate">
                  {FEE_LIGHTNING_ADDRESS}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyLnAddress}
                  className="border-border/60 shrink-0"
                >
                  {lnCopied ? <Check className="w-4 h-4 text-casino-green" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Fees accrue from the 0.5% dev fund rake on every wager. Withdraw and send via Lightning to the address above.
              </p>
            </div>

            <div className="space-y-3">
              <div className="stat-row">
                <span className="text-sm text-muted-foreground">Available to withdraw</span>
                <span className="font-bold text-violet-400">{houseStats.devFundBalance.toLocaleString()} sats</span>
              </div>

              <div>
                <div className="text-sm font-medium mb-1.5">Amount (leave blank for all)</div>
                <Input
                  type="number"
                  value={withdrawAmt}
                  onChange={(e) => setWithdrawAmt(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder={`Max: ${houseStats.devFundBalance.toLocaleString()} sats`}
                  className="bg-secondary/60 border-border/60 font-mono"
                  min={1}
                  max={houseStats.devFundBalance}
                />
              </div>

              <Button
                onClick={handleWithdrawFees}
                disabled={houseStats.devFundBalance <= 0}
                className="w-full bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-black font-bold"
              >
                <ArrowUpFromLine className="mr-2 w-4 h-4" />
                Withdraw Fees to Lightning
              </Button>

              {lastPayout && (
                <div className="p-3 rounded-lg bg-casino-green/10 border border-casino-green/20 text-sm">
                  <div className="text-casino-green font-semibold mb-1">
                    Payout Ready: {lastPayout.amount.toLocaleString()} sats
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Send {lastPayout.amount.toLocaleString()} sats to{' '}
                    <span className="text-gold font-mono">{FEE_LIGHTNING_ADDRESS}</span>{' '}
                    via any Lightning wallet.
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Pool Management ── */}
          <section className="casino-card rounded-2xl p-6 space-y-5">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-purple-400" />
              Prize Pool Management
            </h3>

            <div className="stat-row">
              <span className="text-sm text-muted-foreground">Current Pool</span>
              <span className="text-xl font-bold text-gold">{houseStats.poolBalance.toLocaleString()} sats</span>
            </div>

            {/* Seed pool with Cashu token */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-900/20 to-violet-900/10 border border-purple-700/20 space-y-3">
              <div className="text-sm font-semibold flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-gold" />
                Seed Pool with Cashu Token
              </div>
              <p className="text-xs text-muted-foreground">
                Paste a Cashu token to fund the prize pool. The token is validated with the mint and its value is added to the pool.
              </p>
              <textarea
                value={seedTokenPaste}
                onChange={(e) => setSeedTokenPaste(e.target.value)}
                placeholder="Paste cashuA... or cashuB... token"
                className="w-full bg-secondary/60 border border-border/60 rounded-lg p-3 text-xs font-mono min-h-[60px] resize-none text-foreground placeholder:text-muted-foreground/50"
              />
              <Button
                onClick={async () => {
                  const amt = await adminSeedPool(seedTokenPaste.trim());
                  if (amt > 0) setSeedTokenPaste('');
                }}
                disabled={isLoading || !seedTokenPaste.trim()}
                className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-bold"
              >
                <Zap className="mr-2 w-4 h-4" />
                {isLoading ? 'Processing...' : 'Seed Pool'}
              </Button>
            </div>

            {/* Add/Remove from pool */}
            <div className="space-y-3">
              <div className="text-sm font-medium">Adjust Pool Balance</div>
              <Input
                type="number"
                value={poolAdjustAmt}
                onChange={(e) => setPoolAdjustAmt(Number(e.target.value))}
                className="bg-secondary/60 border-border/60 font-mono"
                min={1}
              />
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => adminAdjustPool(poolAdjustAmt)}
                  disabled={poolAdjustAmt <= 0}
                  className="bg-casino-green/20 hover:bg-casino-green/30 text-casino-green border border-casino-green/30 font-bold"
                  variant="outline"
                >
                  <Plus className="mr-1.5 w-4 h-4" />
                  Add {poolAdjustAmt.toLocaleString()}
                </Button>
                <Button
                  onClick={() => adminAdjustPool(-poolAdjustAmt)}
                  disabled={poolAdjustAmt <= 0 || poolAdjustAmt > houseStats.poolBalance}
                  className="bg-casino-red/20 hover:bg-casino-red/30 text-casino-red border border-casino-red/30 font-bold"
                  variant="outline"
                >
                  <Minus className="mr-1.5 w-4 h-4" />
                  Remove {poolAdjustAmt.toLocaleString()}
                </Button>
              </div>
            </div>

            {/* Reset */}
            <div className="pt-4 border-t border-border/40 space-y-3">
              <div className="text-sm font-medium text-casino-red flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4" />
                Emergency Reset
              </div>
              <p className="text-xs text-muted-foreground">
                Resets all house stats (wagered, paid out, dev fund) and sets the pool to a specified amount.
                This cannot be undone.
              </p>
              <Input
                type="number"
                value={resetPoolAmt}
                onChange={(e) => setResetPoolAmt(Number(e.target.value))}
                className="bg-secondary/60 border-border/60 font-mono"
                min={0}
              />
              <Button
                onClick={handleReset}
                variant="outline"
                className={`w-full font-bold transition-all ${
                  confirmReset
                    ? 'bg-casino-red/30 hover:bg-casino-red/40 text-casino-red border-casino-red/50 animate-pulse'
                    : 'border-casino-red/30 text-casino-red/70 hover:text-casino-red hover:border-casino-red/50'
                }`}
              >
                <RotateCcw className="mr-2 w-4 h-4" />
                {confirmReset ? 'CONFIRM RESET — Click again' : 'Reset House Stats'}
              </Button>
            </div>
          </section>
        </div>

        {/* ── Admin Info ── */}
        <section className="casino-card rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            Admin Configuration
          </h3>
          <div className="space-y-2 text-sm">
            <div className="stat-row">
              <span className="text-muted-foreground">Admin Pubkey</span>
              <code className="font-mono text-xs text-foreground/80 bg-secondary/60 rounded px-2 py-1">
                {ADMIN_PUBKEY.slice(0, 16)}...{ADMIN_PUBKEY.slice(-8)}
              </code>
            </div>
            <div className="stat-row">
              <span className="text-muted-foreground">Lightning Address</span>
              <span className="font-mono text-gold">{FEE_LIGHTNING_ADDRESS}</span>
            </div>
            <div className="stat-row">
              <span className="text-muted-foreground">House Edge</span>
              <span className="font-semibold">{(HOUSE_EDGE_PCT * 100).toFixed(1)}%</span>
            </div>
            <div className="stat-row">
              <span className="text-muted-foreground">Dev Fund Rate</span>
              <span className="font-semibold">{(DEV_FUND_PCT * 100).toFixed(1)}%</span>
            </div>
            <div className="stat-row">
              <span className="text-muted-foreground">Total Rake</span>
              <span className="font-semibold">{(TOTAL_RAKE * 100).toFixed(1)}%</span>
            </div>
          </div>
        </section>

        {/* ── Recent Global Activity ── */}
        {globalFeed && globalFeed.length > 0 && (
          <section className="casino-card rounded-2xl p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-casino-green" />
              Recent Activity (Global)
            </h3>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {globalFeed.slice(0, 30).map((event) => {
                const gameTag = event.tags.find(([n, v]) => n === 't' && v !== 'casino' && v !== 'win' && v !== 'loss');
                const amountTag = event.tags.find(([n]) => n === 'amount');
                const payoutTag = event.tags.find(([n]) => n === 'payout');
                const isWin = event.tags.some(([n, v]) => n === 't' && v === 'win');
                const game = gameTag?.[1] ?? '?';
                const bet = amountTag?.[1] ?? '0';
                const payout = payoutTag?.[1] ?? '0';
                const time = new Date(event.created_at * 1000);

                return (
                  <div key={event.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0 text-sm">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${isWin ? 'bg-casino-green' : 'bg-casino-red'}`} />
                      <span className="capitalize font-medium">{game}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {event.pubkey.slice(0, 8)}...
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground text-xs">{bet} sats</span>
                      <span className={`font-bold text-xs ${isWin ? 'text-casino-green' : 'text-casino-red'}`}>
                        {isWin ? `+${payout}` : `-${bet}`}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 w-14 text-right">
                        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

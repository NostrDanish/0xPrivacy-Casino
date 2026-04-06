import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCashu } from '@/contexts/CashuContext';
import { HOUSE_EDGE_PCT, DEV_FUND_PCT } from '@/lib/cashu';
import { Zap, ArrowDownToLine, ArrowUpFromLine, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface Props {
  onClose: () => void;
}

type Tab = 'overview' | 'deposit' | 'withdraw';

export default function WalletPanel({ onClose }: Props) {
  const { toast } = useToast();
  const { balance, isInitialized, initializeWallet, deposit, withdraw, houseStats, isLoading } = useCashu();
  const [tab, setTab] = useState<Tab>('overview');
  const [depositAmt, setDepositAmt] = useState(10_000);
  const [withdrawAmt, setWithdrawAmt] = useState(1_000);
  const [withdrawToken, setWithdrawToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleDeposit = async () => {
    if (!isInitialized) initializeWallet();
    const ok = await deposit(depositAmt);
    if (ok) setTab('overview');
  };

  const handleWithdraw = async () => {
    const token = await withdraw(withdrawAmt);
    if (token) setWithdrawToken(token);
  };

  const copyToken = () => {
    if (!withdrawToken) return;
    navigator.clipboard.writeText(withdrawToken);
    setCopied(true);
    toast({ title: 'Copied!', description: 'Cashu token copied to clipboard.' });
    setTimeout(() => setCopied(false), 2000);
  };

  const QUICK_AMOUNTS = [1_000, 5_000, 10_000, 50_000, 100_000];

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md w-full bg-card border-border/60 text-foreground p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Zap className="w-5 h-5 text-gold" />
            Cashu Wallet
          </DialogTitle>
        </DialogHeader>

        {/* Balance */}
        <div className="mx-6 mt-4 p-4 rounded-xl bg-gradient-to-br from-purple-900/30 to-violet-900/20 border border-purple-700/30">
          <div className="text-xs text-muted-foreground mb-1">Available Balance</div>
          <div className="text-3xl font-bold text-gold">{balance.toLocaleString()} sats</div>
          <div className="text-xs text-muted-foreground mt-1">
            ≈ ${((balance * 0.00065)).toFixed(2)} USD
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mx-6 mt-4 p-1 bg-secondary/60 rounded-xl">
          {(['overview', 'deposit', 'withdraw'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setWithdrawToken(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg capitalize transition-all
                          ${tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 space-y-4 min-h-[220px]">
          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div className="space-y-3">
              <div className="stat-row">
                <span className="text-sm text-muted-foreground">Prize Pool</span>
                <span className="font-semibold text-gold">{houseStats.poolBalance.toLocaleString()} sats</span>
              </div>
              <div className="stat-row">
                <span className="text-sm text-muted-foreground">Total Wagered (session)</span>
                <span className="font-semibold">{houseStats.totalWagered.toLocaleString()} sats</span>
              </div>
              <div className="stat-row">
                <span className="text-sm text-muted-foreground">Total Paid Out</span>
                <span className="font-semibold text-casino-green">{houseStats.totalPaidOut.toLocaleString()} sats</span>
              </div>
              <div className="stat-row">
                <span className="text-sm text-muted-foreground">Dev Fund (accrued)</span>
                <span className="font-semibold text-violet-400">{houseStats.devFundBalance.toLocaleString()} sats</span>
              </div>
              <div className="mt-4 p-3 rounded-lg bg-secondary/40 text-xs text-muted-foreground">
                House edge: <span className="text-foreground">{(HOUSE_EDGE_PCT * 100).toFixed(1)}%</span>
                {' '}· Dev fund: <span className="text-foreground">{(DEV_FUND_PCT * 100).toFixed(1)}%</span>
                {' '}· Total rake: <span className="text-foreground">2.5%</span>
              </div>
            </div>
          )}

          {/* ── Deposit ── */}
          {tab === 'deposit' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                In production a Lightning invoice is generated. For the demo, tokens are credited instantly.
              </p>
              <div>
                <div className="text-sm font-medium mb-2">Amount (sats)</div>
                <Input
                  type="number"
                  value={depositAmt}
                  onChange={(e) => setDepositAmt(Number(e.target.value))}
                  className="bg-secondary/60 border-border/60 text-lg font-bold"
                  min={100}
                  step={100}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setDepositAmt(a)}
                    className={`bet-btn ${depositAmt === a ? 'bet-btn-active' : ''}`}
                  >
                    {a.toLocaleString()}
                  </button>
                ))}
              </div>
              <Button
                onClick={handleDeposit}
                disabled={isLoading || depositAmt < 100}
                className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 font-bold"
              >
                <ArrowDownToLine className="mr-2 w-4 h-4" />
                {isLoading ? 'Processing…' : `Deposit ${depositAmt.toLocaleString()} sats`}
              </Button>
            </div>
          )}

          {/* ── Withdraw ── */}
          {tab === 'withdraw' && (
            <div className="space-y-4">
              {!withdrawToken ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Your Cashu token can be redeemed at any compatible mint for a Lightning payment.
                  </p>
                  <div>
                    <div className="text-sm font-medium mb-2">Amount (sats)</div>
                    <Input
                      type="number"
                      value={withdrawAmt}
                      onChange={(e) => setWithdrawAmt(Number(e.target.value))}
                      className="bg-secondary/60 border-border/60 text-lg font-bold"
                      min={100}
                      max={balance}
                      step={100}
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      Max: {balance.toLocaleString()} sats
                    </div>
                  </div>
                  <Button
                    onClick={handleWithdraw}
                    disabled={isLoading || withdrawAmt < 100 || withdrawAmt > balance}
                    className="w-full bg-gradient-to-r from-green-700 to-emerald-700 hover:from-green-600 hover:to-emerald-600 font-bold"
                  >
                    <ArrowUpFromLine className="mr-2 w-4 h-4" />
                    {isLoading ? 'Processing…' : `Withdraw ${withdrawAmt.toLocaleString()} sats`}
                  </Button>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-casino-green">✅ Token ready — copy and redeem at your mint</div>
                  <div className="p-3 rounded-xl bg-secondary/60 border border-border/60 break-all text-xs font-mono max-h-28 overflow-y-auto">
                    {withdrawToken}
                  </div>
                  <Button onClick={copyToken} variant="outline" className="w-full border-border/60 font-medium">
                    {copied ? <Check className="mr-2 w-4 h-4 text-casino-green" /> : <Copy className="mr-2 w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy Token'}
                  </Button>
                  <Button onClick={() => { setWithdrawToken(null); onClose(); }} variant="ghost" size="sm" className="w-full text-muted-foreground">
                    Done
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

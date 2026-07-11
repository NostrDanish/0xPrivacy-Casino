import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCashu } from '@/contexts/CashuContext';
import { HOUSE_EDGE_PCT, DEV_FUND_PCT, isValidCashuToken, decodeTokenAmount, type MintQuoteResponse, type MeltQuoteResponse } from '@/lib/cashu';
import {
  Zap, ArrowDownToLine, ArrowUpFromLine, Copy, Check,
  Download, Upload, RefreshCw, QrCode, AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface Props {
  onClose: () => void;
}

type Tab = 'overview' | 'deposit' | 'withdraw' | 'backup';

export default function WalletPanel({ onClose }: Props) {
  const { toast } = useToast();
  const {
    balance, isInitialized, isLoading, houseStats, mintUrl,
    initializeWallet,
    requestDeposit, checkDeposit, finalizeDeposit,
    requestWithdraw, executeWithdraw,
    importToken, exportToken,
    exportBackup, importBackup,
  } = useCashu();

  const [tab, setTab] = useState<Tab>('overview');

  // Deposit state
  const [depositAmt, setDepositAmt] = useState(10_000);
  const [mintQuote, setMintQuote] = useState<MintQuoteResponse | null>(null);
  const [depositPending, setDepositPending] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Withdraw state
  const [lnInvoice, setLnInvoice] = useState('');
  const [meltQuote, setMeltQuote] = useState<MeltQuoteResponse | null>(null);

  // Token paste state
  const [tokenPaste, setTokenPaste] = useState('');
  const [tokenPreview, setTokenPreview] = useState<number>(0);

  // Export state
  const [exportAmt, setExportAmt] = useState(1_000);
  const [exportedToken, setExportedToken] = useState<string | null>(null);

  // Backup state
  const [backupToken, setBackupToken] = useState<string | null>(null);
  const [restorePaste, setRestorePaste] = useState('');

  const [copied, setCopied] = useState(false);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Preview token amount when pasting
  useEffect(() => {
    if (tokenPaste && isValidCashuToken(tokenPaste)) {
      setTokenPreview(decodeTokenAmount(tokenPaste));
    } else {
      setTokenPreview(0);
    }
  }, [tokenPaste]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: 'Copied!' });
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Deposit: get Lightning invoice from mint ───────────────────────────

  const handleRequestInvoice = async () => {
    if (depositAmt < 1) return;
    const quote = await requestDeposit(depositAmt);
    if (quote) {
      setMintQuote(quote);
      setDepositPending(true);
      // Start polling for payment
      pollRef.current = setInterval(async () => {
        const paid = await checkDeposit(quote.quote);
        if (paid) {
          if (pollRef.current) clearInterval(pollRef.current);
          const ok = await finalizeDeposit(depositAmt, quote.quote);
          if (ok) {
            setMintQuote(null);
            setDepositPending(false);
            setTab('overview');
          }
        }
      }, 3000);
    }
  };

  const cancelDeposit = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setMintQuote(null);
    setDepositPending(false);
  };

  // ── Withdraw: pay Lightning invoice ────────────────────────────────────

  const handleGetMeltQuote = async () => {
    if (!lnInvoice.trim()) return;
    const quote = await requestWithdraw(lnInvoice.trim());
    if (quote) setMeltQuote(quote);
  };

  const handleExecuteMelt = async () => {
    if (!meltQuote) return;
    const ok = await executeWithdraw(lnInvoice.trim(), meltQuote);
    if (ok) {
      setLnInvoice('');
      setMeltQuote(null);
      setTab('overview');
    }
  };

  // ── Token import ───────────────────────────────────────────────────────

  const handleImportToken = async () => {
    if (!tokenPaste.trim()) return;
    const amt = await importToken(tokenPaste.trim());
    if (amt > 0) {
      setTokenPaste('');
      setTokenPreview(0);
    }
  };

  // ── Token export ───────────────────────────────────────────────────────

  const handleExportToken = async () => {
    const token = await exportToken(exportAmt);
    if (token) setExportedToken(token);
  };

  // ── Backup ─────────────────────────────────────────────────────────────

  const handleExportBackup = () => {
    const token = exportBackup();
    setBackupToken(token || null);
  };

  const handleRestoreBackup = async () => {
    if (!restorePaste.trim()) return;
    const amt = await importBackup(restorePaste.trim());
    if (amt > 0) {
      setRestorePaste('');
      toast({ title: 'Wallet restored', description: `${amt.toLocaleString()} sats recovered.` });
    }
  };

  const QUICK_AMOUNTS = [1_000, 5_000, 10_000, 50_000, 100_000];

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md w-full bg-card border-border/60 text-foreground p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
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
          <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-casino-green" />
            Mint: {mintUrl.replace('https://', '').split('/')[0]}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 mx-6 mt-4 p-1 bg-secondary/60 rounded-xl text-xs">
          {(['overview', 'deposit', 'withdraw', 'backup'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setExportedToken(null); setMintQuote(null); setMeltQuote(null); }}
              className={`flex-1 py-2 font-medium rounded-lg capitalize transition-all
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
                <span className="text-sm text-muted-foreground">Total Wagered</span>
                <span className="font-semibold">{houseStats.totalWagered.toLocaleString()} sats</span>
              </div>
              <div className="stat-row">
                <span className="text-sm text-muted-foreground">Total Paid Out</span>
                <span className="font-semibold text-casino-green">{houseStats.totalPaidOut.toLocaleString()} sats</span>
              </div>
              <div className="mt-4 p-3 rounded-lg bg-secondary/40 text-xs text-muted-foreground">
                House edge: <span className="text-foreground">{(HOUSE_EDGE_PCT * 100).toFixed(1)}%</span>
                {' '}&middot; Dev fund: <span className="text-foreground">{(DEV_FUND_PCT * 100).toFixed(1)}%</span>
                {' '}&middot; Total rake: <span className="text-foreground">2.5%</span>
              </div>

              {/* Token paste quick import */}
              <div className="pt-3 border-t border-border/40">
                <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Upload className="w-3 h-3" />
                  Import Cashu Token
                </div>
                <div className="flex gap-2">
                  <Input
                    value={tokenPaste}
                    onChange={(e) => setTokenPaste(e.target.value)}
                    placeholder="Paste cashuA... or cashuB... token"
                    className="bg-secondary/60 border-border/60 text-xs font-mono flex-1"
                  />
                  <Button
                    onClick={handleImportToken}
                    disabled={isLoading || !tokenPaste || !isValidCashuToken(tokenPaste)}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-500 text-white shrink-0"
                  >
                    {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Import'}
                  </Button>
                </div>
                {tokenPreview > 0 && (
                  <div className="text-xs text-casino-green mt-1">
                    Token value: {tokenPreview.toLocaleString()} sats
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Deposit (Lightning) ── */}
          {tab === 'deposit' && (
            <div className="space-y-4">
              {!mintQuote ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Get a Lightning invoice from the mint. Pay it and the sats are added to your wallet.
                  </p>
                  <div>
                    <div className="text-sm font-medium mb-2">Amount (sats)</div>
                    <Input
                      type="number"
                      value={depositAmt}
                      onChange={(e) => setDepositAmt(Number(e.target.value))}
                      className="bg-secondary/60 border-border/60 text-lg font-bold"
                      min={1}
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
                    onClick={handleRequestInvoice}
                    disabled={isLoading || depositAmt < 1}
                    className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 font-bold"
                  >
                    <Zap className="mr-2 w-4 h-4" />
                    {isLoading ? 'Getting invoice...' : `Get Lightning Invoice`}
                  </Button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm font-semibold text-center">
                    Pay this Lightning invoice
                  </div>
                  <div className="p-4 rounded-xl bg-secondary/60 border border-border/60 space-y-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gold mb-1">{depositAmt.toLocaleString()} sats</div>
                      <div className="text-xs text-muted-foreground">Pay the invoice below with any Lightning wallet</div>
                    </div>
                    <div className="break-all text-[10px] font-mono bg-black/20 rounded-lg p-3 max-h-24 overflow-y-auto select-all">
                      {mintQuote.request}
                    </div>
                    <Button
                      onClick={() => copyToClipboard(mintQuote.request)}
                      variant="outline"
                      size="sm"
                      className="w-full border-border/60"
                    >
                      {copied ? <Check className="mr-2 w-3.5 h-3.5 text-casino-green" /> : <Copy className="mr-2 w-3.5 h-3.5" />}
                      {copied ? 'Copied!' : 'Copy Invoice'}
                    </Button>
                  </div>
                  {depositPending && (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                      Waiting for payment...
                    </div>
                  )}
                  <Button
                    onClick={cancelDeposit}
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── Withdraw (Lightning) ── */}
          {tab === 'withdraw' && (
            <div className="space-y-4">
              {!exportedToken ? (
                <>
                  {!meltQuote ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Paste a Lightning invoice and we'll pay it from your wallet balance.
                      </p>
                      <div>
                        <div className="text-sm font-medium mb-2">Lightning Invoice</div>
                        <Textarea
                          value={lnInvoice}
                          onChange={(e) => setLnInvoice(e.target.value)}
                          placeholder="lnbc..."
                          className="bg-secondary/60 border-border/60 font-mono text-xs min-h-[80px]"
                        />
                      </div>
                      <Button
                        onClick={handleGetMeltQuote}
                        disabled={isLoading || !lnInvoice.trim() || balance <= 0}
                        className="w-full bg-gradient-to-r from-green-700 to-emerald-700 hover:from-green-600 hover:to-emerald-600 font-bold"
                      >
                        <ArrowUpFromLine className="mr-2 w-4 h-4" />
                        {isLoading ? 'Getting quote...' : 'Get Withdraw Quote'}
                      </Button>

                      {/* OR export as token */}
                      <div className="pt-3 border-t border-border/40">
                        <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Download className="w-3 h-3" />
                          Or export as Cashu token
                        </div>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            value={exportAmt}
                            onChange={(e) => setExportAmt(Number(e.target.value))}
                            className="bg-secondary/60 border-border/60 font-mono flex-1"
                            min={1}
                            max={balance}
                          />
                          <Button
                            onClick={handleExportToken}
                            disabled={isLoading || exportAmt < 1 || exportAmt > balance}
                            size="sm"
                            className="bg-green-700 hover:bg-green-600 text-white shrink-0"
                          >
                            Export
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-sm font-semibold">Confirm withdrawal</div>
                      <div className="space-y-2">
                        <div className="stat-row text-sm">
                          <span className="text-muted-foreground">Amount</span>
                          <span className="font-bold">{meltQuote.amount.toLocaleString()} sats</span>
                        </div>
                        <div className="stat-row text-sm">
                          <span className="text-muted-foreground">Fee reserve</span>
                          <span className="font-bold">{meltQuote.fee_reserve.toLocaleString()} sats</span>
                        </div>
                        <div className="stat-row text-sm">
                          <span className="text-muted-foreground">Total deducted</span>
                          <span className="font-bold text-gold">
                            {(meltQuote.amount + meltQuote.fee_reserve).toLocaleString()} sats
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={handleExecuteMelt}
                        disabled={isLoading || balance < meltQuote.amount + meltQuote.fee_reserve}
                        className="w-full bg-gradient-to-r from-green-700 to-emerald-700 hover:from-green-600 hover:to-emerald-600 font-bold"
                      >
                        <Zap className="mr-2 w-4 h-4" />
                        {isLoading ? 'Sending...' : 'Pay Invoice'}
                      </Button>
                      <Button
                        onClick={() => { setMeltQuote(null); setLnInvoice(''); }}
                        variant="ghost"
                        size="sm"
                        className="w-full text-muted-foreground"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-casino-green">Cashu token created</div>
                  <div className="p-3 rounded-xl bg-secondary/60 border border-border/60 break-all text-xs font-mono max-h-28 overflow-y-auto select-all">
                    {exportedToken}
                  </div>
                  <Button onClick={() => copyToClipboard(exportedToken)} variant="outline" className="w-full border-border/60 font-medium">
                    {copied ? <Check className="mr-2 w-4 h-4 text-casino-green" /> : <Copy className="mr-2 w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy Token'}
                  </Button>
                  <Button onClick={() => setExportedToken(null)} variant="ghost" size="sm" className="w-full text-muted-foreground">
                    Done
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── Backup / Restore ── */}
          {tab === 'backup' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-yellow-900/15 border border-yellow-700/20 text-xs text-yellow-200/80 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-yellow-400" />
                <div>
                  Your wallet is stored in this browser only. If you clear browser data,
                  your sats are <strong>gone</strong>. Back up your wallet regularly!
                </div>
              </div>

              {/* Export backup */}
              <div className="space-y-2">
                <div className="text-sm font-semibold flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-purple-400" />
                  Export Wallet Backup
                </div>
                <p className="text-xs text-muted-foreground">
                  Export all your proofs as a Cashu token. Save it somewhere safe. You can re-import it on any device.
                </p>
                <Button
                  onClick={handleExportBackup}
                  disabled={balance <= 0}
                  variant="outline"
                  className="w-full border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                >
                  <Download className="mr-2 w-4 h-4" />
                  Export All ({balance.toLocaleString()} sats)
                </Button>
                {backupToken && (
                  <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-secondary/60 border border-border/60 break-all text-[10px] font-mono max-h-24 overflow-y-auto select-all">
                      {backupToken}
                    </div>
                    <Button onClick={() => copyToClipboard(backupToken)} variant="outline" size="sm" className="w-full border-border/60">
                      {copied ? <Check className="mr-1.5 w-3.5 h-3.5 text-casino-green" /> : <Copy className="mr-1.5 w-3.5 h-3.5" />}
                      {copied ? 'Copied!' : 'Copy Backup Token'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Restore backup */}
              <div className="pt-3 border-t border-border/40 space-y-2">
                <div className="text-sm font-semibold flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-casino-green" />
                  Restore Wallet
                </div>
                <p className="text-xs text-muted-foreground">
                  Paste a previously exported Cashu token to restore your funds.
                </p>
                <Textarea
                  value={restorePaste}
                  onChange={(e) => setRestorePaste(e.target.value)}
                  placeholder="Paste cashuA... or cashuB... backup token"
                  className="bg-secondary/60 border-border/60 font-mono text-xs min-h-[60px]"
                />
                {restorePaste && isValidCashuToken(restorePaste) && (
                  <div className="text-xs text-casino-green">
                    Token value: {decodeTokenAmount(restorePaste).toLocaleString()} sats
                  </div>
                )}
                <Button
                  onClick={handleRestoreBackup}
                  disabled={isLoading || !restorePaste || !isValidCashuToken(restorePaste)}
                  className="w-full bg-gradient-to-r from-green-700 to-emerald-700 hover:from-green-600 hover:to-emerald-600 font-bold"
                >
                  <Upload className="mr-2 w-4 h-4" />
                  {isLoading ? 'Restoring...' : 'Restore Wallet'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

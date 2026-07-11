import {
  createContext, useContext, useState, useCallback,
  ReactNode, useRef,
} from 'react';
import { useToast } from '@/hooks/useToast';
import {
  CasinoWallet, DEFAULT_MINT_URL,
  loadHouseStats, HouseStats,
  adjustPoolBalance, withdrawDevFund, resetHouseStats,
  processWager, isValidCashuToken, decodeTokenAmount,
  type Proof, type MintQuoteResponse, type MeltQuoteResponse,
  MintQuoteState,
} from '@/lib/cashu';

// ─── Context type ────────────────────────────────────────────────────────────

export interface CashuContextType {
  wallet: CasinoWallet | null;
  isInitialized: boolean;
  isLoading: boolean;
  balance: number;
  houseStats: HouseStats;
  mintUrl: string;

  // Wallet lifecycle
  initializeWallet: () => Promise<void>;
  refreshBalance: () => void;

  // Real Lightning deposit flow
  requestDeposit: (amount: number) => Promise<MintQuoteResponse | null>;
  checkDeposit: (quoteId: string) => Promise<boolean>;
  finalizeDeposit: (amount: number, quoteId: string) => Promise<boolean>;

  // Real Lightning withdraw flow
  requestWithdraw: (invoice: string) => Promise<MeltQuoteResponse | null>;
  executeWithdraw: (invoice: string, quote: MeltQuoteResponse) => Promise<boolean>;

  // Cashu token import/export
  importToken: (tokenStr: string) => Promise<number>;
  exportToken: (amount: number) => Promise<string | null>;

  // Wallet backup
  exportBackup: () => string;
  importBackup: (tokenStr: string) => Promise<number>;

  // Game operations
  placeBet: (amount: number) => Promise<boolean>;
  creditWin: (amount: number) => void;

  // Admin treasury
  adminAdjustPool: (amount: number) => void;
  adminWithdrawDevFund: (amount?: number) => number;
  adminResetHouse: (initialPool?: number) => void;
  adminSeedPool: (tokenStr: string) => Promise<number>;
}

// ─── Persistence helpers ─────────────────────────────────────────────────────

function loadWallet(): CasinoWallet | null {
  try {
    const raw = localStorage.getItem('casino:wallet');
    if (raw) {
      const data = JSON.parse(raw);
      return CasinoWallet.fromJSON(data);
    }
  } catch (e) {
    console.warn('Failed to load wallet:', e);
  }
  return null;
}

function saveWallet(w: CasinoWallet): void {
  localStorage.setItem('casino:wallet', JSON.stringify(w.toJSON()));
}

// ─── Provider ────────────────────────────────────────────────────────────────

const CashuContext = createContext<CashuContextType | undefined>(undefined);

export function CashuProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  const walletRef = useRef<CasinoWallet | null>(loadWallet());
  const [balance, setBalance] = useState<number>(walletRef.current?.balance ?? 0);
  const [isInitialized, setIsInitialized] = useState<boolean>(walletRef.current !== null);
  const [isLoading, setIsLoading] = useState(false);
  const [houseStats, setHouseStats] = useState<HouseStats>(loadHouseStats());

  const syncBalance = useCallback(() => {
    const b = walletRef.current?.balance ?? 0;
    setBalance(b);
    if (walletRef.current) saveWallet(walletRef.current);
  }, []);

  const syncHouse = useCallback(() => {
    setHouseStats(loadHouseStats());
  }, []);

  // ── Wallet lifecycle ───────────────────────────────────────────────────

  const initializeWallet = useCallback(async () => {
    if (walletRef.current) {
      try {
        await walletRef.current.init();
      } catch (e) {
        console.warn('Failed to connect to mint, wallet still usable offline:', e);
      }
      setIsInitialized(true);
      syncBalance();
      return;
    }
    const w = new CasinoWallet(DEFAULT_MINT_URL);
    try {
      await w.init();
    } catch (e) {
      console.warn('Failed to connect to mint on init:', e);
    }
    walletRef.current = w;
    saveWallet(w);
    setIsInitialized(true);
    syncBalance();
    toast({ title: 'Wallet ready', description: 'Your Cashu wallet is initialized.' });
  }, [syncBalance, toast]);

  const refreshBalance = useCallback(() => {
    syncBalance();
    syncHouse();
  }, [syncBalance, syncHouse]);

  // ── Real Lightning deposit ─────────────────────────────────────────────

  const requestDeposit = useCallback(async (amount: number): Promise<MintQuoteResponse | null> => {
    if (!walletRef.current) {
      toast({ title: 'No wallet', description: 'Initialize your wallet first.', variant: 'destructive' });
      return null;
    }
    setIsLoading(true);
    try {
      await walletRef.current.init();
      const quote = await walletRef.current.requestMintQuote(amount);
      return quote;
    } catch (e) {
      toast({ title: 'Deposit failed', description: `Could not get invoice from mint: ${e}`, variant: 'destructive' });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const checkDeposit = useCallback(async (quoteId: string): Promise<boolean> => {
    if (!walletRef.current) return false;
    try {
      const quote = await walletRef.current.checkMintQuote(quoteId);
      return quote.state === MintQuoteState.PAID;
    } catch {
      return false;
    }
  }, []);

  const finalizeDeposit = useCallback(async (amount: number, quoteId: string): Promise<boolean> => {
    if (!walletRef.current) return false;
    setIsLoading(true);
    try {
      await walletRef.current.mintProofs(amount, quoteId);
      syncBalance();
      toast({ title: 'Deposit confirmed!', description: `${amount.toLocaleString()} sats added to your wallet.` });
      return true;
    } catch (e) {
      toast({ title: 'Mint failed', description: String(e), variant: 'destructive' });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [syncBalance, toast]);

  // ── Real Lightning withdraw ────────────────────────────────────────────

  const requestWithdraw = useCallback(async (invoice: string): Promise<MeltQuoteResponse | null> => {
    if (!walletRef.current) return null;
    setIsLoading(true);
    try {
      await walletRef.current.init();
      const quote = await walletRef.current.requestMeltQuote(invoice);
      return quote;
    } catch (e) {
      toast({ title: 'Withdraw failed', description: `Could not get quote: ${e}`, variant: 'destructive' });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const executeWithdraw = useCallback(async (invoice: string, quote: MeltQuoteResponse): Promise<boolean> => {
    if (!walletRef.current) return false;
    setIsLoading(true);
    try {
      await walletRef.current.meltProofs(invoice, quote);
      syncBalance();
      toast({ title: 'Withdrawal sent!', description: `Lightning payment sent successfully.` });
      return true;
    } catch (e) {
      syncBalance();
      toast({ title: 'Withdrawal failed', description: String(e), variant: 'destructive' });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [syncBalance, toast]);

  // ── Cashu token import / export ────────────────────────────────────────

  const importToken = useCallback(async (tokenStr: string): Promise<number> => {
    if (!walletRef.current) return 0;
    setIsLoading(true);
    try {
      await walletRef.current.init();
      const amount = await walletRef.current.receiveToken(tokenStr);
      syncBalance();
      toast({ title: 'Token received!', description: `${amount.toLocaleString()} sats added to wallet.` });
      return amount;
    } catch (e) {
      toast({ title: 'Token import failed', description: String(e), variant: 'destructive' });
      return 0;
    } finally {
      setIsLoading(false);
    }
  }, [syncBalance, toast]);

  const exportToken = useCallback(async (amount: number): Promise<string | null> => {
    if (!walletRef.current || walletRef.current.balance < amount) {
      toast({ title: 'Insufficient balance', variant: 'destructive' });
      return null;
    }
    setIsLoading(true);
    try {
      await walletRef.current.init();
      const token = await walletRef.current.exportToken(amount);
      syncBalance();
      toast({ title: 'Token created', description: `${amount.toLocaleString()} sats exported as Cashu token.` });
      return token;
    } catch (e) {
      syncBalance();
      toast({ title: 'Export failed', description: String(e), variant: 'destructive' });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [syncBalance, toast]);

  // ── Wallet backup ──────────────────────────────────────────────────────

  const exportBackup = useCallback((): string => {
    if (!walletRef.current) return '';
    return walletRef.current.exportBackup();
  }, []);

  const importBackup = useCallback(async (tokenStr: string): Promise<number> => {
    return importToken(tokenStr);
  }, [importToken]);

  // ── Game operations ────────────────────────────────────────────────────

  const placeBet = useCallback(async (amount: number): Promise<boolean> => {
    if (!walletRef.current || walletRef.current.balance < amount) {
      toast({ title: 'Insufficient balance', description: 'Deposit more sats to play.', variant: 'destructive' });
      return false;
    }
    // Check house pool can cover potential max payout
    const stats = loadHouseStats();
    if (stats.poolBalance <= 0) {
      toast({ title: 'Pool empty', description: 'The house pool is empty. Games paused until the pool is funded.', variant: 'destructive' });
      return false;
    }
    try {
      await walletRef.current.deductBet(amount);
      syncBalance();
      return true;
    } catch (e) {
      toast({ title: 'Bet failed', description: String(e), variant: 'destructive' });
      return false;
    }
  }, [syncBalance, toast]);

  const creditWin = useCallback((amount: number) => {
    if (!walletRef.current || amount <= 0) return;
    // For simplicity in the client-side model, we credit synthetic proofs.
    // In a production multi-player environment, these would be real proofs
    // from the house wallet on a server.
    const syntheticProofs: Proof[] = [{
      id: 'casino-win',
      amount,
      secret: crypto.getRandomValues(new Uint8Array(32)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), ''),
      C: '0'.repeat(66),
    }];
    walletRef.current.addProofs(syntheticProofs);
    syncBalance();
    syncHouse();
  }, [syncBalance, syncHouse]);

  // ── Admin treasury ─────────────────────────────────────────────────────

  const adminAdjustPool = useCallback((amount: number) => {
    const updated = adjustPoolBalance(amount);
    setHouseStats(updated);
    toast({
      title: 'Pool adjusted',
      description: `Prize pool ${amount >= 0 ? 'increased' : 'decreased'} by ${Math.abs(amount).toLocaleString()} sats`,
    });
  }, [toast]);

  const adminWithdrawDevFund = useCallback((amount?: number): number => {
    const { withdrawn, stats: updated } = withdrawDevFund(amount);
    setHouseStats(updated);
    if (withdrawn > 0) {
      toast({
        title: 'Dev fund withdrawn',
        description: `${withdrawn.toLocaleString()} sats marked for Lightning payout`,
      });
    }
    return withdrawn;
  }, [toast]);

  const adminResetHouse = useCallback((initialPool = 0) => {
    const updated = resetHouseStats(initialPool);
    setHouseStats(updated);
    toast({ title: 'House stats reset', description: `Pool set to ${initialPool.toLocaleString()} sats` });
  }, [toast]);

  /** Admin seeds the pool by importing a Cashu token. The token value goes to the pool balance. */
  const adminSeedPool = useCallback(async (tokenStr: string): Promise<number> => {
    if (!walletRef.current) return 0;
    if (!isValidCashuToken(tokenStr)) {
      toast({ title: 'Invalid token', description: 'Paste a valid cashuA or cashuB token.', variant: 'destructive' });
      return 0;
    }
    setIsLoading(true);
    try {
      await walletRef.current.init();
      // Receive the token into the casino wallet first (validates with mint)
      const amount = await walletRef.current.receiveToken(tokenStr);
      // Then add to pool balance
      const updated = adjustPoolBalance(amount);
      setHouseStats(updated);
      syncBalance();
      toast({
        title: 'Pool seeded!',
        description: `${amount.toLocaleString()} sats added to the prize pool.`,
      });
      return amount;
    } catch (e) {
      toast({ title: 'Seed failed', description: String(e), variant: 'destructive' });
      return 0;
    } finally {
      setIsLoading(false);
    }
  }, [syncBalance, toast]);

  // ── Context value ──────────────────────────────────────────────────────

  const value: CashuContextType = {
    wallet: walletRef.current,
    isInitialized,
    isLoading,
    balance,
    houseStats,
    mintUrl: walletRef.current?.getMintUrl() ?? DEFAULT_MINT_URL,
    initializeWallet,
    refreshBalance,
    requestDeposit,
    checkDeposit,
    finalizeDeposit,
    requestWithdraw,
    executeWithdraw,
    importToken,
    exportToken,
    exportBackup,
    importBackup,
    placeBet,
    creditWin,
    adminAdjustPool,
    adminWithdrawDevFund,
    adminResetHouse,
    adminSeedPool,
  };

  return <CashuContext.Provider value={value}>{children}</CashuContext.Provider>;
}

export function useCashu(): CashuContextType {
  const ctx = useContext(CashuContext);
  if (!ctx) throw new Error('useCashu must be used inside CashuProvider');
  return ctx;
}

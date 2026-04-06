import {
  createContext, useContext, useState, useCallback,
  ReactNode, useEffect, useRef,
} from 'react';
import { useToast } from '@/hooks/useToast';
import {
  CashuWallet, CashuMintInfo, CashuToken,
  processWager, loadHouseStats, HouseStats, generateSeed,
} from '@/lib/cashu';

// ── Default mints ────────────────────────────────────────────────────────────

const DEFAULT_MINTS: CashuMintInfo[] = [
  { url: 'https://mint.minibits.cash/Bitcoin', name: 'Minibits', active: true },
  { url: 'https://mint.coinos.io', name: 'Coinos', active: true },
  { url: 'https://legend.lnbits.com/cashu/api/v1/4gr9Xcmz3XEkUNwiBiQGoC', name: 'LNbits', active: true },
];

// ── Context type ─────────────────────────────────────────────────────────────

export interface CashuContextType {
  // State
  wallet: CashuWallet | null;
  isInitialized: boolean;
  isLoading: boolean;
  balance: number;
  houseStats: HouseStats;
  // Wallet ops
  initializeWallet: () => void;
  refreshBalance: () => void;
  addMint: (mintUrl: string, name?: string) => void;
  setActiveMint: (mintUrl: string) => void;
  // Payment ops
  deposit: (amount: number) => Promise<boolean>;
  withdraw: (amount: number) => Promise<string | null>;
  // Game ops — use these in every game
  placeBet: (amount: number) => Promise<boolean>;
  creditWin: (amount: number) => void;
  // Dev fund
  getDevFundBalance: () => number;
}

// ── Wallet serialisation helpers ──────────────────────────────────────────────

function loadWallet(): CashuWallet | null {
  try {
    const raw = localStorage.getItem('casino:wallet');
    if (raw) {
      const data = JSON.parse(raw);
      return CashuWallet.fromJSON(data);
    }
  } catch (_) { /* ignore */ }
  return null;
}

function saveWallet(w: CashuWallet): void {
  localStorage.setItem('casino:wallet', JSON.stringify(w.toJSON()));
}

// ── Context ───────────────────────────────────────────────────────────────────

const CashuContext = createContext<CashuContextType | undefined>(undefined);

export function CashuProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  const walletRef = useRef<CashuWallet | null>(loadWallet());
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

  // ── Init ────────────────────────────────────────────────────────────────────

  const initializeWallet = useCallback(() => {
    if (walletRef.current) {
      setIsInitialized(true);
      syncBalance();
      return;
    }
    const w = new CashuWallet(DEFAULT_MINTS);
    walletRef.current = w;
    saveWallet(w);
    setIsInitialized(true);
    syncBalance();
    toast({ title: '⚡ Wallet ready', description: 'Your Cashu wallet is initialized.' });
  }, [syncBalance, toast]);

  const refreshBalance = useCallback(() => {
    syncBalance();
    syncHouse();
  }, [syncBalance, syncHouse]);

  // ── Mint management ─────────────────────────────────────────────────────────

  const addMint = useCallback((mintUrl: string, name?: string) => {
    if (!walletRef.current) return;
    walletRef.current.addMint({ url: mintUrl, name: name ?? mintUrl });
    saveWallet(walletRef.current);
    toast({ title: 'Mint added', description: name ?? mintUrl });
  }, [toast]);

  const setActiveMint = useCallback((mintUrl: string) => {
    walletRef.current?.setMint(mintUrl);
    if (walletRef.current) saveWallet(walletRef.current);
  }, []);

  // ── Deposit (simulate Lightning → Cashu tokens) ─────────────────────────────

  const deposit = useCallback(async (amount: number): Promise<boolean> => {
    if (!walletRef.current) {
      toast({ title: 'No wallet', description: 'Initialize your wallet first.', variant: 'destructive' });
      return false;
    }
    setIsLoading(true);
    try {
      // In production: call mint API to get a Lightning invoice,
      // user pays it, then poll until tokens are ready.
      // Here we simulate tokens arriving immediately.
      await walletRef.current.mintToken(amount);
      syncBalance();
      toast({ title: '✅ Deposit confirmed', description: `${amount.toLocaleString()} sats added to wallet.` });
      return true;
    } catch (e) {
      toast({ title: 'Deposit failed', description: String(e), variant: 'destructive' });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [syncBalance, toast]);

  // ── Withdraw (burn tokens → Lightning invoice) ──────────────────────────────

  const withdraw = useCallback(async (amount: number): Promise<string | null> => {
    if (!walletRef.current) return null;
    if (walletRef.current.balance < amount) {
      toast({ title: 'Insufficient balance', description: `You only have ${walletRef.current.balance} sats.`, variant: 'destructive' });
      return null;
    }
    setIsLoading(true);
    try {
      const token = await walletRef.current.send(amount);
      if (!token) throw new Error('Failed to build token');
      syncBalance();
      // In production: exchange token for a paid Lightning invoice at the mint.
      const tokenStr = `cashuA${btoa(JSON.stringify(token))}`;
      toast({ title: '✅ Withdrawal ready', description: `${amount.toLocaleString()} sats token created.` });
      return tokenStr;
    } catch (e) {
      toast({ title: 'Withdrawal failed', description: String(e), variant: 'destructive' });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [syncBalance, toast]);

  // ── Game ops ─────────────────────────────────────────────────────────────────

  const placeBet = useCallback(async (amount: number): Promise<boolean> => {
    if (!walletRef.current || walletRef.current.balance < amount) {
      toast({
        title: 'Insufficient balance',
        description: `Need ${amount.toLocaleString()} sats — deposit more to play.`,
        variant: 'destructive',
      });
      return false;
    }
    const token = await walletRef.current.send(amount);
    if (!token) return false;
    syncBalance();
    return true;
  }, [syncBalance, toast]);

  const creditWin = useCallback((amount: number) => {
    if (!walletRef.current || amount <= 0) return;
    walletRef.current.creditAmount(amount);
    syncBalance();
    syncHouse();
  }, [syncBalance, syncHouse]);

  // ── Dev fund ──────────────────────────────────────────────────────────────────

  const getDevFundBalance = useCallback(() => loadHouseStats().devFundBalance, []);

  // ── Context value ─────────────────────────────────────────────────────────────

  const value: CashuContextType = {
    wallet: walletRef.current,
    isInitialized,
    isLoading,
    balance,
    houseStats,
    initializeWallet,
    refreshBalance,
    addMint,
    setActiveMint,
    deposit,
    withdraw,
    placeBet,
    creditWin,
    getDevFundBalance,
  };

  return <CashuContext.Provider value={value}>{children}</CashuContext.Provider>;
}

export function useCashu(): CashuContextType {
  const ctx = useContext(CashuContext);
  if (!ctx) throw new Error('useCashu must be used inside CashuProvider');
  return ctx;
}

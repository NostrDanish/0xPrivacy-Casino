import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { useToast } from '@/hooks/useToast';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { CashuWallet, CashuMintInfo, CashuToken } from '@/lib/cashu';

interface CashuContextType {
  wallet: CashuWallet | null;
  isInitialized: boolean;
  initializeWallet: () => Promise<void>;
  getBalance: () => number;
  deposit: (amount: number, mintUrl?: string) => Promise<string | null>;
  withdraw: (amount: number) => Promise<string | null>;
  pay: (amount: number, description?: string) => Promise<boolean>;
  refreshBalance: () => Promise<void>;
  addMint: (mintUrl: string, name?: string) => Promise<void>;
  isLoading: boolean;
  sendToken: (amount: number) => Promise<CashuToken | null>;
  receiveToken: (token: CashuToken) => Promise<boolean>;
}

const defaultMints: CashuMintInfo[] = [
  { url: 'https://mint.cashu.space', name: 'Cashu Public Mint', description: 'Publicly accessible Cashu mint' },
  { url: 'https://mint.franz.today', name: 'Franz Mint', description: 'Reliable public mint' },
  { url: 'https://mint.munch.org', name: 'Munch Mint', description: 'Community-run mint' },
];

const CashuContext = createContext<CashuContextType | undefined>(undefined);

export function CashuProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [wallet, setWallet] = useLocalStorage<CashuWallet | null>('cashu-wallet', null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (wallet) {
      setIsInitialized(true);
    }
  }, [wallet]);

  const initializeWallet = useCallback(async () => {
    try {
      setIsLoading(true);
      const newWallet = new CashuWallet(defaultMints);
      setWallet(newWallet);
      setIsInitialized(true);
      toast({
        title: 'Cashu Wallet Initialized',
        description: 'Your Cashu wallet is ready to use. Mints connected.',
      });
    } catch (error) {
      toast({
        title: 'Wallet Initialization Failed',
        description: 'Failed to initialize Cashu wallet',
        variant: 'destructive',
      });
      console.error('Failed to initialize wallet:', error);
    } finally {
      setIsLoading(false);
    }
  }, [setWallet, toast]);

  const getBalance = useCallback(() => wallet?.balance || 0, [wallet]);

  const deposit = useCallback(async (amount: number, mintUrl?: string): Promise<string | null> => {
    try {
      if (!wallet) {
        toast({ title: 'Wallet Not Initialized', description: 'Initialize your Cashu wallet first', variant: 'destructive' });
        return null;
      }
      setIsLoading(true);
      const mint = mintUrl || wallet.currentMint?.url;
      if (!mint) {
        toast({ title: 'No Mint Selected', description: 'Add a mint or select one from the list', variant: 'destructive' });
        return null;
      }
      const token = await wallet.mintToken(amount, mint);
      if (token) {
        setWallet(wallet);
        toast({ title: 'Deposit Successful', description: `Deposited ${amount} sats` });
        return `Successfully deposited ${amount} sats`;
      }
      toast({ title: 'Deposit Failed', description: 'Failed to receive tokens from mint', variant: 'destructive' });
      return null;
    } catch (error) {
      toast({ title: 'Deposit Failed', description: 'Error during deposit', variant: 'destructive' });
      console.error('Deposit error:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [wallet, setWallet, toast]);

  const withdraw = useCallback(async (amount: number): Promise<string | null> => {
    try {
      if (!wallet) {
        toast({ title: 'Wallet Not Initialized', description: 'Initialize your Cashu wallet first', variant: 'destructive' });
        return null;
      }
      if (wallet.balance < amount) {
        toast({ title: 'Insufficient Balance', description: `Need ${amount} sats, have ${wallet.balance} sats`, variant: 'destructive' });
        return null;
      }
      setIsLoading(true);
      const token = await wallet.send(amount);
      if (token) {
        setWallet(wallet);
        const tokenString = JSON.stringify(token);
        toast({ title: 'Withdrawal Successful', description: `Withdrew ${amount} sats. Token ready.` });
        return tokenString;
      }
      toast({ title: 'Withdrawal Failed', description: 'Failed to generate withdrawal token', variant: 'destructive' });
      return null;
    } catch (error) {
      toast({ title: 'Withdrawal Failed', description: 'Error during withdrawal', variant: 'destructive' });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [wallet, setWallet, toast]);

  const pay = useCallback(async (amount: number, description?: string): Promise<boolean> => {
    try {
      if (!wallet) {
        toast({ title: 'Wallet Not Initialized', description: 'Initialize your Cashu wallet first', variant: 'destructive' });
        return false;
      }
      if (wallet.balance < amount) {
        toast({ title: 'Insufficient Balance', description: `Need ${amount} sats, have ${wallet.balance} sats`, variant: 'destructive' });
        return false;
      }
      setIsLoading(true);
      const token = await wallet.send(amount);
      if (token) {
        setWallet(wallet);
        toast({ title: 'Payment Successful', description: `Paid ${amount} sats${description ? `: ${description}` : ''}` });
        return true;
      }
      toast({ title: 'Payment Failed', description: 'Failed to generate payment token', variant: 'destructive' });
      return false;
    } catch (error) {
      toast({ title: 'Payment Failed', description: 'Error during payment', variant: 'destructive' });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [wallet, setWallet, toast]);

  const refreshBalance = useCallback(async () => {
    try {
      setIsLoading(true);
      const balance = wallet?.balance || 0;
      toast({ title: 'Balance Updated', description: `Current balance: ${balance} sats` });
    } catch (error) {
      console.error('Balance refresh error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [wallet, toast]);

  const addMint = useCallback(async (mintUrl: string, name?: string) => {
    try {
      setIsLoading(true);
      const newMint: CashuMintInfo = {
        url: mintUrl,
        name: name || mintUrl.split('/')[2],
        description: 'Custom mint',
      };
      wallet?.addMint(newMint);
      if (wallet) setWallet(wallet);
      toast({ title: 'Mint Added', description: `Added ${name || mintUrl}` });
    } catch (error) {
      toast({ title: 'Failed to Add Mint', description: 'Could not add the mint', variant: 'destructive' });
      console.error('Add mint error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [wallet, setWallet, toast]);

  const sendToken = useCallback(async (amount: number): Promise<CashuToken | null> => {
    if (!wallet) return null;
    const token = await wallet.send(amount);
    if (token) setWallet(wallet);
    return token;
  }, [wallet, setWallet]);

  const receiveToken = useCallback(async (token: CashuToken): Promise<boolean> => {
    if (!wallet) return false;
    const success = await wallet.receive(token);
    if (success) {
      setWallet(wallet);
      toast({ title: 'Tokens Received', description: `Received ${token.proofs.reduce((sum, p) => sum + p.amount, 0)} sats` });
    }
    return success;
  }, [wallet, setWallet, toast]);

  const value: CashuContextType = {
    wallet, isInitialized, initializeWallet, getBalance,
    deposit, withdraw, pay, refreshBalance, addMint, isLoading,
    sendToken, receiveToken,
  };

  return <CashuContext.Provider value={value}>{children}</CashuContext.Provider>;
}

export function useCashu() {
  const context = useContext(CashuContext);
  if (context === undefined) {
    throw new Error('useCashu must be used within a CashuProvider');
  }
  return context;
}

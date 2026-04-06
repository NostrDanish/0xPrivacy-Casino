import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useToast } from '@/hooks/useToast';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface CashuWallet {
  balance: number;
  mints: CashuMint[];
  tokens: CashuToken[];
}

interface CashuMint {
  url: string;
  pubkey: string;
  name?: string;
}

interface CashuToken {
  mint: string;
  amount: number;
  proofs: any[];
}

interface CashuContextType {
  wallet: CashuWallet | null;
  isInitialized: boolean;
  initializeWallet: () => Promise<void>;
  getBalance: () => number;
  deposit: (amount: number, mintUrl: string) => Promise<void>;
  withdraw: (amount: number) => Promise<string | null>;
  pay: (amount: number, invoice: string) => Promise<boolean>;
  refreshBalance: () => Promise<void>;
  addMint: (mintUrl: string, name?: string) => Promise<void>;
  isLoading: boolean;
}

const defaultMints: CashuMint[] = [
  { url: 'https://cashu.mint.fun', pubkey: 'mint_pubkey_1', name: 'Main Mint' },
  { url: 'https://mint.cashu.space', pubkey: 'mint_pubkey_2', name: 'Backup Mint' },
];

const CashuContext = createContext<CashuContextType | undefined>(undefined);

export function CashuProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [wallet, setWallet] = useLocalStorage<CashuWallet | null>('cashu-wallet', null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const initializeWallet = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Initialize a new wallet if none exists
      if (!wallet) {
        const newWallet: CashuWallet = {
          balance: 0,
          mints: defaultMints,
          tokens: [],
        };
        setWallet(newWallet);
      }
      
      setIsInitialized(true);
      toast({
        title: 'Cashu Wallet Initialized',
        description: 'Your Cashu wallet is ready to use',
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
  }, [wallet, setWallet, toast]);

  const getBalance = useCallback(() => {
    return wallet?.balance || 0;
  }, [wallet]);

  const deposit = useCallback(async (amount: number, mintUrl: string) => {
    try {
      setIsLoading(true);
      
      // In a real implementation, this would interact with a Cashu mint
      // For now, simulate a deposit
      const mint = wallet?.mints.find(m => m.url === mintUrl) || defaultMints[0];
      
      // Simulate getting tokens from mint
      const newTokens: CashuToken[] = Array.from({ length: Math.ceil(amount / 1000) }, (_, i) => ({
        mint: mint.url,
        amount: i === 0 ? amount % 1000 || 1000 : 1000,
        proofs: [{ id: `proof_${Date.now()}_${i}`, amount: i === 0 ? amount % 1000 || 1000 : 1000 }],
      }));
      
      const updatedWallet: CashuWallet = {
        balance: (wallet?.balance || 0) + amount,
        mints: wallet?.mints || defaultMints,
        tokens: [...(wallet?.tokens || []), ...newTokens],
      };
      
      setWallet(updatedWallet);
      
      toast({
        title: 'Deposit Successful',
        description: `Deposited ${amount} sats to your wallet`,
      });
    } catch (error) {
      toast({
        title: 'Deposit Failed',
        description: 'Failed to process deposit',
        variant: 'destructive',
      });
      console.error('Deposit error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [wallet, setWallet, toast]);

  const withdraw = useCallback(async (amount: number): Promise<string | null> => {
    try {
      if (!wallet || wallet.balance < amount) {
        toast({
          title: 'Insufficient Balance',
          description: `You need ${amount} sats, but only have ${wallet?.balance || 0} sats`,
          variant: 'destructive',
        });
        return null;
      }

      setIsLoading(true);
      
      // Simulate withdrawal - in real implementation, this would create an invoice
      const invoice = `lnbc${amount}...simulated_invoice_${Date.now()}`;
      
      // Update wallet balance
      const updatedWallet: CashuWallet = {
        ...wallet,
        balance: wallet.balance - amount,
        // Remove tokens proportional to withdrawal
        tokens: wallet.tokens.slice(Math.ceil(amount / 1000)),
      };
      
      setWallet(updatedWallet);
      
      toast({
        title: 'Withdrawal Successful',
        description: `Withdrew ${amount} sats from your wallet`,
      });
      
      return invoice;
    } catch (error) {
      toast({
        title: 'Withdrawal Failed',
        description: 'Failed to process withdrawal',
        variant: 'destructive',
      });
      console.error('Withdrawal error:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [wallet, setWallet, toast]);

  const pay = useCallback(async (amount: number, invoice: string): Promise<boolean> => {
    try {
      if (!wallet || wallet.balance < amount) {
        toast({
          title: 'Payment Failed',
          description: 'Insufficient balance',
          variant: 'destructive',
        });
        return false;
      }

      setIsLoading(true);
      
      // Simulate payment - in real implementation, this would pay the invoice
      console.log(`Paying ${amount} sats to invoice: ${invoice}`);
      
      // Update wallet balance
      const updatedWallet: CashuWallet = {
        ...wallet,
        balance: wallet.balance - amount,
        // Remove tokens proportional to payment
        tokens: wallet.tokens.slice(Math.ceil(amount / 1000)),
      };
      
      setWallet(updatedWallet);
      
      toast({
        title: 'Payment Successful',
        description: `Paid ${amount} sats`,
      });
      
      return true;
    } catch (error) {
      toast({
        title: 'Payment Failed',
        description: 'Failed to process payment',
        variant: 'destructive',
      });
      console.error('Payment error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [wallet, setWallet, toast]);

  const refreshBalance = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // In a real implementation, this would check mint for token validity
      // For now, just recalculate from tokens
      const totalBalance = wallet?.tokens.reduce((sum, token) => sum + token.amount, 0) || 0;
      
      if (wallet) {
        const updatedWallet: CashuWallet = {
          ...wallet,
          balance: totalBalance,
        };
        setWallet(updatedWallet);
      }
    } catch (error) {
      console.error('Balance refresh error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [wallet, setWallet]);

  const addMint = useCallback(async (mintUrl: string, name?: string) => {
    try {
      setIsLoading(true);
      
      // In a real implementation, this would fetch mint info
      const newMint: CashuMint = {
        url: mintUrl,
        pubkey: `mint_pubkey_${Date.now()}`,
        name: name || mintUrl,
      };
      
      const updatedWallet: CashuWallet = {
        ...(wallet || { balance: 0, mints: [], tokens: [] }),
        mints: [...(wallet?.mints || []), newMint],
      };
      
      setWallet(updatedWallet);
      
      toast({
        title: 'Mint Added',
        description: `Added ${name || mintUrl} to your wallet`,
      });
    } catch (error) {
      toast({
        title: 'Failed to Add Mint',
        description: 'Could not add the mint',
        variant: 'destructive',
      });
      console.error('Add mint error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [wallet, setWallet, toast]);

  const value: CashuContextType = {
    wallet,
    isInitialized,
    initializeWallet,
    getBalance,
    deposit,
    withdraw,
    pay,
    refreshBalance,
    addMint,
    isLoading,
  };

  return (
    <CashuContext.Provider value={value}>
      {children}
    </CashuContext.Provider>
  );
}

export function useCashu() {
  const context = useContext(CashuContext);
  if (context === undefined) {
    throw new Error('useCashu must be used within a CashuProvider');
  }
  return context;
}
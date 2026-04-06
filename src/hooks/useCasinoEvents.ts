import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';

interface GameResult {
  game_type: 'slots' | 'dice' | 'roulette' | 'blackjack' | 'coinflip' | 'poker';
  bet_amount: number;
  win_amount: number;
  result: 'win' | 'loss' | 'draw';
  game_data: Record<string, any>;
  provably_fair?: {
    seed: string;
    server_seed: string;
    client_seed: string;
  };
}

interface Transaction {
  transaction_type: 'deposit' | 'withdrawal' | 'game_payment' | 'payout';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  cashu_mint?: string;
  token_id?: string;
  description?: string;
}

export function useCasinoEvents() {
  const { mutate: publishEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const { toast } = useToast();

  const publishGameResult = async (gameResult: GameResult) => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'You must be logged in to publish game results',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const gameId = `${gameResult.game_type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const content = JSON.stringify(gameResult, null, 2);
      
      const tags = [
        ['d', gameId],
        ['t', 'casino'],
        ['t', gameResult.game_type],
        ['t', gameResult.result],
        ['amount', gameResult.bet_amount.toString()],
        ['payout', gameResult.win_amount.toString()],
        ['client', 'nostr-casino-cashu'],
      ];

      // Add provably fair seed if available
      if (gameResult.provably_fair?.seed) {
        tags.push(['seed', gameResult.provably_fair.seed]);
      }

      publishEvent({
        kind: 31383,
        content,
        tags,
      });

      toast({
        title: 'Game Result Recorded',
        description: 'Your game result has been published to Nostr',
      });

      return gameId;
    } catch (error) {
      console.error('Failed to publish game result:', error);
      toast({
        title: 'Publish Failed',
        description: 'Failed to publish game result to Nostr',
        variant: 'destructive',
      });
      return null;
    }
  };

  const publishTransaction = async (transaction: Transaction) => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'You must be logged in to publish transactions',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const content = JSON.stringify(transaction, null, 2);
      
      const tags = [
        ['d', txId],
        ['t', 'casino_transaction'],
        ['t', transaction.transaction_type],
        ['amount', transaction.amount.toString()],
        ['status', transaction.status],
        ['client', 'nostr-casino-cashu'],
      ];

      if (transaction.cashu_mint) {
        tags.push(['mint', transaction.cashu_mint]);
      }

      if (transaction.token_id) {
        tags.push(['cashu_token', transaction.token_id]);
      }

      if (transaction.description) {
        tags.push(['description', transaction.description]);
      }

      publishEvent({
        kind: 31384,
        content,
        tags,
      });

      toast({
        title: 'Transaction Recorded',
        description: 'Transaction has been published to Nostr',
      });

      return txId;
    } catch (error) {
      console.error('Failed to publish transaction:', error);
      toast({
        title: 'Publish Failed',
        description: 'Failed to publish transaction to Nostr',
        variant: 'destructive',
      });
      return null;
    }
  };

  const getGameHistory = async (limit = 20) => {
    // This would query Nostr for game history
    // For now, return empty array - implementation depends on specific relay setup
    return [];
  };

  const getTransactionHistory = async (limit = 20) => {
    // This would query Nostr for transaction history
    // For now, return empty array - implementation depends on specific relay setup
    return [];
  };

  return {
    publishGameResult,
    publishTransaction,
    getGameHistory,
    getTransactionHistory,
  };
}
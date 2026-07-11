import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Kind 8867 — 0xPrivacy Casino Game Result
 *
 * A regular event used to record provably-fair casino game outcomes on Nostr.
 * See NIP.md in the project root for the full specification.
 */
export const CASINO_GAME_RESULT_KIND = 8867;

export type GameType = 'slots' | 'dice' | 'roulette' | 'blackjack' | 'coinflip';

export interface GameResultData {
  game: GameType;
  bet: number;
  payout: number;
  multiplier: number;
  outcome: string;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  /** Extra game-specific data (reels, roll, cards, etc.) */
  extra?: Record<string, unknown>;
}

/** Validate a kind 8867 event has the required tags. */
function isValidGameResult(event: NostrEvent): boolean {
  if (event.kind !== CASINO_GAME_RESULT_KIND) return false;
  const hasT = event.tags.some(([n, v]) => n === 't' && v === 'casino');
  const hasAmount = event.tags.some(([n]) => n === 'amount');
  const hasAlt = event.tags.some(([n]) => n === 'alt');
  return hasT && hasAmount && hasAlt;
}

export function useCasinoEvents() {
  const { nostr } = useNostr();
  const { mutate: publishEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const { toast } = useToast();

  /** Publish a game result event (kind 8867). */
  const publishGameResult = (data: GameResultData) => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'You must be logged in to publish game results.',
        variant: 'destructive',
      });
      return;
    }

    const isWin = data.payout > 0;
    const resultLabel = isWin ? 'win' : 'loss';

    const tags: string[][] = [
      ['t', 'casino'],
      ['t', data.game],
      ['t', resultLabel],
      ['amount', data.bet.toString()],
      ['payout', data.payout.toString()],
      ['alt', `0xPrivacy Casino - ${data.game}: ${data.outcome} (${isWin ? `won ${data.payout} sats` : 'lost'})`],
    ];

    publishEvent({
      kind: CASINO_GAME_RESULT_KIND,
      content: JSON.stringify({
        game: data.game,
        bet: data.bet,
        payout: data.payout,
        multiplier: data.multiplier,
        serverSeed: data.serverSeed,
        clientSeed: data.clientSeed,
        nonce: data.nonce,
        ...data.extra,
      }),
      tags,
    });
  };

  return {
    publishGameResult,
  };
}

/**
 * Hook to query the current user's game history from Nostr.
 * Returns validated kind 8867 events sorted newest-first.
 */
export function useGameHistory(limit = 20) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['casino', 'game-history', user?.pubkey, limit],
    queryFn: async () => {
      if (!user) return [];
      const events = await nostr.query([
        {
          kinds: [CASINO_GAME_RESULT_KIND],
          authors: [user.pubkey],
          '#t': ['casino'],
          limit,
        },
      ]);
      return events.filter(isValidGameResult);
    },
    enabled: !!user,
  });
}

/**
 * Hook to query the global casino feed (all players).
 * Returns validated kind 8867 events sorted newest-first.
 */
export function useCasinoFeed(limit = 50) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['casino', 'feed', limit],
    queryFn: async () => {
      const events = await nostr.query([
        {
          kinds: [CASINO_GAME_RESULT_KIND],
          '#t': ['casino'],
          limit,
        },
      ]);
      return events.filter(isValidGameResult);
    },
  });
}
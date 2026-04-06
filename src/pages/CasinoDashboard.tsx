import { useSeoMeta } from '@unhead/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { LoginArea } from '@/components/auth/LoginArea';
import { useCashu } from '@/contexts/CashuContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Coins, Wallet, Gamepad2, Trophy, BarChart, History } from 'lucide-react';
import { Link } from 'react-router-dom';

const CasinoDashboard = () => {
  useSeoMeta({
    title: 'Nostr Casino - Play with Cashu',
    description: 'Decentralized casino powered by Nostr and Cashu payments',
  });

  const { user } = useCurrentUser();
  const { wallet, getBalance, initializeWallet, isInitialized, isLoading } = useCashu();

  const games = [
    { id: 'slots', name: 'Slot Machine', description: 'Try your luck with classic slots', icon: '🎰', path: '/games/slots' },
    { id: 'roulette', name: 'Roulette', description: 'Bet on red, black, or numbers', icon: '🎲', path: '/games/roulette' },
    { id: 'blackjack', name: 'Blackjack', description: 'Beat the dealer to 21', icon: '♠️', path: '/games/blackjack' },
    { id: 'dice', name: 'Dice Roll', description: 'Simple dice game with instant payout', icon: '🎯', path: '/games/dice' },
    { id: 'coinflip', name: 'Coin Flip', description: '50/50 chance to double your money', icon: '🪙', path: '/games/coinflip' },
    { id: 'poker', name: 'Video Poker', description: 'Five-card draw poker', icon: '♥️', path: '/games/poker' },
  ];

  const handleInitializeWallet = () => {
    if (!isInitialized) {
      initializeWallet();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-gray-900 to-black text-white">
      {/* Header */}
      <header className="border-b border-purple-800/30">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 rounded-xl">
                <Gamepad2 className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Nostr Casino
                </h1>
                <p className="text-gray-400">Decentralized gaming with Cashu payments</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <div className="flex items-center space-x-3 bg-gray-800/50 backdrop-blur-sm px-4 py-2 rounded-lg border border-purple-800/30">
                    <Coins className="h-5 w-5 text-yellow-400" />
                    <div>
                      <div className="text-sm text-gray-400">Balance</div>
                      <div className="text-xl font-bold text-yellow-300">
                        {isInitialized ? `${getBalance().toLocaleString()} sats` : '--'}
                      </div>
                    </div>
                  </div>
                  <LoginArea className="flex" />
                </>
              ) : (
                <LoginArea className="flex" />
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        {!user ? (
          <Card className="bg-gradient-to-r from-purple-900/50 to-gray-900/50 border-purple-800/30 backdrop-blur-sm mb-8">
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Trophy className="h-16 w-16 mx-auto text-yellow-400 mb-4" />
                <h2 className="text-3xl font-bold mb-4">Welcome to Nostr Casino</h2>
                <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                  Log in with your Nostr account to start playing. All games are provably fair and powered by Cashu payments.
                </p>
                <div className="flex justify-center">
                  <LoginArea className="flex" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Wallet Section */}
            <Card className="bg-gradient-to-r from-purple-900/50 to-gray-900/50 border-purple-800/30 backdrop-blur-sm mb-8">
              <CardHeader>
                <CardTitle className="flex items-center text-2xl">
                  <Wallet className="mr-3 h-6 w-6 text-purple-400" />
                  Cashu Wallet
                </CardTitle>
                <CardDescription>Manage your Bitcoin sats with Cashu ecash</CardDescription>
              </CardHeader>
              <CardContent>
                {!isInitialized ? (
                  <div className="text-center py-8">
                    <p className="text-gray-300 mb-6">Initialize your Cashu wallet to start playing</p>
                    <Button 
                      onClick={handleInitializeWallet}
                      disabled={isLoading}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-6 text-lg"
                    >
                      {isLoading ? 'Initializing...' : 'Initialize Cashu Wallet'}
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gray-800/50 p-6 rounded-xl border border-purple-800/30">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Balance</h3>
                        <Badge className="bg-green-900/30 text-green-400 border-green-800">Live</Badge>
                      </div>
                      <div className="text-4xl font-bold text-yellow-300 mb-2">
                        {getBalance().toLocaleString()} sats
                      </div>
                      <p className="text-gray-400 text-sm">≈ ${(getBalance() * 0.00065).toFixed(2)} USD</p>
                    </div>

                    <div className="bg-gray-800/50 p-6 rounded-xl border border-purple-800/30">
                      <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                      <div className="space-y-3">
                        <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
                          Deposit
                        </Button>
                        <Button className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                          Withdraw
                        </Button>
                        <Button variant="outline" className="w-full border-purple-800 text-purple-400 hover:bg-purple-900/30">
                          View Transactions
                        </Button>
                      </div>
                    </div>

                    <div className="bg-gray-800/50 p-6 rounded-xl border border-purple-800/30">
                      <h3 className="text-lg font-semibold mb-4">Stats</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Games Played</span>
                          <span className="font-semibold">0</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Total Wagered</span>
                          <span className="font-semibold">0 sats</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Net Profit</span>
                          <span className="font-semibold text-green-400">+0 sats</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Games Section */}
            <Card className="bg-gradient-to-r from-purple-900/50 to-gray-900/50 border-purple-800/30 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl">Available Games</CardTitle>
                <CardDescription>Choose a game to start playing. All games require Cashu wallet initialization.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {games.map((game) => (
                    <Link key={game.id} to={game.path}>
                      <Card className="bg-gray-800/30 border-purple-800/30 hover:border-purple-600/50 hover:bg-gray-800/50 transition-all duration-300 cursor-pointer h-full">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="text-4xl">{game.icon}</div>
                            <Badge variant="outline" className="border-purple-800 text-purple-400">
                              Coming Soon
                            </Badge>
                          </div>
                          <h3 className="text-xl font-bold mb-2">{game.name}</h3>
                          <p className="text-gray-400 mb-4">{game.description}</p>
                          <div className="flex items-center text-sm text-gray-500">
                            <span>Min bet: 100 sats</span>
                            <span className="mx-2">•</span>
                            <span>Max bet: 10,000 sats</span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>

                {/* Featured Game */}
                <div className="mt-8 p-6 bg-gradient-to-r from-purple-900/70 to-pink-900/70 rounded-xl border border-purple-600/30">
                  <div className="flex flex-col md:flex-row items-center justify-between">
                    <div className="mb-6 md:mb-0 md:mr-6">
                      <Badge className="mb-2 bg-yellow-900/30 text-yellow-400 border-yellow-800">Featured</Badge>
                      <h3 className="text-2xl font-bold mb-2">Slot Machine</h3>
                      <p className="text-gray-300 mb-4">
                        Our most popular game! Spin the reels for a chance to win big. 
                        Features multiple paylines and bonus rounds.
                      </p>
                      <Button className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700">
                        Play Now
                      </Button>
                    </div>
                    <div className="text-6xl">🎰🎰🎰</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="mt-8 bg-gradient-to-r from-purple-900/50 to-gray-900/50 border-purple-800/30 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <History className="mr-2 h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-400">
                  <BarChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recent activity. Start playing games to see your history here!</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Info Section */}
        <Card className="mt-8 bg-gradient-to-r from-gray-900/50 to-black/50 border-gray-800/30 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="bg-purple-900/30 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🔒</span>
                </div>
                <h4 className="font-bold mb-2">Provably Fair</h4>
                <p className="text-gray-400 text-sm">
                  All game outcomes are verifiable on the Nostr network
                </p>
              </div>
              <div className="text-center">
                <div className="bg-purple-900/30 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚡</span>
                </div>
                <h4 className="font-bold mb-2">Instant Payouts</h4>
                <p className="text-gray-400 text-sm">
                  Cashu ensures instant withdrawals with no waiting periods
                </p>
              </div>
              <div className="text-center">
                <div className="bg-purple-900/30 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🌐</span>
                </div>
                <h4 className="font-bold mb-2">Decentralized</h4>
                <p className="text-gray-400 text-sm">
                  No central authority. Powered by Nostr and Bitcoin
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t border-purple-800/30 mt-12 py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <h3 className="text-xl font-bold">Nostr Casino</h3>
              <p className="text-gray-500 text-sm">Decentralized gaming on Nostr</p>
            </div>
            <div className="text-gray-500 text-sm">
              <p>© {new Date().getFullYear()} Nostr Casino. All rights reserved.</p>
              <p className="mt-1">
                Built with ❤️ on{' '}
                <a href="https://shakespeare.diy" className="text-purple-400 hover:text-purple-300">
                  Shakespeare
                </a>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CasinoDashboard;
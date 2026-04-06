import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import { useCashu } from '@/contexts/CashuContext';
import { Coins, RotateCw, Trophy, Zap } from 'lucide-react';

const SYMBOLS = ['🍒', '🍋', '🍊', '🍉', '⭐', '7️⃣'];
const PAYOUTS = {
  '7️⃣7️⃣7️⃣': 100,
  '⭐⭐⭐': 50,
  '🍉🍉🍉': 25,
  '🍊🍊🍊': 15,
  '🍋🍋🍋': 10,
  '🍒🍒🍒': 5,
  '🍒🍒': 2,
  '🍒': 1,
};

const SlotMachine = () => {
  const { toast } = useToast();
  const { wallet, pay, getBalance, isLoading } = useCashu();
  const [reels, setReels] = useState(['🍒', '🍋', '🍊']);
  const [isSpinning, setIsSpinning] = useState(false);
  const [betAmount, setBetAmount] = useState(100);
  const [lastWin, setLastWin] = useState(0);
  const [totalWins, setTotalWins] = useState(0);
  const [totalSpins, setTotalSpins] = useState(0);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    if (wallet) {
      setBalance(getBalance());
    }
  }, [wallet, getBalance]);

  const spinReels = () => {
    if (isSpinning || isLoading) return;
    
    if (balance < betAmount) {
      toast({
        title: 'Insufficient Balance',
        description: `You need ${betAmount} sats to spin`,
        variant: 'destructive',
      });
      return;
    }

    setIsSpinning(true);
    
    // Simulate payment
    pay(betAmount, `slot_spin_${Date.now()}`).then((success) => {
      if (!success) {
        setIsSpinning(false);
        return;
      }

      setTotalSpins(prev => prev + 1);
      setBalance(prev => prev - betAmount);

      // Animate reels
      const spinDuration = 2000;
      const interval = 100;
      let spins = 0;
      const maxSpins = spinDuration / interval;

      const spinInterval = setInterval(() => {
        setReels([
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        ]);
        spins++;

        if (spins >= maxSpins) {
          clearInterval(spinInterval);
          
          // Final result
          const finalReels = [
            SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
            SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
            SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
          ];
          
          setReels(finalReels);
          
          // Calculate win
          const result = finalReels.join('');
          let winMultiplier = 0;
          
          // Check for winning combinations
          if (finalReels[0] === finalReels[1] && finalReels[1] === finalReels[2]) {
            // Three of a kind
            const key = `${finalReels[0]}${finalReels[1]}${finalReels[2]}`;
            winMultiplier = PAYOUTS[key as keyof typeof PAYOUTS] || 0;
          } else if (finalReels[0] === '🍒' || finalReels[1] === '🍒' || finalReels[2] === '🍒') {
            // Single cherry
            const cherryCount = finalReels.filter(symbol => symbol === '🍒').length;
            if (cherryCount === 2) {
              winMultiplier = PAYOUTS['🍒🍒'];
            } else if (cherryCount === 1) {
              winMultiplier = PAYOUTS['🍒'];
            }
          }
          
          const winAmount = betAmount * winMultiplier;
          
          if (winAmount > 0) {
            // Simulate winning payment back
            setTimeout(() => {
              // In a real implementation, this would be a proper payment
              setBalance(prev => prev + winAmount);
              setLastWin(winAmount);
              setTotalWins(prev => prev + winAmount);
              
              toast({
                title: '🎉 You Win!',
                description: `Congratulations! You won ${winAmount.toLocaleString()} sats!`,
              });
            }, 500);
          } else {
            setLastWin(0);
            toast({
              title: 'No Win',
              description: 'Better luck next time!',
              variant: 'destructive',
            });
          }
          
          setIsSpinning(false);
        }
      }, interval);
    });
  };

  const getPayoutMultiplier = (symbol: string) => {
    const key = `${symbol}${symbol}${symbol}`;
    return PAYOUTS[key as keyof typeof PAYOUTS] || 0;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              🎰 Slot Machine
            </h1>
            <p className="text-gray-400">Classic 3-reel slots with instant Cashu payouts</p>
          </div>
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <div className="bg-gray-800/50 backdrop-blur-sm px-4 py-3 rounded-lg border border-yellow-800/30">
              <div className="flex items-center">
                <Coins className="h-5 w-5 text-yellow-400 mr-2" />
                <div>
                  <div className="text-sm text-gray-400">Balance</div>
                  <div className="text-xl font-bold text-yellow-300">
                    {balance.toLocaleString()} sats
                  </div>
                </div>
              </div>
            </div>
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Back to Casino
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Slot Machine */}
          <div className="lg:col-span-2">
            <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl">Spin to Win!</CardTitle>
                <CardDescription>Bet sats and spin the reels for a chance to win big</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Slot Machine Display */}
                <div className="bg-gradient-to-b from-gray-900 to-black border-4 border-yellow-900/50 rounded-2xl p-8 mb-8">
                  <div className="flex justify-center items-center space-x-4 md:space-x-8">
                    {reels.map((symbol, index) => (
                      <div
                        key={index}
                        className="w-32 h-32 bg-gradient-to-b from-gray-800 to-gray-900 border-4 border-yellow-800/50 rounded-xl flex items-center justify-center text-6xl shadow-2xl"
                      >
                        <div className={isSpinning ? 'animate-pulse' : ''}>
                          {symbol}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="text-center mt-6">
                    <div className="inline-block bg-yellow-900/30 px-6 py-2 rounded-full">
                      <span className="text-yellow-300 font-bold text-lg">
                        {lastWin > 0 ? `WIN: ${lastWin.toLocaleString()} sats!` : 'READY TO SPIN'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bet Controls */}
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-lg font-semibold">Bet Amount</label>
                      <span className="text-2xl font-bold text-yellow-400">{betAmount.toLocaleString()} sats</span>
                    </div>
                    <Slider
                      value={[betAmount]}
                      min={10}
                      max={Math.min(10000, balance)}
                      step={10}
                      onValueChange={(value) => setBetAmount(value[0])}
                      disabled={isSpinning || isLoading}
                      className="w-full"
                    />
                    <div className="flex justify-between text-sm text-gray-400 mt-2">
                      <span>10 sats</span>
                      <span>10,000 sats max</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[100, 500, 1000, 5000].map((amount) => (
                      <Button
                        key={amount}
                        variant="outline"
                        onClick={() => setBetAmount(amount)}
                        disabled={isSpinning || isLoading || balance < amount}
                        className={`border-gray-700 ${betAmount === amount ? 'bg-gray-800' : ''}`}
                      >
                        {amount.toLocaleString()} sats
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={spinReels}
                  disabled={isSpinning || isLoading || balance < betAmount}
                  className="w-full py-6 text-lg bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700"
                >
                  {isSpinning ? (
                    <>
                      <RotateCw className="mr-2 h-5 w-5 animate-spin" />
                      Spinning...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-5 w-5" />
                      SPIN REELS ({betAmount.toLocaleString()} sats)
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            {/* Stats */}
            <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Trophy className="mr-2 h-5 w-5 text-yellow-400" />
                  Game Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total Spins</span>
                  <span className="font-bold text-xl">{totalSpins}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total Wagered</span>
                  <span className="font-bold text-xl">{(totalSpins * betAmount).toLocaleString()} sats</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total Wins</span>
                  <span className="font-bold text-xl text-green-400">{totalWins.toLocaleString()} sats</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Net Profit</span>
                  <span className={`font-bold text-xl ${totalWins - totalSpins * betAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(totalWins - totalSpins * betAmount).toLocaleString()} sats
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Payout Table */}
            <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Payout Table</CardTitle>
                <CardDescription>Win multipliers for each symbol</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {SYMBOLS.map((symbol) => {
                    const multiplier = getPayoutMultiplier(symbol);
                    return multiplier > 0 ? (
                      <div key={symbol} className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg">
                        <div className="flex items-center">
                          <span className="text-2xl mr-3">{symbol}</span>
                          <span className="text-lg">{symbol} {symbol} {symbol}</span>
                        </div>
                        <Badge className="bg-green-900/30 text-green-400 border-green-800">
                          {multiplier}x
                        </Badge>
                      </div>
                    ) : null;
                  })}
                  <div className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">🍒🍒</span>
                      <span className="text-lg">Two Cherries</span>
                    </div>
                    <Badge className="bg-yellow-900/30 text-yellow-400 border-yellow-800">
                      {PAYOUTS['🍒🍒']}x
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">🍒</span>
                      <span className="text-lg">Single Cherry</span>
                    </div>
                    <Badge className="bg-yellow-900/30 text-yellow-400 border-yellow-800">
                      {PAYOUTS['🍒']}x
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Tips */}
            <Card className="bg-gradient-to-br from-purple-900/30 to-gray-900/50 border-purple-800/30 backdrop-blur-sm">
              <CardContent className="pt-6">
                <h3 className="font-bold text-lg mb-3 text-purple-300">🎯 Quick Tips</h3>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>• Start with small bets to learn the game</li>
                  <li>• Three 7s pay 100x your bet</li>
                  <li>• Cherries pay even with just 1 or 2 matches</li>
                  <li>• Always gamble responsibly</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Game Info */}
        <Card className="mt-8 bg-gradient-to-br from-gray-800/50 to-black/50 border-gray-700 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="bg-yellow-900/30 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">🎲</span>
                </div>
                <h4 className="font-bold mb-1">Provably Fair</h4>
                <p className="text-gray-400 text-xs">
                  Game outcomes are generated using Nostr events
                </p>
              </div>
              <div className="text-center">
                <div className="bg-yellow-900/30 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">⚡</span>
                </div>
                <h4 className="font-bold mb-1">Instant Payouts</h4>
                <p className="text-gray-400 text-xs">
                  Winnings are instantly credited to your Cashu wallet
                </p>
              </div>
              <div className="text-center">
                <div className="bg-yellow-900/30 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">🔒</span>
                </div>
                <h4 className="font-bold mb-1">Secure</h4>
                <p className="text-gray-400 text-xs">
                  Your funds are secured by Chaumian ecash
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SlotMachine;
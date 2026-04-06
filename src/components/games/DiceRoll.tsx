import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';
import { useCashu } from '@/contexts/CashuContext';
import { Coins, Dice5, Trophy, Zap, ChevronRight } from 'lucide-react';

const DiceRoll = () => {
  const { toast } = useToast();
  const { wallet, pay, getBalance, isLoading } = useCashu();
  const [betAmount, setBetAmount] = useState(100);
  const [playerPrediction, setPlayerPrediction] = useState<number>(50);
  const [diceResult, setDiceResult] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [balance, setBalance] = useState(0);
  const [winStreak, setWinStreak] = useState(0);
  const [gameHistory, setGameHistory] = useState<Array<{ prediction: number; result: number; win: boolean }>>([]);

  const rollDice = async () => {
    if (isRolling || isLoading) return;
    
    if (!wallet || getBalance() < betAmount) {
      toast({
        title: 'Insufficient Balance',
        description: `You need ${betAmount} sats to play`,
        variant: 'destructive',
      });
      return;
    }

    setIsRolling(true);
    
    // Simulate payment
    const success = await pay(betAmount, `dice_roll_${Date.now()}`);
    if (!success) {
      setIsRolling(false);
      return;
    }

    setBalance(prev => prev - betAmount);

    // Animate dice roll
    let rollCount = 0;
    const maxRolls = 20;
    const rollInterval = setInterval(() => {
      setDiceResult(Math.floor(Math.random() * 100) + 1);
      rollCount++;
      
      if (rollCount >= maxRolls) {
        clearInterval(rollInterval);
        
        // Final result
        const finalResult = Math.floor(Math.random() * 100) + 1;
        setDiceResult(finalResult);
        
        // Determine win/loss
        const isWin = playerPrediction <= 50 
          ? finalResult <= playerPrediction  // Under prediction
          : finalResult >= playerPrediction; // Over prediction
        
        const multiplier = playerPrediction <= 50 
          ? (100 / playerPrediction) - 1
          : (100 / (100 - playerPrediction)) - 1;
        
        const winAmount = isWin ? Math.floor(betAmount * multiplier) : 0;
        
        // Update game history
        const newGame = {
          prediction: playerPrediction,
          result: finalResult,
          win: isWin,
        };
        setGameHistory(prev => [newGame, ...prev.slice(0, 9)]);
        
        if (isWin) {
          setTimeout(() => {
            setBalance(prev => prev + winAmount);
            setWinStreak(prev => prev + 1);
            toast({
              title: '🎉 You Win!',
              description: `Dice: ${finalResult}, You won ${winAmount.toLocaleString()} sats!`,
            });
          }, 500);
        } else {
          setWinStreak(0);
          toast({
            title: 'No Win',
            description: `Dice: ${finalResult}, Better luck next time!`,
            variant: 'destructive',
          });
        }
        
        setIsRolling(false);
      }
    }, 50);
  };

  const getMultiplier = (prediction: number) => {
    if (prediction <= 50) {
      return ((100 / prediction) - 1).toFixed(2);
    } else {
      return ((100 / (100 - prediction)) - 1).toFixed(2);
    }
  };

  const getPayout = (prediction: number, bet: number) => {
    const multiplier = prediction <= 50 
      ? (100 / prediction) - 1
      : (100 / (100 - prediction)) - 1;
    return Math.floor(bet * multiplier);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-gray-900 text-white p-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              🎯 Dice Roll
            </h1>
            <p className="text-gray-400">Predict if the dice roll will be over or under your chosen number</p>
          </div>
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <div className="bg-gray-800/50 backdrop-blur-sm px-4 py-3 rounded-lg border border-blue-800/30">
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
          {/* Game Area */}
          <div className="lg:col-span-2">
            <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl">Roll the Dice</CardTitle>
                <CardDescription>Predict if the dice roll (1-100) will be over or under your chosen number</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Dice Display */}
                <div className="bg-gradient-to-b from-gray-900 to-black border-4 border-blue-900/50 rounded-2xl p-8 mb-8">
                  <div className="text-center">
                    <div className="inline-block relative">
                      <div className="w-48 h-48 bg-gradient-to-br from-blue-900 to-cyan-900 border-4 border-cyan-700/50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                        <div className="text-6xl font-bold">
                          {diceResult !== null ? diceResult : '?'}
                        </div>
                      </div>
                      {isRolling && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Dice5 className="h-24 w-24 text-cyan-400 animate-spin" />
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-4">
                      <div className="inline-block bg-blue-900/30 px-6 py-2 rounded-full">
                        <span className="text-cyan-300 font-bold text-lg">
                          {diceResult !== null 
                            ? `Dice: ${diceResult} | Prediction: ${playerPrediction}`
                            : 'READY TO ROLL'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Prediction Controls */}
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <Label htmlFor="prediction" className="text-lg font-semibold">
                          Prediction: {playerPrediction}
                        </Label>
                        <p className="text-sm text-gray-400">
                          {playerPrediction <= 50 
                            ? `Win if dice ≤ ${playerPrediction} (${getMultiplier(playerPrediction)}x payout)`
                            : `Win if dice ≥ ${playerPrediction} (${getMultiplier(playerPrediction)}x payout)`}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-cyan-400">
                          {getMultiplier(playerPrediction)}x
                        </div>
                        <div className="text-sm text-gray-400">Payout Multiplier</div>
                      </div>
                    </div>
                    <Slider
                      value={[playerPrediction]}
                      min={1}
                      max={99}
                      step={1}
                      onValueChange={(value) => setPlayerPrediction(value[0])}
                      disabled={isRolling || isLoading}
                      className="w-full"
                    />
                    <div className="flex justify-between text-sm text-gray-400 mt-2">
                      <span>1 (99x)</span>
                      <span>50 (1x)</span>
                      <span>99 (99x)</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[10, 25, 50, 75, 90].map((num) => (
                      <Button
                        key={num}
                        variant="outline"
                        onClick={() => setPlayerPrediction(num)}
                        disabled={isRolling || isLoading}
                        className={`border-gray-700 ${playerPrediction === num ? 'bg-blue-900/30 border-blue-700' : ''}`}
                      >
                        {num}
                      </Button>
                    ))}
                  </div>

                  {/* Bet Amount */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-lg font-semibold">Bet Amount</Label>
                      <span className="text-2xl font-bold text-yellow-400">{betAmount.toLocaleString()} sats</span>
                    </div>
                    <Slider
                      value={[betAmount]}
                      min={10}
                      max={Math.min(10000, balance)}
                      step={10}
                      onValueChange={(value) => setBetAmount(value[0])}
                      disabled={isRolling || isLoading}
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
                        disabled={isRolling || isLoading || balance < amount}
                        className={`border-gray-700 ${betAmount === amount ? 'bg-gray-800' : ''}`}
                      >
                        {amount.toLocaleString()} sats
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex-col space-y-4">
                <div className="w-full bg-gray-800/50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm text-gray-400">Potential Payout</div>
                      <div className="text-2xl font-bold text-green-400">
                        {getPayout(playerPrediction, betAmount).toLocaleString()} sats
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">Win Chance</div>
                      <div className="text-2xl font-bold">
                        {playerPrediction <= 50 ? playerPrediction : 100 - playerPrediction}%
                      </div>
                    </div>
                  </div>
                </div>
                
                <Button
                  onClick={rollDice}
                  disabled={isRolling || isLoading || balance < betAmount}
                  className="w-full py-6 text-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
                >
                  {isRolling ? (
                    <>
                      <Dice5 className="mr-2 h-5 w-5 animate-spin" />
                      Rolling Dice...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-5 w-5" />
                      ROLL DICE ({betAmount.toLocaleString()} sats)
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
                  <span className="text-gray-400">Win Streak</span>
                  <Badge className={winStreak > 0 ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-gray-800'}>
                    {winStreak} wins
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total Games</span>
                  <span className="font-bold">{gameHistory.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Win Rate</span>
                  <span className="font-bold">
                    {gameHistory.length > 0 
                      ? `${Math.round((gameHistory.filter(g => g.win).length / gameHistory.length) * 100)}%`
                      : '0%'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Recent Games */}
            <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Recent Games</CardTitle>
              </CardHeader>
              <CardContent>
                {gameHistory.length > 0 ? (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {gameHistory.map((game, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                        <div className="flex items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${game.win ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                            <span className={game.win ? 'text-green-400' : 'text-red-400'}>
                              {game.win ? '✓' : '✗'}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm">
                              Pred: {game.prediction} | Roll: {game.result}
                            </div>
                            <div className="text-xs text-gray-400">
                              {game.prediction <= 50 
                                ? `Under ${game.prediction}`
                                : `Over ${game.prediction}`}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400">
                    <Dice5 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No games played yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* How to Play */}
            <Card className="bg-gradient-to-br from-blue-900/30 to-gray-900/50 border-blue-800/30 backdrop-blur-sm">
              <CardContent className="pt-6">
                <h3 className="font-bold text-lg mb-3 text-cyan-300">🎯 How to Play</h3>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start">
                    <div className="bg-blue-900/50 rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                      1
                    </div>
                    <span>Choose a prediction number (1-99)</span>
                  </li>
                  <li className="flex items-start">
                    <div className="bg-blue-900/50 rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                      2
                    </div>
                    <span>If prediction ≤ 50: Win if dice ≤ prediction</span>
                  </li>
                  <li className="flex items-start">
                    <div className="bg-blue-900/50 rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                      3
                    </div>
                    <span>If prediction ≥ 51: Win if dice ≥ prediction</span>
                  </li>
                  <li className="flex items-start">
                    <div className="bg-blue-900/50 rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                      4
                    </div>
                    <span>Higher risk = higher payout multiplier</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiceRoll;
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ScrollToTop } from './components/ScrollToTop';

// Pages
import CasinoDashboard from './pages/CasinoDashboard';
import NotFound from './pages/NotFound';
import { NIP19Page } from './pages/NIP19Page';

// Games
import SlotMachine from './components/games/SlotMachine';
import DiceRoll from './components/games/DiceRoll';
import Roulette from './components/games/Roulette';
import Blackjack from './components/games/Blackjack';
import CoinFlip from './components/games/CoinFlip';

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<CasinoDashboard />} />
        {/* Casino games */}
        <Route path="/games/slots" element={<SlotMachine />} />
        <Route path="/games/dice" element={<DiceRoll />} />
        <Route path="/games/roulette" element={<Roulette />} />
        <Route path="/games/blackjack" element={<Blackjack />} />
        <Route path="/games/coinflip" element={<CoinFlip />} />
        {/* NIP-19 route for npub1, note1, naddr1, nevent1, nprofile1 */}
        <Route path="/:nip19" element={<NIP19Page />} />
        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;

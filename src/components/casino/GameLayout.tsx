import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCashu } from '@/contexts/CashuContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { isAdminPubkey } from '@/lib/admin';
import { ChevronLeft, Zap, Shield } from 'lucide-react';
import WalletPanel from './WalletPanel';

interface Props {
  title: string;
  emoji: string;
  subtitle: string;
  children: ReactNode;
}

export default function GameLayout({ title, emoji, subtitle, children }: Props) {
  const { balance, isInitialized } = useCashu();
  const { user } = useCurrentUser();
  const [showWallet, setShowWallet] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Casino
            </Link>
            <span className="text-border/60">/</span>
            <span className="font-bold text-sm">{emoji} {title}</span>
          </div>
          <div className="flex items-center gap-3">
            {isAdminPubkey(user?.pubkey) && (
              <Link
                to="/admin"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-purple-400 hover:text-purple-300 transition-colors border border-purple-500/20 hover:border-purple-500/40"
              >
                <Shield className="w-3 h-3" />
                Admin
              </Link>
            )}
            <button
              onClick={() => setShowWallet(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/60 bg-secondary/80
                         hover:bg-secondary hover:border-purple-500/40 transition-all text-sm"
            >
              <Zap className="w-3.5 h-3.5 text-gold" />
              <span className="text-gold font-bold">
                {isInitialized ? `${balance.toLocaleString()} sats` : 'Wallet'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Subheader */}
      <div className="border-b border-border/30 bg-secondary/10 px-4 py-3">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      {showWallet && <WalletPanel onClose={() => setShowWallet(false)} />}
    </div>
  );
}

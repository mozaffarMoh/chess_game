import type { Color, GameStatus } from '../types/chess';

interface StatusBannerProps {
  status: GameStatus;
  winner: Color | null;
  players: { w: string; b: string };
}

export default function StatusBanner({ status, winner, players }: StatusBannerProps) {
  const winnerName = winner ? players[winner] : '';

  const message = (): { title: string; detail: string } | null => {
    switch (status) {
      case 'checkmate':
        return { title: 'Checkmate', detail: `${winnerName} wins the game.` };
      case 'resigned':
        return { title: 'Resignation', detail: `${winnerName} wins the game.` };
      case 'stalemate':
        return { title: 'Stalemate', detail: 'Draw — no legal moves and no check.' };
      case 'draw-fifty':
        return { title: 'Draw', detail: 'Fifty moves without a capture or pawn move.' };
      case 'draw-repetition':
        return { title: 'Draw', detail: 'The same position occurred three times.' };
      case 'draw-material':
        return { title: 'Draw', detail: 'Neither side has mating material.' };
      case 'draw-agreed':
        return { title: 'Draw', detail: 'Both players agreed to a draw.' };
      default:
        return null;
    }
  };

  const result = message();
  if (!result) return null;

  return (
    <div className="banner" role="status">
      <p className="text-lg font-bold tracking-tight text-accent-soft">{result.title}</p>
      <p className="mt-0.5 text-sm text-ink-muted">{result.detail}</p>
    </div>
  );
}

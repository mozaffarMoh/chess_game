import type { Color, PieceType } from '../types/chess';
import Piece from './Piece';

interface PlayerCardProps {
  color: Color;
  name: string;
  active: boolean;
  captured: string[];
  /** Material lead in pawns; only shown when positive. */
  advantage: number;
  onRename: (name: string) => void;
}

export default function PlayerCard({
  color,
  name,
  active,
  captured,
  advantage,
  onRename,
}: PlayerCardProps) {
  return (
    <div className={`player-card ${active ? 'player-card--active' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-full border"
            style={{
              background: color === 'w' ? '#f7f5ef' : '#2c2f36',
              borderColor: color === 'w' ? '#c9c4b6' : '#0c0d10',
            }}
          />
          <input
            className="name-input"
            value={name}
            maxLength={20}
            aria-label={`${color === 'w' ? 'White' : 'Black'} player name`}
            onChange={(e) => onRename(e.target.value)}
          />
        </div>

        <div className="mt-1.5 flex items-center gap-2 pl-5">
          <span className="captured">
            {captured.map((type, i) => (
              <Piece
                key={`${type}-${i}`}
                type={type as PieceType}
                color={color === 'w' ? 'b' : 'w'}
                className=""
              />
            ))}
          </span>
          {advantage > 0 && (
            <span className="text-xs font-bold text-ink-muted">+{advantage}</span>
          )}
        </div>
      </div>

      {active && <span className="turn-dot shrink-0" aria-label="To move" />}
    </div>
  );
}

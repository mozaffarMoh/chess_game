import { useMemo } from 'react';
import type { Color, Move, PieceType, Position, Square } from '../types/chess';
import { FILES, RANKS, fileOf, isLightSquare, rankOf, squareName } from '../engine/board';
import { findKing, isInCheck } from '../engine/moves';
import Piece from './Piece';

interface BoardProps {
  position: Position;
  selected: Square | null;
  legalTargets: Move[];
  lastMove: Move | null;
  flipped: boolean;
  interactive: boolean;
  onSelect: (square: Square) => void;
}

const PROMOTION_CHOICES: Exclude<PieceType, 'p' | 'k'>[] = ['q', 'r', 'b', 'n'];

export default function Board({
  position,
  selected,
  legalTargets,
  lastMove,
  flipped,
  interactive,
  onSelect,
}: BoardProps) {
  // Render order: a8..h1 normally, mirrored when the board is flipped.
  const squares = useMemo(() => {
    const list = Array.from({ length: 64 }, (_, i) => i);
    return flipped ? list.reverse() : list;
  }, [flipped]);

  const targets = useMemo(
    () => new Map(legalTargets.map((m) => [m.to, m])),
    [legalTargets],
  );

  const checkedKing = useMemo(() => {
    const inCheck = isInCheck(position, position.turn);
    return inCheck ? findKing(position, position.turn) : null;
  }, [position]);

  return (
    <div className="board" role="grid" aria-label="Chess board">
      {squares.map((sq) => {
        const piece = position.board[sq];
        const light = isLightSquare(sq);
        const target = targets.get(sq);
        const isLast = lastMove?.from === sq || lastMove?.to === sq;

        const classes = [
          'square',
          light ? '' : 'square--dark',
          selected === sq ? 'square--selected' : '',
          isLast ? 'square--last' : '',
          checkedKing === sq ? 'square--check' : '',
        ]
          .filter(Boolean)
          .join(' ');

        // Edge squares carry the coordinate labels, following the flip.
        const showFile = flipped ? rankOf(sq) === 0 : rankOf(sq) === 7;
        const showRank = flipped ? fileOf(sq) === 7 : fileOf(sq) === 0;
        const coordTone = light ? 'coord--on-light' : 'coord--on-dark';

        const label = piece
          ? `${squareName(sq)}, ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}`
          : squareName(sq);

        return (
          <button
            key={sq}
            type="button"
            role="gridcell"
            className={classes}
            aria-label={label}
            aria-selected={selected === sq}
            disabled={!interactive}
            onClick={() => onSelect(sq)}
          >
            {showFile && (
              <span className={`coord coord--file ${coordTone}`}>{FILES[fileOf(sq)]}</span>
            )}
            {showRank && (
              <span className={`coord coord--rank ${coordTone}`}>{RANKS[rankOf(sq)]}</span>
            )}

            {piece && <Piece type={piece.type} color={piece.color} />}

            {target && (
              <span className="move-hint">
                {piece || target.enPassant ? (
                  <span className="move-hint__ring" />
                ) : (
                  <span className="move-hint__dot" />
                )}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface PromotionDialogProps {
  color: Color;
  onChoose: (piece: Exclude<PieceType, 'p' | 'k'>) => void;
  onCancel: () => void;
}

export function PromotionDialog({ color, onChoose, onCancel }: PromotionDialogProps) {
  return (
    <div
      className="promotion-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Choose promotion piece"
      onClick={onCancel}
    >
      <div className="promotion-card" onClick={(e) => e.stopPropagation()}>
        {PROMOTION_CHOICES.map((type) => (
          <button
            key={type}
            type="button"
            aria-label={`Promote to ${type}`}
            onClick={() => onChoose(type)}
          >
            <Piece type={type} color={color} className="" />
          </button>
        ))}
      </div>
    </div>
  );
}

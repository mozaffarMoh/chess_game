import type { CastlingRights, Color, Piece, Position, Square } from '../types/chess';

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

export const fileOf = (sq: Square): number => sq % 8;
export const rankOf = (sq: Square): number => Math.floor(sq / 8);
export const squareOf = (rank: number, file: number): Square => rank * 8 + file;
export const onBoard = (rank: number, file: number): boolean =>
  rank >= 0 && rank < 8 && file >= 0 && file < 8;

export const squareName = (sq: Square): string => `${FILES[fileOf(sq)]}${RANKS[rankOf(sq)]}`;

export const parseSquare = (name: string): Square => {
  const file = FILES.indexOf(name[0] as (typeof FILES)[number]);
  const rank = RANKS.indexOf(name[1] as (typeof RANKS)[number]);
  return squareOf(rank, file);
};

export const opposite = (color: Color): Color => (color === 'w' ? 'b' : 'w');

export const isLightSquare = (sq: Square): boolean => (rankOf(sq) + fileOf(sq)) % 2 === 0;

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function fenToPosition(fen: string): Position {
  const [placement, turn, castling, ep, half, full] = fen.trim().split(/\s+/);
  const board: (Piece | null)[] = new Array(64).fill(null);

  let sq = 0;
  for (const ch of placement) {
    if (ch === '/') continue;
    if (ch >= '1' && ch <= '8') {
      sq += Number(ch);
      continue;
    }
    const color: Color = ch === ch.toUpperCase() ? 'w' : 'b';
    board[sq] = { type: ch.toLowerCase() as Piece['type'], color };
    sq += 1;
  }

  const rights: CastlingRights = {
    wK: castling.includes('K'),
    wQ: castling.includes('Q'),
    bK: castling.includes('k'),
    bQ: castling.includes('q'),
  };

  return {
    board,
    turn: turn === 'b' ? 'b' : 'w',
    castling: rights,
    enPassant: ep && ep !== '-' ? parseSquare(ep) : null,
    halfmoveClock: Number(half ?? 0),
    fullmoveNumber: Number(full ?? 1),
  };
}

export function positionToFen(pos: Position): string {
  let placement = '';
  for (let rank = 0; rank < 8; rank += 1) {
    let empty = 0;
    for (let file = 0; file < 8; file += 1) {
      const piece = pos.board[squareOf(rank, file)];
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty) {
        placement += empty;
        empty = 0;
      }
      placement += piece.color === 'w' ? piece.type.toUpperCase() : piece.type;
    }
    if (empty) placement += empty;
    if (rank < 7) placement += '/';
  }

  const c = pos.castling;
  const castling =
    `${c.wK ? 'K' : ''}${c.wQ ? 'Q' : ''}${c.bK ? 'k' : ''}${c.bQ ? 'q' : ''}` || '-';

  return [
    placement,
    pos.turn,
    castling,
    pos.enPassant === null ? '-' : squareName(pos.enPassant),
    pos.halfmoveClock,
    pos.fullmoveNumber,
  ].join(' ');
}

export const initialPosition = (): Position => fenToPosition(START_FEN);

export const clonePosition = (pos: Position): Position => ({
  board: pos.board.slice(),
  turn: pos.turn,
  castling: { ...pos.castling },
  enPassant: pos.enPassant,
  halfmoveClock: pos.halfmoveClock,
  fullmoveNumber: pos.fullmoveNumber,
});

/** Position key for repetition detection: everything but the move counters. */
export const positionKey = (pos: Position): string =>
  positionToFen(pos).split(' ').slice(0, 4).join(' ');

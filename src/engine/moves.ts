import type { Color, Move, PieceType, Position, Square } from '../types/chess';
import { clonePosition, fileOf, onBoard, opposite, rankOf, squareOf } from './board';

const KNIGHT_DELTAS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];

const KING_DELTAS = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1],
  [0, 1], [1, -1], [1, 0], [1, 1],
];

const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

const PROMOTION_PIECES: Exclude<PieceType, 'p' | 'k'>[] = ['q', 'r', 'b', 'n'];

export function findKing(pos: Position, color: Color): Square | null {
  for (let sq = 0; sq < 64; sq += 1) {
    const piece = pos.board[sq];
    if (piece && piece.type === 'k' && piece.color === color) return sq;
  }
  return null;
}

/** Is `square` attacked by any piece of `by`? Ignores turn and pins. */
export function isSquareAttacked(pos: Position, square: Square, by: Color): boolean {
  const rank = rankOf(square);
  const file = fileOf(square);

  // Pawns: look backwards from the target toward where an attacker would stand.
  const pawnRank = by === 'w' ? rank + 1 : rank - 1;
  for (const df of [-1, 1]) {
    const f = file + df;
    if (!onBoard(pawnRank, f)) continue;
    const piece = pos.board[squareOf(pawnRank, f)];
    if (piece && piece.color === by && piece.type === 'p') return true;
  }

  for (const [dr, df] of KNIGHT_DELTAS) {
    const r = rank + dr;
    const f = file + df;
    if (!onBoard(r, f)) continue;
    const piece = pos.board[squareOf(r, f)];
    if (piece && piece.color === by && piece.type === 'n') return true;
  }

  for (const [dr, df] of KING_DELTAS) {
    const r = rank + dr;
    const f = file + df;
    if (!onBoard(r, f)) continue;
    const piece = pos.board[squareOf(r, f)];
    if (piece && piece.color === by && piece.type === 'k') return true;
  }

  const slide = (dirs: number[][], types: PieceType[]) => {
    for (const [dr, df] of dirs) {
      let r = rank + dr;
      let f = file + df;
      while (onBoard(r, f)) {
        const piece = pos.board[squareOf(r, f)];
        if (piece) {
          if (piece.color === by && types.includes(piece.type)) return true;
          break;
        }
        r += dr;
        f += df;
      }
    }
    return false;
  };

  if (slide(BISHOP_DIRS, ['b', 'q'])) return true;
  if (slide(ROOK_DIRS, ['r', 'q'])) return true;

  return false;
}

export function isInCheck(pos: Position, color: Color): boolean {
  const king = findKing(pos, color);
  if (king === null) return false;
  return isSquareAttacked(pos, king, opposite(color));
}

/** Apply a move without any legality checking. Returns the new position. */
export function applyMove(pos: Position, move: Move): Position {
  const next = clonePosition(pos);
  const { board } = next;
  const piece = board[move.from];
  if (!piece) return next;

  board[move.from] = null;

  if (move.enPassant && move.capturedSquare !== undefined) {
    board[move.capturedSquare] = null;
  }

  board[move.to] = move.promotion
    ? { type: move.promotion, color: piece.color }
    : piece;

  if (move.castle) {
    const rank = rankOf(move.from);
    const [rookFrom, rookTo] =
      move.castle === 'k'
        ? [squareOf(rank, 7), squareOf(rank, 5)]
        : [squareOf(rank, 0), squareOf(rank, 3)];
    board[rookTo] = board[rookFrom];
    board[rookFrom] = null;
  }

  // Castling rights are lost when the king or a rook leaves, or a rook is taken.
  if (piece.type === 'k') {
    if (piece.color === 'w') {
      next.castling.wK = false;
      next.castling.wQ = false;
    } else {
      next.castling.bK = false;
      next.castling.bQ = false;
    }
  }
  const clearRookRight = (sq: Square) => {
    if (sq === 63) next.castling.wK = false;
    if (sq === 56) next.castling.wQ = false;
    if (sq === 7) next.castling.bK = false;
    if (sq === 0) next.castling.bQ = false;
  };
  clearRookRight(move.from);
  clearRookRight(move.to);

  // A double pawn push opens an en passant target square.
  if (piece.type === 'p' && Math.abs(rankOf(move.to) - rankOf(move.from)) === 2) {
    next.enPassant = squareOf((rankOf(move.from) + rankOf(move.to)) / 2, fileOf(move.from));
  } else {
    next.enPassant = null;
  }

  next.halfmoveClock =
    piece.type === 'p' || move.captured ? 0 : pos.halfmoveClock + 1;
  if (pos.turn === 'b') next.fullmoveNumber = pos.fullmoveNumber + 1;
  next.turn = opposite(pos.turn);

  return next;
}

function pushPawnMoves(pos: Position, from: Square, color: Color, out: Move[]): void {
  const dir = color === 'w' ? -1 : 1;
  const startRank = color === 'w' ? 6 : 1;
  const promoRank = color === 'w' ? 0 : 7;
  const rank = rankOf(from);
  const file = fileOf(from);

  const add = (move: Move) => {
    if (rankOf(move.to) === promoRank) {
      for (const promotion of PROMOTION_PIECES) out.push({ ...move, promotion });
    } else {
      out.push(move);
    }
  };

  const oneRank = rank + dir;
  if (onBoard(oneRank, file) && !pos.board[squareOf(oneRank, file)]) {
    add({ from, to: squareOf(oneRank, file), piece: 'p', color });

    const twoRank = rank + dir * 2;
    if (rank === startRank && !pos.board[squareOf(twoRank, file)]) {
      out.push({ from, to: squareOf(twoRank, file), piece: 'p', color });
    }
  }

  for (const df of [-1, 1]) {
    const r = rank + dir;
    const f = file + df;
    if (!onBoard(r, f)) continue;
    const to = squareOf(r, f);
    const target = pos.board[to];

    if (target && target.color !== color) {
      add({ from, to, piece: 'p', color, captured: target.type });
    } else if (!target && to === pos.enPassant) {
      const capturedSquare = squareOf(rank, f);
      out.push({
        from,
        to,
        piece: 'p',
        color,
        captured: 'p',
        enPassant: true,
        capturedSquare,
      });
    }
  }
}

function pushCastlingMoves(pos: Position, from: Square, color: Color, out: Move[]): void {
  if (isInCheck(pos, color)) return;

  const rank = color === 'w' ? 7 : 0;
  if (from !== squareOf(rank, 4)) return;

  const enemy = opposite(color);
  const canKing = color === 'w' ? pos.castling.wK : pos.castling.bK;
  const canQueen = color === 'w' ? pos.castling.wQ : pos.castling.bQ;

  const clear = (files: number[]) => files.every((f) => !pos.board[squareOf(rank, f)]);
  const safe = (files: number[]) =>
    files.every((f) => !isSquareAttacked(pos, squareOf(rank, f), enemy));

  if (canKing) {
    const rook = pos.board[squareOf(rank, 7)];
    if (rook?.type === 'r' && rook.color === color && clear([5, 6]) && safe([5, 6])) {
      out.push({ from, to: squareOf(rank, 6), piece: 'k', color, castle: 'k' });
    }
  }

  if (canQueen) {
    const rook = pos.board[squareOf(rank, 0)];
    if (rook?.type === 'r' && rook.color === color && clear([1, 2, 3]) && safe([2, 3])) {
      out.push({ from, to: squareOf(rank, 2), piece: 'k', color, castle: 'q' });
    }
  }
}

/** Pseudo-legal moves for one square — may leave the mover's king in check. */
function pseudoLegalMovesFrom(pos: Position, from: Square): Move[] {
  const piece = pos.board[from];
  if (!piece) return [];

  const out: Move[] = [];
  const { color, type } = piece;
  const rank = rankOf(from);
  const file = fileOf(from);

  const step = (deltas: number[][]) => {
    for (const [dr, df] of deltas) {
      const r = rank + dr;
      const f = file + df;
      if (!onBoard(r, f)) continue;
      const to = squareOf(r, f);
      const target = pos.board[to];
      if (target?.color === color) continue;
      out.push({ from, to, piece: type, color, captured: target?.type });
    }
  };

  const slide = (dirs: number[][]) => {
    for (const [dr, df] of dirs) {
      let r = rank + dr;
      let f = file + df;
      while (onBoard(r, f)) {
        const to = squareOf(r, f);
        const target = pos.board[to];
        if (target) {
          if (target.color !== color) {
            out.push({ from, to, piece: type, color, captured: target.type });
          }
          break;
        }
        out.push({ from, to, piece: type, color });
        r += dr;
        f += df;
      }
    }
  };

  switch (type) {
    case 'p':
      pushPawnMoves(pos, from, color, out);
      break;
    case 'n':
      step(KNIGHT_DELTAS);
      break;
    case 'b':
      slide(BISHOP_DIRS);
      break;
    case 'r':
      slide(ROOK_DIRS);
      break;
    case 'q':
      slide([...BISHOP_DIRS, ...ROOK_DIRS]);
      break;
    case 'k':
      step(KING_DELTAS);
      pushCastlingMoves(pos, from, color, out);
      break;
  }

  return out;
}

/** Fully legal moves from one square (self-check filtered out). */
export function legalMovesFrom(pos: Position, from: Square): Move[] {
  const piece = pos.board[from];
  if (!piece || piece.color !== pos.turn) return [];

  return pseudoLegalMovesFrom(pos, from).filter(
    (move) => !isInCheck(applyMove(pos, move), piece.color),
  );
}

/** Every legal move for the side to move. */
export function legalMoves(pos: Position): Move[] {
  const out: Move[] = [];
  for (let sq = 0; sq < 64; sq += 1) {
    const piece = pos.board[sq];
    if (piece?.color === pos.turn) out.push(...legalMovesFrom(pos, sq));
  }
  return out;
}

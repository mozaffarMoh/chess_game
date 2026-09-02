import type { Move, PieceType, Position } from '../types/chess';
import { applyMove, isInCheck, legalMoves } from './moves';

export type Difficulty = 'easy' | 'medium' | 'hard';

/** Search depth and a blunder rate that makes the easier levels beatable. */
const LEVELS: Record<Difficulty, { depth: number; randomness: number }> = {
  easy: { depth: 1, randomness: 0.45 },
  medium: { depth: 3, randomness: 0.12 },
  hard: { depth: 4, randomness: 0 },
};

const VALUES: Record<PieceType, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

const MATE = 100000;

/**
 * Piece-square tables, written from White's point of view with index 0 = a8.
 * They encode simple positional wisdom: knights toward the centre, pawns
 * pushing forward, the king tucked away behind its pawns.
 */
const PST: Record<PieceType, number[]> = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
      0,  0,  0,  0,  0,  0,  0,  0,
      5, 10, 10, 10, 10, 10, 10,  5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
      0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0, 20, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
  ],
};

/** King safety matters less once the queens come off; centralise instead. */
const KING_ENDGAME: number[] = [
  -50,-40,-30,-20,-20,-30,-40,-50,
  -30,-20,-10,  0,  0,-10,-20,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-30,  0,  0,  0,  0,-30,-30,
  -50,-30,-30,-30,-30,-30,-30,-50,
];

/** Mirror a square so a table written for White can be read for Black. */
const mirror = (sq: number): number => (7 - Math.floor(sq / 8)) * 8 + (sq % 8);

/** Static evaluation in centipawns, from the side-to-move's point of view. */
export function evaluate(pos: Position): number {
  let score = 0;
  let material = 0;

  for (let sq = 0; sq < 64; sq += 1) {
    const piece = pos.board[sq];
    if (!piece || piece.type === 'k') continue;
    material += VALUES[piece.type];
  }
  // Below roughly a queen + rook of material each, treat it as an endgame.
  const endgame = material < 2400;

  for (let sq = 0; sq < 64; sq += 1) {
    const piece = pos.board[sq];
    if (!piece) continue;

    const table =
      piece.type === 'k' && endgame ? KING_ENDGAME : PST[piece.type];
    const index = piece.color === 'w' ? sq : mirror(sq);
    const value = VALUES[piece.type] + table[index];

    score += piece.color === 'w' ? value : -value;
  }

  return pos.turn === 'w' ? score : -score;
}

/** Most Valuable Victim / Least Valuable Aggressor, plus a promotion bonus. */
const moveScore = (move: Move): number => {
  let score = 0;
  if (move.captured) score += 10 * VALUES[move.captured] - VALUES[move.piece];
  if (move.promotion) score += VALUES[move.promotion];
  return score;
};

const order = (moves: Move[]): Move[] =>
  moves
    .map((move) => ({ move, score: moveScore(move) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.move);

/**
 * Search only captures until the position is quiet, so the evaluation is never
 * taken in the middle of a trade.
 */
function quiescence(pos: Position, alpha: number, beta: number, depth: number): number {
  const stand = evaluate(pos);
  if (depth === 0) return stand;
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;

  const captures = order(legalMoves(pos).filter((m) => m.captured || m.promotion));

  for (const move of captures) {
    const score = -quiescence(applyMove(pos, move), -beta, -alpha, depth - 1);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

function negamax(pos: Position, depth: number, alpha: number, beta: number, ply: number): number {
  const moves = legalMoves(pos);

  if (!moves.length) {
    // Prefer mates that arrive sooner, and stalemate is exactly level.
    return isInCheck(pos, pos.turn) ? -MATE + ply : 0;
  }
  if (pos.halfmoveClock >= 100) return 0;
  if (depth === 0) return quiescence(pos, alpha, beta, 4);

  for (const move of order(moves)) {
    const score = -negamax(applyMove(pos, move), depth - 1, -beta, -alpha, ply + 1);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

/**
 * Pick a move for the side to play. `randomness` occasionally takes a move
 * that is not the best, which is what makes the easy levels feel human.
 */
export function findBestMove(pos: Position, difficulty: Difficulty): Move | null {
  const { depth, randomness } = LEVELS[difficulty];
  const moves = legalMoves(pos);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];

  const scored = order(moves).map((move) => ({
    move,
    score: -negamax(applyMove(pos, move), depth - 1, -Infinity, Infinity, 1),
  }));

  scored.sort((a, b) => b.score - a.score);

  // Never throw away a forced mate, however weak the level.
  if (randomness > 0 && scored[0].score < MATE - 100 && Math.random() < randomness) {
    // Choose among moves that are at least close to playable.
    const viable = scored.filter((entry) => entry.score > scored[0].score - 120);
    const pool = viable.length > 1 ? viable.slice(1) : scored;
    return pool[Math.floor(Math.random() * pool.length)].move;
  }

  return scored[0].move;
}

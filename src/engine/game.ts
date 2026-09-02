import type {
  Color,
  GameState,
  GameStatus,
  HistoryEntry,
  Move,
  Position,
} from '../types/chess';
import { fileOf, initialPosition, positionKey, rankOf, squareName } from './board';
import { applyMove, isInCheck, legalMoves, legalMovesFrom } from './moves';

const PIECE_LETTER: Record<string, string> = {
  n: 'N',
  b: 'B',
  r: 'R',
  q: 'Q',
  k: 'K',
};

/** Standard Algebraic Notation for a move made in `pos`. */
export function toSan(pos: Position, move: Move): string {
  if (move.castle) {
    const base = move.castle === 'k' ? 'O-O' : 'O-O-O';
    return base + suffix(pos, move);
  }

  let san = '';

  if (move.piece === 'p') {
    if (move.captured) san += `${squareName(move.from)[0]}x`;
    san += squareName(move.to);
    if (move.promotion) san += `=${PIECE_LETTER[move.promotion]}`;
  } else {
    san += PIECE_LETTER[move.piece];
    san += disambiguate(pos, move);
    if (move.captured) san += 'x';
    san += squareName(move.to);
  }

  return san + suffix(pos, move);
}

/** File/rank hint when another identical piece could reach the same square. */
function disambiguate(pos: Position, move: Move): string {
  const rivals: number[] = [];
  for (let sq = 0; sq < 64; sq += 1) {
    if (sq === move.from) continue;
    const piece = pos.board[sq];
    if (piece?.type !== move.piece || piece.color !== move.color) continue;
    if (legalMovesFrom(pos, sq).some((m) => m.to === move.to)) rivals.push(sq);
  }

  if (!rivals.length) return '';

  const sameFile = rivals.some((sq) => fileOf(sq) === fileOf(move.from));
  const sameRank = rivals.some((sq) => rankOf(sq) === rankOf(move.from));
  const name = squareName(move.from);

  if (!sameFile) return name[0];
  if (!sameRank) return name[1];
  return name;
}

function suffix(pos: Position, move: Move): string {
  const next = applyMove(pos, move);
  if (!isInCheck(next, next.turn)) return '';
  return legalMoves(next).length === 0 ? '#' : '+';
}

/** Neither side has enough material to force mate. */
export function isInsufficientMaterial(pos: Position): boolean {
  const minors: { color: Color; light: boolean }[] = [];

  for (let sq = 0; sq < 64; sq += 1) {
    const piece = pos.board[sq];
    if (!piece || piece.type === 'k') continue;
    if (piece.type === 'p' || piece.type === 'r' || piece.type === 'q') return false;
    minors.push({ color: piece.color, light: (rankOf(sq) + fileOf(sq)) % 2 === 0 });
  }

  // K vs K, and K+minor vs K.
  if (minors.length <= 1) return true;

  // Any number of bishops, all on one colour complex, cannot mate.
  if (minors.length >= 2 && minors.every((m) => !m.light === !minors[0].light)) {
    return true;
  }

  return false;
}

function countRepetitions(history: HistoryEntry[], position: Position): number {
  const key = positionKey(position);
  // The starting position counts once, plus every historical match.
  let count = 1;
  for (const entry of history) {
    if (positionKey(entry.position) === key) count += 1;
  }
  return count;
}

export function resolveStatus(
  position: Position,
  history: HistoryEntry[],
): { status: GameStatus; winner: Color | null } {
  const moves = legalMoves(position);
  const check = isInCheck(position, position.turn);

  if (moves.length === 0) {
    return check
      ? { status: 'checkmate', winner: position.turn === 'w' ? 'b' : 'w' }
      : { status: 'stalemate', winner: null };
  }

  if (isInsufficientMaterial(position)) return { status: 'draw-material', winner: null };
  if (position.halfmoveClock >= 100) return { status: 'draw-fifty', winner: null };
  if (countRepetitions(history, position) >= 3) {
    return { status: 'draw-repetition', winner: null };
  }

  return { status: check ? 'check' : 'playing', winner: null };
}

export const createGame = (players = { w: 'White', b: 'Black' }): GameState => {
  const position = initialPosition();
  const now = Date.now();
  return {
    position,
    history: [],
    status: 'playing',
    winner: null,
    players,
    startedAt: now,
    updatedAt: now,
  };
};

export const isGameOver = (status: GameStatus): boolean =>
  status !== 'playing' && status !== 'check';

/** Play a move and return the next game state (unchanged if illegal or over). */
export function playMove(game: GameState, move: Move): GameState {
  if (isGameOver(game.status)) return game;

  const legal = legalMovesFrom(game.position, move.from).find(
    (m) => m.to === move.to && (m.promotion ?? null) === (move.promotion ?? null),
  );
  if (!legal) return game;

  const san = toSan(game.position, legal);
  const position = applyMove(game.position, legal);
  const nextHistory = [
    ...game.history,
    {
      move: legal,
      san,
      position,
      check: san.includes('+'),
      mate: san.includes('#'),
    },
  ];
  const { status, winner } = resolveStatus(position, nextHistory);

  return {
    ...game,
    position,
    history: nextHistory,
    status,
    winner,
    updatedAt: Date.now(),
  };
}

/** Undo the last move. */
export function undoMove(game: GameState): GameState {
  if (!game.history.length) return game;

  const history = game.history.slice(0, -1);
  const position = history.length
    ? history[history.length - 1].position
    : initialPosition();
  const { status, winner } = resolveStatus(position, history);

  return { ...game, position, history, status, winner, updatedAt: Date.now() };
}

/** Material balance from White's point of view, plus what each side captured. */
export function materialSummary(game: GameState) {
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const captured: Record<Color, string[]> = { w: [], b: [] };
  let balance = 0;

  for (const entry of game.history) {
    const { move } = entry;
    if (!move.captured) continue;
    captured[move.color].push(move.captured);
    balance += (move.color === 'w' ? 1 : -1) * values[move.captured];
  }

  const order = ['q', 'r', 'b', 'n', 'p'];
  captured.w.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  captured.b.sort((a, b) => order.indexOf(a) - order.indexOf(b));

  return { captured, balance };
}

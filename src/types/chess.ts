export type Color = 'w' | 'b';

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface Piece {
  type: PieceType;
  color: Color;
}

/** 0 = a8 ... 63 = h1. Index = rank * 8 + file, rank 0 is the 8th rank. */
export type Square = number;

export type CastlingRights = {
  wK: boolean;
  wQ: boolean;
  bK: boolean;
  bQ: boolean;
};

export interface Position {
  board: (Piece | null)[];
  turn: Color;
  castling: CastlingRights;
  /** Square index behind a pawn that just made a double push, else null. */
  enPassant: Square | null;
  halfmoveClock: number;
  fullmoveNumber: number;
}

export interface Move {
  from: Square;
  to: Square;
  piece: PieceType;
  color: Color;
  captured?: PieceType;
  promotion?: Exclude<PieceType, 'p' | 'k'>;
  /** 'k' king-side, 'q' queen-side */
  castle?: 'k' | 'q';
  enPassant?: boolean;
  /** Square of the pawn removed by an en passant capture. */
  capturedSquare?: Square;
}

export interface HistoryEntry {
  move: Move;
  san: string;
  /** Position *after* the move was played. */
  position: Position;
  check: boolean;
  mate: boolean;
}

export type GameStatus =
  | 'playing'
  | 'check'
  | 'checkmate'
  | 'stalemate'
  | 'draw-fifty'
  | 'draw-repetition'
  | 'draw-material'
  | 'draw-agreed'
  | 'resigned';

export interface GameState {
  position: Position;
  history: HistoryEntry[];
  status: GameStatus;
  /** Winner when status is checkmate / resigned. */
  winner: Color | null;
  players: { w: string; b: string };
  startedAt: number;
  updatedAt: number;
}

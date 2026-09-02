import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Color, GameState, Move, PieceType, Square } from '../types/chess';
import type { Difficulty } from '../engine/ai';
import { createGame, isGameOver, playMove, undoMove } from '../engine/game';
import { legalMovesFrom } from '../engine/moves';
import { sound } from '../utils/sound';
import { useChessAi } from './useChessAi';
import {
  archiveGame,
  clearGame,
  loadArchive,
  loadGame,
  saveGame,
  type ArchivedGame,
} from '../utils/storage';

export interface PendingPromotion {
  from: Square;
  to: Square;
  color: Color;
}

export type Mode = 'human' | 'computer';

/** Which sound a completed move should make, in priority order. */
const soundForMove = (game: GameState, move: Move): void => {
  if (isGameOver(game.status)) {
    if (game.status === 'checkmate' || game.status === 'resigned') sound.play('win');
    else sound.play('draw');
    return;
  }
  if (game.status === 'check') sound.play('check');
  else if (move.promotion) sound.play('promote');
  else if (move.castle) sound.play('castle');
  else if (move.captured) sound.play('capture');
  else sound.play('move');
};

const resultLabel = (status: string, winner: Color | null): string => {
  if (status === 'checkmate' || status === 'resigned') {
    return winner === 'w' ? '1-0' : '0-1';
  }
  return '½-½';
};

export function useChessGame() {
  const [game, setGame] = useState(() => loadGame() ?? createGame());
  const [selected, setSelected] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [archive, setArchive] = useState<ArchivedGame[]>(() => loadArchive());
  /** Index into history being viewed; null means "live position". */
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>('human');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  /** Which colour the human plays when facing the computer. */
  const [humanColor, setHumanColor] = useState<Color>('w');

  const archivedRef = useRef(false);
  const { requestMove, cancel, thinking } = useChessAi();

  useEffect(() => {
    saveGame(game);
  }, [game]);

  // Archive a finished game exactly once.
  useEffect(() => {
    if (!isGameOver(game.status) || archivedRef.current) return;
    archivedRef.current = true;
    setArchive(
      archiveGame({
        id: `${game.startedAt}-${game.history.length}-${Math.random().toString(36).slice(2, 8)}`,
        players: game.players,
        result: resultLabel(game.status, game.winner),
        moves: game.history.length,
        finishedAt: Date.now(),
      }),
    );
  }, [game.status, game.winner, game.players, game.history.length, game.startedAt]);

  const legalTargets = useMemo(() => {
    if (selected === null || reviewIndex !== null) return [];
    return legalMovesFrom(game.position, selected);
  }, [game.position, selected, reviewIndex]);

  const viewedPosition = useMemo(() => {
    if (reviewIndex === null) return game.position;
    if (reviewIndex < 0) return createGame().position;
    return game.history[reviewIndex].position;
  }, [game.position, game.history, reviewIndex]);

  const lastMove = useMemo(() => {
    const index = reviewIndex ?? game.history.length - 1;
    return index >= 0 ? game.history[index]?.move ?? null : null;
  }, [game.history, reviewIndex]);

  const commit = useCallback((move: Move) => {
    setGame((current) => {
      const next = playMove(current, move);
      // An illegal move leaves the state untouched.
      if (next === current) {
        sound.play('illegal');
        return current;
      }
      soundForMove(next, move);
      return next;
    });
    setSelected(null);
    setReviewIndex(null);
  }, []);

  const isComputerTurn =
    mode === 'computer' && game.position.turn !== humanColor && !isGameOver(game.status);

  const selectSquare = useCallback(
    (square: Square) => {
      if (isGameOver(game.status) || reviewIndex !== null || isComputerTurn) return;

      const target = legalTargets.find((m) => m.to === square);
      if (target && selected !== null) {
        if (target.promotion) {
          setPendingPromotion({ from: selected, to: square, color: target.color });
          return;
        }
        commit(target);
        return;
      }

      const piece = game.position.board[square];
      if (piece && piece.color === game.position.turn) {
        setSelected((current) => (current === square ? null : square));
      } else {
        setSelected(null);
      }
    },
    [commit, game.position, game.status, isComputerTurn, legalTargets, reviewIndex, selected],
  );

  // Ask the worker for a move whenever it becomes the computer's turn.
  useEffect(() => {
    if (!isComputerTurn || reviewIndex !== null || pendingPromotion) return;

    let cancelled = false;
    requestMove(game.position, difficulty, (move) => {
      if (cancelled || !move) return;
      commit(move);
    });

    return () => {
      cancelled = true;
    };
  }, [
    commit,
    difficulty,
    game.position,
    isComputerTurn,
    pendingPromotion,
    requestMove,
    reviewIndex,
  ]);

  const choosePromotion = useCallback(
    (promotion: Exclude<PieceType, 'p' | 'k'>) => {
      if (!pendingPromotion) return;
      const { from, to } = pendingPromotion;
      const move = legalMovesFrom(game.position, from).find(
        (m) => m.to === to && m.promotion === promotion,
      );
      setPendingPromotion(null);
      if (move) commit(move);
    },
    [commit, game.position, pendingPromotion],
  );

  const cancelPromotion = useCallback(() => setPendingPromotion(null), []);

  const newGame = useCallback((players?: { w: string; b: string }) => {
    archivedRef.current = false;
    cancel();
    clearGame();
    setGame(createGame(players));
    setSelected(null);
    setPendingPromotion(null);
    setReviewIndex(null);
  }, [cancel]);

  const undo = useCallback(() => {
    archivedRef.current = false;
    cancel();
    setGame((current) => {
      // Against the computer, step back over its reply too.
      const back = undoMove(current);
      return mode === 'computer' && back.position.turn !== humanColor
        ? undoMove(back)
        : back;
    });
    setSelected(null);
    setReviewIndex(null);
  }, [cancel, humanColor, mode]);

  const resign = useCallback((color: Color) => {
    cancel();
    sound.play('win');
    setGame((current) =>
      isGameOver(current.status)
        ? current
        : {
            ...current,
            status: 'resigned',
            winner: color === 'w' ? 'b' : 'w',
            updatedAt: Date.now(),
          },
    );
  }, [cancel]);

  const agreeDraw = useCallback(() => {
    cancel();
    sound.play('draw');
    setGame((current) =>
      isGameOver(current.status)
        ? current
        : { ...current, status: 'draw-agreed', winner: null, updatedAt: Date.now() },
    );
  }, [cancel]);

  const renamePlayers = useCallback((players: { w: string; b: string }) => {
    setGame((current) => ({ ...current, players, updatedAt: Date.now() }));
  }, []);

  const goToMove = useCallback(
    (index: number | null) => {
      setSelected(null);
      setReviewIndex(index === null || index >= game.history.length - 1 ? null : index);
    },
    [game.history.length],
  );

  /** Reset to a fresh board, applying any settings the caller passes. */
  const restart = useCallback(
    (next?: { mode?: Mode; difficulty?: Difficulty; humanColor?: Color }) => {
      const nextMode = next?.mode ?? mode;
      const nextColor = next?.humanColor ?? humanColor;

      archivedRef.current = false;
      cancel();
      clearGame();

      if (next?.mode !== undefined) setMode(next.mode);
      if (next?.difficulty !== undefined) setDifficulty(next.difficulty);
      if (next?.humanColor !== undefined) setHumanColor(next.humanColor);

      // Name the sides for whoever is actually playing them.
      const players =
        nextMode === 'computer'
          ? {
              w: nextColor === 'w' ? 'You' : 'Computer',
              b: nextColor === 'b' ? 'You' : 'Computer',
            }
          : { w: 'White', b: 'Black' };

      setGame(createGame(players));
      setSelected(null);
      setPendingPromotion(null);
      setReviewIndex(null);
    },
    [cancel, humanColor, mode],
  );

  /**
   * A settings change only takes effect on a fresh board. Mid-game it is held
   * here until the player confirms, so a stray click cannot wipe the position.
   */
  const [pendingSettings, setPendingSettings] = useState<{
    mode?: Mode;
    difficulty?: Difficulty;
    humanColor?: Color;
  } | null>(null);

  const requestSettings = useCallback(
    (next: { mode?: Mode; difficulty?: Difficulty; humanColor?: Color }) => {
      // Nothing to lose on an empty or finished board — just apply it.
      if (!game.history.length || isGameOver(game.status)) {
        restart(next);
        return;
      }
      setPendingSettings(next);
    },
    [game.history.length, game.status, restart],
  );

  const confirmSettings = useCallback(() => {
    if (pendingSettings) restart(pendingSettings);
    setPendingSettings(null);
  }, [pendingSettings, restart]);

  const cancelSettings = useCallback(() => setPendingSettings(null), []);

  const changeMode = useCallback(
    (next: Mode) => requestSettings({ mode: next }),
    [requestSettings],
  );

  const changeDifficulty = useCallback(
    (next: Difficulty) => requestSettings({ difficulty: next }),
    [requestSettings],
  );

  const changeHumanColor = useCallback(
    (next: Color) => requestSettings({ humanColor: next }),
    [requestSettings],
  );

  return {
    game,
    mode,
    difficulty,
    humanColor,
    thinking,
    isComputerTurn,
    changeDifficulty,
    changeHumanColor,
    changeMode,
    pendingSettings,
    confirmSettings,
    cancelSettings,
    selected,
    legalTargets,
    pendingPromotion,
    archive,
    reviewIndex,
    viewedPosition,
    lastMove,
    isReviewing: reviewIndex !== null,
    selectSquare,
    choosePromotion,
    cancelPromotion,
    newGame,
    undo,
    resign,
    agreeDraw,
    renamePlayers,
    goToMove,
  };
}

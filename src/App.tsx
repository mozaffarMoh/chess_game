import { useCallback, useEffect, useMemo, useState } from 'react';
import Board, { PromotionDialog } from './components/Board';
import ConfirmDialog from './components/ConfirmDialog';
import GameSetup from './components/GameSetup';
import MoveList from './components/MoveList';
import PlayerCard from './components/PlayerCard';
import SoundToggle from './components/SoundToggle';
import StatusBanner from './components/StatusBanner';
import { isGameOver, materialSummary } from './engine/game';
import { useChessGame } from './hooks/useChessGame';

export default function App() {
  const {
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
    isReviewing,
    selectSquare,
    choosePromotion,
    cancelPromotion,
    newGame,
    undo,
    resign,
    agreeDraw,
    renamePlayers,
    goToMove,
  } = useChessGame();

  const [flipped, setFlipped] = useState(false);
  const [autoFlip, setAutoFlip] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);

  const over = isGameOver(game.status);
  const { captured, balance } = useMemo(() => materialSummary(game), [game]);

  // In hot-seat play it helps to keep the mover's side at the bottom.
  useEffect(() => {
    if (autoFlip && mode === 'human') setFlipped(game.position.turn === 'b');
  }, [autoFlip, game.position.turn, mode]);

  // Facing the computer, the human's colour always sits at the bottom.
  useEffect(() => {
    if (mode === 'computer') setFlipped(humanColor === 'b');
  }, [humanColor, mode]);

  const settingsMessage = useMemo(() => {
    if (!pendingSettings) return '';
    if (pendingSettings.mode) {
      return pendingSettings.mode === 'computer'
        ? 'Switching to the computer will end the game in progress.'
        : 'Switching to two players will end the game in progress.';
    }
    if (pendingSettings.difficulty) {
      return `Changing the level to ${pendingSettings.difficulty} will end the game in progress.`;
    }
    if (pendingSettings.humanColor) {
      return `Playing as ${
        pendingSettings.humanColor === 'w' ? 'White' : 'Black'
      } will end the game in progress.`;
    }
    return 'This will end the game in progress.';
  }, [pendingSettings]);

  const handleNewGame = useCallback(() => {
    if (game.history.length && !over) {
      setConfirmNew(true);
      return;
    }
    newGame(game.players);
  }, [game.history.length, game.players, newGame, over]);

  // Arrow keys step through the game history.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const last = game.history.length - 1;
      const current = reviewIndex ?? last;

      if (e.key === 'ArrowLeft' && current >= 0) {
        e.preventDefault();
        goToMove(current - 1 < 0 ? -1 : current - 1);
      } else if (e.key === 'ArrowRight' && current < last) {
        e.preventDefault();
        goToMove(current + 1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        goToMove(null);
      } else if (e.key === 'f' || e.key === 'F') {
        setFlipped((v) => !v);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game.history.length, goToMove, reviewIndex]);

  const turnLabel = over
    ? 'Game over'
    : `${game.players[game.position.turn]} to move${
        game.status === 'check' ? ' — check' : ''
      }`;

  return (
    <div className="mx-auto flex min-h-full max-w-[1180px] flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-4 sm:py-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Chess<span className="text-accent">.</span>
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {mode === 'computer'
              ? `Playing the computer on ${difficulty}.`
              : 'Two-player game, on one board.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SoundToggle />
          <button type="button" className="btn" onClick={() => setFlipped((v) => !v)}>
            Flip board
          </button>
          {mode === 'human' && (
            <button
              type="button"
              className="btn"
              aria-pressed={autoFlip}
              onClick={() => setAutoFlip((v) => !v)}
              style={autoFlip ? { borderColor: '#c9a227', color: '#e0be4a' } : undefined}
            >
              Auto-flip {autoFlip ? 'on' : 'off'}
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={handleNewGame}>
            New game
          </button>
        </div>
      </header>

      <main className="grid flex-1 items-start gap-4 md:grid-cols-[minmax(0,1fr)_300px] md:gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        <section className="board-frame">
          <Board
            position={viewedPosition}
            selected={selected}
            legalTargets={legalTargets}
            lastMove={lastMove}
            flipped={flipped}
            interactive={!over && !isReviewing && !isComputerTurn}
            onSelect={selectSquare}
          />

          {pendingPromotion && (
            <PromotionDialog
              color={pendingPromotion.color}
              onChoose={choosePromotion}
              onCancel={cancelPromotion}
            />
          )}

          {thinking && !isReviewing && (
            <div className="thinking mt-3" role="status" aria-live="polite">
              <span>Computer is thinking</span>
              <span className="thinking__dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </div>
          )}

          {isReviewing && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-edge bg-black/30 px-3 py-2">
              <span className="text-sm text-ink-muted">
                Reviewing move {(reviewIndex ?? 0) + 1} of {game.history.length}
              </span>
              <button type="button" className="btn" onClick={() => goToMove(null)}>
                Back to live
              </button>
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <GameSetup
            mode={mode}
            difficulty={difficulty}
            humanColor={humanColor}
            dirty={game.history.length > 0}
            onMode={changeMode}
            onDifficulty={changeDifficulty}
            onColor={changeHumanColor}
          />

          <div className="flex flex-col gap-2">
            <PlayerCard
              color={flipped ? 'w' : 'b'}
              name={game.players[flipped ? 'w' : 'b']}
              active={!over && game.position.turn === (flipped ? 'w' : 'b')}
              captured={captured[flipped ? 'w' : 'b']}
              advantage={flipped ? Math.max(0, balance) : Math.max(0, -balance)}
              onRename={(name) =>
                renamePlayers({ ...game.players, [flipped ? 'w' : 'b']: name })
              }
            />
            <PlayerCard
              color={flipped ? 'b' : 'w'}
              name={game.players[flipped ? 'b' : 'w']}
              active={!over && game.position.turn === (flipped ? 'b' : 'w')}
              captured={captured[flipped ? 'b' : 'w']}
              advantage={flipped ? Math.max(0, -balance) : Math.max(0, balance)}
              onRename={(name) =>
                renamePlayers({ ...game.players, [flipped ? 'b' : 'w']: name })
              }
            />
          </div>

          <StatusBanner status={game.status} winner={game.winner} players={game.players} />

          {!over && (
            <p className="text-center text-sm font-semibold text-ink-muted">{turnLabel}</p>
          )}

          <div className="panel flex max-h-[340px] min-h-[180px] flex-col">
            <div className="panel__header">Moves</div>
            <MoveList
              history={game.history}
              reviewIndex={reviewIndex}
              onGoTo={goToMove}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn"
              disabled={!game.history.length || thinking}
              onClick={undo}
            >
              Undo
            </button>
            <button
              type="button"
              className="btn"
              disabled={over}
              onClick={agreeDraw}
            >
              Draw
            </button>
            {mode === 'computer' ? (
              <button
                type="button"
                className="btn btn--danger col-span-2"
                disabled={over}
                onClick={() => resign(humanColor)}
              >
                Resign
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn--danger"
                  disabled={over}
                  onClick={() => resign('w')}
                >
                  {game.players.w} resigns
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  disabled={over}
                  onClick={() => resign('b')}
                >
                  {game.players.b} resigns
                </button>
              </>
            )}
          </div>

          {archive.length > 0 && (
            <div className="panel">
              <div className="panel__header">Recent games</div>
              <ul className="max-h-[150px] overflow-y-auto p-2">
                {archive.slice(0, 6).map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm"
                  >
                    <span className="truncate text-ink-muted">
                      {entry.players.w} vs {entry.players.b}
                    </span>
                    <span className="shrink-0 font-bold tabular-nums">{entry.result}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-center text-xs text-ink-muted">
            ← → step through moves · F flips the board
          </p>
        </aside>
      </main>

      <ConfirmDialog
        open={pendingSettings !== null}
        title="Start a new game?"
        message={settingsMessage}
        onConfirm={confirmSettings}
        onCancel={cancelSettings}
      />

      <ConfirmDialog
        open={confirmNew}
        title="Start a new game?"
        message="The game in progress will be discarded."
        onConfirm={() => {
          setConfirmNew(false);
          newGame(game.players);
        }}
        onCancel={() => setConfirmNew(false)}
      />
    </div>
  );
}

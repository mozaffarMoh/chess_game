import { useEffect, useRef } from 'react';
import type { HistoryEntry } from '../types/chess';

interface MoveListProps {
  history: HistoryEntry[];
  reviewIndex: number | null;
  onGoTo: (index: number | null) => void;
}

export default function MoveList({ history, reviewIndex, onGoTo }: MoveListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const activeIndex = reviewIndex ?? history.length - 1;

  // Keep the newest move in view while playing live.
  useEffect(() => {
    if (reviewIndex === null) endRef.current?.scrollIntoView({ block: 'end' });
  }, [history.length, reviewIndex]);

  const rows = Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => i);

  if (!history.length) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-ink-muted">
        No moves yet — White to open.
      </div>
    );
  }

  return (
    <div className="move-list flex-1">
      {rows.map((row) => {
        const whiteIdx = row * 2;
        const blackIdx = whiteIdx + 1;
        const white = history[whiteIdx];
        const black = history[blackIdx];

        return (
          <div key={row} className="contents">
            <span className="move-list__num">{row + 1}.</span>

            <button
              type="button"
              className={`move-list__move ${
                activeIndex === whiteIdx ? 'move-list__move--active' : ''
              }`}
              onClick={() => onGoTo(whiteIdx)}
            >
              {white.san}
            </button>

            {black ? (
              <button
                type="button"
                className={`move-list__move ${
                  activeIndex === blackIdx ? 'move-list__move--active' : ''
                }`}
                onClick={() => onGoTo(blackIdx)}
              >
                {black.san}
              </button>
            ) : (
              <span />
            )}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

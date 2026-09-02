import { useCallback, useEffect, useRef, useState } from 'react';
import type { Move, Position } from '../types/chess';
import type { Difficulty } from '../engine/ai';
import type { AiRequest, AiResponse } from '../engine/ai.worker';

/**
 * Runs the search in a worker so the board stays responsive while the
 * computer thinks. Requests carry an id; stale replies (after an undo or a
 * new game) are discarded.
 */
export function useChessAi() {
  const workerRef = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const pending = useRef<((move: Move | null) => void) | null>(null);
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    const worker = new Worker(new URL('../engine/ai.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event: MessageEvent<AiResponse>) => {
      // Ignore replies to superseded requests.
      if (event.data.id !== requestId.current) return;
      setThinking(false);
      pending.current?.(event.data.move);
      pending.current = null;
    };

    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const requestMove = useCallback(
    (position: Position, difficulty: Difficulty, onMove: (move: Move | null) => void) => {
      const worker = workerRef.current;
      if (!worker) return;

      requestId.current += 1;
      pending.current = onMove;
      setThinking(true);

      const request: AiRequest = { id: requestId.current, position, difficulty };
      worker.postMessage(request);
    },
    [],
  );

  /** Drop any in-flight search — used on undo, new game, or mode change. */
  const cancel = useCallback(() => {
    requestId.current += 1;
    pending.current = null;
    setThinking(false);
  }, []);

  return { requestMove, cancel, thinking };
}

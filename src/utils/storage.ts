import type { GameState } from '../types/chess';

const KEY = 'chess:game';
const ARCHIVE_KEY = 'chess:archive';
const MAX_ARCHIVE = 20;

export interface ArchivedGame {
  id: string;
  players: { w: string; b: string };
  result: string;
  moves: number;
  finishedAt: number;
}

const available = (): boolean => {
  try {
    const probe = '__chess_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
};

export function loadGame(): GameState | null {
  if (!available()) return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    // Guard against a schema change or hand-edited storage.
    if (!parsed?.position?.board || parsed.position.board.length !== 64) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveGame(game: GameState): void {
  if (!available()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(game));
  } catch {
    /* quota exceeded — the game simply is not persisted */
  }
}

export function clearGame(): void {
  if (!available()) return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function loadArchive(): ArchivedGame[] {
  if (!available()) return [];
  try {
    const raw = window.localStorage.getItem(ARCHIVE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ArchivedGame[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function archiveGame(entry: ArchivedGame): ArchivedGame[] {
  const next = [entry, ...loadArchive()].slice(0, MAX_ARCHIVE);
  if (!available()) return next;
  try {
    window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function clearArchive(): void {
  if (!available()) return;
  try {
    window.localStorage.removeItem(ARCHIVE_KEY);
  } catch {
    /* ignore */
  }
}

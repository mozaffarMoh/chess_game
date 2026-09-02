import type { Move, Position } from '../types/chess';
import { findBestMove, type Difficulty } from './ai';

export interface AiRequest {
  id: number;
  position: Position;
  difficulty: Difficulty;
}

export interface AiResponse {
  id: number;
  move: Move | null;
}

self.onmessage = (event: MessageEvent<AiRequest>) => {
  const { id, position, difficulty } = event.data;
  const move = findBestMove(position, difficulty);
  const response: AiResponse = { id, move };
  self.postMessage(response);
};

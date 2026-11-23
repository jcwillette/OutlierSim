import type { CalibrationSpec } from '../engine/sim/calibration.ts';
import type { GameDefinition } from '../engine/sim/types.ts';
import { definition as reference } from './0000-reference/definition.ts';

/**
 * Every playable game. Add new seasons here (newest first). `hidden` games are left out of the
 * student-facing menu unless ?dev=1 is set.
 */
export interface GameEntry {
  definition: GameDefinition;
  hidden?: boolean;
  /** Past seasons: how to compare against real matches (see tools/calibrate.ts). */
  calibration?: CalibrationSpec;
}

export const GAMES: GameEntry[] = [{ definition: reference, hidden: false }];

export function findGame(id: string): GameDefinition | undefined {
  return GAMES.find((g) => g.definition.id === id)?.definition;
}

import type { CalibrationSpec } from '../engine/sim/calibration.ts';
import type { GameDefinition } from '../engine/sim/types.ts';
import { definition as reference } from './0000-reference/definition.ts';
import { calibration as chargedUp2023Calibration } from './2023-chargedup/calibration.ts';
import { definition as chargedUp2023 } from './2023-chargedup/definition.ts';
import { definition as crescendo2024 } from './2024-crescendo/definition.ts';

/**
 * Every playable game. Add new seasons here (newest first). `hidden` games are left out of the
 * student-facing menu unless ?dev=1 is set.
 */
export interface GameEntry {
  definition: GameDefinition;
  hidden?: boolean;
  /** Only when the owner asks: how to compare against real matches (see tools/calibrate.ts, ADR 0004). */
  calibration?: CalibrationSpec;
}

export const GAMES: GameEntry[] = [
  // Built blind from the kickoff manual (6 Jan 2024) only: see its SOURCES.md.
  { definition: crescendo2024 },
  // The owner asked for a real-match comparison of 2023 (ADR 0004): see its CALIBRATION.md.
  { definition: chargedUp2023, calibration: chargedUp2023Calibration },
  { definition: reference, hidden: false },
];

export function findGame(id: string): GameDefinition | undefined {
  return GAMES.find((g) => g.definition.id === id)?.definition;
}

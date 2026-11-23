import { clamp } from './math.ts';
import type { FaultRates, RobotArchetype } from './types.ts';

/** Default `RobotArchetype.reliability`. */
export const DEFAULT_RELIABILITY = 0.95;
/** Chance of a breakdown (dead robot) is this x (1 - reliability). */
const BREAKDOWN_SCALE = 0.6;
/** Chance of a mechanism failure (drives, can't score) is this x (1 - reliability): 2.5x a breakdown. */
const MECH_FAIL_SCALE = 1.5;
/** Expected short power / comms losses per match is this x (1 - reliability). */
const STALL_SCALE = 5;
/**
 * Chance a breakdown clears is BREAKDOWN_RECOVER_BASE - RECOVER_SLOPE x (1 - reliability), clamped to
 * RECOVER_RANGE. Mechanism failures clear more often.
 */
const BREAKDOWN_RECOVER_BASE = 0.7;
const MECH_RECOVER_BASE = 0.85;
const RECOVER_SLOPE = 3;
const RECOVER_RANGE: [number, number] = [0.05, 0.95];
/** Seconds until a breakdown / mechanism failure clears, when it does (uniform in the range). */
export const BREAKDOWN_RECOVER_SEC: [number, number] = [10, 35];
export const MECH_RECOVER_SEC: [number, number] = [5, 25];
/** Length of a short power / comms loss (uniform in the range). */
export const STALL_SEC: [number, number] = [2, 6];

/**
 * A robot's per-match fault rates: derived from its `reliability`, with any explicit
 * `RobotArchetype.faults` taking precedence.
 */
export function faultRates(a: RobotArchetype): FaultRates {
  const u = 1 - clamp(a.reliability ?? DEFAULT_RELIABILITY, 0, 1);
  const derived: FaultRates = {
    breakdownChance: Math.min(0.9, BREAKDOWN_SCALE * u),
    breakdownRecoverChance: clamp(BREAKDOWN_RECOVER_BASE - RECOVER_SLOPE * u, ...RECOVER_RANGE),
    mechFailChance: Math.min(0.9, MECH_FAIL_SCALE * u),
    mechRecoverChance: clamp(MECH_RECOVER_BASE - RECOVER_SLOPE * u, ...RECOVER_RANGE),
    stallsPerMatch: STALL_SCALE * u,
  };
  return { ...derived, ...a.faults };
}

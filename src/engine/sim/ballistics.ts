export const GRAVITY = 9.81;

/**
 * Launch pitch (radians above horizontal) to hit a point `d` meters away horizontally and `h` meters
 * higher, at muzzle speed `v`, ignoring drag. Returns null if out of range.
 */
export function launchPitch(v: number, d: number, h: number, arc: 'high' | 'low'): number | null {
  if (d < 1e-6) return h > 0 ? Math.PI / 2 : null;
  const g = GRAVITY;
  const v2 = v * v;
  const disc = v2 * v2 - g * (g * d * d + 2 * h * v2);
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  return Math.atan((v2 + (arc === 'high' ? root : -root)) / (g * d));
}

/** Time of flight for a launch that travels horizontal distance d at speed v and pitch. */
export function flightTime(v: number, pitch: number, d: number): number {
  return d / Math.max(1e-6, v * Math.cos(pitch));
}

/** Muzzle speed needed to hit (d, h) at a given pitch, or null if the pitch can't reach it. */
export function speedForPitch(pitch: number, d: number, h: number): number | null {
  const c = Math.cos(pitch);
  const denom = 2 * c * c * (d * Math.tan(pitch) - h);
  if (denom <= 0) return null;
  return Math.sqrt((GRAVITY * d * d) / denom);
}

export interface ShotSolution {
  pitch: number;
  speed: number;
}

/**
 * Choose hood pitch and flywheel speed (<= maxSpeed) to hit a point `d` away horizontally and `h`
 * higher. The pitch stays within the hood range. 'high' prefers steeper shots than the minimum-energy
 * one, 'low' prefers flatter ones. With `descending`, the piece must be falling at the target.
 */
export function solveShot(
  maxSpeed: number,
  d: number,
  h: number,
  prefer: 'high' | 'low',
  pitchRangeDeg: readonly [number, number] = [10, 80],
  descending = false,
): ShotSolution | null {
  const deg = Math.PI / 180;
  const minEnergy = Math.PI / 4 + Math.atan2(h, d) / 2;
  const preferred = minEnergy + (prefer === 'high' ? 12 : -6) * deg;
  let best: ShotSolution | null = null;
  let bestCost = Infinity;
  for (let a = pitchRangeDeg[0]; a <= pitchRangeDeg[1] + 1e-9; a += 0.5) {
    const pitch = a * deg;
    const speed = speedForPitch(pitch, d, h);
    if (speed === null || speed > maxSpeed) continue;
    if (descending && speed * Math.sin(pitch) - GRAVITY * flightTime(speed, pitch, d) >= 0) continue;
    const cost = Math.abs(pitch - preferred);
    if (cost < bestCost) {
      bestCost = cost;
      best = { pitch, speed };
    }
  }
  return best;
}

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

/** How a piece must arrive at the aim point: any way, falling (top-entry goals) or still rising. */
export type ShotArrival = 'any' | 'descending' | 'rising';

/**
 * Choose hood pitch and flywheel speed (<= maxSpeed) to hit a point `d` away horizontally and `h`
 * higher. The pitch stays within the hood range. 'high' prefers steeper shots than the minimum-energy
 * one, 'low' prefers flatter ones. `arrival` 'descending': the piece must be falling at the target;
 * 'rising': it must not be falling yet (a mouth under a hood), and the fastest such shot is taken.
 */
export function solveShot(
  maxSpeed: number,
  d: number,
  h: number,
  prefer: 'high' | 'low',
  pitchRangeDeg: readonly [number, number] = [10, 80],
  arrival: ShotArrival = 'any',
): ShotSolution | null {
  const deg = Math.PI / 180;
  const minEnergy = Math.PI / 4 + Math.atan2(h, d) / 2;
  // A rising arrival: the fastest shot the flywheel makes (the lowest hood angle), which arrives
  // rising most steeply and so meets a downward-facing mouth most squarely.
  const preferred = arrival === 'rising' ? 0 : minEnergy + (prefer === 'high' ? 12 : -6) * deg;
  let best: ShotSolution | null = null;
  let bestCost = Infinity;
  for (let a = pitchRangeDeg[0]; a <= pitchRangeDeg[1] + 1e-9; a += 0.5) {
    const pitch = a * deg;
    const speed = speedForPitch(pitch, d, h);
    if (speed === null || speed > maxSpeed) continue;
    if (arrival !== 'any') {
      const vz = speed * Math.sin(pitch) - GRAVITY * flightTime(speed, pitch, d);
      if (arrival === 'descending' ? vz >= 0 : vz < 0) continue;
    }
    const cost = Math.abs(pitch - preferred);
    if (cost < bestCost) {
      bestCost = cost;
      best = { pitch, speed };
    }
  }
  return best;
}

/**
 * The shot a shooter takes at a target `d` away and `h` higher: the target's preferred arc ('high'
 * for top-entry goals, else 'low'; 'rising' is the fastest shot, still rising at the aim point).
 */
export function shotAt(
  sh: { exitSpeed: number; pitchRangeDeg?: [number, number] },
  t: { arc?: 'high' | 'low' | 'rising'; aperture?: { entry?: 'any' | 'down' } },
  d: number,
  h: number,
): ShotSolution | null {
  const down = t.aperture?.entry === 'down';
  const arc = t.arc ?? (down ? 'high' : 'low');
  const arrival: ShotArrival = down ? 'descending' : arc === 'rising' ? 'rising' : 'any';
  return solveShot(sh.exitSpeed, d, h, arc === 'rising' ? 'low' : arc, sh.pitchRangeDeg, arrival);
}

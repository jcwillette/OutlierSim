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

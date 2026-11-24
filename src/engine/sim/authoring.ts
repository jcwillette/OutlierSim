import type { Region2D } from './types.ts';

/**
 * Helpers for writing a `GameDefinition` from a game manual: unit conversions, floor regions and
 * citations. Manuals give inches, feet and pounds; the engine works in meters, kilograms and
 * radians. Convert once, where the number is written down, and keep the manual's own figures
 * visible in the expression (`feet(18, 0.5)`, `14.25 * IN`) so a reviewer can check them.
 */

/** One inch, in meters. */
export const IN = 0.0254;
/** One foot, in meters. */
export const FT = 0.3048;
/** One pound, in kilograms. */
export const LB = 0.45359237;
/** One degree, in radians. */
export const DEG = Math.PI / 180;

/** A length given in feet and inches (e.g. 54 ft 3 1/4 in is `feet(54, 3.25)`), in meters. */
export const feet = (ft: number, inches = 0): number => (ft * 12 + inches) * IN;

/** An axis-aligned floor rectangle between two corners (given in any order). */
export function rect(x0: number, y0: number, x1: number, y1: number): Region2D {
  return {
    kind: 'rect',
    min: { x: Math.min(x0, x1), y: Math.min(y0, y1) },
    max: { x: Math.max(x0, x1), y: Math.max(y0, y1) },
  };
}

/** A floor polygon from `[x, y]` corners, in order around the outline. */
export function poly(...corners: Array<readonly [number, number]>): Region2D {
  return { kind: 'poly', points: corners.map(([x, y]) => ({ x, y })) };
}

/** A floor circle. */
export function circle(x: number, y: number, radius: number): Region2D {
  return { kind: 'circle', center: { x, y }, radius };
}

/**
 * A citation maker for one document: with `const M = cite('Manual')`, `M(47, 'Table 6-2')` is
 * "Manual p.47, Table 6-2". Use one per source (`cite('TU03')` for a Team Update) so every
 * `source` field reads the same way.
 */
export function cite(doc: string): (page: number | string, what?: string) => string {
  return (page, what = '') => `${doc} p.${page}${what ? ', ' + what : ''}`;
}

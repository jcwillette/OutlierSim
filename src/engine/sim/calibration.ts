import type { AllianceResult } from './match.ts';

/**
 * How a game compares its simulated matches to real ones (from The Blue Alliance).
 * Lives in `src/games/<id>/calibration.ts` for past seasons. Metrics are per alliance per match.
 */
export interface CalibrationMetric {
  name: string;
  /** Value from a TBA alliance `score_breakdown` (plus the alliance's final score). Null = skip match. */
  real: (breakdown: Record<string, unknown>, score: number) => number | null;
  /** Same quantity from a simulated alliance result. */
  sim: (s: AllianceResult) => number;
}

export interface CalibrationSpec {
  /** TBA event keys to compare against, e.g. a strong district event and a championship division. */
  events: string[];
  /**
   * Instead of `events`: every official event of this season on TBA (regionals, district events,
   * district championships and the Championship), for the average match of the season.
   */
  season?: number;
  /** TBA comp levels to include. Default ['qm']. */
  compLevels?: string[];
  metrics: CalibrationMetric[];
  notes?: string;
}

/** Number field from a TBA breakdown (0 if missing). */
export const num = (b: Record<string, unknown>, key: string): number => {
  const v = b[key];
  return typeof v === 'number' ? v : typeof v === 'boolean' ? Number(v) : 0;
};

/** Pieces scored by an alliance in targets with this base id (optionally one phase). */
export function simCount(s: AllianceResult, baseId: string, phase?: 'auto' | 'teleop'): number {
  let n = 0;
  for (const [id, c] of Object.entries(s.targetCounts)) {
    if (id !== baseId && !id.startsWith(`${baseId}.`)) continue;
    n += phase ? c[phase] : c.auto + c.teleop;
  }
  return n;
}

/** Metrics that work for most seasons (TBA uses autoPoints / foulPoints nearly every year). */
export const DEFAULT_METRICS: CalibrationMetric[] = [
  {
    name: 'Score excl. fouls',
    real: (b, score) => score - num(b, 'foulPoints'),
    sim: (s) => s.score - s.breakdown.penalty,
  },
  { name: 'Auto points', real: (b) => num(b, 'autoPoints'), sim: (s) => s.breakdown.auto },
  {
    name: 'Teleop + endgame points',
    real: (b) => num(b, 'teleopPoints'),
    sim: (s) => s.breakdown.teleop + s.breakdown.endgame,
  },
];

export interface Stats {
  n: number;
  mean: number;
  sd: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export function stats(xs: number[]): Stats {
  const n = xs.length;
  if (!n) return { n: 0, mean: NaN, sd: NaN, p25: NaN, p50: NaN, p75: NaN, p90: NaN };
  const s = [...xs].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
  const q = (p: number) => {
    const i = (n - 1) * p;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return s[lo]! + (s[hi]! - s[lo]!) * (i - lo);
  };
  return { n, mean, sd, p25: q(0.25), p50: q(0.5), p75: q(0.75), p90: q(0.9) };
}

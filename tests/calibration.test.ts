import { describe, expect, it } from 'vitest';
import { DEFAULT_METRICS, num, simCount, stats } from '../src/engine/sim/calibration.ts';
import type { AllianceResult } from '../src/engine/sim/index.ts';

const fakeSide = (over: Partial<AllianceResult> = {}): AllianceResult => ({
  alliance: 'blue',
  score: 100,
  breakdown: { auto: 20, teleop: 60, endgame: 14, penalty: 6 },
  targetCounts: {
    'goal.blue': { auto: 2, teleop: 10 },
    'shelf.blue': { auto: 1, teleop: 3 },
    mid: { auto: 0, teleop: 4 },
  },
  endgame: {},
  sources: {},
  fouls: { minor: 0, major: 0 },
  foulCalls: {},
  rp: 0,
  rpBreakdown: {},
  won: false,
  tied: false,
  ...over,
});

describe('calibration helpers', () => {
  it('stats computes mean, sd and percentiles', () => {
    const s = stats([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(s.mean).toBe(5.5);
    expect(s.p50).toBe(5.5);
    expect(s.p90).toBeCloseTo(9.1);
    expect(s.sd).toBeCloseTo(3.03, 2);
    expect(Number.isNaN(stats([]).mean)).toBe(true);
  });
  it('simCount sums by base id across alliances and phases', () => {
    const side = fakeSide();
    expect(simCount(side, 'goal')).toBe(12);
    expect(simCount(side, 'goal', 'teleop')).toBe(10);
    expect(simCount(side, 'mid')).toBe(4);
    expect(simCount(side, 'go')).toBe(0);
  });
  it('default metrics read common TBA fields and exclude fouls', () => {
    const b = { autoPoints: 12, teleopPoints: 40, foulPoints: 5 };
    expect(num(b, 'missing')).toBe(0);
    const [total, auto, teleop] = DEFAULT_METRICS;
    expect(total!.real(b, 57)).toBe(52);
    expect(total!.sim(fakeSide())).toBe(94);
    expect(auto!.real(b, 57)).toBe(12);
    expect(teleop!.sim(fakeSide())).toBe(74);
  });
});

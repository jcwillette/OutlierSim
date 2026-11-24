import { beforeAll, describe, expect, it } from 'vitest';
import {
  IDLE,
  Match,
  expandDefinition,
  initPhysics,
  type AllianceSummary,
  type Robot,
  type RobotCommand,
  type RobotInfo,
  type RulesContext,
} from '../src/engine/sim/index.ts';
import { definition } from '../src/games/2024-crescendo/definition.ts';
import {
  CHAINS,
  CORE_BOTTOM,
  L,
  SPEAKER_Y,
  STAGE_C,
  chainAt,
  polar,
} from '../src/games/2024-crescendo/layout.ts';
import { AMPLIFIED_MULTIPLIER, rules } from '../src/games/2024-crescendo/rules.ts';

beforeAll(async () => {
  await initPhysics();
});

const ctl = (f: (m: Match, r: Robot) => Partial<RobotCommand>) => ({
  command: (m: Match, r: Robot) => ({ ...IDLE, ...f(m, r) }),
});
const stepFor = (m: Match, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) m.step();
};
const teleport = (r: Robot, x: number, y: number) => {
  r.setPosition({ x, y, z: r.archetype.frame.height / 2 + 0.01 });
  r.setVelocity({ x: 0, y: 0, z: 0 });
};
const park = (m: Match, keep: Robot[]) => {
  for (const r of m.robots) if (!keep.includes(r)) teleport(r, 8.27, 0.6 + r.id * 1.2);
};

describe('2024 Crescendo: field', () => {
  const x = expandDefinition(definition);
  it('is mirrored: both AMPS on the far guardrail, each SOURCE in the scoring-table corner at the other end', () => {
    const amp = (a: string) => x.targets.find((t) => t.id === `amp.${a}`)!.place!.zone;
    const center = (z: { kind: string; min?: { x: number; y: number }; max?: { x: number; y: number } }) => ({
      x: (z.min!.x + z.max!.x) / 2,
      y: (z.min!.y + z.max!.y) / 2,
    });
    expect(center(amp('blue') as never).x).toBeLessThan(3);
    expect(center(amp('red') as never).x).toBeGreaterThan(L - 3);
    expect(center(amp('red') as never).y).toBeCloseTo(center(amp('blue') as never).y, 6);
    const src = (a: string) => x.stations.find((s) => s.id === `source.${a}`)!;
    const mid = (s: ReturnType<typeof src>) => {
      const pts = (s.zone as { points: Array<{ x: number; y: number }> }).points;
      return {
        x: pts.reduce((n, p) => n + p.x, 0) / pts.length,
        y: pts.reduce((n, p) => n + p.y, 0) / pts.length,
      };
    };
    expect(mid(src('blue')).x).toBeGreaterThan(L - 2.5); // blue's SOURCE is at the red end
    expect(mid(src('red')).x).toBeLessThan(2.5);
    expect(mid(src('blue')).y).toBeLessThan(1.5);
  });

  it('every robot type fits under the STAGE core, and drives under it', () => {
    for (const a of definition.archetypes) expect(a.frame.height).toBeLessThan(CORE_BOTTOM);
    const m = new Match({ ...definition, staging: [], preload: {} }, { seed: 1 });
    m.start();
    m.step();
    const r = m.robots[0]!;
    park(m, [r]);
    teleport(r, 3.95, STAGE_C.y);
    r.controller = ctl(() => ({ vx: 0.6 }));
    stepFor(m, 4);
    expect(r.x).toBeGreaterThan(STAGE_C.x + 1); // came out past the far legs
  });

  it('the chains are found from a robot position', () => {
    CHAINS.forEach((c, i) => expect(chainAt(polar(STAGE_C, 0.8, c.deg))).toBe(i));
  });
});

describe('2024 Crescendo: scoring', () => {
  it('a shooter scores the SPEAKER from mid-range with a rising shot (5 points in AUTO)', () => {
    const m = new Match({ ...definition, staging: [] }, { seed: 3, archetypes: { 0: 'allround' } });
    m.start();
    m.step();
    const r = m.robots[0]!;
    park(m, [r]);
    teleport(r, 3.0, SPEAKER_Y);
    r.controller = ctl(() => ({ score: true }));
    stepFor(m, 2);
    expect(m.summary('blue').targetCounts['speaker.blue']?.auto).toBe(1);
    expect(m.ledger.bySource('blue')['speaker.blue']).toBe(5);
  });

  it('the TRAPS open only in the last 20 s', () => {
    const m = new Match(definition, { seed: 1 });
    m.start();
    m.step();
    const open = () => m.targets.get('trap-1.blue')!.enabled;
    expect(open()).toBe(false);
    while (!m.isEndgame) m.step();
    m.step();
    expect(open()).toBe(true);
  });
});

describe('2024 Crescendo: rules (AMPLIFICATION, Coopertition, HARMONY, SPOTLIT)', () => {
  const fakeCtx = (over: Partial<Record<string, unknown>> = {}) => {
    const added: Array<[string, string, number, string]> = [];
    const mult: Record<string, number> = {};
    const ctx = {
      vars: {} as Record<string, unknown>,
      time: 30,
      phase: 'teleop',
      remaining: 120,
      endgame: false,
      robots: () => [] as RobotInfo[],
      addPoints: (a: string, c: string, p: number, s: string) => added.push([a, c, p, s]),
      setTargetMultiplier: (id: string, k: number) => (mult[id] = k),
      setTargetEnabled: () => {},
      setIndicator: () => {},
      announce: () => {},
      random: () => 0,
      ...over,
    } as unknown as RulesContext & { time: number; remaining: number };
    return { ctx, added, mult };
  };
  const ampScore = (ctx: RulesContext, a: 'blue' | 'red') =>
    rules.onScore!(ctx, {
      time: 0,
      phase: 'teleop',
      alliance: a,
      targetId: `amp.${a}`,
      pieceType: 'note',
      robotId: 0,
      points: 1,
    });

  it('2 AMP NOTES AMPLIFY the SPEAKER for 10 s once a robot is ready to shoot', () => {
    const shooter = { id: 0, alliance: 'blue', x: 3, y: SPEAKER_Y, held: ['note'] } as unknown as RobotInfo;
    const { ctx, mult } = fakeCtx({ remaining: 80, robots: () => [shooter] });
    rules.onInit!(ctx);
    ampScore(ctx, 'blue');
    rules.onTick!(ctx, 1 / 60);
    expect(mult['speaker.blue']).toBeUndefined(); // 1 banked: not yet
    ampScore(ctx, 'blue');
    rules.onTick!(ctx, 1 / 60);
    expect(mult['speaker.blue']).toBe(AMPLIFIED_MULTIPLIER);
    expect(rules.botValue!(ctx, 'blue', 'speaker.blue')).toBe(3);
    ampScore(ctx, 'blue'); // during AMPLIFICATION: points, but nothing banked
    (ctx as { time: number }).time += 10.01;
    rules.onTick!(ctx, 1 / 60);
    expect(mult['speaker.blue']).toBe(1);
    expect(rules.botValue!(ctx, 'blue', 'amp.blue')).toBe(2); // bank empty again
  });

  it('both HUMAN PLAYERS pressing Coopertition in the first 45 s of TELEOP lowers MELODY to 15', () => {
    const { ctx, added } = fakeCtx({ remaining: 110 });
    rules.onInit!(ctx);
    ampScore(ctx, 'blue');
    ampScore(ctx, 'red');
    rules.onTick!(ctx, 1 / 60);
    const sources: Record<string, number> = {};
    for (const [a, , p, s] of added) if (a === 'blue') sources[s] = (sources[s] ?? 0) + p;
    expect(sources).toEqual({ coopertition: 1, 'coopertition-offset': -1 });
    const melody = definition.rankingPoints.bonuses.find((b) => b.id === 'melody')!;
    const own = (notes: number, coop: boolean) =>
      ({
        alliance: 'blue',
        targetCounts: { 'speaker.blue': { auto: 0, teleop: notes }, 'amp.blue': { auto: 0, teleop: 0 } },
        sources: coop ? sources : {},
      }) as unknown as AllianceSummary;
    if (melody.kind !== 'custom') throw new Error('melody is custom');
    expect(melody.check(own(15, true), own(0, false))).toBe(true);
    expect(melody.check(own(15, false), own(0, false))).toBe(false);
    expect(melody.check(own(18, false), own(0, false))).toBe(true);
  });

  it('no Coopertition after the first 45 s of TELEOP', () => {
    const { ctx, added } = fakeCtx({ remaining: 89 });
    rules.onInit!(ctx);
    ampScore(ctx, 'blue');
    ampScore(ctx, 'red');
    rules.onTick!(ctx, 1 / 60);
    expect(added).toEqual([]);
  });

  it('HARMONY: +2 per extra robot on a chain; SPOTLIT: +1 per robot under a spotlit MICROPHONE', () => {
    const on = (id: number, deg: number) =>
      ({
        id,
        alliance: 'blue',
        endgameAction: 'onstage.blue',
        ...polar(STAGE_C, 0.8, deg),
      }) as unknown as RobotInfo;
    const { ctx, added } = fakeCtx({ phase: 'post', robots: () => [on(0, 0), on(1, 0), on(2, 120)] });
    rules.onInit!(ctx);
    rules.onMatchEnd!(ctx);
    // random() = 0: every throw lands; the chain with 2 robots first, then the other.
    expect(added).toEqual([
      ['blue', 'endgame', 2, 'harmony'],
      ['blue', 'endgame', 3, 'spotlight'],
    ]);
  });

  it("counts HARMONY on red's STAGE the same way (mirror image)", () => {
    const on = (id: number, deg: number) => {
      const p = polar(STAGE_C, 0.8, deg);
      return {
        id,
        alliance: 'red',
        endgameAction: 'onstage.red',
        x: L - p.x,
        y: p.y,
      } as unknown as RobotInfo;
    };
    const { ctx, added } = fakeCtx({
      phase: 'post',
      random: () => 1,
      robots: () => [on(3, 0), on(4, 120), on(5, -120)],
    });
    rules.onInit!(ctx);
    rules.onMatchEnd!(ctx);
    expect(added).toEqual([]); // three robots on three chains: no HARMONY
  });

  it('a G424 violation hands the opponent the ENSEMBLE RP', () => {
    const ensemble = definition.rankingPoints.bonuses.find((b) => b.id === 'ensemble')!;
    if (ensemble.kind !== 'custom') throw new Error('ensemble is custom');
    const s = (sources: Record<string, number>, onstage: number, foulCalls: Record<string, number> = {}) =>
      ({ alliance: 'blue', sources, endgame: { onstage }, foulCalls }) as unknown as AllianceSummary;
    expect(ensemble.check(s({ 'onstage.blue': 6, harmony: 2, 'park.blue': 1 }, 2), s({}, 0))).toBe(false);
    expect(ensemble.check(s({ 'onstage.blue': 6, harmony: 2, spotlight: 2 }, 2), s({}, 0))).toBe(true);
    expect(
      ensemble.check(
        s({}, 0),
        s({}, 0, { "G424 contact with either robot in the opponent's STAGE ZONE in the last 20 s": 1 }),
      ),
    ).toBe(true);
  });
});

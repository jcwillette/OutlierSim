import { beforeAll, describe, expect, it } from 'vitest';
import { attachBots } from '../src/engine/ai/index.ts';
import {
  IDLE,
  Match,
  expandDefinition,
  initPhysics,
  validateDefinition,
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
import { AMPLIFIED_MULTIPLIER, AMP_BANK_VALUE, rules } from '../src/games/2024-crescendo/rules.ts';
import { AllianceNav } from '../src/engine/ai/navgrid.ts';
import { defaultLineup, resolveLineup } from '../src/ui/lineup.ts';
import { dealRng } from '../src/ui/montecarlo.ts';

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

  it('short robots drive under the STAGE core; the full-size robot is blocked by it', () => {
    const tall = definition.archetypes.filter((a) => a.frame.height >= CORE_BOTTOM).map((a) => a.id);
    expect(tall).toEqual(['fullsize']);
    const drive = (archetype: string) => {
      const m = new Match(
        { ...definition, staging: [], preload: {} },
        { seed: 1, archetypes: { 0: archetype } },
      );
      m.start();
      m.step();
      const r = m.robots[0]!;
      park(m, [r]);
      teleport(r, 3.95, STAGE_C.y);
      r.controller = ctl(() => ({ vx: 0.6 }));
      stepFor(m, 4);
      return r.x;
    };
    expect(drive('allround')).toBeGreaterThan(STAGE_C.x + 1); // came out past the far legs
    expect(drive('fullsize')).toBeLessThan(STAGE_C.x); // stopped by the core
    // The bots' nav grids agree: free under the STAGE for short robots, a wall for tall ones.
    const game = expandDefinition(definition);
    expect(new AllianceNav(game, 0.5, 'blue').isFree(STAGE_C)).toBe(true);
    expect(new AllianceNav(game, 0.5, 'blue', 1.0).isFree(STAGE_C)).toBe(false);
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

  const holder = (id: number, x: number) =>
    ({ id, alliance: 'blue', x, y: SPEAKER_Y, held: ['note'] }) as unknown as RobotInfo;
  const speakerScore = (ctx: RulesContext) =>
    rules.onScore!(ctx, {
      time: 0,
      phase: 'teleop',
      alliance: 'blue',
      targetId: 'speaker.blue',
      pieceType: 'note',
      robotId: 0,
      points: 5,
    });

  it('2 AMP NOTES AMPLIFY the SPEAKER for 10 s once two robots are ready, and bots hold their shot for it', () => {
    const robots = [holder(0, 3)];
    const { ctx, mult } = fakeCtx({ remaining: 80, robots: () => robots });
    rules.onInit!(ctx);
    ampScore(ctx, 'blue');
    rules.onTick!(ctx, 1 / 60);
    expect(mult['speaker.blue']).toBeUndefined(); // 1 banked: not yet
    ampScore(ctx, 'blue');
    rules.onTick!(ctx, 1 / 60);
    // Full bank, one robot ready: the HUMAN PLAYER waits for a second, and bots hold the shot.
    expect(mult['speaker.blue']).toBeUndefined();
    expect(rules.botHold!(ctx, 'blue', 'speaker.blue')).toBe(true);
    robots.push(holder(1, 8));
    rules.onTick!(ctx, 1 / 60);
    expect(mult['speaker.blue']).toBe(AMPLIFIED_MULTIPLIER);
    expect(rules.botHold!(ctx, 'blue', 'speaker.blue')).toBe(false);
    expect(rules.botValue!(ctx, 'blue', 'speaker.blue')).toBe(3);
    ampScore(ctx, 'blue'); // during AMPLIFICATION: points, but nothing banked
    (ctx as { time: number }).time += 10.01;
    rules.onTick!(ctx, 1 / 60);
    expect(mult['speaker.blue']).toBe(1);
    expect(rules.botValue!(ctx, 'blue', 'amp.blue')).toBe(AMP_BANK_VALUE); // bank empty again
  });

  it('a full bank waits at most 12 s for a second robot; AMPLIFICATION ends after 4 SPEAKER NOTES', () => {
    const { ctx, mult } = fakeCtx({ remaining: 80, robots: () => [holder(0, 3)] });
    rules.onInit!(ctx);
    ampScore(ctx, 'blue');
    ampScore(ctx, 'blue');
    rules.onTick!(ctx, 1 / 60);
    expect(mult['speaker.blue']).toBeUndefined();
    (ctx as { time: number }).time += 12;
    rules.onTick!(ctx, 1 / 60);
    expect(mult['speaker.blue']).toBe(AMPLIFIED_MULTIPLIER);
    for (let i = 0; i < 3; i++) speakerScore(ctx);
    expect(mult['speaker.blue']).toBe(AMPLIFIED_MULTIPLIER);
    speakerScore(ctx); // the 4th (Team Update 01)
    expect(mult['speaker.blue']).toBe(1);
  });

  it('bots value the AMP only in TELEOP: real autos shot the SPEAKER', () => {
    const { ctx } = fakeCtx({ phase: 'auto', remaining: 10 });
    rules.onInit!(ctx);
    expect(rules.botValue!(ctx, 'blue', 'amp.blue')).toBe(0);
  });

  it('shows the timing of scoring on the HUD: points now, AMPLIFIED countdown, co-op window, TRAPS', () => {
    const shown = new Map<string, { v: unknown; st?: { active?: boolean; until?: number; span?: number } }>();
    const setIndicator = (k: string, v: unknown, st?: { active?: boolean; until?: number; span?: number }) =>
      shown.set(k, { v, st });
    const shooters = [0, 1].map((id) => holder(id, 3 + id));
    const { ctx } = fakeCtx({ phase: 'auto', remaining: 10, setIndicator, robots: () => shooters });
    rules.onInit!(ctx);
    expect(shown.get('blue SPEAKER')!.v).toBe('5 pts (auto)');
    expect(shown.get('red AMP')!.v).toBe('2 pts (auto) · 0/2 to AMPLIFY');
    expect(shown.get('blue Coopertition')!.v).toBe('opens in teleop');
    expect(shown.get('TRAPS')!.v).toBe('open in the last 20 s');
    Object.assign(ctx, { phase: 'teleop', remaining: 120 });
    rules.onTick!(ctx, 1 / 60);
    expect(shown.get('blue SPEAKER')!.v).toBe('2 pts');
    expect(shown.get('blue Coopertition')!.v).toBe('open 30 s · needs 1 AMP NOTE');
    expect(shown.get('blue Coopertition')!.st).toEqual({ active: true, until: 60, span: 45 });
    expect(shown.get('TRAPS')!.v).toBe('open in 1:40');
    ampScore(ctx, 'blue'); // spent on Coopertition
    rules.onTick!(ctx, 1 / 60);
    ampScore(ctx, 'blue');
    ampScore(ctx, 'blue');
    rules.onTick!(ctx, 1 / 60);
    expect(shown.get('blue Coopertition')!.v).toBe('pressed, waiting on the other alliance');
    expect(shown.get('blue SPEAKER')!.v).toBe('AMPLIFIED 5 pts · 10 s');
    expect(shown.get('blue SPEAKER')!.st).toEqual({ active: true, until: 40, span: 10 });
    expect(shown.get('red SPEAKER')!.v).toBe('2 pts');
    Object.assign(ctx, { time: 41, remaining: 15, endgame: true });
    rules.onTick!(ctx, 1 / 60);
    expect(shown.get('blue SPEAKER')!.v).toBe('2 pts');
    expect(shown.get('blue Coopertition')!.v).toBe('pressed, waiting on the other alliance');
    expect(shown.get('red Coopertition')!.v).toBe('closed');
    expect(shown.get('TRAPS')!.v).toBe('OPEN · 5 pts · 15 s');
    expect(shown.get('TRAPS')!.st).toEqual({ active: true, until: 56, span: 20 });
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

describe('2024 Crescendo: specialist roles', () => {
  it('the definition offers its roles, and the validator rejects bad ones', () => {
    expect(validateDefinition(definition).filter((i) => i.level === 'error')).toEqual([]);
    const bad = {
      ...definition,
      roles: [
        { id: 'score', name: 'x', description: 'x', targetWeights: {} },
        { id: 'feeder', name: 'x', description: 'x', targetWeights: { hoop: 1 } },
      ],
      lineups: [
        {
          id: 'l',
          name: 'l',
          description: 'l',
          robots: [
            { archetype: 'allround', role: 'nope' },
            { archetype: 'allround' },
            { archetype: 'allround' },
          ],
        },
      ],
    } as typeof definition;
    const errors = validateDefinition(bad).map((i) => i.message);
    expect(errors).toContain("'score' is reserved");
    expect(errors).toContain("unknown target 'hoop'");
    expect(errors).toContain("unknown role 'nope'");
  });

  it('a SPEAKER-only alliance never uses its AMP in TELEOP; an AMP specialist does', () => {
    const play = (role: string) => [3, 4].reduce((n, seed) => n + playSeed(role, seed), 0);
    const playSeed = (role: string, seed: number) => {
      const m = new Match(definition, {
        seed,
        archetypes: {
          0: 'allround',
          1: 'allround',
          2: 'allround',
          3: 'allround',
          4: 'allround',
          5: 'allround',
        },
      });
      attachBots(m, {
        partners: 'normal',
        opponents: 'normal',
        playerId: null,
        // An AMP specialist with two SPEAKER-only partners: it is the one using the AMP.
        roles: { 0: role, 1: role === 'amp' ? 'speaker' : role, 2: role === 'amp' ? 'speaker' : role },
      });
      return m.runToEnd().blue.targetCounts['amp.blue']?.teleop ?? 0;
    };
    expect(play('speaker')).toBe(0);
    expect(play('amp')).toBeGreaterThan(4);
  });
});

describe('2024 Crescendo: real strategies (passing, feeders, SOURCE defense, robot shares)', () => {
  const pass = (archetype: string, from: { x: number; y: number }, phase: 'auto' | 'teleop' = 'teleop') => {
    const m = new Match({ ...definition, staging: [] }, { seed: 2, archetypes: { 0: archetype } });
    m.start();
    if (phase === 'teleop') while (m.phase !== 'teleop') m.step();
    else m.step();
    const r = m.robots[0]!;
    park(m, [r]);
    teleport(r, from.x, from.y);
    const to = m.passLandings('blue')[0]!;
    r.controller = ctl(() => ({ pass: to }));
    stepFor(m, 4);
    const note = m.pieces.find((p) => p.status === 'field');
    return {
      held: r.held.length,
      landed: note ? Math.hypot(note.position.x - to.x, note.position.y - to.y) : null,
    };
  };

  it('a robot that passes lobs its NOTE onto the landing spot from mid-field in TELEOP', () => {
    const { held, landed } = pass('allround', { x: 8.5, y: 2.0 });
    expect(held).toBe(0);
    expect(landed).not.toBeNull();
    expect(landed!).toBeLessThan(2.5);
  });

  it("doesn't pass from the opponents' WING (G414), in AUTO, or without a passing shooter", () => {
    expect(pass('allround', { x: L - 3, y: 2.0 }).held).toBe(1);
    expect(pass('allround', { x: 8.5, y: 2.0 }, 'auto').held).toBe(1);
    expect(pass('ampbot', { x: 8.5, y: 2.0 }).held).toBe(1);
  });

  it('the KitBot loads only at the SOURCE: it drives into floor NOTES without picking them up', () => {
    const drive = (archetype: string) => {
      const m = new Match({ ...definition, preload: {} }, { seed: 1, archetypes: { 0: archetype } });
      m.start();
      m.step();
      const r = m.robots[0]!;
      park(m, [r]);
      // A WING NOTE, approached intake first (blue robots start facing their own wall, -x).
      const note = m.pieces
        .filter((p) => p.status === 'field')
        .sort((a, b) => a.position.x - b.position.x)[0]!;
      teleport(r, note.position.x + 1.2, note.position.y);
      r.controller = ctl(() => ({ vx: -0.4, intake: true }));
      stepFor(m, 3);
      return r.held.length;
    };
    expect(drive('midbot')).toBe(1);
    expect(drive('kitbot')).toBe(0);
  });

  it('feeders pass NOTES that their scorer picks up', () => {
    const m = new Match(definition, {
      seed: 4,
      archetypes: { 0: 'fullsize', 1: 'allround', 2: 'shooter', 3: 'midbot', 4: 'kitbot', 5: 'starter' },
    });
    attachBots(m, {
      partners: 'normal',
      opponents: 'normal',
      playerId: null,
      roles: { 1: 'feeder', 2: 'feeder' },
    });
    const res = m.runToEnd();
    const by = (id: number) => res.robots[id]!.piecesScored;
    expect(by(0)).toBeGreaterThan(by(1) + by(2)); // the scorer scores what the feeders bring
    expect(by(0)).toBeGreaterThan(10);
  });

  it('a SOURCE defender waits by the opponents’ SOURCE, a goal-side one by their SPEAKER', () => {
    const post = (role: string) => {
      const m = new Match(definition, { seed: 1, archetypes: { 0: 'defender' } });
      const bots = attachBots(m, {
        partners: 'normal',
        opponents: 'normal',
        playerId: null,
        roles: { 0: role },
      });
      m.start();
      while (m.phase !== 'teleop') m.step();
      stepFor(m, 0.5);
      const plan = bots.get(0)!.currentPlan;
      return 'point' in plan ? plan.point : null;
    };
    // Red's SOURCE is in blue's corner (x < 2.5); red's SPEAKER at the red end.
    expect(post('source-defense')!.x).toBeLessThan(6);
    expect(post('defense')!.x).toBeGreaterThan(L - 6);
  });

  it('the random preset deals robot types by their real share and never deals the defender', () => {
    const counts: Record<string, number> = {};
    for (let seed = 1; seed <= 400; seed++) {
      const d = resolveLineup(definition, defaultLineup(), null, dealRng(seed));
      for (const a of Object.values(d.archetypes)) counts[a] = (counts[a] ?? 0) + 1;
    }
    expect(counts['defender']).toBeUndefined();
    // Top seventh split 0.6 / 0.4 between the under-stage and the full-size build.
    const top = (counts['allround'] ?? 0) + (counts['fullsize'] ?? 0);
    expect(top / (counts['shooter'] ?? 1)).toBeGreaterThan(0.8);
    expect(top / (counts['shooter'] ?? 1)).toBeLessThan(1.25);
    expect((counts['allround'] ?? 0) / top).toBeGreaterThan(0.5);
    expect((counts['allround'] ?? 0) / top).toBeLessThan(0.7);
  });
});

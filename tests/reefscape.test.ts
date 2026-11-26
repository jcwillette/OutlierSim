import { beforeAll, describe, expect, it } from 'vitest';
import {
  IDLE,
  Match,
  expandDefinition,
  initPhysics,
  type AllianceSummary,
  type Robot,
  type RobotCommand,
} from '../src/engine/sim/index.ts';
import { definition } from '../src/games/2025-reefscape/definition.ts';
import {
  ALGAE_HIGH,
  BARGE_ZONE,
  CY,
  FACES,
  L,
  PROCESSOR_X,
  REEF_C,
  SCORE_R0,
  SCORE_R1,
  W,
  branchId,
  faceAngle,
  reefPoint,
} from '../src/games/2025-reefscape/layout.ts';

beforeAll(async () => {
  await initPhysics();
});

const ctl = (f: (m: Match, r: Robot) => Partial<RobotCommand>) => ({
  command: (m: Match, r: Robot) => ({ ...IDLE, ...f(m, r) }),
});
const stepFor = (m: Match, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) m.step();
};
const teleport = (r: Robot, x: number, y: number, yaw?: number) => {
  r.setPosition({ x, y, z: r.archetype.frame.height / 2 + 0.01 });
  r.setVelocity({ x: 0, y: 0, z: 0 });
  if (yaw !== undefined) r.setYaw(yaw);
};
/** Everyone else out of the way, against the guardrails near mid-field on their own side. */
const park = (m: Match, keep: Robot[]) => {
  for (const r of m.robots)
    if (!keep.includes(r)) teleport(r, r.alliance === 'blue' ? 6.9 : L - 6.9, 2.2 + (r.id % 3) * 1.8);
};
/** A match in TELEOP with no staged pieces and no preloads. */
function teleopMatch(archetypes: Record<number, string> = {}, preload: Record<string, number> = {}): Match {
  // The test drives these robots itself: no drive-team line-up.
  const m = new Match(
    { ...definition, staging: [], preload },
    { seed: 3, archetypes, alignExempt: [0, 1, 2, 3, 4, 5] },
  );
  m.start();
  while (m.phase !== 'teleop') m.step();
  return m;
}
/** Stand `r` in front of REEF face k (blue), facing the REEF. */
const atFace = (r: Robot, k: number) => {
  const p = reefPoint(k, (SCORE_R0 + SCORE_R1) / 2);
  teleport(r, p.x, p.y, faceAngle(k) + Math.PI);
};

describe('2025 Reefscape: field', () => {
  const x = expandDefinition(definition);
  it('is rotationally symmetric: each PROCESSOR on its own half, on opposite guardrails', () => {
    const zone = (a: string) => x.targets.find((t) => t.id === `processor.${a}`)!.place!.zone;
    const c = (z: ReturnType<typeof zone>) => {
      if (z.kind !== 'rect') throw new Error('rect');
      return { x: (z.min.x + z.max.x) / 2, y: (z.min.y + z.max.y) / 2 };
    };
    expect(c(zone('blue')).x).toBeCloseTo(PROCESSOR_X, 6);
    expect(c(zone('blue')).y).toBeLessThan(1);
    expect(c(zone('red')).x).toBeCloseTo(L - PROCESSOR_X, 6);
    expect(c(zone('red')).y).toBeGreaterThan(W - 1);
  });

  it('places the REEF from the AprilTag table (12 ft from the ALLIANCE WALL to its near face)', () => {
    expect(REEF_C.x - 0.832).toBeCloseTo(144 * 0.0254, 2);
    expect(REEF_C.y).toBeCloseTo(CY, 6);
  });

  it('every robot type drives under the BARGE (5 ft 2 in truss)', () => {
    for (const a of definition.archetypes) expect(a.frame.height).toBeLessThan(62 * 0.0254);
  });
});

describe('2025 Reefscape: REEF ALGAE', () => {
  it('starts with L3 closed on every face, L2 on the low-ALGAE faces, and L4 open', () => {
    const m = teleopMatch();
    const open = (id: string) => m.targets.get(`${id}.blue`)!.enabled;
    for (const k of FACES) {
      expect(open(branchId('L4', k, 1))).toBe(true);
      expect(open(branchId('L3', k, -1))).toBe(false);
      expect(open(branchId('L2', k, 1))).toBe(ALGAE_HIGH(k));
    }
  });

  it('taking a face’s ALGAE opens its BRANCHES; a short arm reaches only the low ALGAE', () => {
    const m = teleopMatch({ 0: 'elevator', 1: 'l2-scorer' });
    const [tall, short] = [m.robots[0]!, m.robots[1]!];
    park(m, [tall, short]);
    const high = FACES.find((k) => ALGAE_HIGH(k))!;
    const low = FACES.find((k) => !ALGAE_HIGH(k))!;
    atFace(tall, high);
    teleport(short, 2, 7.5);
    tall.controller = ctl(() => ({ intake: true }));
    stepFor(m, 1.5);
    expect(tall.held).toContain('algae');
    expect(m.targets.get(`${branchId('L3', high, 1)}.blue`)!.enabled).toBe(true);
    // The trough-and-L2 robot can't reach the high position...
    const high2 = FACES.find((k) => ALGAE_HIGH(k) && k !== high)!;
    atFace(short, high2);
    short.controller = ctl(() => ({ intake: true }));
    stepFor(m, 1.5);
    expect(short.held).not.toContain('algae');
    // ...but takes the low one, which opens L2 and L3 there.
    atFace(short, low);
    stepFor(m, 1.5);
    expect(short.held).toContain('algae');
    expect(m.targets.get(`${branchId('L2', low, -1)}.blue`)!.enabled).toBe(true);
    expect(m.targets.get(`${branchId('L3', low, -1)}.blue`)!.enabled).toBe(true);
  });
});

describe('2025 Reefscape: PROCESSOR and the HUMAN PLAYER', () => {
  /** `r` (preloaded with an ALGAE) scores it in the blue PROCESSOR. */
  const process = (m: Match, r: Robot) => {
    expect(r.held).toEqual(['algae']);
    teleport(r, PROCESSOR_X, 0.6, -Math.PI / 2);
    r.controller = ctl(() => ({ score: true }));
    stepFor(m, 1.5);
    r.controller = ctl(() => ({}));
  };

  it('a processed ALGAE scores 6 and goes to the opposing HUMAN PLAYER, whose good throw lands in their NET', () => {
    const m = teleopMatch({ 0: 'elevator' }, { algae: 1 });
    const r = m.robots[0]!;
    park(m, [r]);
    (m as unknown as { random: () => number }).random = () => 0; // the throw goes in
    process(m, r);
    expect(m.targets.get('processor.blue')!.count).toBe(1);
    expect(m.summary('blue').sources['processor.blue']).toBe(6);
    stepFor(m, 5);
    expect(m.targets.get('net.red')!.count).toBe(1);
    expect(m.targets.get('net.blue')!.count).toBe(0);
    expect(m.summary('red').sources['net.red']).toBe(4);
  });

  it('a missed throw falls onto the FIELD as a loose ALGAE', () => {
    const m = teleopMatch({ 0: 'elevator' }, { algae: 1 });
    const r = m.robots[0]!;
    park(m, [r]);
    (m as unknown as { random: () => number }).random = () => 0.99;
    process(m, r);
    stepFor(m, 6);
    expect(m.targets.get('net.red')!.count).toBe(0);
    const loose = m.pieces.filter((p) => p.type.id === 'algae' && p.status === 'field');
    expect(loose.length).toBe(1);
    expect(loose[0]!.position.z).toBeLessThan(0.3);
    // Short of red's NET, on the thrower's side of the BARGE (blue's half: red's HUMAN PLAYER
    // stands behind blue's PROCESSOR).
    expect(loose[0]!.position.x).toBeGreaterThan(5);
    expect(loose[0]!.position.x).toBeLessThan(BARGE_ZONE.min.x);
  });

  it('the HUMAN PLAYER doesn’t throw in AUTO (G404)', () => {
    const m = new Match(
      { ...definition, staging: [], preload: { algae: 1 } },
      { seed: 1, archetypes: { 0: 'elevator' } },
    );
    m.start();
    const r = m.robots[0]!;
    park(m, [r]);
    process(m, r);
    stepFor(m, 6);
    expect(m.phase).toBe('auto');
    expect(m.pieces.filter((p) => p.status === 'field').length).toBe(0);
  });
});

describe('2025 Reefscape: G421 (one robot at a time on the opponent’s side)', () => {
  it('a second robot fully beyond the BARGE ZONES draws a MINOR FOUL, then a MAJOR FOUL every 3 s', () => {
    const m = teleopMatch();
    park(m, []);
    const far = BARGE_ZONE.max.x + 1.5;
    teleport(m.robots[0]!, far, 1.5);
    stepFor(m, 1);
    expect(m.summary('blue').fouls).toEqual({ minor: 0, major: 0 });
    teleport(m.robots[1]!, far + 1.5, 6.5);
    stepFor(m, 3.5);
    expect(m.summary('blue').fouls).toEqual({ minor: 1, major: 1 });
    teleport(m.robots[1]!, 3, 6.5);
    stepFor(m, 4);
    expect(m.summary('blue').fouls).toEqual({ minor: 1, major: 1 });
  });
});

describe('2025 Reefscape: ranking points', () => {
  const bonus = (id: string) => {
    const b = definition.rankingPoints.bonuses.find((x) => x.id === id)!;
    if (b.kind !== 'custom') throw new Error(`${id} is custom`);
    return b.check;
  };
  const counts = (perLevel: number[], processor = 0, auto = 0) => {
    const tc: Record<string, { auto: number; teleop: number }> = {};
    perLevel.forEach((n, i) => {
      if (n) tc[`l${i + 1}-0${i ? 'r' : ''}.blue`] = { auto: 0, teleop: n };
    });
    if (auto) tc['l4-1r.blue'] = { auto, teleop: 0 };
    if (processor) tc['processor.blue'] = { auto: 0, teleop: processor };
    return tc;
  };
  const s = (
    o: {
      levels?: number[];
      processor?: number;
      sources?: Record<string, number>;
      foulCalls?: Record<string, number>;
      auto?: number;
      alliance?: 'blue' | 'red';
    } = {},
  ) =>
    ({
      alliance: 'blue',
      targetCounts: counts(o.levels ?? [0, 0, 0, 0], o.processor, o.auto),
      sources: o.sources ?? {},
      foulCalls: o.foulCalls ?? {},
    }) as unknown as AllianceSummary;

  it('CORAL RP: 5 on every level, or on 3 levels once both alliances process 2 ALGAE', () => {
    const coral = bonus('coral');
    expect(coral(s({ levels: [5, 5, 5, 5] }), s())).toBe(true);
    expect(coral(s({ levels: [5, 5, 5, 4] }), s())).toBe(false);
    const oppCoop = { ...s({ processor: 2 }), alliance: 'red' } as AllianceSummary;
    (oppCoop as unknown as { targetCounts: Record<string, unknown> }).targetCounts = {
      'processor.red': { auto: 0, teleop: 2 },
    };
    expect(coral(s({ levels: [5, 0, 5, 5], processor: 2 }), oppCoop)).toBe(true);
    expect(coral(s({ levels: [5, 0, 5, 5], processor: 1 }), oppCoop)).toBe(false);
  });

  it('AUTO RP: all three robots LEAVE and a CORAL is scored in AUTO', () => {
    const auto = bonus('auto');
    expect(auto(s({ sources: { 'leave.blue': 9 }, auto: 1 }), s())).toBe(true);
    expect(auto(s({ sources: { 'leave.blue': 6 }, auto: 2 }), s())).toBe(false);
    expect(auto(s({ sources: { 'leave.blue': 9 } }), s())).toBe(false);
  });

  it('BARGE RP: 14 BARGE points, or an opponent G428 call', () => {
    const barge = bonus('barge');
    expect(barge(s({ sources: { 'deep.blue': 12, 'park.blue': 2 } }), s())).toBe(true);
    expect(barge(s({ sources: { 'shallow.blue': 6, 'park.blue': 4 } }), s())).toBe(false);
    expect(
      barge(s(), s({ foulCalls: { 'G428 contact with an opponent on its CAGE in the last 20 s': 1 } })),
    ).toBe(true);
  });
});

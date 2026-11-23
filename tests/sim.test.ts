import { beforeAll, describe, expect, it } from 'vitest';
import {
  IDLE,
  Match,
  expandDefinition,
  initPhysics,
  launchPitch,
  validateDefinition,
  type Robot,
  type RobotCommand,
} from '../src/engine/sim/index.ts';
import { miniGame } from './fixtures/mini-game.ts';

beforeAll(async () => {
  await initPhysics();
});

const ctl = (f: (m: Match, r: Robot) => Partial<RobotCommand>) => ({
  command: (m: Match, r: Robot) => ({ ...IDLE, ...f(m, r) }),
});

/** Steer robot toward (x, y) at full speed until within tolerance. */
const goTo = (r: Robot, x: number, y: number): Partial<RobotCommand> => {
  const dx = x - r.x;
  const dy = y - r.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.05) return {};
  const s = Math.min(1, d / 0.5);
  return { vx: (dx / d) * s, vy: (dy / d) * s };
};

const stepFor = (m: Match, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) m.step();
};

describe('validateDefinition', () => {
  it('accepts the fixture', () => {
    expect(validateDefinition(miniGame()).filter((i) => i.level === 'error')).toEqual([]);
  });
  it('rejects unknown piece references and bad default archetype', () => {
    const issues = validateDefinition(miniGame({ preload: { cube: 1 }, defaultArchetype: 'nope' }));
    const msgs = issues.filter((i) => i.level === 'error').map((i) => i.message);
    expect(msgs).toContain("unknown piece type 'cube'");
    expect(msgs.some((m) => m.includes("'nope'"))).toBe(true);
  });
});

describe('expandDefinition', () => {
  it('rotational symmetry maps blue to red through the field center', () => {
    const x = expandDefinition(miniGame());
    const red = x.targets.find((t) => t.id === 'goal.red')!;
    expect(red.aperture!.center).toEqual({ x: 14, y: 2, z: 2 });
    expect(x.startPoses.red[0]!.x).toBeCloseTo(15);
    expect(x.startPoses.red[0]!.y).toBeCloseTo(6);
    expect(Math.abs(x.startPoses.red[0]!.yaw)).toBeCloseTo(Math.PI);
    expect(x.staged).toHaveLength(4);
  });
  it('mirror symmetry keeps y', () => {
    const def = miniGame();
    def.field.symmetry = 'mirror';
    const x = expandDefinition(def);
    expect(x.targets.find((t) => t.id === 'goal.red')!.aperture!.center).toEqual({ x: 14, y: 6, z: 2 });
    const shelf = x.targets.find((t) => t.id === 'shelf.red')!.place!.zone;
    expect(shelf).toEqual({ kind: 'rect', min: { x: 14.5, y: 0.5 }, max: { x: 15.5, y: 1.5 } });
  });
});

describe('ballistics', () => {
  it('launch pitch reaches the target height at the target distance', () => {
    const v = 9;
    const d = 4;
    const h = 1.5;
    for (const arc of ['high', 'low'] as const) {
      const p = launchPitch(v, d, h, arc)!;
      const t = d / (v * Math.cos(p));
      expect(v * Math.sin(p) * t - 0.5 * 9.81 * t * t).toBeCloseTo(h, 5);
    }
    expect(launchPitch(3, 10, 2, 'high')).toBeNull();
  });
});

describe('Match', () => {
  it('runs the clock through auto, transition, teleop, post', () => {
    const m = new Match(miniGame());
    const phases = new Set<string>();
    m.start();
    while (!m.isOver) {
      m.step();
      phases.add(m.phase);
    }
    expect([...phases]).toEqual(['auto', 'transition', 'teleop', 'post']);
    expect(m.time).toBeCloseTo(153, 1);
  });

  it('drives toward max speed under accel limits', () => {
    const m = new Match(miniGame());
    m.robots[0]!.controller = ctl(() => ({ vx: 1 }));
    m.start();
    stepFor(m, 0.25);
    const early = m.robots[0]!.speed;
    stepFor(m, 0.5);
    expect(early).toBeLessThan(2.5);
    expect(m.robots[0]!.speed).toBeGreaterThan(3.5);
    expect(m.robots[0]!.speed).toBeLessThan(4.2);
  });

  it('intakes a piece it drives into', () => {
    const m = new Match(miniGame());
    const r = m.robots[0]!;
    r.controller = ctl((_, rr) => ({ ...goTo(rr, 3, 2), intake: true }));
    m.start();
    stepFor(m, 2);
    expect(r.held).toEqual(['ball', 'ball']);
    expect(r.stats.intakes).toBe(1);
  });

  it('places at a target for auto points', () => {
    const m = new Match(miniGame());
    const r = m.robots[0]!;
    r.controller = ctl((_, rr) => ({ ...goTo(rr, 1, 1), score: true, targetId: 'shelf.blue' }));
    m.start();
    stepFor(m, 2);
    expect(m.ledger.bySource('blue')['shelf.blue']).toBe(3);
    expect(r.held).toEqual([]);
  });

  it('shoots into a top-entry aperture', () => {
    const m = new Match(miniGame());
    const r = m.robots[2]!; // starts at (1, 6), goal at (2, 6, 2)
    r.controller = ctl((_, rr) => ({ ...goTo(rr, 0.8, 4), score: true }));
    m.start();
    stepFor(m, 4);
    expect(r.stats.shotsTaken).toBe(1);
    expect(m.ledger.bySource('blue')['goal.blue']).toBe(5);
  });

  it('awards leave points at end of auto', () => {
    const m = new Match(miniGame());
    m.robots[0]!.controller = ctl((_, rr) => goTo(rr, 3, 1));
    m.start();
    stepFor(m, 16);
    expect(m.ledger.bySource('blue')['leave.blue']).toBe(3);
    expect(m.ledger.bySource('red')['leave.red']).toBeUndefined();
  });

  it('endgame action only in the endgame window, then locks the robot', () => {
    const m = new Match(miniGame());
    const r = m.robots[1]!; // starts at (1,4), bar zone at (1.2,4)
    r.controller = ctl(() => ({ endgame: true }));
    m.start();
    stepFor(m, 20);
    expect(r.action).toBeNull();
    while (!m.isEndgame) m.step();
    stepFor(m, 2.2);
    expect(r.endgameDone?.actionId).toBe('bar.blue');
    expect(m.ledger.breakdown('blue').endgame).toBe(10);
  });

  it('computes win and bonus RPs and conserves pieces', () => {
    const m = new Match(miniGame());
    m.robots[0]!.controller = ctl((_, rr) => ({ ...goTo(rr, 1, 1), score: true, targetId: 'shelf.blue' }));
    m.robots[2]!.controller = ctl((_, rr) => ({ ...goTo(rr, 0.8, 4), score: true }));
    const res = m.runToEnd();
    expect(res.blue.won).toBe(true);
    expect(res.blue.rpBreakdown).toEqual({ win: 3, twoPieces: 1 });
    expect(res.red.rp).toBe(0);
    expect(m.pieces).toHaveLength(4 + 6);
  });

  it('is deterministic for a given seed', () => {
    const run = () => {
      const m = new Match(miniGame(), { seed: 42 });
      m.robots.forEach((r) => (r.controller = ctl((_, rr) => ({ ...goTo(rr, 8, 4), intake: true }))));
      m.start();
      stepFor(m, 5);
      return m.robots.map((r) => [r.x.toFixed(6), r.y.toFixed(6)]);
    };
    expect(run()).toEqual(run());
  });

  it('rules hooks can award fouls and override points', () => {
    const def = miniGame({
      rules: {
        onScore: (_ctx, ev) => ev.points * 10,
        onPhaseChange: (ctx, p) => {
          if (p === 'teleop') ctx.foul('red', 'major', 'test');
        },
      },
    });
    const m = new Match(def);
    m.robots[0]!.controller = ctl((_, rr) => ({ ...goTo(rr, 1, 1), score: true, targetId: 'shelf.blue' }));
    m.start();
    stepFor(m, 19);
    expect(m.ledger.bySource('blue')['shelf.blue']).toBe(30);
    expect(m.ledger.breakdown('blue').penalty).toBe(6);
  });
});

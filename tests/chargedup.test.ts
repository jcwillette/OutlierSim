import { beforeAll, describe, expect, it } from 'vitest';
import {
  IDLE,
  Match,
  expandDefinition,
  initPhysics,
  type Robot,
  type RobotCommand,
  type RobotInfo,
  type RulesContext,
} from '../src/engine/sim/index.ts';
import { definition } from '../src/games/2023-chargedup/definition.ts';
import { countLinks, coopPieces } from '../src/games/2023-chargedup/layout.ts';
import { rules } from '../src/games/2023-chargedup/rules.ts';

beforeAll(async () => {
  await initPhysics();
});

const ctl = (f: (m: Match, r: Robot) => Partial<RobotCommand>) => ({
  command: (m: Match, r: Robot) => ({ ...IDLE, ...f(m, r) }),
});
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
const teleport = (r: Robot, x: number, y: number, z = r.archetype.frame.height / 2 + 0.01) => {
  r.setPosition({ x, y, z });
  r.setVelocity({ x: 0, y: 0, z: 0 });
};

describe('2023 Charged Up: layout helpers', () => {
  const row = (s: string) => [...s].map((c) => c === 'x');
  it('counts links as non-overlapping triples of adjacent filled nodes', () => {
    expect(countLinks([row('xxx......'), row('xxxxx....'), row('xxxxxx.xx')])).toBe(1 + 1 + 2);
    expect(countLinks([row('xx.xx.xx.'), row('.........'), row('xxxxxxxxx')])).toBe(3);
  });
  it('counts pieces on the co-op grid (columns 4-6)', () => {
    expect(coopPieces([row('...xxx...'), row('...x.....'), row('xxx......')])).toBe(4);
  });
});

describe('2023 Charged Up: engine features it relies on', () => {
  it('mirrors node display points and keeps both grids on the scoring-table side', () => {
    const x = expandDefinition(definition);
    const blue = x.targets.find((t) => t.id === 'high-1.blue')!;
    const red = x.targets.find((t) => t.id === 'high-1.red')!;
    expect(red.display!.x).toBeCloseTo(definition.field.length - blue.display!.x, 6);
    expect(red.display!.y).toBeCloseTo(blue.display!.y, 6);
  });

  it('a robot drives over the Charge Station ramp, engages in auto, and is released for teleop', () => {
    const m = new Match(definition);
    const r = m.robots[1]!; // blue station 2 starts in front of the Charge Station
    r.controller = ctl((mm, rr) => ({ ...goTo(rr, 3.94, 2.745), endgame: mm.phase === 'auto' }));
    m.start();
    stepFor(m, 15);
    expect(r.endgameDone?.actionId).toBe('auto-engage.blue');
    expect(r.z).toBeGreaterThan(r.archetype.frame.height / 2 + 0.1); // on top
    expect(m.ledger.bySource('blue')['auto-engage.blue']).toBe(12);
    stepFor(m, 3.5); // into teleop
    expect(r.endgameDone).toBeNull();
    r.controller = ctl(() => ({ vx: 1 }));
    stepFor(m, 1);
    expect(r.speed).toBeGreaterThan(0.5);
  });

  it.each(definition.archetypes.map((a) => a.id))(
    'a %s robot drives onto the Charge Station from a slow approach (no run-up needed)',
    (id) => {
      const m = new Match(definition, { archetypes: { 1: id } });
      const r = m.robots[1]!; // blue station 2 starts in front of the Charge Station
      // The bots' ramp speed (1.5 m/s), straight at the station until its center.
      const v = Math.min(1, 1.5 / r.archetype.drive.maxSpeed);
      r.controller = ctl((_mm, rr) => ({ vx: rr.x < 3.94 ? v : 0 }));
      m.start();
      stepFor(m, 4);
      expect(r.x).toBeGreaterThan(3.8);
      expect(r.z).toBeGreaterThan(r.archetype.frame.height / 2 + 0.2); // on the 0.23 m top
    },
  );

  it('shelf stations need a tall intake and take handoffSec to load', () => {
    const def = { ...definition, preload: {} };
    const m = new Match(def, { archetypes: { 0: 'elevator', 1: 'kitbot' } });
    const [tall, low] = [m.robots[0]!, m.robots[1]!];
    const st = m.game.stations.find((s) => s.id === 'double-cone.blue')!;
    const zx = (st.zone as { min: { x: number } }).min.x + 0.3;
    const zy = (st.zone as { min: { y: number } }).min.y + 0.4;
    m.start();
    stepFor(m, 18.5);
    teleport(tall, zx, zy);
    teleport(low, zx, zy - 1.6); // cube shelf zone
    tall.controller = ctl(() => ({ intake: true }));
    low.controller = ctl(() => ({ intake: true }));
    stepFor(m, 1.0);
    expect(tall.held).toEqual([]); // still lining up
    stepFor(m, 0.7);
    expect(tall.held).toEqual(['cone']);
    expect(low.held).toEqual([]); // floor-only intake can't reach the 0.95 m shelf
    expect(m.stationsFor(low)).toEqual([]);
  });

  it('one robot at a time on the Charge Station, then points for each', () => {
    const m = new Match(definition);
    m.start();
    while (!m.isEndgame) m.step();
    const [a, b] = [m.robots[0]!, m.robots[1]!];
    const [s0, s1] = m.game.endgame
      .find((e) => e.id === 'engage.blue')!
      .zones.map((z) => {
        const r = z as { min: { x: number; y: number }; max: { x: number; y: number } };
        return { x: (r.min.x + r.max.x) / 2, y: (r.min.y + r.max.y) / 2 };
      });
    teleport(a, s0!.x, s0!.y, a.archetype.frame.height / 2 + 0.2);
    teleport(b, s1!.x, s1!.y, b.archetype.frame.height / 2 + 0.2);
    stepFor(m, 0.3);
    a.controller = ctl(() => ({ endgame: true }));
    stepFor(m, 0.2);
    expect(a.action?.kind).toBe('endgame');
    expect(m.availableEndgame(b)).toEqual([]); // waiting for the station to settle
    stepFor(m, 4.5);
    expect(a.endgameDone).not.toBeNull();
    expect(m.availableEndgame(b).length).toBeGreaterThan(0);
  });

  it('an endgame attempt fails if the robot is pushed off its spot (no points, not frozen)', () => {
    const m = new Match(definition);
    m.start();
    while (!m.isEndgame) m.step();
    const r = m.robots[1]!;
    teleport(r, 3.94, 2.745, r.archetype.frame.height / 2 + 0.2);
    stepFor(m, 0.3);
    r.controller = ctl(() => ({ endgame: true }));
    stepFor(m, 0.2);
    expect(r.action?.kind).toBe('endgame');
    r.controller = ctl(() => ({}));
    teleport(r, 6.5, 2.745); // shoved off the station mid-balance
    stepFor(m, 6);
    expect(r.action).toBeNull();
    expect(r.endgameDone).toBeNull();
    expect(m.ledger.bySource('blue')['engage.blue']).toBeUndefined();
  });

  it('exposes points by source in the alliance summary', () => {
    const m = new Match(definition);
    m.ledger.add({
      time: 0,
      alliance: 'blue',
      category: 'endgame',
      points: 6,
      source: 'dock.blue',
      robotId: 0,
    });
    expect(m.summary('blue').sources['dock.blue']).toBe(6);
  });
});

describe('2023 Charged Up: rules', () => {
  const fakeCtx = (robots: Array<Partial<RobotInfo>>, doneAt: Record<number, number>) => {
    const added: Array<[string, string, number, string]> = [];
    const ctx = {
      vars: { doneAt } as Record<string, unknown>,
      time: 153,
      phase: 'post',
      robots: () => robots as RobotInfo[],
      targetCount: () => 0,
      addPoints: (a: string, c: string, p: number, s: string) => added.push([a, c, p, s]),
      announce: () => {},
    } as unknown as RulesContext;
    return { ctx, added };
  };

  it('a level station (balancer got on last) makes docked partners engaged', () => {
    const { ctx, added } = fakeCtx(
      [
        { id: 0, alliance: 'blue', endgameAction: 'dock.blue' },
        { id: 1, alliance: 'blue', endgameAction: 'engage.blue' },
      ],
      { 0: 140, 1: 148 },
    );
    rules.onMatchEnd!(ctx);
    expect(added).toEqual([['blue', 'endgame', 4, 'engaged-partner']]);
  });

  it('a dock-only robot climbing on last tips the station: nobody is engaged', () => {
    const { ctx, added } = fakeCtx(
      [
        { id: 0, alliance: 'blue', endgameAction: 'dock.blue' },
        { id: 1, alliance: 'blue', endgameAction: 'engage.blue' },
      ],
      { 0: 150, 1: 145 },
    );
    rules.onMatchEnd!(ctx);
    expect(added).toEqual([['blue', 'endgame', -4, 'station-tipped']]);
  });

  it('declares G207 and G202 for the engine to call: contact by a robot partly in the opponent zone', () => {
    expect(definition.fouls.contact?.map((c) => c.id)).toEqual(['G207']);
    expect(definition.fouls.pinning?.id).toBe('G202');
    const m = new Match({ ...definition, staging: [], preload: {} }, { seed: 1 });
    m.start();
    m.step();
    const [blue, red] = [m.robots[0]!, m.robots[3]!];
    // Red's LOADING ZONE is at the blue end along the far guardrail (y > 6.75 at x 3.36-6.71).
    // A blue robot reaching 5 cm into it touches a red robot inside it: FOUL on blue (any part counts).
    const half = blue.archetype.frame.width / 2;
    teleport(blue, 5.0, 6.75 - half + 0.05);
    teleport(red, 5.0, 6.75 + 0.05 + half + 0.005);
    for (const r of m.robots) if (r !== blue && r !== red) teleport(r, 8, 1 + r.id * 1.2);
    stepFor(m, 0.1);
    expect(m.fouls.blue.minor).toBe(1);
    expect(m.ledger.entries.at(-1)!.source).toBe(
      "foul:G207 contact in the opponent's loading zone or community",
    );
  });

  it('only one auto Charge Station robot counts per alliance', () => {
    const { ctx, added } = fakeCtx(
      [
        { id: 0, alliance: 'blue', endgameAction: 'auto-dock.blue' },
        { id: 1, alliance: 'blue', endgameAction: 'auto-engage.blue' },
      ],
      {},
    );
    rules.onPhaseChange!(ctx, 'teleop');
    expect(added).toEqual([['blue', 'auto', -8, 'auto-charge-limit']]);
  });
});

describe('2023 Charged Up: the player picks the row to place on', () => {
  it('Space places on the best row; V switches to the next one at the same column', async () => {
    const { PlayerController } = await import('../src/engine/input/input.ts');
    const m = new Match({ ...definition, preload: { cone: 1 } }, { seed: 1, archetypes: { 0: 'elevator' } });
    const r = m.robots[0]!;
    m.start();
    m.step();
    // In front of column 1 (a cone column), facing the grid.
    r.setPosition({ x: 1.43 + 0.5, y: 2.75 - 4 * 0.559, z: r.archetype.frame.height / 2 + 0.01 });
    r.body.setRotation({ x: 0, y: 0, z: 1, w: 0 }, true); // yaw = pi
    m.step();
    const input = { autoIntake: false } as unknown as ConstructorParameters<typeof PlayerController>[0];
    const pc = new PlayerController(input, () => 0);
    pc.latest = { ...pc.latest, score: true };
    expect(m.placeOptions(r).map((o) => o.target.baseId)).toEqual(['high-1', 'mid-1', 'hybrid-1']);
    expect(pc.placeChoice(m, r)?.target.baseId).toBe('high-1');
    expect(pc.command(m, r).targetId).toBeUndefined(); // the default: best row
    pc.placeRank++;
    expect(pc.placeChoice(m, r)?.target.baseId).toBe('mid-1');
    expect(pc.command(m, r).targetId).toBe('mid-1.blue');
    pc.placeRank += 2; // wraps around
    expect(pc.placeChoice(m, r)?.target.baseId).toBe('high-1');
  });
});

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

  const g207 = (rammed: boolean) => {
    const fouls: string[] = [];
    const ctx = {
      vars: {} as Record<string, unknown>,
      time: 50,
      phase: 'teleop',
      robots: () =>
        [
          // blue robot inside red's LOADING ZONE (at the blue end, high y), touching a red robot
          { id: 0, alliance: 'blue', x: 2.0, y: 7.0, endgameAction: null, vx: rammed ? 0 : 1, vy: 0 },
          { id: 3, alliance: 'red', x: 2.7, y: 7.0, endgameAction: null, vx: rammed ? -2 : 0, vy: 0 },
        ] as RobotInfo[],
      targetCount: () => 0,
      setTargetEnabled: () => {},
      setIndicator: () => {},
      announce: () => {},
      foul: (against: string) => fouls.push(against),
    } as unknown as RulesContext;
    rules.onTick!(ctx, 1 / 60);
    rules.onTick!(ctx, 1 / 60); // same contact moments later: not another foul
    return fouls;
  };
  it('G207: contact inside the opponent loading zone is a foul on the intruder', () => {
    expect(g207(false)).toEqual(['blue']);
  });
  it('G201: no G207 foul when the zone owner drove into the intruder', () => {
    expect(g207(true)).toEqual([]);
  });

  it('G202: pinning a robot that is trying to move is a FOUL at 5 s, then a TECH FOUL every 5 s', () => {
    const pin = (victimTrying: boolean, seconds: number) => {
      const fouls: string[] = [];
      const ctx = {
        vars: {} as Record<string, unknown>,
        time: 50,
        phase: 'teleop',
        robots: () =>
          [
            // blue pushes (+x) into red, which is stuck mid-field (no protected zone involved)
            { id: 0, alliance: 'blue', x: 8.0, y: 2.0, endgameAction: null, vx: 0, vy: 0, cmdX: 1, cmdY: 0 },
            {
              id: 3,
              alliance: 'red',
              x: 8.85,
              y: 2.0,
              endgameAction: null,
              vx: 0,
              vy: 0,
              cmdX: 0,
              cmdY: victimTrying ? 1 : 0,
            },
          ] as RobotInfo[],
        targetCount: () => 0,
        setTargetEnabled: () => {},
        setIndicator: () => {},
        announce: () => {},
        foul: (against: string, severity: string) => fouls.push(`${against}:${severity}`),
      } as unknown as RulesContext;
      for (let t = 0; t < seconds; t += 1 / 60) rules.onTick!(ctx, 1 / 60);
      return fouls;
    };
    expect(pin(true, 4.5)).toEqual([]);
    expect(pin(true, 5.5)).toEqual(['blue:minor']);
    expect(pin(true, 10.5)).toEqual(['blue:minor', 'blue:major']);
    expect(pin(false, 10.5)).toEqual([]); // red wasn't trying to move: not a pin
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

import { beforeAll, describe, expect, it } from 'vitest';
import {
  IDLE,
  Match,
  initPhysics,
  validateDefinition,
  type ContactFoulRule,
  type GameDefinition,
  type Region2D,
  type Robot,
  type RobotCommand,
} from '../src/engine/sim/index.ts';
import { footprint, footprintInside, footprintOverlaps, pointInRegion } from '../src/engine/sim/math.ts';
import { CONTACT_GAP, robotGap, robotInZone } from '../src/engine/sim/referee.ts';
import { miniGame } from './fixtures/mini-game.ts';

/** Fouls the engine calls from `GameDefinition.fouls` (protected-zone contact, pinning). */

beforeAll(async () => {
  await initPhysics();
});

const ctl = (f: (m: Match, r: Robot) => Partial<RobotCommand>) => ({
  command: (m: Match, r: Robot) => ({ ...IDLE, ...f(m, r) }),
});
const stepFor = (m: Match, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) m.step();
};
const put = (r: Robot, x: number, y: number, yaw = 0) => {
  r.setPosition({ x, y, z: r.archetype.frame.height / 2 + 0.005 });
  r.setVelocity({ x: 0, y: 0, z: 0 });
  r.body.setRotation({ x: 0, y: 0, z: Math.sin(yaw / 2), w: Math.cos(yaw / 2) }, true);
  r.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
};

/** Mini game with a blue loading zone at x 6-10, y 0-3 (red's copy at x 6-10, y 5-8, rotational). */
const withFouls = (contact: Partial<ContactFoulRule> = {}, pinning = true): GameDefinition => {
  const base = miniGame();
  return {
    ...base,
    field: {
      ...base.field,
      zones: [
        ...base.field.zones,
        { id: 'load', side: 'blue', region: { kind: 'rect', min: { x: 6, y: 0 }, max: { x: 10, y: 3 } } },
      ],
    },
    // No staged pieces or preload, so nothing but the robots moves.
    staging: [],
    preload: {},
    // A robot that can't push anything (a pinned robot that tries but can't move).
    archetypes: [
      ...base.archetypes,
      { ...base.archetypes[0]!, id: 'weak', drive: { maxSpeed: 4, maxAccel: 0.01, maxOmega: 6 } },
    ],
    fouls: {
      minor: 2,
      major: 6,
      contact: [
        {
          id: 'G1',
          name: 'contact in the opponent loading zone',
          zones: ['load'],
          inside: 'intruder',
          severity: 'minor',
          source: 'test',
          ...contact,
        },
      ],
      ...(pinning ? { pinning: { id: 'G2', source: 'test' } } : {}),
    },
  };
};

/** Start a match with every robot parked out of the way (red 1 weak, if the game has it). */
const setup = (def: GameDefinition) => {
  const weak = def.archetypes.some((a) => a.id === 'weak');
  const m = new Match(def, { seed: 1, ...(weak ? { archetypes: { 3: 'weak' } } : {}) });
  m.start();
  m.robots.forEach((r, i) => put(r, 1 + i * 2.5, 7.4));
  m.step();
  return m;
};

const fouls = (m: Match) => m.ledger.entries.filter((e) => e.source.startsWith('foul:')).map((e) => e.source);

describe('robot contact geometry', () => {
  it('measures the gap between bumper boxes, rotated or not', () => {
    const m = setup(miniGame());
    const [a, b] = [m.robots[0]!, m.robots[3]!]; // 0.8 m square frames
    put(a, 5, 4);
    put(b, 5.9, 4);
    expect(robotGap(a, b)).toBeCloseTo(0.1, 6);
    put(b, 5.8, 4);
    expect(robotGap(a, b)).toBeCloseTo(0, 6);
    // Diamond against a square: its corner reaches 0.4 * sqrt(2) = 0.566 m out.
    put(b, 5 + 0.4 + 0.566 + 0.05, 4, Math.PI / 4);
    expect(robotGap(a, b)).toBeCloseTo(0.05, 2);
    // Diagonal neighbors whose corners are 0.2 m apart (centers 0.8 + 0.2/sqrt(2) apart on each axis).
    put(b, 5 + 0.8 + 0.1414, 4 + 0.8 + 0.1414);
    expect(robotGap(a, b)).toBeGreaterThan(CONTACT_GAP);
  });
  it('a robot is in a zone with any part of it, or only when all of it is', () => {
    const m = setup(miniGame());
    const r = m.robots[0]!;
    const zone = { kind: 'rect' as const, min: { x: 6, y: 0 }, max: { x: 10, y: 3 } };
    put(r, 5.7, 1.5); // front edge 0.1 m into the zone
    expect(robotInZone(r, zone)).toBe(true);
    expect(robotInZone(r, zone, true)).toBe(false);
    put(r, 8, 1.5);
    expect(robotInZone(r, zone, true)).toBe(true);
    put(r, 5.5, 1.5);
    expect(robotInZone(r, zone)).toBe(false);
  });
});

describe('footprint and zone overlap (exact)', () => {
  // A 0.8 m square robot.
  const robot = (x: number, y: number, yaw = 0) => footprint(x, y, yaw, 0.8, 0.8);
  const rect = (x0: number, y0: number, x1: number, y1: number): Region2D => ({
    kind: 'rect',
    min: { x: x0, y: y0 },
    max: { x: x1, y: y1 },
  });

  it("counts a zone corner poking into the robot's side, with none of the robot's corners in the zone", () => {
    // Turned 45 deg, the robot's top-right side is the line x + y = 10.566; the zone's corner
    // (5.25, 5.25) is just inside it.
    const diamond = robot(5, 5, Math.PI / 4);
    const zone = rect(5.25, 5.25, 7, 7);
    expect(diamond.some((c) => pointInRegion(c, zone))).toBe(false);
    expect(footprintOverlaps(diamond, zone)).toBe(true);
    expect(footprintOverlaps(diamond, rect(5.35, 5.35, 7, 7))).toBe(false);
  });

  it('counts a zone narrower than the robot running across it', () => {
    const r = robot(5.25, 5); // x 4.85-5.65: the strip x 4.9-5.1 crosses it, center outside
    expect(footprintOverlaps(r, rect(4.9, 0, 5.1, 10))).toBe(true);
    expect(footprintOverlaps(r, rect(4.5, 0, 4.8, 10))).toBe(false);
    const strip: Region2D = {
      kind: 'poly',
      points: [
        { x: 4.9, y: 0 },
        { x: 5.1, y: 0 },
        { x: 5.1, y: 10 },
        { x: 4.9, y: 10 },
      ],
    };
    expect(footprintOverlaps(r, strip)).toBe(true);
  });

  it('is exact for circles', () => {
    const r = robot(5, 5); // front side at x 5.4
    expect(footprintOverlaps(r, { kind: 'circle', center: { x: 5.6, y: 5 }, radius: 0.25 })).toBe(true);
    expect(footprintOverlaps(r, { kind: 'circle', center: { x: 5.7, y: 5 }, radius: 0.25 })).toBe(false);
    expect(footprintOverlaps(r, { kind: 'circle', center: { x: 5, y: 5 }, radius: 0.1 })).toBe(true);
    expect(footprintInside(r, { kind: 'circle', center: { x: 5, y: 5 }, radius: 0.6 })).toBe(true);
    expect(footprintInside(r, { kind: 'circle', center: { x: 5, y: 5 }, radius: 0.5 })).toBe(false);
  });

  it('is fully inside a polygon only when no notch of it reaches into the robot', () => {
    // A 10 m square with a 0.2 m slot cut down from the top edge to y = 5.
    const slotted: Region2D = {
      kind: 'poly',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 5.1, y: 10 },
        { x: 5.1, y: 5 },
        { x: 4.9, y: 5 },
        { x: 4.9, y: 10 },
        { x: 0, y: 10 },
      ],
    };
    // The slot runs right through the robot: every corner is inside, but the robot isn't.
    const across = robot(5, 5.5);
    expect(across.every((c) => pointInRegion(c, slotted))).toBe(true);
    expect(footprintInside(across, slotted)).toBe(false);
    // The slot's end pokes into the robot.
    expect(footprintInside(robot(5, 4.8), slotted)).toBe(false);
    expect(footprintInside(robot(5, 4.5), slotted)).toBe(true);
    expect(footprintInside(robot(2, 2), rect(0, 0, 10, 10))).toBe(true);
    expect(footprintInside(robot(9.7, 2), rect(0, 0, 10, 10))).toBe(false);
  });
});

describe('protected-zone contact fouls', () => {
  it('are valid definitions; unknown or neutral zones are errors', () => {
    expect(validateDefinition(withFouls()).filter((i) => i.level === 'error')).toEqual([]);
    const bad = validateDefinition(withFouls({ zones: ['nope'] })).filter((i) => i.level === 'error');
    expect(bad.map((i) => i.message)).toContain("zone 'nope' is not a sided (blue-authored) zone");
  });

  it('call a foul on an intruder touching an opponent, once per instance', () => {
    const m = setup(withFouls());
    const [blue, red] = [m.robots[0]!, m.robots[3]!];
    // Blue loading zone is x 6-10, y 0-3: a red robot partly inside touches a blue robot.
    put(blue, 7, 1.5);
    put(red, 7, 2.3 + CONTACT_GAP / 2); // gap ~0
    stepFor(m, 0.1);
    expect(fouls(m)).toEqual(['foul:G1 contact in the opponent loading zone']);
    expect(m.fouls.red.minor).toBe(1);
    stepFor(m, 1); // still touching: the same instance
    expect(fouls(m)).toHaveLength(1);
    stepFor(m, 2.5); // a new instance after repeatSec (3 s)
    expect(fouls(m)).toHaveLength(2);
  });

  it("don't call contact outside the zone, or by a robot in its own zone", () => {
    const m = setup(withFouls());
    const [blue, red] = [m.robots[0]!, m.robots[3]!];
    put(blue, 4, 1.5);
    put(red, 4.81, 1.5); // touching, both well outside the blue zone
    stepFor(m, 0.5);
    put(blue, 7, 2.6); // blue inside its own zone, touching red just outside it
    put(red, 7, 3.41);
    stepFor(m, 0.5);
    expect(fouls(m)).toEqual([]);
  });

  it("'protected' rules protect a robot inside its own zone instead", () => {
    const m = setup(withFouls({ inside: 'protected' }));
    const [blue, red] = [m.robots[0]!, m.robots[3]!];
    put(blue, 7, 2.2); // blue's center in its own zone
    put(red, 7, 3.01); // red just outside, touching
    stepFor(m, 0.1);
    expect(m.fouls.red.minor).toBe(1);
  });

  it('endgame-only rules wait for the endgame', () => {
    const m = setup(withFouls({ endgameOnly: true }));
    const [blue, red] = [m.robots[0]!, m.robots[3]!];
    put(blue, 7, 1.5);
    put(red, 7, 2.3);
    stepFor(m, 1);
    expect(fouls(m)).toEqual([]);
    while (!m.isEndgame) m.step();
    put(blue, 7, 1.5);
    put(red, 7, 2.3);
    stepFor(m, 0.2);
    expect(m.fouls.red.minor).toBe(1);
  });

  it('forgiveForced skips contact the protected robot drove into', () => {
    for (const forgive of [false, true]) {
      const m = setup(withFouls({ forgiveForced: forgive }));
      const [blue, red] = [m.robots[0]!, m.robots[3]!];
      put(blue, 7, 1.0);
      put(red, 7, 2.5); // red partly in blue's zone, standing still
      blue.controller = ctl(() => ({ vy: 1 })); // blue rams it
      stepFor(m, 1);
      expect(m.fouls.red.minor > 0).toBe(!forgive);
    }
  });
});

describe('contact warnings (for the HUD)', () => {
  it("warn a robot in the opponent's zone under an 'intruder' rule", () => {
    const m = setup(withFouls());
    const [blue, red] = [m.robots[0]!, m.robots[3]!];
    put(red, 8, 1.5); // in blue's loading zone
    put(blue, 8, 1.5 + 2); // blue's own zone: no warning for blue
    expect(m.contactWarnings(red).map((w) => [w.rule.id, w.zone, w.opponent])).toEqual([
      ['G1', 'load', undefined],
    ]);
    expect(m.contactWarnings(blue)).toEqual([]);
    put(red, 5.5, 1.5); // just outside
    expect(m.contactWarnings(red)).toEqual([]);
  });

  it("warn a robot near an opponent that is in its own zone under a 'protected' rule", () => {
    const m = setup(withFouls({ inside: 'protected' }));
    const [blue, red] = [m.robots[0]!, m.robots[3]!];
    put(blue, 8, 1.5); // protected in its loading zone
    put(red, 8, 3.5);
    expect(m.contactWarnings(red).map((w) => [w.rule.id, w.zone, w.opponent?.id])).toEqual([
      ['G1', 'load', blue.id],
    ]);
    expect(m.contactWarnings(blue)).toEqual([]);
    put(red, 8, 5); // too far away to matter
    expect(m.contactWarnings(red)).toEqual([]);
  });
});

describe('pinning', () => {
  it('validates its numbers', () => {
    const def = withFouls();
    const bad = {
      ...def,
      fouls: {
        ...def.fouls,
        pinning: { id: 'G2', countSec: 0, releaseGap: -1, repinSec: -1, source: 'test' },
      },
    };
    expect(
      validateDefinition(bad)
        .filter((i) => i.level === 'error')
        .map((i) => i.message),
    ).toEqual(['countSec must be > 0', 'releaseGap must be >= 0', 'repinSec must be >= 0']);
  });
  /**
   * Blue pushes red (a robot too weak to push back) against the side wall while red tries to
   * drive along it. Red never drives toward blue, so only blue is pinning.
   */
  const pin = (seconds: number, redTries = true) => {
    const m = setup(withFouls({}, true));
    const [blue, red] = [m.robots[0]!, m.robots[3]!];
    put(red, 4, 0.45); // against the y = 0 wall
    put(blue, 4, 0.45 + 0.8 + 0.01);
    blue.controller = ctl(() => ({ vy: -1 }));
    red.controller = ctl(() => (redTries ? { vx: 1 } : {}));
    stepFor(m, seconds);
    return m;
  };
  it('is a minor foul at 5 s, then a major foul every further 5 s', () => {
    expect(fouls(pin(4.5))).toEqual([]);
    expect(fouls(pin(5.5))).toEqual(['foul:G2 pinning']);
    const m = pin(10.5);
    expect(fouls(m)).toEqual(['foul:G2 pinning', 'foul:G2 pinning']);
    expect(m.fouls.blue).toEqual({ minor: 1, major: 1 });
    expect(m.summary('blue').foulCalls).toEqual({ 'G2 pinning': 2 });
    expect(m.announcements.map((a) => a.text).filter((t) => t.includes('FOUL'))).toEqual([
      'MINOR FOUL on blue: G2 pinning (5 s)',
      'MAJOR FOUL on blue: G2 pinning (10 s)',
    ]);
    expect(m.fouls.red).toEqual({ minor: 0, major: 0 });
  });
  it("isn't a pin when the pressed robot isn't trying to move", () => {
    expect(fouls(pin(10.5, false))).toEqual([]);
  });
  it('the count resumes after a short break', () => {
    const m = pin(3);
    const blue = m.robots[0]!;
    blue.controller = ctl(() => ({ vy: 1 })); // back off a little...
    stepFor(m, 0.3);
    blue.controller = ctl(() => ({ vy: -1 })); // ...and pin again: the count goes on from 3 s
    stepFor(m, 3);
    expect(fouls(m)).toEqual(['foul:G2 pinning']);
  });

  /** Pin for 3 s, move blue `away` m (bumper gap) off for `wait` s, then pin again for `again` s. */
  const separate = (away: number, wait: number, again: number) => {
    const m = pin(3);
    const blue = m.robots[0]!;
    put(blue, 4, 0.45 + 0.8 + away);
    blue.controller = ctl(() => ({}));
    stepFor(m, wait);
    put(blue, 4, 0.45 + 0.8 + 0.01);
    blue.controller = ctl(() => ({ vy: -1 }));
    stepFor(m, again);
    return fouls(m);
  };
  it('ends once the robots are 6 ft apart, and starts over unless the robot pins again within 3 s', () => {
    expect(separate(1.9, 3.5, 4.5)).toEqual([]); // a fresh count: 4.5 s
    expect(separate(1.9, 1, 2.5)).toEqual(['foul:G2 pinning']); // back within 3 s: 3 + 2.5 s
    expect(separate(1.5, 3.5, 2.5)).toEqual(['foul:G2 pinning']); // never 6 ft apart: still on
  });

  it('ends once either robot has moved 6 ft from where the pin started', () => {
    /** Pin 3 s, both robots move `dx` along the wall, touching but idle for 3.5 s, then pin 4.5 s. */
    const slide = (dx: number) => {
      const m = pin(3);
      const [blue, red] = [m.robots[0]!, m.robots[3]!];
      blue.controller = ctl(() => ({}));
      red.controller = ctl(() => ({}));
      put(red, 4 - dx, 0.45);
      put(blue, 4 - dx, 0.45 + 0.8 + 0.01);
      stepFor(m, 3.5);
      blue.controller = ctl(() => ({ vy: -1 }));
      red.controller = ctl(() => ({ vx: 1 }));
      stepFor(m, 4.5);
      return fouls(m);
    };
    expect(slide(2)).toEqual([]); // the pin ended: a fresh 4.5 s count
    expect(slide(1)).toEqual(['foul:G2 pinning']); // still the same pin: 3 + 4.5 s
  });

  it('ends when the pinning robot gets pinned itself', () => {
    const m = pin(3);
    const [blue, red2] = [m.robots[0]!, m.robots[4]!];
    // Red 2 presses blue from above while blue keeps pressing red 1 against the wall.
    put(red2, 4, blue.y + 0.81);
    red2.controller = ctl(() => ({ vy: -1 }));
    stepFor(m, 3);
    expect(fouls(m)).toEqual([]); // blue's count stopped at 3 s, red 2's is at 3 s
    stepFor(m, 2.5);
    expect(fouls(m)).toEqual(['foul:G2 pinning']);
    expect(m.fouls.red).toEqual({ minor: 1, major: 0 });
    expect(m.fouls.blue).toEqual({ minor: 0, major: 0 });
  });
});

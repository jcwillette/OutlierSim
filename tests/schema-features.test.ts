import { beforeAll, describe, expect, it } from 'vitest';
import { NavGrid, attachBots } from '../src/engine/ai/index.ts';
import { IN, cite, circle, feet, poly, rect } from '../src/engine/sim/authoring.ts';
import {
  IDLE,
  Match,
  expandDefinition,
  initPhysics,
  sinkRampBase,
  sourceBase,
  validateDefinition,
  type FieldElement,
  type GameDefinition,
  type Robot,
  type RobotCommand,
} from '../src/engine/sim/index.ts';
import { miniGame } from './fixtures/mini-game.ts';

/**
 * Schema features added after the 2023 stress test, so the next game can declare what 2023 had to
 * hand-write: points-from-sources ranking points, navigation hints on field elements, authoring
 * helpers, and bots that read protected zones from the declared contact fouls.
 */

beforeAll(async () => {
  await initPhysics();
});

const ctl = (f: (m: Match, r: Robot) => Partial<RobotCommand>) => ({
  command: (m: Match, r: Robot) => ({ ...IDLE, ...f(m, r) }),
});

describe("ranking point kind 'pointsAtLeast'", () => {
  const withRp = (sources?: string[], categories?: Array<'auto' | 'teleop' | 'endgame' | 'penalty'>) =>
    miniGame({
      rankingPoints: {
        win: 3,
        tie: 1,
        bonuses: [
          {
            id: 'bar',
            name: 'Bar points',
            rp: 1,
            kind: 'pointsAtLeast',
            points: 10,
            ...(sources ? { sources } : {}),
            ...(categories ? { categories } : {}),
          },
        ],
      },
    });
  const play = (def: GameDefinition) => {
    const m = new Match(def);
    m.robots[1]!.controller = ctl(() => ({ endgame: true })); // starts in the bar zone
    return m.runToEnd().blue.rpBreakdown;
  };
  it('counts points from the listed sources only', () => {
    expect(play(withRp(['bar']))).toEqual({ win: 3, bar: 1 });
    expect(play(withRp(['goal']))).toEqual({ win: 3 });
  });
  it('filters by category (default: everything but fouls)', () => {
    expect(play(withRp(undefined, ['endgame']))).toEqual({ win: 3, bar: 1 });
    expect(play(withRp(['bar'], ['auto']))).toEqual({ win: 3 });
  });
  it('rejects unknown sources when no rules.ts could add them', () => {
    const errors = validateDefinition(withRp(['nope'])).filter((i) => i.level === 'error');
    expect(errors.map((e) => e.message)).toEqual(['unknown sources (no rules.ts adds points): nope']);
  });
  it('strips the alliance from expanded ledger sources', () => {
    expect(sourceBase('dock.blue')).toBe('dock');
    expect(sourceBase('high-3.red')).toBe('high-3');
    expect(sourceBase('engaged-partner')).toBe('engaged-partner');
    expect(sourceBase('foul:G207 contact in the opponent zone')).toBe(
      'foul:G207 contact in the opponent zone',
    );
  });
});

describe('navigation hints on field elements', () => {
  const block = (z: number, nav?: FieldElement['nav']): FieldElement => ({
    id: 'block',
    side: 'neutral',
    shape: { kind: 'box', size: { x: 1, y: 1, z } },
    position: { x: 8, y: 4, z: z / 2 },
    ...(nav ? { nav } : {}),
  });
  const grid = (e: FieldElement) => {
    const def = miniGame();
    def.field.elements = [e];
    return new NavGrid(expandDefinition(def), 0.3);
  };
  const at = { x: 8, y: 4 };
  it('by default goes by height: walls from 0.2 m, ramps from 0.05 m', () => {
    expect(grid(block(0.5)).isFree(at)).toBe(false);
    expect(grid(block(0.1)).isFree(at)).toBe(true);
    expect(grid(block(0.1)).isSlow(at)).toBe(true);
    expect(grid(block(0.03)).isSlow(at)).toBe(false);
  });
  it("'wall', 'ramp' and 'none' override the height", () => {
    expect(grid(block(0.1, 'wall')).isFree(at)).toBe(false);
    const ramp = grid(block(0.3, 'ramp'));
    expect(ramp.isFree(at)).toBe(true);
    expect(ramp.isSlow(at)).toBe(true);
    const none = grid(block(0.5, 'none'));
    expect(none.isFree(at)).toBe(true);
    expect(none.isSlow(at)).toBe(false);
  });
  it('are validated', () => {
    const def = miniGame();
    def.field.elements = [{ ...block(0.5), nav: 'bogus' as unknown as 'wall' }];
    expect(validateDefinition(def).some((i) => i.level === 'error' && i.message.startsWith('nav must'))).toBe(
      true,
    );
  });
});

describe('endgame attempts that can fail', () => {
  /** Mini game whose 'bar' (10) falls back to 'hang' (4) on the same zone. */
  const game = (success: number, fallback = true): GameDefinition => {
    const base = miniGame();
    const bar = base.endgame[0]!;
    return {
      ...base,
      endgame: [
        { ...bar, ...(fallback ? { fallback: 'hang' } : {}) },
        { ...bar, id: 'hang', name: 'Hang', points: 4 },
      ],
      archetypes: [
        { ...base.archetypes[0]!, endgame: { bar: 2, hang: 1 }, endgameSuccess: { bar: success } },
      ],
    };
  };
  const climb = (def: GameDefinition, seed = 1) => {
    const m = new Match(def, { seed });
    const r = m.robots[1]!; // starts in the bar zone
    r.controller = ctl(() => ({ endgame: true, targetId: 'bar.blue' }));
    m.start();
    while (!m.isEndgame) m.step();
    for (let i = 0; i < 60 * 2.5; i++) m.step();
    return { m, r };
  };
  it('always count at the default success chance', () => {
    const { m, r } = climb(miniGame());
    expect(r.endgameDone?.actionId).toBe('bar.blue');
    expect(m.ledger.bySource('blue')['bar.blue']).toBe(10);
  });
  it('a failed attempt earns the fallback action instead', () => {
    const { m, r } = climb(game(0));
    expect(r.endgameDone?.actionId).toBe('hang.blue');
    expect(m.ledger.bySource('blue')).toMatchObject({ 'hang.blue': 4 });
    expect(m.announcements.some((a) => a.text.includes('failed'))).toBe(true);
  });
  it('without a fallback the robot is free to try again, and earns nothing', () => {
    const { m, r } = climb(game(0, false));
    expect(r.endgameDone).toBeNull();
    expect(m.ledger.bySource('blue')['bar.blue']).toBeUndefined();
  });
  it('succeeds about as often as the chance says', () => {
    let ok = 0;
    for (let seed = 1; seed <= 60; seed++)
      if (climb(game(0.7), seed).r.endgameDone?.actionId === 'bar.blue') ok++;
    expect(ok / 60).toBeGreaterThan(0.5);
    expect(ok / 60).toBeLessThan(0.9);
  });
  it('is validated', () => {
    const bad = game(1.5);
    bad.endgame[0]!.fallback = 'nope';
    const msgs = validateDefinition(bad)
      .filter((i) => i.level === 'error')
      .map((i) => i.message);
    expect(msgs).toEqual([
      "fallback 'nope' is not another endgame action",
      'endgameSuccess.bar must be between 0 and 1',
    ]);
  });
});

describe('human player stations that offer a choice', () => {
  /** Mini game with cubes too, and a feeder at (1, 7) that hands out either piece. */
  const game = (choice: boolean): GameDefinition => {
    const base = miniGame();
    return {
      ...base,
      pieces: [...base.pieces, { ...base.pieces[0]!, id: 'cube', name: 'Cube' }],
      preload: {},
      staging: [],
      stations: [
        {
          id: 'feeder',
          name: 'Feeder',
          side: 'blue',
          zone: { kind: 'rect', min: { x: 0.5, y: 6.5 }, max: { x: 1.5, y: 7.5 } },
          pieceTypes: ['ball', 'cube'],
          ...(choice ? { choice: true } : {}),
          mode: 'direct',
          feedIntervalSec: 1,
          source: 'test',
        },
      ],
      archetypes: [
        {
          ...base.archetypes[0]!,
          capacity: { ball: 1, cube: 1 },
          totalCapacity: 1,
          intake: { pieceTypes: ['ball', 'cube'], timeSec: 0.2 },
        },
      ],
    };
  };
  const load = (def: GameDefinition, pieceType?: string) => {
    const m = new Match(def);
    const r = m.robots[0]!;
    m.start();
    while (m.phase !== 'teleop') m.step();
    r.setPosition({ x: 1, y: 7, z: r.archetype.frame.height / 2 + 0.01 });
    r.controller = ctl(() => ({ intake: true, ...(pieceType ? { pieceType } : {}) }));
    for (let i = 0; i < 30; i++) m.step();
    return { m, r };
  };
  it('hands out the piece the robot asks for', () => {
    expect(load(game(true), 'cube').r.held).toEqual(['cube']);
    expect(load(game(true), 'ball').r.held).toEqual(['ball']);
    expect(load(game(true)).r.held).toEqual(['ball']); // no request: the first type
  });
  it('without a choice, hands out the first type the robot can hold', () => {
    expect(load(game(false), 'cube').r.held).toEqual(['ball']);
  });
  it('lists what a robot can ask for', () => {
    const m = new Match(game(true));
    expect(m.choiceTypes(m.robots[0]!)).toEqual(['ball', 'cube']);
    expect(new Match(game(false)).choiceTypes(m.robots[0]!)).toEqual([]);
  });
  it('bots ask for the piece they plan to score', () => {
    // Only cubes score: a bot at the feeder should ask for a cube.
    const def = game(true);
    def.targets = def.targets.map((t) => ({ ...t, accepts: ['cube'] }));
    const m = new Match(def, { seed: 3 });
    attachBots(m, { partners: 'normal', opponents: 'normal', playerId: null });
    m.start();
    while (m.phase !== 'teleop') m.step();
    for (let i = 0; i < 60 * 20; i++) m.step();
    const intaken = m.pieces
      .filter((p) => p.lastTouch !== null && p.status !== 'field')
      .map((p) => p.type.id);
    expect(intaken.length).toBeGreaterThan(0);
    expect(intaken.every((t) => t === 'cube')).toBe(true);
  });
});

describe('ramps in physics', () => {
  it("continue a 'ramp' hull's floor edges just below the floor, along the slope", () => {
    // A 1 m wide ramp: floor edge at x = 0, top edge 0.2 m up at x = 0.4.
    const verts = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0.4, y: 0, z: 0.2 },
      { x: 0.4, y: 1, z: 0.2 },
    ];
    const out = sinkRampBase(verts, 0);
    expect(out[2]).toEqual(verts[2]);
    expect(out[3]).toEqual(verts[3]);
    expect(out[0]!.z).toBeCloseTo(-0.03, 12);
    expect(out[0]!.x).toBeCloseTo(-0.06, 12); // same slope: 0.03 down is 0.06 back
    expect(out[1]).toEqual({ x: out[0]!.x, y: 1, z: out[0]!.z });
    // A hull raised off the floor isn't touched.
    expect(sinkRampBase(verts, 0.5)).toEqual(verts);
  });
});

describe('authoring helpers', () => {
  it('convert manual units', () => {
    expect(feet(54, 3.25)).toBeCloseTo(16.54, 2);
    expect(feet(0, 1)).toBe(IN);
  });
  it('build regions and citations', () => {
    expect(rect(3, 2, 1, 0)).toEqual({ kind: 'rect', min: { x: 1, y: 0 }, max: { x: 3, y: 2 } });
    expect(poly([0, 0], [1, 0], [0, 1])).toEqual({
      kind: 'poly',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ],
    });
    expect(circle(1, 2, 3)).toEqual({ kind: 'circle', center: { x: 1, y: 2 }, radius: 3 });
    const M = cite('Manual');
    expect(M(47, 'Table 6-2')).toBe('Manual p.47, Table 6-2');
    expect(cite('TU03')(2)).toBe('TU03 p.2');
  });
});

describe('bots read protected zones from the contact fouls', () => {
  /** Mini game whose blue 'load' zone (x 6-10, y 0-3) is protected only by a contact rule. */
  const def = (): GameDefinition => {
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
      fouls: {
        minor: 2,
        major: 6,
        contact: [
          { id: 'G1', name: 'test', zones: ['load'], inside: 'intruder', severity: 'minor', source: 'test' },
        ],
      },
    };
  };
  it('a defender leaves an opponent in its protected zone alone', () => {
    const m = new Match(def(), { seed: 1 });
    const bots = attachBots(m, {
      partners: 'normal',
      opponents: 'normal',
      playerId: null,
      roles: { 3: 'defense' },
    });
    const brain = bots.get(3)! as unknown as { worthDefending: (m: Match, r: Robot, o: Robot) => boolean };
    m.start();
    const put = (r: Robot, x: number, y: number) => {
      r.setPosition({ x, y, z: r.archetype.frame.height / 2 + 0.01 });
      r.setVelocity({ x: 0, y: 0, z: 0 });
    };
    const [blue, red] = [m.robots[0]!, m.robots[3]!];
    put(blue, 8, 6); // mid-field
    put(red, 9.5, 6);
    expect(brain.worthDefending(m, red, blue)).toBe(true);
    put(blue, 8, 1.5); // in its protected loading zone
    put(red, 9.5, 4.5);
    expect(brain.worthDefending(m, red, blue)).toBe(false);
  });
});

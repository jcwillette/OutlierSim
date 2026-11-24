import { beforeAll, describe, expect, it } from 'vitest';
import { NavGrid, attachBots } from '../src/engine/ai/index.ts';
import { IN, cite, circle, feet, poly, rect } from '../src/engine/sim/authoring.ts';
import {
  IDLE,
  Match,
  expandDefinition,
  initPhysics,
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

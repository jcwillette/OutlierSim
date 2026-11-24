import { beforeAll, describe, expect, it } from 'vitest';
import { BotBrain } from '../src/engine/ai/index.ts';
import {
  IDLE,
  Match,
  initPhysics,
  validateDefinition,
  type AutoRoutine,
  type GameDefinition,
  type Robot,
  type RobotCommand,
} from '../src/engine/sim/index.ts';
import { miniGame } from './fixtures/mini-game.ts';

/**
 * Robot settings found missing when the 2023 build was compared with real matches: a pickup costs
 * time (`intake.timeSec`), and each robot type has its own auto routine (`RobotArchetype.auto`).
 */

beforeAll(async () => {
  await initPhysics();
});

const ctl = (f: (m: Match, r: Robot) => Partial<RobotCommand>) => ({
  command: (m: Match, r: Robot) => ({ ...IDLE, ...f(m, r) }),
});

/** The mini game with its one robot type changed. */
const withBasic = (
  patch: Partial<GameDefinition['archetypes'][number]>,
  more: Partial<GameDefinition> = {},
) => {
  const base = miniGame(more);
  return { ...base, archetypes: [{ ...base.archetypes[0]!, ...patch }] };
};

describe('pickup time', () => {
  it('stops the robot for intake.timeSec once a floor piece is in reach', () => {
    const def = withBasic({ intake: { pieceTypes: ['ball'], timeSec: 1 } });
    const m = new Match(def, { seed: 1 });
    const r = m.robots[0]!; // (1, 2) facing +x; a staged ball at (3, 2)
    r.controller = ctl(() => ({ vx: 1, intake: true }));
    m.start();
    while (r.held.length < 2 && m.time < 5) m.step();
    expect(r.held).toEqual(['ball', 'ball']);
    expect(r.action?.kind).toBe('intake');
    const grabbedAt = m.time;
    while (m.time < grabbedAt + 0.8) m.step();
    expect(r.speed).toBeLessThan(0.05); // drive locked while grabbing
    while (r.action && m.time < grabbedAt + 2) m.step();
    expect(m.time - grabbedAt).toBeCloseTo(1, 1);
  });

  it('comes after the station hand-off for a direct station', () => {
    const def = withBasic(
      { capacity: { ball: 1 }, intake: { pieceTypes: ['ball'], timeSec: 0.5 } },
      {
        preload: {},
        stations: [
          {
            id: 'chute',
            name: 'Chute',
            side: 'blue',
            zone: { kind: 'rect', min: { x: 0.5, y: 1.5 }, max: { x: 1.5, y: 2.5 } },
            pieceTypes: ['ball'],
            mode: 'direct',
            feedIntervalSec: 1,
            handoffSec: 1,
          },
        ],
      },
    );
    const m = new Match(def, { seed: 1 });
    const r = m.robots[0]!; // starts in the station zone
    r.controller = ctl(() => ({ intake: true }));
    m.start();
    while (!r.held.length && m.time < 5) m.step();
    expect(m.time).toBeCloseTo(1, 1); // the hand-off
    expect(r.action?.kind).toBe('intake');
    const t = m.time;
    while (r.action) m.step();
    expect(m.time - t).toBeCloseTo(0.5, 1); // then the robot's own grab
  });
});

describe('line-up time (alignSec)', () => {
  /** Place times offered to robot `id` in the shelf's place zone, in auto and then in teleop. */
  const placeTimes = (id: number, alignExempt: number[] = []) => {
    const def = withBasic({ alignSec: 2, place: { low: 0.5 } });
    const m = new Match(def, { seed: 1, alignExempt });
    const r = m.robots[id]!;
    const atShelf = () => {
      // The shelf's place zone on the robot's own side (red's is the rotation image).
      const p = r.alliance === 'blue' ? { x: 1, y: 1 } : { x: 15, y: 7 };
      r.setPosition({ ...p, z: r.archetype.frame.height / 2 + 0.01 }); // the shelf faces any way
      m.step();
      return m.placeOptions(r).map((o) => o.time);
    };
    m.start();
    const auto = atShelf();
    while (m.phase !== 'teleop') m.step();
    return { auto, teleop: atShelf() };
  };

  it('adds the drive team’s line-up to teleop placements only, and not for exempt robots', () => {
    expect(placeTimes(0)).toEqual({ auto: [0.5], teleop: [2.5] }); // a programmed auto doesn't need it
    expect(placeTimes(3)).toEqual({ auto: [0.5], teleop: [2.5] });
    expect(placeTimes(0, [0])).toEqual({ auto: [0.5], teleop: [0.5] }); // the student drives this one
  });

  it('adds it to a teleop pickup too', () => {
    const def = withBasic({ alignSec: 2, intake: { pieceTypes: ['ball'], timeSec: 0.5 } });
    const m = new Match(def, { seed: 1 });
    const r = m.robots[0]!; // (1, 2) facing +x; a staged ball at (3, 2)
    r.controller = ctl((mm) => (mm.phase === 'teleop' ? { vx: 1, intake: true } : {}));
    m.start();
    while (r.held.length < 2 && m.time < 30) m.step();
    expect(m.phase).toBe('teleop');
    expect(r.action?.kind === 'intake' ? r.action.total : null).toBe(2.5);
  });
});

describe('auto routine', () => {
  /** One bot (blue 1) running `auto` through auto; the other robots stay still. */
  const runAuto = (auto: AutoRoutine | undefined, canFail = true) => {
    const def = withBasic(auto ? { auto } : {});
    const m = new Match(def, { seed: 3 });
    const r = m.robots[0]!;
    r.controller = new BotBrain({ difficulty: 'hard', autoCanFail: canFail });
    m.start();
    const start = { x: r.x, y: r.y };
    while (m.phase === 'auto') m.step();
    const left = m.ledger.entries.some((e) => e.source === 'leave.blue' && e.robotId === r.id);
    return {
      scored: r.stats.piecesScored,
      held: r.held.length,
      left,
      moved: Math.hypot(r.x - start.x, r.y - start.y),
    };
  };

  it('without one, the bot scores what it can in auto', () => {
    const free = runAuto(undefined);
    expect(free.scored).toBeGreaterThanOrEqual(2);
    expect(free.left).toBe(true);
  });

  it('scores at most `pieces`, then leaves the starting zone', () => {
    const one = runAuto({ pieces: 1 });
    expect(one.scored).toBe(1);
    expect(one.left).toBe(true);
    const none = runAuto({ pieces: 0 });
    expect(none.scored).toBe(0);
    expect(none.held).toBe(1); // keeps its preload for teleop
    expect(none.left).toBe(true);
  });

  it('stays in the starting zone with leave: false', () => {
    const stay = runAuto({ pieces: 1, leave: false });
    expect(stay.scored).toBe(1);
    expect(stay.left).toBe(false);
  });

  it('a routine that fails sits still; the player’s own routine always runs', () => {
    const dead = runAuto({ pieces: 1, success: 0 });
    expect(dead.scored).toBe(0);
    expect(dead.moved).toBeLessThan(0.05);
    const player = runAuto({ pieces: 1, success: 0 }, false);
    expect(player.scored).toBe(1);
  });

  it('validates its numbers', () => {
    const bad = withBasic({ auto: { pieces: 1.5, success: 2 } });
    const errors = validateDefinition(bad)
      .filter((i) => i.level === 'error')
      .map((e) => e.message);
    expect(errors).toEqual([
      'auto.pieces must be a whole number, 0 or more',
      'auto.success must be between 0 and 1',
    ]);
  });
});

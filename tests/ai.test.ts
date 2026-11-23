import { beforeAll, describe, expect, it } from 'vitest';
import { NavGrid, attachBots } from '../src/engine/ai/index.ts';
import { Match, expandDefinition, initPhysics } from '../src/engine/sim/index.ts';
import { findGame } from '../src/games/index.ts';

beforeAll(async () => {
  await initPhysics();
});

const ref = findGame('0000-reference')!;

describe('NavGrid', () => {
  const grid = new NavGrid(expandDefinition(ref), 0.5);
  it('blocks solid elements (inflated) and the perimeter', () => {
    expect(grid.isFree({ x: 5.5, y: 2.0 })).toBe(false); // pillar
    expect(grid.isFree({ x: 5.5, y: 2.65 })).toBe(false); // within inflation
    expect(grid.isFree({ x: 0.2, y: 3 })).toBe(false); // wall
    expect(grid.isFree({ x: 4, y: 3 })).toBe(true);
  });
  it('finds a clear path around an obstacle', () => {
    const path = grid.findPath({ x: 4.3, y: 2.0 }, { x: 6.7, y: 2.0 });
    expect(path.length).toBeGreaterThan(1);
    let prev = { x: 4.3, y: 2.0 };
    for (const p of path) {
      expect(grid.lineOfSight(grid.nearestFree(prev), p)).toBe(true);
      prev = p;
    }
  });
});

describe('bot AI on the reference game', () => {
  it('plays a full 3v3 match: both alliances score in auto, teleop and endgame', () => {
    const m = new Match(ref, { seed: 7 });
    attachBots(m, { partners: 'normal', opponents: 'normal', playerId: null });
    const res = m.runToEnd();
    for (const side of [res.blue, res.red]) {
      expect(side.breakdown.auto).toBeGreaterThan(0);
      expect(side.breakdown.teleop).toBeGreaterThan(30);
    }
    expect(res.blue.breakdown.endgame + res.red.breakdown.endgame).toBeGreaterThan(0);
    // every robot did something
    for (const r of res.robots) expect(r.intakes + r.shotsTaken + r.piecesScored).toBeGreaterThan(0);
  });

  it('hard bots outscore easy bots', () => {
    const m = new Match(ref, { seed: 3 });
    attachBots(m, { partners: 'hard', opponents: 'easy', playerId: 0 });
    // robot 0 (blue) would be the player: give it a hard bot too so blue is all-hard
    attachBots(m, { partners: 'hard', opponents: 'easy', playerId: null });
    const res = m.runToEnd();
    expect(res.blue.score).toBeGreaterThan(res.red.score);
  });
});

import { beforeAll, describe, expect, it } from 'vitest';
import { attachBots } from '../src/engine/ai/index.ts';
import { IDLE, Match, initPhysics, validateDefinition } from '../src/engine/sim/index.ts';
import { GAMES } from '../src/games/index.ts';

beforeAll(async () => {
  await initPhysics();
});

describe.each(GAMES.map((g) => [g.definition.id, g.definition] as const))('game %s', (id, def) => {
  it('has a valid definition with no errors', () => {
    const errors = validateDefinition(def).filter((i) => i.level === 'error');
    expect(errors).toEqual([]);
  });
  it('id matches registry conventions', () => {
    expect(id).toMatch(/^\d{4}-[a-z0-9-]+$/);
  });
  it('builds a match and survives a full idle match', () => {
    const m = new Match(def);
    const res = m.runToEnd();
    expect(res.blue.score).toBe(
      res.blue.breakdown.endgame +
        res.blue.breakdown.auto +
        res.blue.breakdown.teleop +
        res.blue.breakdown.penalty,
    );
    // nothing should fall through the floor
    for (const p of m.pieces) if (p.status === 'field') expect(p.position.z).toBeGreaterThan(-0.1);
  });
  it('bots can score points in a full match (catches unreachable targets / broken definitions)', () => {
    const m = new Match(def, { seed: 11 });
    attachBots(m, { partners: 'normal', opponents: 'normal', playerId: null });
    const res = m.runToEnd();
    expect(res.blue.score + res.red.score).toBeGreaterThan(0);
    expect(res.blue.breakdown.teleop + res.red.breakdown.teleop).toBeGreaterThan(0);
  });

  it('every robot archetype can be instantiated', () => {
    for (const a of def.archetypes) {
      const m = new Match(def, { archetypes: { 0: a.id } });
      expect(m.robots[0]!.archetype.id).toBe(a.id);
      m.robots[0]!.controller = { command: () => ({ ...IDLE, vx: 1 }) };
      m.start();
      for (let i = 0; i < 30; i++) m.step(); // 0.5 s: clear of the first obstacle
      expect(m.robots[0]!.speed).toBeGreaterThan(0.5);
    }
  });
});

describe('reference game mechanics', () => {
  const def = GAMES.find((g) => g.definition.id === '0000-reference')!.definition;
  it('a preloaded orb shot from the start pose scores in the tower and is recycled', () => {
    const m = new Match(def);
    const r = m.robots[1]!; // blue station 2 faces the tower's opposite direction; auto-align turns it
    r.controller = { command: () => ({ ...IDLE, score: true }) };
    m.start();
    for (let i = 0; i < 60 * 3; i++) m.step();
    expect(r.stats.shotsTaken).toBe(1);
    expect(m.ledger.bySource('blue')['tower.blue']).toBe(4);
    for (let i = 0; i < 60 * 3; i++) m.step();
    const recycled = m.pieces.filter((p) => p.type.id === 'orb' && p.status === 'field' && p.position.x > 7);
    expect(recycled.length).toBeGreaterThanOrEqual(9);
  });
});

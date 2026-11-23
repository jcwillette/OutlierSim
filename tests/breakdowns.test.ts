import { beforeAll, describe, expect, it } from 'vitest';
import { attachBots } from '../src/engine/ai/index.ts';
import { IDLE, Match, initPhysics } from '../src/engine/sim/index.ts';
import { findGame } from '../src/games/index.ts';
import { applyPreset, defaultLineup, resolveLineup, sanitizeLineup } from '../src/ui/lineup.ts';

beforeAll(async () => {
  await initPhysics();
});

const cu = findGame('2023-chargedup')!;
const all = (id: string) => Object.fromEntries([0, 1, 2, 3, 4, 5].map((i) => [i, id]));

describe('breakdowns', () => {
  const rates = (archetype: string, n: number) => {
    let dead = 0;
    let stalls = 0;
    for (let seed = 1; seed <= n; seed++) {
      const m = new Match(cu, { seed, archetypes: all(archetype), breakdowns: true });
      for (const r of m.robots) {
        if (r.breakdownAt !== null) dead++;
        stalls += r.outages.length;
      }
    }
    return { dead: dead / (6 * n), stalls: stalls / (6 * n) };
  };

  it('are off unless asked for', () => {
    const m = new Match(cu, { seed: 1, archetypes: all('kitbot') });
    expect(m.robots.every((r) => r.breakdownAt === null && r.outages.length === 0)).toBe(true);
  });

  it('happen more often to low-reliability robots', () => {
    const kitbot = rates('kitbot', 60); // reliability 0.85
    const elevator = rates('elevator', 60); // 0.97
    expect(kitbot.dead).toBeGreaterThan(elevator.dead);
    expect(kitbot.stalls).toBeGreaterThan(elevator.stalls * 2);
    // ~0.6 x 0.15 = 9% per match, ~5 x 0.15 = 0.75 outages per match
    expect(kitbot.dead).toBeGreaterThan(0.04);
    expect(kitbot.dead).toBeLessThan(0.16);
    expect(kitbot.stalls).toBeGreaterThan(0.5);
    expect(kitbot.stalls).toBeLessThan(1.0);
  });

  it('exempt robots never break down', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const m = new Match(cu, { seed, archetypes: all('kitbot'), breakdowns: true, breakdownExempt: [0] });
      expect(m.robots[0]!.breakdownAt).toBeNull();
      expect(m.robots[0]!.outages).toEqual([]);
    }
  });

  it('a broken-down robot stops for good and the HUD hears about it', () => {
    const m = new Match(cu, { seed: 1 });
    const r = m.robots[0]!; // blue 1, in the clear lane beside the barrier
    r.breakdownAt = 20;
    r.controller = { command: () => ({ ...IDLE, vx: m.phase === 'teleop' ? 0.3 : 0 }) };
    m.start();
    while (m.time < 19.5) m.step();
    expect(r.speed).toBeGreaterThan(0.5);
    while (m.time < 22) m.step();
    expect(r.brokenDown).toBe(true);
    expect(r.speed).toBeLessThan(0.05);
    expect(m.announcements.some((a) => a.text.includes('broke down'))).toBe(true);
    const res = m.runToEnd();
    expect(res.robots[0]!.brokeDownAt).toBeCloseTo(20, 0);
  });

  it('a short outage stops the robot, then it drives again', () => {
    const m = new Match(cu, { seed: 1 });
    const r = m.robots[0]!;
    r.outages.push({ at: 20, sec: 3 });
    r.controller = { command: () => ({ ...IDLE, vx: m.phase === 'teleop' ? 0.3 : 0 }) };
    m.start();
    while (m.time < 21.5) m.step();
    expect(r.isOut(m.time)).toBe(true);
    expect(r.speed).toBeLessThan(0.3);
    while (m.time < 24.5) m.step();
    expect(r.isOut(m.time)).toBe(false);
    expect(r.speed).toBeGreaterThan(0.5);
    expect(m.runToEnd().robots[0]!.stalls).toBe(1);
  });
});

describe('roles and strategies', () => {
  it('attachBots takes explicit roles, then archetype default roles', () => {
    const m = new Match(cu, { archetypes: { 0: 'elevator', 1: 'defender', 2: 'arm' } });
    const bots = attachBots(m, {
      partners: 'normal',
      opponents: 'normal',
      playerId: null,
      roles: { 2: 'defense' },
      strategies: { blue: 'aggressive' },
    });
    expect(bots.get(0)!.role).toBe('score');
    expect(bots.get(1)!.role).toBe('defense'); // the Defender archetype defaults to defense
    expect(bots.get(2)!.role).toBe('defense'); // explicit
    expect(bots.get(0)!.strategy).toBe('aggressive');
    expect(bots.get(3)!.strategy).toBe('balanced');
  });
});

describe('lineups (menu)', () => {
  it('every 2023 preset fills three real robots', () => {
    for (const l of cu.lineups ?? []) {
      const a = applyPreset(cu, l.id);
      expect(a.preset).toBe(l.id);
      for (const s of a.slots) expect(cu.archetypes.some((t) => t.id === s.archetype)).toBe(true);
    }
  });

  it('resolves presets, random slots, roles and strategies; skips the player', () => {
    const choice = defaultLineup();
    choice.blue = applyPreset(cu, 'shutdown');
    const r = resolveLineup(cu, choice, 3, () => 0.5);
    expect(r.archetypes[0]).toBe('elevator');
    expect(r.archetypes[2]).toBe('defender');
    expect(r.roles[2]).toBe('defense');
    expect(r.strategies.blue).toBe('aggressive');
    expect(r.archetypes[3]).toBeUndefined(); // the player's robot
    const red = [r.archetypes[4]!, r.archetypes[5]!];
    expect(new Set(red).size).toBe(2); // random slots on one alliance get different robots
  });

  it('drops saved choices that do not exist in this game', () => {
    const l = sanitizeLineup(cu, {
      blue: { preset: 'nope', strategy: 'weird', slots: [{ archetype: 'orb-shooter', role: 'x' }] },
    });
    expect(l.blue.preset).toBe('random');
    expect(l.blue.strategy).toBe('balanced');
    expect(l.blue.slots[0]).toEqual({ archetype: 'random', role: 'auto' });
  });
});

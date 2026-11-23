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
    let deadBack = 0;
    let mech = 0;
    let mechBack = 0;
    let stalls = 0;
    for (let seed = 1; seed <= n; seed++) {
      const m = new Match(cu, { seed, archetypes: all(archetype), breakdowns: true });
      for (const r of m.robots) {
        if (r.breakdownAt !== null) dead++;
        if (r.breakdownRecoverAt !== null) deadBack++;
        if (r.mechFailAt !== null) mech++;
        if (r.mechRecoverAt !== null) mechBack++;
        stalls += r.outages.length;
      }
    }
    return {
      dead: dead / (6 * n),
      deadBack: deadBack / Math.max(1, dead),
      mech: mech / (6 * n),
      mechBack: mechBack / Math.max(1, mech),
      stalls: stalls / (6 * n),
    };
  };

  it('are off unless asked for', () => {
    const m = new Match(cu, { seed: 1, archetypes: all('kitbot') });
    expect(
      m.robots.every((r) => r.breakdownAt === null && r.mechFailAt === null && r.outages.length === 0),
    ).toBe(true);
  });

  it('happen more often to low-reliability robots', () => {
    const kitbot = rates('kitbot', 60); // reliability 0.85
    const elevator = rates('elevator', 60); // 0.97
    expect(kitbot.dead).toBeGreaterThan(elevator.dead);
    expect(kitbot.mech).toBeGreaterThan(elevator.mech * 2);
    expect(kitbot.stalls).toBeGreaterThan(elevator.stalls * 2);
    // ~0.6 x 0.15 = 9% per match, ~5 x 0.15 = 0.75 outages per match
    expect(kitbot.dead).toBeGreaterThan(0.04);
    expect(kitbot.dead).toBeLessThan(0.16);
    expect(kitbot.stalls).toBeGreaterThan(0.5);
    expect(kitbot.stalls).toBeLessThan(1.0);
    // ~1.5 x 0.15 = 22.5% mechanism failures per match
    expect(kitbot.mech).toBeGreaterThan(0.15);
    expect(kitbot.mech).toBeLessThan(0.3);
  });

  it('mechanism failures are more common than breakdowns at every reliability tier', () => {
    for (const a of ['kitbot', 'arm', 'elevator']) {
      const r = rates(a, 80);
      expect(r.mech, a).toBeGreaterThan(r.dead * 1.5);
    }
  });

  it('better robots come back more often; mechanisms come back more often than dead robots', () => {
    const kitbot = rates('kitbot', 200);
    const elevator = rates('elevator', 400);
    expect(elevator.deadBack).toBeGreaterThan(kitbot.deadBack);
    expect(elevator.mechBack).toBeGreaterThan(kitbot.mechBack);
    expect(kitbot.mechBack).toBeGreaterThan(kitbot.deadBack);
    // Even a kitbot gets some robots back.
    expect(kitbot.deadBack).toBeGreaterThan(0.05);
  });

  it('exempt robots never break down', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const m = new Match(cu, { seed, archetypes: all('kitbot'), breakdowns: true, breakdownExempt: [0] });
      expect(m.robots[0]!.breakdownAt).toBeNull();
      expect(m.robots[0]!.mechFailAt).toBeNull();
      expect(m.robots[0]!.outages).toEqual([]);
    }
  });

  it('a broken-down robot with no recovery stops for good and the HUD hears about it', () => {
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
    expect(res.robots[0]!.recoveredAt).toBeNull();
  });

  it('a broken-down robot can come back online', () => {
    const m = new Match(cu, { seed: 1 });
    const r = m.robots[0]!;
    r.breakdownAt = 20;
    r.breakdownRecoverAt = 30;
    r.outages.push({ at: 25, sec: 3 }); // while dead: doesn't count
    r.controller = { command: () => ({ ...IDLE, vx: m.phase === 'teleop' ? 0.3 : 0 }) };
    m.start();
    while (m.time < 28) m.step();
    expect(r.brokenDown).toBe(true);
    expect(r.speed).toBeLessThan(0.05);
    while (m.time < 31.5) m.step();
    expect(r.brokenDown).toBe(false);
    expect(r.speed).toBeGreaterThan(0.5);
    expect(m.announcements.some((a) => a.text.includes('back online'))).toBe(true);
    const res = m.runToEnd().robots[0]!;
    expect(res.brokeDownAt).toBeCloseTo(20, 0);
    expect(res.recoveredAt).toBeCloseTo(30, 0);
    expect(res.stalls).toBe(0);
  });

  it('a mechanism failure stops scoring but not driving, then can clear', () => {
    const m = new Match(cu, { seed: 1 });
    const r = m.robots[0]!;
    r.mechFailAt = 20;
    r.mechRecoverAt = 30;
    r.controller = {
      command: () => ({ ...IDLE, vx: m.phase === 'teleop' ? 0.3 : 0, intake: true, score: true }),
    };
    m.start();
    while (m.time < 21) m.step();
    expect(r.mechDown).toBe(true);
    expect(r.isOut(m.time)).toBe(false);
    expect(r.canHandlePieces(m.time)).toBe(false);
    expect(m.placeOptions(r)).toEqual([]);
    expect(m.shotOptions(r)).toEqual([]);
    expect(m.stationsFor(r)).toEqual([]);
    const intakes = r.stats.intakes;
    while (m.time < 24) m.step();
    expect(r.speed).toBeGreaterThan(0.5); // still drives
    expect(r.stats.intakes).toBe(intakes);
    expect(r.action).toBeNull();
    expect(m.announcements.some((a) => a.text.includes('mechanism failure'))).toBe(true);
    while (m.time < 30.5) m.step();
    expect(r.mechDown).toBe(false);
    expect(r.canHandlePieces(m.time)).toBe(true);
    const res = m.runToEnd().robots[0]!;
    expect(res.mechFailedAt).toBeCloseTo(20, 0);
    expect(res.mechFixedAt).toBeCloseTo(30, 0);
  });

  it('a bot whose mechanism fails plays defense instead of cycling', () => {
    const m = new Match(cu, { seed: 3, archetypes: all('arm') });
    const bots = attachBots(m, { partners: 'normal', opponents: 'normal', playerId: null });
    const r = m.robots[0]!;
    r.mechFailAt = 40;
    m.start();
    while (m.time < 41) m.step();
    expect(r.mechDown).toBe(true);
    const scored = r.stats.piecesScored;
    const plans = new Set<string>();
    while (m.time < 90) {
      m.step();
      plans.add(bots.get(0)!.currentPlan.kind);
    }
    expect(r.stats.piecesScored).toBe(scored);
    expect(plans.has('defend')).toBe(true);
    for (const k of ['acquire', 'station', 'place', 'shoot']) expect(plans.has(k), k).toBe(false);
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

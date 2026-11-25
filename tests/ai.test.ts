import { beforeAll, describe, expect, it } from 'vitest';
import { NavGrid, attachBots } from '../src/engine/ai/index.ts';
import { Match, expandDefinition, initPhysics } from '../src/engine/sim/index.ts';
import { distToRegion } from '../src/engine/sim/math.ts';
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

describe('NavGrid: ramps, parked robots and penalty zones', () => {
  const cu = findGame('2023-chargedup')!;
  const grid = new NavGrid(expandDefinition(cu), 0.5);
  const crosses = (
    path: Array<{ x: number; y: number }>,
    from: { x: number; y: number },
    test: (p: { x: number; y: number }) => boolean,
  ) => {
    let prev = from;
    for (const p of path) {
      for (let t = 0; t <= 1; t += 0.05)
        if (test({ x: prev.x + (p.x - prev.x) * t, y: prev.y + (p.y - prev.y) * t })) return true;
      prev = p;
    }
    return false;
  };
  it('marks the Charge Station as slow ground and drives around it when that is not much longer', () => {
    expect(grid.isSlow({ x: 3.94, y: 2.745 })).toBe(true);
    expect(grid.isSlow({ x: 7, y: 2.745 })).toBe(false);
    // Straight across the station is 4.6 m; around it is a little longer, so go around.
    const from = { x: 1.95, y: 2.2 };
    const path = grid.findPath(from, { x: 6.6, y: 2.2 });
    expect(crosses(path, from, (p) => grid.isSlow(p) && Math.abs(p.x - 3.94) < 0.6)).toBe(false);
  });
  it('routes around a parked robot', () => {
    const from = { x: 7, y: 1 };
    const to = { x: 7, y: 7 };
    const parked = { x: 7, y: 4, radius: 0.45 };
    expect(crosses(grid.findPath(from, to), from, (p) => Math.hypot(p.x - 7, p.y - 4) < 0.5)).toBe(true);
    const path = grid.findPath(from, to, [parked]);
    expect(crosses(path, from, (p) => Math.hypot(p.x - 7, p.y - 4) < 0.5 + 0.45)).toBe(false);
  });
  it('keeps out of penalty regions when there is a reasonable way around', () => {
    // Short detour (~0.5 m longer): stay out. A long detour would cross it (soft penalty).
    const zone = { kind: 'rect' as const, min: { x: 9, y: 3.4 }, max: { x: 10, y: 4.6 } };
    const from = { x: 8, y: 4 };
    const inside = (p: { x: number; y: number }) => p.x > 9.1 && p.x < 9.9 && p.y > 3.5 && p.y < 4.5;
    expect(crosses(grid.findPath(from, { x: 11, y: 4 }), from, inside)).toBe(true);
    const path = grid.findPath(from, { x: 11, y: 4 }, [], { key: 'test', regions: [zone] });
    expect(crosses(path, from, inside)).toBe(false);
  });
});

describe('bot teamwork and defense on 2023 Charged Up', () => {
  const cu = findGame('2023-chargedup')!;
  it('teammates rarely push each other, and nobody is credited an endgame off the station', () => {
    // Contact varies a lot from match to match (about 2-22 s), so judge the mean of several.
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    let teamContact = 0;
    for (const seed of seeds) {
      const m = new Match(cu, {
        seed,
        archetypes: { 0: 'elevator', 1: 'arm', 2: 'kitbot', 3: 'cubebot', 4: 'elevator', 5: 'arm' },
      });
      attachBots(m, { partners: 'normal', opponents: 'normal', playerId: null });
      m.start();
      while (!m.isOver) {
        m.step();
        if (m.phase !== 'teleop') continue;
        for (const a of m.robots)
          for (const b of m.robots)
            if (a.id < b.id && a.alliance === b.alliance && !(a.endgameDone && b.endgameDone))
              if (Math.hypot(a.x - b.x, a.y - b.y) < 0.9) teamContact += 1 / 60;
      }
      for (const r of m.robots) {
        if (!r.endgameDone) continue;
        const cx = r.x < cu.field.length / 2 ? 3.94 : cu.field.length - 3.94;
        expect(Math.abs(r.x - cx)).toBeLessThan(0.7);
      }
    }
    // Before teammate coordination this was ~27 s per match.
    expect(teamContact / seeds.length).toBeLessThan(15);
  });
  it('an empty-handed bot blocks a nearby opponent carrying a piece, but not inside its protected zone', () => {
    const m = new Match(cu, { seed: 1, archetypes: { 0: 'kitbot' } });
    const bots = attachBots(m, { partners: 'normal', opponents: 'normal', playerId: null });
    m.start();
    while (m.phase !== 'teleop') m.step();
    const me = m.robots[0]!;
    const opp = m.robots[4]!; // red, heading home (+x) with a piece
    const put = (r: typeof me, x: number, y: number) => {
      r.setPosition({ x, y, z: r.archetype.frame.height / 2 + 0.01 });
      r.setVelocity({ x: 0, y: 0, z: 0 });
    };
    for (const r of m.robots)
      if (r !== me && r !== opp) put(r, r.alliance === 'blue' ? 1.95 : 14.6, r.station * 2 + 0.6);
    while (me.held.length) me.held.pop();
    put(me, 8.2, 6.6);
    put(opp, 7.4, 6.6);
    opp.action = null; // it may have been mid-placement when we moved it
    opp.setVelocity({ x: 2.5, y: 0, z: 0 });
    if (!opp.held.length) opp.held.push('cube');
    const brain = bots.get(0)!;
    (brain as unknown as { decide: (m: Match, r: typeof me) => void }).decide(m, me);
    expect(brain.currentPlan.kind).toBe('defend');
    // The same opponent inside its own loading zone (red's is at the blue end) is off limits.
    put(opp, 2.0, 7.0);
    opp.action = null;
    opp.setVelocity({ x: 2.5, y: 0, z: 0 });
    put(me, 2.8, 7.0);
    (brain as unknown as { decide: (m: Match, r: typeof me) => void }).decide(m, me);
    expect(brain.currentPlan.kind).not.toBe('defend');
  });
});

describe('clean defense on 2023 Charged Up', () => {
  const cu = findGame('2023-chargedup')!;
  type Brainish = {
    defenseOption: (m: Match, r: unknown) => { plan: { kind: string; opponentId?: number } } | null;
    worthDefending: (m: Match, r: unknown, o: unknown) => boolean;
  };
  const setup = (redRoles: Record<number, 'score' | 'defense'>, def = cu) => {
    const m = new Match(def, {
      seed: 2,
      archetypes: { 0: 'defender', 3: 'defender', 4: 'elevator', 5: 'arm' },
    });
    const bots = attachBots(m, {
      partners: 'normal',
      opponents: 'normal',
      playerId: null,
      roles: { 0: 'defense', ...redRoles },
    });
    m.start();
    while (m.phase !== 'teleop') m.step();
    // Park everyone mid-field, clear of protected zones.
    m.robots.forEach((r, i) => {
      r.setPosition({ x: 7 + (i % 3), y: 3 + Math.floor(i / 3) * 2, z: r.archetype.frame.height / 2 + 0.01 });
      r.setVelocity({ x: 0, y: 0, z: 0 });
    });
    return { m, me: m.robots[0]!, brain: bots.get(0)! as unknown as Brainish };
  };
  it('never marks an opposing defender', () => {
    const { m, me, brain } = setup({});
    // Every red robot carries a piece home; we stand between them and their grid.
    for (const id of [3, 4, 5]) if (!m.robots[id]!.held.length) m.robots[id]!.held.push('cube');
    me.setPosition({ x: 10, y: 4.5, z: me.archetype.frame.height / 2 + 0.01 });
    const opt = brain.defenseOption(m, me);
    expect(opt?.plan.kind).toBe('defend');
    expect(opt!.plan.opponentId).not.toBe(3); // red 1 is a defender
  });
  it('goes back to scoring when every opponent is a defender', () => {
    const { m, me, brain } = setup({ 4: 'defense', 5: 'defense' });
    expect(brain.defenseOption(m, me)).toBeNull();
  });
  it("with nobody to mark, waits at the goal end of the opponents' lane, clear of their zones", () => {
    const { m, me, brain } = setup({});
    // Both red scorers deep in their own community: off limits.
    m.robots[4]!.setPosition({ x: 15, y: 1, z: 0.4 });
    m.robots[5]!.setPosition({ x: 15, y: 4, z: 0.4 });
    const opt = brain.defenseOption(m, me) as { plan: { kind: string; point?: { x: number; y: number } } };
    expect(opt.plan.kind).toBe('guard');
    const post = opt.plan.point!;
    // Between mid-field and red's community, outside it (it starts at x 11.6, or 13.2 above y 4).
    expect(post.x).toBeGreaterThan(cu.field.length / 2);
    const community = m.game.zones.find((z) => z.baseId === 'community' && z.alliance === 'red')!;
    expect(distToRegion(post, community.region)).toBeGreaterThan(1);
  });
  it('marks the carrier it can get in front of, and drives into it from goal-side', () => {
    const { m, me, brain } = setup({});
    const o = m.robots[4]!;
    const put = (r: typeof me, x: number, y: number) => {
      r.setPosition({ x, y, z: r.archetype.frame.height / 2 + 0.01 });
      r.setVelocity({ x: 0, y: 0, z: 0 });
    };
    put(m.robots[5]!, 15, 4); // the other scorer out of the way, in its community
    put(o, 7, 4.5); // red, carrying a cube toward its grid (+x)
    o.action = null;
    if (!o.held.length) o.held.push('cube');
    put(me, 8.4, 4.2); // already between it and its grid
    const opt = brain.defenseOption(m, me);
    expect(opt?.plan).toMatchObject({ kind: 'defend', opponentId: 4 });
    const press = (
      brain as unknown as { press: (m: Match, r: unknown, o: unknown) => { x: number; y: number } }
    ).press(m, me, o);
    // Toward the carrier (back toward the red loading zone, -x), at full effort.
    expect(press.x).toBeLessThan(-0.5);
  });
  it('leaves robots near their Charge Station alone in the endgame (endgameProtectedZones)', () => {
    // In 2023 the station is inside the always-protected community; switch that off (the bots'
    // zones and the declared G207 that defenders read) to isolate the endgame-only protection
    // (G209), which matters in games where the climb is elsewhere.
    const endgameOnly = {
      ...cu,
      fouls: { ...cu.fouls, contact: [] },
      botHints: { ...cu.botHints, protectedZones: [] },
    };
    const { m, me, brain } = setup({}, endgameOnly);
    const o = m.robots[4]!;
    o.setPosition({ x: cu.field.length - 3.94, y: 2.745, z: o.archetype.frame.height / 2 + 0.2 });
    me.setPosition({ x: cu.field.length - 6.2, y: 2.745, z: me.archetype.frame.height / 2 + 0.01 });
    expect(brain.worthDefending(m, me, o)).toBe(true); // not endgame yet
    while (!m.isEndgame) m.step();
    o.setPosition({ x: cu.field.length - 3.94, y: 2.745, z: o.archetype.frame.height / 2 + 0.2 });
    me.setPosition({ x: cu.field.length - 6.2, y: 2.745, z: me.archetype.frame.height / 2 + 0.01 });
    expect(brain.worthDefending(m, me, o)).toBe(false);
  });
});

describe('defense on 2024 Crescendo', () => {
  const cr = findGame('2024-crescendo')!;
  it('waits where shooters shoot from in teleop, and is out of the STAGE ZONE before its last 20 s', () => {
    const m = new Match(cr, {
      seed: 1,
      archetypes: {
        0: 'allround',
        1: 'allround',
        2: 'defender',
        3: 'allround',
        4: 'allround',
        5: 'allround',
      },
    });
    const bots = attachBots(m, {
      partners: 'normal',
      opponents: 'normal',
      playerId: null,
      roles: { 2: 'defense' },
    });
    const brain = bots.get(2)! as unknown as {
      defenseOption: (
        m: Match,
        r: unknown,
      ) => { plan: { kind: string; point?: { x: number; y: number } } } | null;
    };
    const me = m.robots[2]!;
    const stage = m.game.zones.find((z) => z.baseId === 'stage-zone' && z.alliance === 'red')!.region;
    // Red's scorers parked in their SOURCE ZONE: off limits, so the defender guards.
    const park = () => {
      for (const id of [3, 4, 5]) {
        const o = m.robots[id]!;
        o.setPosition({ x: 0.8 + (id - 3) * 0.4, y: 0.6, z: o.archetype.frame.height / 2 + 0.01 });
        o.setVelocity({ x: 0, y: 0, z: 0 });
      }
    };
    m.start();
    while (m.phase !== 'teleop') m.step();
    park();
    const teleop = brain.defenseOption(m, me)!.plan;
    expect(teleop.kind).toBe('guard');
    // Within red's shooting range of its SPEAKER (x > 11), where STAGE contact is still legal.
    expect(teleop.point!.x).toBeGreaterThan(11);
    while (m.remaining > cr.timing.endgameSec + 3) m.step();
    park();
    const late = brain.defenseOption(m, me)!.plan;
    expect(late.kind).toBe('guard');
    expect(distToRegion(late.point!, stage)).toBeGreaterThan(1);
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

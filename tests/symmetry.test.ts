import { beforeAll, describe, expect, it } from 'vitest';
import {
  AllianceNav,
  attachBots,
  navInflation,
  type BotBrain,
  type DynamicObstacle,
} from '../src/engine/ai/index.ts';
import { Match, PhysicsFrame, expandDefinition, initPhysics } from '../src/engine/sim/index.ts';
import { eulerToQuat, makeRng, rotateVec, wrapAngle } from '../src/engine/sim/math.ts';
import type { GameDefinition, Region2D, Vec2 } from '../src/engine/sim/types.ts';
import { GAMES, findGame } from '../src/games/index.ts';

/**
 * Blue and red must play the same game (ADR 0007). Every match puts blue at the low-x end, so any
 * part of the engine that treats the two ends differently shows up as one alliance scoring more,
 * or more erratically, than the other in identical match-ups.
 */

beforeAll(async () => {
  await initPhysics();
});

/** The field's mirror / rotation, which carries blue's half onto red's. */
const flipper = (def: GameDefinition) => {
  const { length: L, width: W, symmetry } = def.field;
  return (p: Vec2): Vec2 => ({ x: L - p.x, y: symmetry === 'rotational' ? W - p.y : p.y });
};

/** The nav grid inflations the bots use (one per robot size). */
const inflations = (def: GameDefinition) => [...new Set(def.archetypes.map((a) => navInflation(a.frame)))];

describe.each(GAMES.map((g) => [g.definition.id, g.definition] as const))(
  'alliance symmetry of navigation: %s',
  (_id, def) => {
    const game = expandDefinition(def);
    const flip = flipper(def);
    const { length: L, width: W } = def.field;
    const zones = (a: 'blue' | 'red'): Region2D[] =>
      game.zones.filter((z) => z.alliance === a).map((z) => z.region);
    const close = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-9;

    it.each(inflations(def))('red plans the exact image of blue (inflation %s m)', (inflate) => {
      const blue = new AllianceNav(game, inflate, 'blue');
      const red = new AllianceNav(game, inflate, 'red');
      const rand = makeRng(17);
      const pt = () => ({ x: rand() * L, y: rand() * W });
      for (let i = 0; i < 4000; i++) {
        const p = pt();
        expect(red.isFree(flip(p))).toBe(blue.isFree(p));
        expect(red.isSlow(flip(p))).toBe(blue.isSlow(p));
        expect(close(flip(red.nearestFree(flip(p))), blue.nearestFree(p))).toBe(true);
      }
      // Paths with each alliance's penalty zones (the opponent's) and parked robots.
      for (let i = 0; i < 150; i++) {
        const a = pt();
        const b = pt();
        const avoid: DynamicObstacle[] = [{ ...pt(), radius: 0.45 }];
        const pb = blue.findPath(a, b, avoid, { key: 'opponent', regions: zones('red') });
        const pr = red.findPath(
          flip(a),
          flip(b),
          avoid.map((o) => ({ ...flip(o), radius: o.radius })),
          { key: 'opponent', regions: zones('blue') },
        );
        expect(pr.length).toBe(pb.length);
        pb.forEach((q, k) => expect(close(flip(pr[k]!), q)).toBe(true));
      }
    });
  },
);

describe.each(GAMES.map((g) => [g.definition.id, g.definition] as const))(
  'alliance symmetry of the opening seconds: %s',
  (_id, def) => {
    it.each([false, true])('with fixed randomness, red mirrors blue (flipped physics: %s)', (flipPhysics) => {
      const flip = flipper(def);
      const flipYaw = (y: number) => (def.field.symmetry === 'mirror' ? Math.PI - y : y + Math.PI);
      const m = new Match(def, { seed: 1, flipPhysics });
      (m as unknown as { random: () => number }).random = () => 0.5;
      const brains = attachBots(m, { partners: 'hard', opponents: 'hard', playerId: null });
      m.start();
      let maxPos = 0;
      let maxYaw = 0;
      // Before pieces start flying or bouncing off robots (Rapier's solver isn't mirror-exact).
      while (m.time < 1.5) {
        m.step();
        for (let i = 0; i < 3; i++) {
          const b = m.robots[i]!;
          const r = m.robots[i + 3]!;
          const rp = flip(r);
          maxPos = Math.max(maxPos, Math.hypot(b.x - rp.x, b.y - rp.y));
          maxYaw = Math.max(maxYaw, Math.abs(wrapAngle(b.yaw - flipYaw(r.yaw))));
          const pb = brains.get(i)!.currentPlan as unknown as Record<string, unknown>;
          const pr = brains.get(i + 3)!.currentPlan as unknown as Record<string, unknown>;
          const id = (p: Record<string, unknown>) =>
            String(p.targetId ?? p.stationId ?? p.actionId ?? '').replace(/\.(blue|red)$/, '');
          expect(`${pr.kind}:${id(pr)}`).toBe(`${pb.kind}:${id(pb)}`);
          if (pb.point && pb.kind !== 'acquire') {
            const q = flip(pr.point as Vec2);
            const d = Math.hypot(q.x - (pb.point as Vec2).x, q.y - (pb.point as Vec2).y);
            expect(d).toBeLessThan(1e-9);
          }
        }
      }
      expect(maxPos).toBeLessThan(1e-7);
      expect(maxYaw).toBeLessThan(1e-4);
    });
  },
);

describe('alliance symmetry of a whole match (2023 Charged Up)', () => {
  const def = findGame('2023-chargedup')!;
  const flip = flipper(def);
  const archetypes = {
    0: 'elevator',
    1: 'elevator',
    2: 'cubebot',
    3: 'elevator',
    4: 'elevator',
    5: 'cubebot',
  };
  /** A bot match where both alliances get the same "random" numbers (no noise, jitter or lapses). */
  const fixedMatch = (flipPhysics: boolean) => {
    const m = new Match(def, { seed: 1, archetypes, flipPhysics });
    (m as unknown as { random: () => number }).random = () => 0.5;
    const brains = attachBots(m, { partners: 'hard', opponents: 'hard', playerId: null });
    m.start();
    return { m, brains };
  };
  /** A bot's plan in blue's frame, comparable across alliances. */
  const planOf = (b: BotBrain, red: boolean) => {
    const p = b.currentPlan as unknown as Record<string, unknown>;
    const out: Record<string, unknown> = { kind: p.kind };
    for (const k of ['targetId', 'stationId', 'actionId'])
      if (typeof p[k] === 'string') out[k] = (p[k] as string).replace(/\.(blue|red)$/, '');
    const pt = p.point as Vec2 | undefined;
    if (pt) out.point = red ? flip(pt) : pt;
    if (typeof p.approachYaw === 'number') out.approachYaw = red ? Math.PI - p.approachYaw : p.approachYaw;
    return out;
  };

  it.each([false, true])(
    'with fixed randomness, red bots mirror blue bots’ decisions and moves (flipped physics: %s)',
    (flipPhysics) => {
      const { m, brains } = fixedMatch(flipPhysics);
      let maxPos = 0;
      let maxYaw = 0;
      /** Spots from the field geometry (score, load, endgame): must be exact images. */
      let maxSpot = 0;
      /** Pieces to fetch and approach headings: they come from where Rapier has the piece resting. */
      let maxPiece = 0;
      let acquires = 0;
      // Preload placements and the first trips out, until just before the first staged piece is
      // picked up (from then on Rapier's contact solver, which isn't mirror-exact, has a say).
      while (m.time < 2.5) {
        m.step();
        for (let i = 0; i < 3; i++) {
          const b = m.robots[i]!;
          const r = m.robots[i + 3]!;
          const rp = flip(r);
          maxPos = Math.max(maxPos, Math.hypot(b.x - rp.x, b.y - rp.y));
          maxYaw = Math.max(maxYaw, Math.abs(wrapAngle(b.yaw - (Math.PI - r.yaw))));
          const pb = planOf(brains.get(i)!, false);
          const pr = planOf(brains.get(i + 3)!, true);
          expect(pr.kind).toBe(pb.kind);
          expect(pr.targetId ?? pr.stationId ?? pr.actionId).toBe(pb.targetId ?? pb.stationId ?? pb.actionId);
          const acquire = typeof pb.approachYaw === 'number';
          if (pb.point) {
            const [qb, qr] = [pb.point as Vec2, pr.point as Vec2];
            const d = Math.hypot(qb.x - qr.x, qb.y - qr.y);
            if (acquire) maxPiece = Math.max(maxPiece, d);
            else maxSpot = Math.max(maxSpot, d);
          }
          if (acquire) {
            acquires++;
            const turn = wrapAngle((pr.approachYaw as number) - (pb.approachYaw as number));
            maxPiece = Math.max(maxPiece, Math.abs(turn));
          }
        }
      }
      expect(maxSpot).toBeLessThan(1e-9);
      // A resting piece settles a few micrometers differently on each side (Rapier's contact solver
      // isn't mirror-exact); a heading off by a whole approach step would be ~0.5 rad.
      expect(maxPiece).toBeLessThan(1e-4);
      // Robot positions: exact, since Rapier's origin is mid-field and both halves round alike.
      // Headings: within float32 rounding of a quaternion.
      expect(maxPos).toBeLessThan(1e-7);
      expect(maxYaw).toBeLessThan(1e-4);
      expect(acquires).toBeGreaterThan(0); // the approach-heading choice was exercised
      const placed = (a: string) => m.ledger.entries.filter((e) => e.alliance === a).length;
      expect(placed('blue')).toBeGreaterThan(0);
      expect(placed('red')).toBe(placed('blue'));
    },
  );

  it('flipped physics plays the same match with the alliances’ ends swapped in Rapier', () => {
    // Blue in a flipped-physics match does exactly the Rapier work that red did in a plain one, so
    // the two runs are each other's mirror images with the colors swapped.
    const plain = fixedMatch(false).m;
    const flipped = fixedMatch(true).m;
    expect(plain.physics.flipped).toBe(false);
    expect(flipped.physics.flipped).toBe(true);
    let maxPos = 0;
    let maxYaw = 0;
    while (plain.time < 2.5) {
      plain.step();
      flipped.step();
      for (let i = 0; i < 6; i++) {
        const a = flipped.robots[i]!;
        const b = plain.robots[(i + 3) % 6]!; // the same station of the other alliance
        const bp = flip(b);
        maxPos = Math.max(maxPos, Math.hypot(a.x - bp.x, a.y - bp.y), Math.abs(a.z - b.z));
        maxYaw = Math.max(maxYaw, Math.abs(wrapAngle(a.yaw - (Math.PI - b.yaw))));
      }
    }
    expect(maxPos).toBeLessThan(1e-9);
    expect(maxYaw).toBeLessThan(1e-9);
  });

  it('flips the physics on even seeds, so consecutive seeds alternate ends', () => {
    const ends = [1, 2, 3, 4].map((seed) => new Match(def, { seed }).physics.flipped);
    expect(ends).toEqual([false, true, false, true]);
  });
});

describe('PhysicsFrame', () => {
  const origin = { x: 8, y: 4 };
  it.each(['mirror', 'rotational'] as const)('maps field to physics and back (%s field)', (symmetry) => {
    const rand = makeRng(5);
    for (const flipped of [false, true]) {
      const f = new PhysicsFrame(origin, flipped, symmetry);
      const mirror = flipped && symmetry === 'mirror';
      const p = { x: 3.25, y: 1.5, z: 0.4 };
      const q = f.toPhysics(p);
      expect([f.fieldX(q.x), f.fieldY(q.y), q.z]).toEqual([p.x, p.y, p.z]);
      expect(f.vector(f.vector({ x: 1.5, y: -2, z: 3 }))).toEqual({ x: 1.5, y: -2, z: 3 });
      if (!flipped) expect(q).toEqual({ x: p.x - origin.x, y: p.y - origin.y, z: p.z });
      for (let i = 0; i < 20; i++) {
        // Headings (robots): the heading map turns the robot's front vector like `vector` does.
        const yaw = (rand() * 2 - 1) * Math.PI;
        const front = f.vector({ x: Math.cos(yaw), y: Math.sin(yaw), z: 0 });
        expect(wrapAngle(Math.atan2(front.y, front.x) - f.yaw(yaw))).toBeCloseTo(0, 12);
        expect(wrapAngle(f.yaw(f.yaw(yaw)) - yaw)).toBeCloseTo(0, 12);
        // Turn rates follow headings.
        expect(wrapAngle(f.yaw(yaw + 0.01) - f.yaw(yaw))).toBeCloseTo(f.omega(0.01), 12);
        // Orientations (shapes symmetric about their own x-axis): a mirror conjugates, M R M; a
        // rotation composes, Rz(pi) R. Check where the shape's local axes end up.
        const rot = eulerToQuat({ yaw, pitch: rand() - 0.5, roll: rand() * 3 });
        for (const v of [
          { x: 1, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 },
          { x: 0, y: 0, z: 1 },
        ]) {
          const got = rotateVec(f.quat(rot), v);
          const want = f.vector(rotateVec(rot, mirror ? f.vector(v) : v));
          expect(Math.hypot(got.x - want.x, got.y - want.y, got.z - want.z)).toBeLessThan(1e-12);
        }
      }
    }
  });
});

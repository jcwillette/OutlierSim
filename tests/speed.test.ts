import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import { attachBots, nearZone, zoneCheck } from '../src/engine/ai/bot.ts';
import { NavGrid, obstacleFootprints, type DynamicObstacle } from '../src/engine/ai/navgrid.ts';
import { PointIndex } from '../src/engine/ai/spatial.ts';
import { stepWorld } from '../src/engine/sim/bodyState.ts';
import { Match, initPhysics } from '../src/engine/sim/index.ts';
import { distToRegion, makeRng, pointInRegion, yawFromQuat } from '../src/engine/sim/math.ts';
import { findGame } from '../src/games/index.ts';
import type { Region2D, Vec2 } from '../src/engine/sim/types.ts';

/**
 * The speed-ups in the engine (pose caches, the direct physics step, the A* scratch buffers and
 * heap, the shot-spot index, caches shared across matches) must not change any result. These tests
 * pin each one to the plain version it replaced.
 */

beforeAll(async () => {
  await initPhysics();
});

const cu = findGame('2023-chargedup')!;
const ref = findGame('0000-reference')!;

describe('pose cache', () => {
  it.each([false, true])(
    'never returns a stale pose or velocity, whoever moves the body (flipped physics: %s)',
    (flipPhysics) => {
      const m = new Match(cu, { seed: 3, flipPhysics });
      m.start();
      for (let i = 0; i < 30; i++) m.step();
      const r = m.robots[2]!;
      const p = m.pieces.find((x) => x.status === 'field')!;
      // What Rapier reports right now, read past the cache and moved to field coordinates.
      const f = m.physics;
      const live = () => {
        const t = r.body.translation();
        const v = f.vector(r.body.linvel());
        const yaw = f.yaw(yawFromQuat(r.body.rotation()));
        return [f.fieldX(t.x), f.fieldY(t.y), t.z, v.x, v.y, Math.hypot(v.x, v.y), yaw];
      };
      const cached = () => [r.x, r.y, r.z, r.vx, r.vy, r.speed, r.yaw];
      expect(cached()).toEqual(live());
      r.body.setTranslation({ x: -3, y: 0.5, z: 0.375 }, true); // a raw Rapier write
      expect(cached()).toEqual(live());
      r.setPosition({ x: 6.5, y: 2.25, z: 0.375 });
      expect(r.x).toBeCloseTo(6.5, 5);
      expect(r.y).toBeCloseTo(2.25, 5);
      expect(cached()).toEqual(live());
      r.body.setRotation({ x: 0, y: 0, z: Math.sin(0.3), w: Math.cos(0.3) }, true);
      expect(r.yaw).toBeCloseTo(f.yaw(0.6), 6);
      expect(cached()).toEqual(live());
      r.setVelocity({ x: 1.5, y: -0.5, z: 0 });
      expect([r.vx, r.vy]).toEqual([1.5, -0.5]);
      r.body.applyImpulse({ x: r.body.mass(), y: 0, z: 0 }, true);
      expect(cached()).toEqual(live());
      p.setPosition({ x: 8, y: 4, z: 0.25 });
      expect(p.position.x).toBeCloseTo(8, 5);
      expect(p.position.y).toBeCloseTo(4, 5);
      m.step();
      expect(cached()).toEqual(live());
      const t = p.body.translation();
      expect(p.position).toEqual({ x: f.fieldX(t.x), y: f.fieldY(t.y), z: t.z });
    },
  );
});

describe('stepWorld', () => {
  it('advances the physics exactly like world.step()', () => {
    const scene = () => {
      const w = new RAPIER.World({ x: 0, y: 0, z: -9.81 });
      w.createCollider(
        RAPIER.ColliderDesc.cuboid(10, 10, 0.5),
        w.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, -0.5)),
      );
      const bodies = [0, 1, 2].map((i) => {
        const b = w.createRigidBody(
          RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(i * 0.3, 0, 1 + i)
            .setCcdEnabled(true),
        );
        w.createCollider(RAPIER.ColliderDesc.ball(0.2).setRestitution(0.4), b);
        b.setLinvel({ x: 1 - i, y: 0.5 * i, z: 0 }, true);
        return b;
      });
      return { w, bodies };
    };
    const a = scene();
    const b = scene();
    for (let i = 0; i < 240; i++) {
      a.w.step();
      stepWorld(b.w);
    }
    expect(b.bodies.map((x) => [x.translation(), x.linvel()])).toEqual(
      a.bodies.map((x) => [x.translation(), x.linvel()]),
    );
  });
});

/**
 * The A* search before it was optimized (fresh arrays per search, a heap of {i, g, f} objects),
 * kept verbatim as the reference the fast version must match path for path.
 */
function referenceSearch(grid: NavGrid, a: Vec2, b: Vec2): Vec2[] {
  const gr = grid as unknown as {
    cols: number;
    rows: number;
    cell: number;
    blocked: Uint8Array;
    slow: Uint8Array;
    dyn: Uint8Array | null;
    pen: Uint8Array | null;
    cellOf(p: Vec2): [number, number];
  };
  type Node = { i: number; g: number; f: number };
  const heap: Node[] = [];
  const push = (n: Node) => {
    heap.push(n);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p]!.f <= heap[i]!.f) break;
      [heap[p], heap[i]] = [heap[i]!, heap[p]!];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length && last) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l]!.f < heap[m]!.f) m = l;
        if (r < heap.length && heap[r]!.f < heap[m]!.f) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i]!, heap[m]!];
        i = m;
      }
    }
    return top;
  };
  const center = (c: number, r: number) => ({ x: (c + 0.5) * gr.cell, y: (r + 0.5) * gr.cell });
  const start = grid.nearestFree(a);
  const goal = grid.nearestFree(b);
  if (grid.lineOfSight(start, goal, grid.isSlow(start) || grid.isSlow(goal))) return [goal];
  const [sc, sr] = gr.cellOf(start);
  const [gc, grow] = gr.cellOf(goal);
  const N = gr.cols * gr.rows;
  const g = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const si = sr * gr.cols + sc;
  const gi = grow * gr.cols + gc;
  const h = (i: number) => {
    const dx = Math.abs((i % gr.cols) - gc);
    const dy = Math.abs(((i / gr.cols) | 0) - grow);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  g[si] = 0;
  push({ i: si, g: 0, f: h(si) });
  const dirs = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ] as const;
  let found = false;
  while (heap.length) {
    const cur = pop()!;
    if (closed[cur.i]) continue;
    closed[cur.i] = 1;
    if (cur.i === gi) {
      found = true;
      break;
    }
    const c = cur.i % gr.cols;
    const r = (cur.i / gr.cols) | 0;
    for (const [dc, dr, cost] of dirs) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= gr.cols || nr >= gr.rows) continue;
      const ni = nr * gr.cols + nc;
      if (gr.blocked[ni] || gr.dyn?.[ni] || closed[ni]) continue;
      const s1 = r * gr.cols + nc;
      const s2 = nr * gr.cols + c;
      if (dc && dr && (gr.blocked[s1] || gr.blocked[s2] || gr.dyn?.[s1] || gr.dyn?.[s2])) continue;
      const ng = cur.g + cost * (gr.slow[ni] || gr.pen?.[ni] ? 3 : 1);
      if (ng < g[ni]!) {
        g[ni] = ng;
        came[ni] = cur.i;
        push({ i: ni, g: ng, f: ng + h(ni) });
      }
    }
  }
  if (!found) return [];
  const cells: Vec2[] = [];
  for (let i = gi; i !== -1 && i !== si; i = came[i]!) cells.push(center(i % gr.cols, (i / gr.cols) | 0));
  cells.reverse();
  cells[cells.length - 1] = goal;
  const slowOk = grid.isSlow(start) || cells.some((p) => grid.isSlow(p));
  const out: Vec2[] = [];
  let anchor = start;
  let k = 0;
  while (k < cells.length) {
    let j = cells.length - 1;
    while (j > k && !grid.lineOfSight(anchor, cells[j]!, slowOk)) j--;
    out.push(cells[j]!);
    anchor = cells[j]!;
    k = j + 1;
  }
  return out;
}

describe('NavGrid occupancy', () => {
  /** Distance from p to a polygon's outline (the grid builder's own formula). */
  const distToPoly = (p: Vec2, pts: Vec2[]) => {
    let best = Infinity;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[j]!;
      const b = pts[i]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1e-9)));
      best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
    }
    return best;
  };
  it('the bounding-box shortcut marks exactly the cells the plain per-cell test does', () => {
    for (const def of [cu, ref]) {
      const m = new Match(def, { seed: 1 });
      for (const inflate of [0.3, 0.5, 0.55]) {
        const grid = new NavGrid(m.game, inflate);
        const g = grid as unknown as { blocked: Uint8Array; slow: Uint8Array; cols: number; rows: number };
        const { length: L, width: W } = def.field;
        const solid = obstacleFootprints(m.game);
        const ramps = obstacleFootprints(m.game, 0.5, true);
        const pts = (o: Region2D) => (o as { points: Vec2[] }).points;
        for (let r = 0; r < g.rows; r++)
          for (let c = 0; c < g.cols; c++) {
            const p = { x: (c + 0.5) * grid.cell, y: (r + 0.5) * grid.cell };
            const wall = p.x < inflate || p.y < inflate || p.x > L - inflate || p.y > W - inflate;
            const blocked = wall || solid.some((o) => pointInRegion(p, o) || distToPoly(p, pts(o)) < inflate);
            const slow = ramps.some((o) => pointInRegion(p, o) || distToPoly(p, pts(o)) < inflate * 0.5);
            expect(g.blocked[r * g.cols + c]).toBe(blocked ? 1 : 0);
            expect(g.slow[r * g.cols + c]).toBe(slow ? 1 : 0);
          }
      }
    }
  });
});

describe('NavGrid.findPath', () => {
  it('finds exactly the paths of the original A* (parked robots, penalty zones, dead ends)', () => {
    for (const def of [cu, ref]) {
      const m = new Match(def, { seed: 1 });
      const grid = new NavGrid(m.game, 0.55);
      const { length: L, width: W } = def.field;
      const rand = makeRng(42);
      const pt = () => ({ x: rand() * L, y: rand() * W });
      const zones: Region2D[] = m.game.zones.slice(0, 3).map((z) => z.region);
      // Run the reference inside findPath's setup (same dynamic / penalty masks).
      const internals = grid as unknown as { search(a: Vec2, b: Vec2): Vec2[] };
      const fast = internals.search.bind(grid);
      let compared = 0;
      for (let i = 0; i < 150; i++) {
        const avoid: DynamicObstacle[] = Array.from({ length: i % 4 }, () => ({ ...pt(), radius: 0.45 }));
        const penalty = i % 3 === 0 ? { key: 'test', regions: zones } : undefined;
        const a = pt();
        const b = pt();
        internals.search = (x, y) => referenceSearch(grid, x, y);
        const want = grid.findPath(a, b, avoid, penalty);
        internals.search = fast;
        expect(grid.findPath(a, b, avoid, penalty)).toEqual(want);
        compared++;
      }
      expect(compared).toBe(150);
    }
  });
});

describe('protected-zone checks', () => {
  it('the bounding-box shortcut gives the plain answer for rects, polygons and circles', () => {
    const rand = makeRng(9);
    const regions: Region2D[] = [
      { kind: 'rect', min: { x: 2, y: 1 }, max: { x: 4.5, y: 3 } },
      {
        kind: 'poly',
        points: [
          { x: 10, y: 1 },
          { x: 13, y: 1.5 },
          { x: 12, y: 4 },
          { x: 11, y: 3 },
          { x: 9.5, y: 3.5 },
        ],
      },
      { kind: 'circle', center: { x: 6, y: 6 }, radius: 1.3 },
    ];
    for (const region of regions) {
      const z = zoneCheck(region);
      for (let i = 0; i < 4000; i++) {
        const p = { x: rand() * 16, y: rand() * 8 };
        for (const margin of [0, 0.3, 0.6, 1.5]) {
          const plain = pointInRegion(p, region) || (margin > 0 && distToRegion(p, region) < margin);
          expect(nearZone(p, z, margin)).toBe(plain);
        }
      }
    }
  });
});

describe('PointIndex', () => {
  it('returns the same point as a linear scan, ties included, from anywhere', () => {
    const rand = makeRng(7);
    // Rings of spots like shotSpots(), with duplicates (exact distance ties) and a far outlier.
    const pts: Vec2[] = [];
    for (let d = 1.2; d <= 5.4; d += 0.4)
      for (let k = 0; k < 32; k++) {
        if (rand() < 0.3) continue;
        const a = (k / 32) * 2 * Math.PI;
        pts.push({ x: 4 + d * Math.cos(a), y: 4 + d * Math.sin(a) });
      }
    pts.push({ ...pts[5]! }, { ...pts[40]! }, { x: 30, y: -12 });
    const idx = new PointIndex(pts);
    const queries: Vec2[] = [
      ...Array.from({ length: 2000 }, () => ({ x: rand() * 24 - 6, y: rand() * 20 - 6 })),
      ...pts.slice(0, 50),
      { x: 4, y: 4 }, // equidistant from a whole ring
      { x: -100, y: 50 },
      { x: NaN, y: 1 },
    ];
    for (const q of queries) expect(idx.nearest(q)).toBe(idx.scan(q));
    expect(new PointIndex([]).nearest({ x: 0, y: 0 })).toBeNull();
  });
});

describe('caches shared across matches', () => {
  const fingerprint = (def: typeof cu, seed: number) => {
    const m = new Match(def, { seed, breakdowns: true, archetypes: { 1: def.archetypes.at(-1)!.id } });
    attachBots(m, { partners: 'normal', opponents: 'hard', playerId: null });
    const r = m.runToEnd();
    return JSON.stringify([r.blue, r.red, m.robots.map((x) => x.body.translation())]);
  };
  it('a match replays exactly after other matches of the same game ran in between', () => {
    for (const def of [ref, cu]) {
      const first = fingerprint(def, 11);
      fingerprint(def, 12);
      expect(fingerprint(def, 11)).toBe(first);
    }
  });
});

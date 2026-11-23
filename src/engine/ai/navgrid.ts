import type { ExpandedGame } from '../sim/expand.ts';
import { eulerToQuat, pointInRegion, rotateVec } from '../sim/math.ts';
import type { Region2D, Vec2 } from '../sim/types.ts';

/** Elements whose top is below this are drivable (ramps, bumps). */
const DRIVABLE_HEIGHT = 0.2;
/** Drivable but raised elements (ramps, platforms) at least this tall are "slow" ground. */
const SLOW_MIN_HEIGHT = 0.05;
/** A* cost multiplier for slow ground: bots cross a ramp only when it saves real distance. */
const SLOW_COST = 3;

/** A circle bots should path around this time (e.g. a parked robot). */
export interface DynamicObstacle {
  x: number;
  y: number;
  radius: number;
}

function convexHull2D(points: Vec2[]): Vec2[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Vec2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: Vec2[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0)
      upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** 2D footprints of solid, robot-height field elements (or, with `slow`, of drivable raised ones). */
export function obstacleFootprints(game: ExpandedGame, robotHeight = 0.5, slow = false): Region2D[] {
  const out: Region2D[] = [];
  for (const e of game.elements) {
    if (e.solid === false) continue;
    const q = eulerToQuat(e.rotation);
    let verts: Array<{ x: number; y: number; z: number }>;
    switch (e.shape.kind) {
      case 'box': {
        const { x: sx, y: sy, z: sz } = e.shape.size;
        verts = [];
        for (const a of [-0.5, 0.5])
          for (const b of [-0.5, 0.5])
            for (const c of [-0.5, 0.5]) verts.push({ x: a * sx, y: b * sy, z: c * sz });
        break;
      }
      case 'cylinder': {
        const { radius: r, height: hgt } = e.shape;
        verts = [];
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * 2 * Math.PI;
          for (const z of [-hgt / 2, hgt / 2]) verts.push({ x: r * Math.cos(a), y: r * Math.sin(a), z });
        }
        break;
      }
      case 'hull':
        verts = e.shape.vertices;
        break;
    }
    const world = verts.map((v) => {
      const w = rotateVec(q, v);
      return { x: e.position.x + w.x, y: e.position.y + w.y, z: e.position.z + w.z };
    });
    const minZ = Math.min(...world.map((w) => w.z));
    const maxZ = Math.max(...world.map((w) => w.z));
    if (
      slow ? maxZ >= DRIVABLE_HEIGHT || maxZ < SLOW_MIN_HEIGHT : maxZ < DRIVABLE_HEIGHT || minZ > robotHeight
    )
      continue;
    out.push({ kind: 'poly', points: convexHull2D(world) });
  }
  return out;
}

interface Node {
  i: number;
  g: number;
  f: number;
}

/** Occupancy grid of the field for one robot size, with A* + line-of-sight smoothing. */
export class NavGrid {
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
  private readonly blocked: Uint8Array;
  /** Cells on drivable ramps / platforms (extra path cost). */
  private readonly slow: Uint8Array;
  /** Per-call dynamic obstacle mask (set during findPath). */
  private dyn: Uint8Array | null = null;
  /** Per-call "keep out if you can" mask (set during findPath), costed like slow ground. */
  private pen: Uint8Array | null = null;
  private readonly penaltyCache = new Map<string, Uint8Array>();

  constructor(
    readonly game: ExpandedGame,
    readonly inflate: number,
    cell = 0.12,
  ) {
    const { length: L, width: W } = game.def.field;
    this.cell = cell;
    this.cols = Math.ceil(L / cell);
    this.rows = Math.ceil(W / cell);
    this.blocked = new Uint8Array(this.cols * this.rows);
    this.slow = new Uint8Array(this.cols * this.rows);
    const obstacles = obstacleFootprints(game);
    const ramps = obstacleFootprints(game, 0.5, true);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const p = this.center(c, r);
        let b = p.x < inflate || p.y < inflate || p.x > L - inflate || p.y > W - inflate;
        if (!b) {
          for (const o of obstacles) {
            if (pointInRegion(p, o) || distToPoly(p, o) < inflate) {
              b = true;
              break;
            }
          }
        }
        this.blocked[r * this.cols + c] = b ? 1 : 0;
        // Slow if any part of the robot would be on the ramp.
        if (ramps.some((o) => pointInRegion(p, o) || distToPoly(p, o) < inflate * 0.5))
          this.slow[r * this.cols + c] = 1;
      }
    }
  }

  private center(c: number, r: number): Vec2 {
    return { x: (c + 0.5) * this.cell, y: (r + 0.5) * this.cell };
  }
  private cellOf(p: Vec2): [number, number] {
    return [
      Math.min(this.cols - 1, Math.max(0, Math.floor(p.x / this.cell))),
      Math.min(this.rows - 1, Math.max(0, Math.floor(p.y / this.cell))),
    ];
  }

  isFree(p: Vec2): boolean {
    const [c, r] = this.cellOf(p);
    const i = r * this.cols + c;
    return this.blocked[i] === 0 && !this.dyn?.[i];
  }

  /** True if `p` is on a drivable ramp or platform, or in this search's penalty regions. */
  isSlow(p: Vec2): boolean {
    const [c, r] = this.cellOf(p);
    const i = r * this.cols + c;
    return this.slow[i] === 1 || this.pen?.[i] === 1;
  }

  /** Cells inside `regions`, cached under `key` (e.g. the zones one alliance should stay out of). */
  private penaltyMask(key: string, regions: readonly Region2D[]): Uint8Array {
    let mask = this.penaltyCache.get(key);
    if (!mask) {
      mask = new Uint8Array(this.cols * this.rows);
      for (let r = 0; r < this.rows; r++)
        for (let c = 0; c < this.cols; c++)
          if (regions.some((z) => pointInRegion(this.center(c, r), z))) mask[r * this.cols + c] = 1;
      this.penaltyCache.set(key, mask);
    }
    return mask;
  }

  /** Nearest free point to `p` (spiral search), or `p` itself if free. */
  nearestFree(p: Vec2): Vec2 {
    if (this.isFree(p)) return p;
    const [c0, r0] = this.cellOf(p);
    for (let rad = 1; rad < Math.max(this.cols, this.rows); rad++) {
      let best: Vec2 | null = null;
      let bestD = Infinity;
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
          const c = c0 + dc;
          const r = r0 + dr;
          if (c < 0 || r < 0 || c >= this.cols || r >= this.rows || this.blocked[r * this.cols + c]) continue;
          const q = this.center(c, r);
          const d = Math.hypot(q.x - p.x, q.y - p.y);
          if (d < bestD) {
            bestD = d;
            best = q;
          }
        }
      }
      if (best) return best;
    }
    return p;
  }

  /** True if the straight segment a-b stays in free cells (and off slow ground unless `slowOk`). */
  lineOfSight(a: Vec2, b: Vec2, slowOk = true): boolean {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.ceil(d / (this.cell * 0.5));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (!this.isFree(q) || (!slowOk && this.isSlow(q))) return false;
    }
    return true;
  }

  /**
   * Smoothed waypoint path from `a` to `b` (excluding `a`). Empty if unreachable. Ramps cost extra,
   * and `avoid` circles (e.g. parked robots) are treated as walls for this search, except one that
   * covers the start or the goal. `penalty` regions (e.g. the opponent's protected zones) cost as
   * much as ramps: crossed only when going around is much longer.
   */
  findPath(
    a: Vec2,
    b: Vec2,
    avoid: readonly DynamicObstacle[] = [],
    penalty?: { key: string; regions: readonly Region2D[] },
  ): Vec2[] {
    this.dyn = this.dynamicMask(a, b, avoid);
    this.pen = penalty?.regions.length ? this.penaltyMask(penalty.key, penalty.regions) : null;
    try {
      return this.search(a, b);
    } finally {
      this.dyn = null;
      this.pen = null;
    }
  }

  private dynamicMask(a: Vec2, b: Vec2, avoid: readonly DynamicObstacle[]): Uint8Array | null {
    let mask: Uint8Array | null = null;
    for (const o of avoid) {
      const rad = o.radius + this.inflate;
      if (Math.hypot(a.x - o.x, a.y - o.y) < rad || Math.hypot(b.x - o.x, b.y - o.y) < rad) continue;
      mask ??= new Uint8Array(this.cols * this.rows);
      const [c0, r0] = this.cellOf({ x: o.x - rad, y: o.y - rad });
      const [c1, r1] = this.cellOf({ x: o.x + rad, y: o.y + rad });
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++) {
          const p = this.center(c, r);
          if (Math.hypot(p.x - o.x, p.y - o.y) < rad) mask[r * this.cols + c] = 1;
        }
    }
    return mask;
  }

  private search(a: Vec2, b: Vec2): Vec2[] {
    const start = this.nearestFree(a);
    const goal = this.nearestFree(b);
    if (this.lineOfSight(start, goal, this.isSlow(start) || this.isSlow(goal))) return [goal];
    const [sc, sr] = this.cellOf(start);
    const [gc, gr] = this.cellOf(goal);
    const N = this.cols * this.rows;
    const g = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const si = sr * this.cols + sc;
    const gi = gr * this.cols + gc;
    const h = (i: number) => {
      const c = i % this.cols;
      const r = (i / this.cols) | 0;
      const dx = Math.abs(c - gc);
      const dy = Math.abs(r - gr);
      return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
    };
    const open = new MinHeap();
    g[si] = 0;
    open.push({ i: si, g: 0, f: h(si) });
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
    while (open.size) {
      const cur = open.pop()!;
      if (closed[cur.i]) continue;
      closed[cur.i] = 1;
      if (cur.i === gi) {
        found = true;
        break;
      }
      const c = cur.i % this.cols;
      const r = (cur.i / this.cols) | 0;
      for (const [dc, dr, cost] of dirs) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows) continue;
        const ni = nr * this.cols + nc;
        if (this.blocked[ni] || this.dyn?.[ni] || closed[ni]) continue;
        const side1 = r * this.cols + nc;
        const side2 = nr * this.cols + c;
        if (
          dc &&
          dr &&
          (this.blocked[side1] || this.blocked[side2] || this.dyn?.[side1] || this.dyn?.[side2])
        )
          continue;
        const ng = cur.g + cost * (this.slow[ni] || this.pen?.[ni] ? SLOW_COST : 1);
        if (ng < g[ni]!) {
          g[ni] = ng;
          came[ni] = cur.i;
          open.push({ i: ni, g: ng, f: ng + h(ni) });
        }
      }
    }
    if (!found) return [];
    const cells: Vec2[] = [];
    for (let i = gi; i !== -1 && i !== si; i = came[i]!)
      cells.push(this.center(i % this.cols, (i / this.cols) | 0));
    cells.reverse();
    cells[cells.length - 1] = goal;
    // string-pull smoothing (shortcuts may only cross ramps if the search chose to)
    const slowOk = this.isSlow(start) || cells.some((p) => this.isSlow(p));
    const out: Vec2[] = [];
    let anchor = start;
    let k = 0;
    while (k < cells.length) {
      let j = cells.length - 1;
      while (j > k && !this.lineOfSight(anchor, cells[j]!, slowOk)) j--;
      out.push(cells[j]!);
      anchor = cells[j]!;
      k = j + 1;
    }
    return out;
  }
}

function distToPoly(p: Vec2, r: Region2D): number {
  if (r.kind !== 'poly') return Infinity;
  let best = Infinity;
  const pts = r.points;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[j]!;
    const b = pts[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  }
  return best;
}

class MinHeap {
  private readonly a: Node[] = [];
  get size(): number {
    return this.a.length;
  }
  push(n: Node): void {
    const a = this.a;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p]!.f <= a[i]!.f) break;
      [a[p], a[i]] = [a[i]!, a[p]!];
      i = p;
    }
  }
  pop(): Node | undefined {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length && last) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l]!.f < a[m]!.f) m = l;
        if (r < a.length && a[r]!.f < a[m]!.f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top;
  }
}

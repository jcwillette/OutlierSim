import type { ExpandedGame } from '../sim/expand.ts';
import { eulerToQuat, pointInRegion, rotateVec } from '../sim/math.ts';
import type { Region2D, Vec2 } from '../sim/types.ts';

/** Elements whose top is below this are drivable (ramps, bumps). */
const DRIVABLE_HEIGHT = 0.2;

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

/** 2D footprints of solid, robot-height field elements. */
export function obstacleFootprints(game: ExpandedGame, robotHeight = 0.5): Region2D[] {
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
    if (maxZ < DRIVABLE_HEIGHT || minZ > robotHeight) continue;
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
    const obstacles = obstacleFootprints(game);
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
    return this.blocked[r * this.cols + c] === 0;
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

  /** True if the straight segment a-b stays in free cells. */
  lineOfSight(a: Vec2, b: Vec2): boolean {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.ceil(d / (this.cell * 0.5));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (!this.isFree({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return false;
    }
    return true;
  }

  /** Smoothed waypoint path from `a` to `b` (excluding `a`). Empty if unreachable. */
  findPath(a: Vec2, b: Vec2): Vec2[] {
    const start = this.nearestFree(a);
    const goal = this.nearestFree(b);
    if (this.lineOfSight(start, goal)) return [goal];
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
        if (this.blocked[ni] || closed[ni]) continue;
        if (dc && dr && (this.blocked[r * this.cols + nc] || this.blocked[nr * this.cols + c])) continue;
        const ng = cur.g + cost;
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
    // string-pull smoothing
    const out: Vec2[] = [];
    let anchor = start;
    let k = 0;
    while (k < cells.length) {
      let j = cells.length - 1;
      while (j > k && !this.lineOfSight(anchor, cells[j]!)) j--;
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

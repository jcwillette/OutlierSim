import type { Vec2 } from '../sim/types.ts';

/**
 * A fixed set of points with a bucket grid, for nearest-point queries that give exactly the answer
 * of a linear scan (`Math.hypot` distance, the earliest point in the list among equal distances).
 * Bots ask "nearest shot spot to here" for every piece on the field every time they plan, and a
 * shooter can have hundreds of spots; this looks at a few buckets instead of all of them.
 */
export class PointIndex {
  private readonly x0: number;
  private readonly y0: number;
  private readonly cols: number;
  private readonly rows: number;
  /** Point indices per bucket, ascending. */
  private readonly buckets: number[][];

  constructor(
    readonly points: readonly Vec2[],
    private readonly cell = 0.5,
  ) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    this.x0 = points.length ? minX : 0;
    this.y0 = points.length ? minY : 0;
    this.cols = points.length ? Math.floor((maxX - minX) / cell) + 1 : 0;
    this.rows = points.length ? Math.floor((maxY - minY) / cell) + 1 : 0;
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
    points.forEach((p, i) => this.buckets[this.bucketOf(p.x, p.y)]!.push(i));
  }

  private colOf(x: number): number {
    return Math.min(this.cols - 1, Math.max(0, Math.floor((x - this.x0) / this.cell)));
  }
  private rowOf(y: number): number {
    return Math.min(this.rows - 1, Math.max(0, Math.floor((y - this.y0) / this.cell)));
  }
  private bucketOf(x: number, y: number): number {
    return this.rowOf(y) * this.cols + this.colOf(x);
  }

  /** The point nearest `from`, or null if there are none. */
  nearest(from: Vec2): Vec2 | null {
    const pts = this.points;
    if (!pts.length) return null;
    if (!Number.isFinite(from.x) || !Number.isFinite(from.y)) return this.scan(from);
    // Bucket of `from` on the unbounded grid (it may lie outside the points' bounding box).
    const cx = Math.floor((from.x - this.x0) / this.cell);
    const cy = Math.floor((from.y - this.y0) / this.cell);
    // Rings of buckets around (cx, cy) needed to cover the whole grid.
    const lastRing = Math.max(cx, this.cols - 1 - cx, cy, this.rows - 1 - cy);
    let best = -1;
    let bestD = Infinity;
    for (let k = 0; k <= lastRing; k++) {
      // Every point in ring k or beyond is more than (k - 1) cells away, so it can't be nearer
      // (or tie) once the best is clearly closer than that. 1e-9 m covers rounding in the buckets.
      if (best >= 0 && bestD < (k - 1) * this.cell - 1e-9) break;
      for (let r = cy - k; r <= cy + k; r++) {
        if (r < 0 || r >= this.rows) continue;
        const edgeRow = r === cy - k || r === cy + k;
        for (let c = cx - k; c <= cx + k; c += edgeRow ? 1 : 2 * k) {
          if (c >= 0 && c < this.cols) {
            for (const i of this.buckets[r * this.cols + c]!) {
              const p = pts[i]!;
              const d = Math.hypot(p.x - from.x, p.y - from.y);
              if (d < bestD || (d === bestD && i < best)) {
                bestD = d;
                best = i;
              }
            }
          }
          if (k === 0) break;
        }
      }
    }
    return best >= 0 ? pts[best]! : null;
  }

  /** The plain linear scan this index stands in for. */
  scan(from: Vec2): Vec2 | null {
    let best: Vec2 | null = null;
    let bestD = Infinity;
    for (const p of this.points) {
      const d = Math.hypot(p.x - from.x, p.y - from.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }
}

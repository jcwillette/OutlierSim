import { fieldFromRed, type ExpandedGame } from '../sim/expand.ts';
import {
  distToRegion,
  eulerToQuat,
  flipRegion,
  pointInRegion,
  regionOutline,
  rotateVec,
} from '../sim/math.ts';
import type { Alliance, Region2D, Vec2 } from '../sim/types.ts';

/** Elements whose top is below this are drivable (ramps, bumps). */
const DRIVABLE_HEIGHT = 0.2;
/** Drivable but raised elements (ramps, platforms) at least this tall are "slow" ground. */
const SLOW_MIN_HEIGHT = 0.05;
/** A* cost multiplier for slow ground: bots cross a ramp only when it saves real distance. */
const SLOW_COST = 3;

/**
 * The height a robot's nav grid is built for: its frame height if some structure is too low for it
 * (`FieldElement.clearance`), else 0, so every robot that fits under everything shares one grid.
 */
export function navHeight(game: ExpandedGame, frameHeight: number): number {
  return game.elements.some((e) => e.clearance !== undefined && frameHeight > e.clearance) ? frameHeight : 0;
}

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

/**
 * 2D footprints of the solid field elements bots drive around (walls), or with `slow`, of the ones
 * they drive over slowly (ramps, platforms). `FieldElement.nav` decides, or by default the height:
 * parts at least `DRIVABLE_HEIGHT` tall that reach below `robotHeight` are walls, lower ones at least
 * `SLOW_MIN_HEIGHT` tall are ramps. `frameHeight`: a robot this tall also treats the structures it
 * doesn't fit under (`FieldElement.clearance`) as walls.
 */
export function obstacleFootprints(
  game: ExpandedGame,
  robotHeight = 0.5,
  slow = false,
  frameHeight = 0,
): Region2D[] {
  const out: Region2D[] = [];
  for (const e of game.elements) {
    const tooLow = !slow && e.clearance !== undefined && frameHeight > e.clearance;
    if (e.solid === false || (e.nav === 'none' && !tooLow)) continue;
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
    const kind = tooLow
      ? 'wall'
      : e.nav === 'wall' || e.nav === 'ramp'
        ? e.nav
        : maxZ >= DRIVABLE_HEIGHT
          ? minZ > robotHeight
            ? null // overhead: robots fit under it
            : 'wall'
          : maxZ >= SLOW_MIN_HEIGHT
            ? 'ramp'
            : null;
    if (kind !== (slow ? 'ramp' : 'wall')) continue;
    out.push({ kind: 'poly', points: convexHull2D(world) });
  }
  return out;
}

/** Neighbor steps for A*: 4 straight, then 4 diagonal (this order decides ties). */
const STEP_DC = [1, -1, 0, 0, 1, 1, -1, -1] as const;
const STEP_DR = [0, 0, 1, -1, 1, -1, 1, -1] as const;
const STEP_COST = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2] as const;
const STEP_COST_SLOW = STEP_COST.map((c) => c * SLOW_COST);
/** Octile-distance weight of the diagonal part of the A* heuristic. */
const DIAG_EXTRA = Math.SQRT2 - 1;

/** Occupancy grid of the field for one robot size, with A* + line-of-sight smoothing. */
export class NavGrid {
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
  private readonly blocked: Uint8Array;
  /**
   * Per cell, bit k set if step k (STEP_DC/DR[k]) stays on the field, lands on an unblocked cell
   * and, for a diagonal, doesn't cut a blocked corner: the static part of A*'s neighbor test.
   */
  private readonly moves: Uint8Array;
  /** Index offset of each step. */
  private readonly stepDelta: Int32Array;
  /** Cells on drivable ramps / platforms (extra path cost). */
  private readonly slow: Uint8Array;
  /** Per-call dynamic obstacle mask (set during findPath). */
  private dyn: Uint8Array | null = null;
  /** Per-call "keep out if you can" mask (set during findPath), costed like slow ground. */
  private pen: Uint8Array | null = null;
  private readonly penaltyCache = new Map<string, Uint8Array>();
  // A* scratch, reused across searches. g / came are valid where `stamp` equals the current search
  // id, and a cell is closed where `closedAt` does; this saves clearing ~10k cells per search.
  // g stays Float32 (as it always was), so path costs, ties and paths are unchanged.
  private readonly gScratch: Float32Array;
  private readonly came: Int32Array;
  private readonly stamp: Uint32Array;
  private readonly closedAt: Uint32Array;
  private searchId = 0;
  private readonly open = new NodeHeap();
  private dynScratch: Uint8Array | null = null;

  /** `frameHeight`: the robot's height, for structures it doesn't fit under (`FieldElement.clearance`). */
  constructor(
    readonly game: ExpandedGame,
    readonly inflate: number,
    cell = 0.12,
    frameHeight = 0,
  ) {
    const { length: L, width: W } = game.def.field;
    this.cell = cell;
    this.cols = Math.ceil(L / cell);
    this.rows = Math.ceil(W / cell);
    this.blocked = new Uint8Array(this.cols * this.rows);
    this.slow = new Uint8Array(this.cols * this.rows);
    this.moves = new Uint8Array(this.cols * this.rows);
    this.stepDelta = Int32Array.from(STEP_DC, (dc, k) => STEP_DR[k]! * this.cols + dc);
    this.gScratch = new Float32Array(this.cols * this.rows);
    this.came = new Int32Array(this.cols * this.rows);
    this.stamp = new Uint32Array(this.cols * this.rows);
    this.closedAt = new Uint32Array(this.cols * this.rows);
    const obstacles = obstacleFootprints(game, 0.5, false, frameHeight).map((o) => withBounds(o, inflate));
    const ramps = obstacleFootprints(game, 0.5, true).map((o) => withBounds(o, inflate * 0.5));
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const p = this.center(c, r);
        let b = p.x < inflate || p.y < inflate || p.x > L - inflate || p.y > W - inflate;
        if (!b) {
          for (const o of obstacles) {
            if (o.near(p) && (pointInRegion(p, o.region) || distToPoly(p, o.region) < inflate)) {
              b = true;
              break;
            }
          }
        }
        this.blocked[r * this.cols + c] = b ? 1 : 0;
        // Slow if any part of the robot would be on the ramp.
        if (
          ramps.some(
            (o) => o.near(p) && (pointInRegion(p, o.region) || distToPoly(p, o.region) < inflate * 0.5),
          )
        )
          this.slow[r * this.cols + c] = 1;
      }
    }
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        let mask = 0;
        for (let k = 0; k < 8; k++) {
          const dc = STEP_DC[k]!;
          const dr = STEP_DR[k]!;
          const nc = c + dc;
          const nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows) continue;
          if (this.blocked[nr * this.cols + nc]) continue;
          if (dc && dr && (this.blocked[r * this.cols + nc] || this.blocked[nr * this.cols + c])) continue;
          mask |= 1 << k;
        }
        this.moves[r * this.cols + c] = mask;
      }
    }
  }

  private center(c: number, r: number): Vec2 {
    return { x: (c + 0.5) * this.cell, y: (r + 0.5) * this.cell };
  }
  private cellOf(p: Vec2): [number, number] {
    return [this.colOf(p.x), this.rowOf(p.y)];
  }
  private colOf(x: number): number {
    return Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cell)));
  }
  private rowOf(y: number): number {
    return Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cell)));
  }
  /** Grid index of the cell containing (x, y), clamped to the field. */
  private indexAt(x: number, y: number): number {
    return this.rowOf(y) * this.cols + this.colOf(x);
  }
  private freeAt(i: number): boolean {
    return this.blocked[i] === 0 && !this.dyn?.[i];
  }
  private slowAt(i: number): boolean {
    return this.slow[i] === 1 || this.pen?.[i] === 1;
  }

  isFree(p: Vec2): boolean {
    return this.freeAt(this.indexAt(p.x, p.y));
  }

  /** True if `p` is on a drivable ramp or platform, or in this search's penalty regions. */
  isSlow(p: Vec2): boolean {
    return this.slowAt(this.indexAt(p.x, p.y));
  }

  /**
   * Cells where any part of the robot would be inside `regions` (center inside, or within the grid's
   * inflation of one), cached under `key` (e.g. the zones one alliance should stay out of).
   */
  private penaltyMask(key: string, regions: readonly Region2D[]): Uint8Array {
    let mask = this.penaltyCache.get(key);
    if (!mask) {
      mask = new Uint8Array(this.cols * this.rows);
      const near = regions.map((z) => withBounds(z, this.inflate));
      for (let r = 0; r < this.rows; r++)
        for (let c = 0; c < this.cols; c++) {
          const p = this.center(c, r);
          if (
            near.some(
              (z) => z.near(p) && (pointInRegion(p, z.region) || distToRegion(p, z.region) < this.inflate),
            )
          )
            mask[r * this.cols + c] = 1;
        }
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
      const k = this.indexAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      if (!this.freeAt(k) || (!slowOk && this.slowAt(k))) return false;
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
      if (!mask) {
        mask = this.dynScratch ??= new Uint8Array(this.cols * this.rows);
        mask.fill(0);
      }
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
    const cols = this.cols;
    const si = this.indexAt(start.x, start.y);
    const gc = this.colOf(goal.x);
    const gr = this.rowOf(goal.y);
    const gi = gr * cols + gc;
    if (++this.searchId === 0xffffffff) {
      this.stamp.fill(0);
      this.closedAt.fill(0);
      this.searchId = 1;
    }
    const id = this.searchId;
    const g = this.gScratch;
    const came = this.came;
    const stamp = this.stamp;
    const closed = this.closedAt;
    const moves = this.moves;
    const delta = this.stepDelta;
    const slow = this.slow;
    const dyn = this.dyn;
    const pen = this.pen;
    // Octile distance to the goal cell (admissible: every step costs at least its length).
    const h = (c: number, r: number) => {
      const dx = Math.abs(c - gc);
      const dy = Math.abs(r - gr);
      return Math.max(dx, dy) + DIAG_EXTRA * Math.min(dx, dy);
    };
    const open = this.open;
    open.clear();
    g[si] = 0;
    stamp[si] = id;
    came[si] = -1;
    open.push(si, 0, h(si % cols, (si / cols) | 0));
    let found = false;
    while (open.size) {
      open.pop();
      const ci = open.poppedI;
      const cg = open.poppedG;
      if (closed[ci] === id) continue;
      closed[ci] = id;
      if (ci === gi) {
        found = true;
        break;
      }
      const c = ci % cols;
      const r = (ci / cols) | 0;
      const mv = moves[ci]!;
      for (let k = 0; k < 8; k++) {
        if (!(mv & (1 << k))) continue; // off the field, into a wall, or cutting a wall's corner
        const ni = ci + delta[k]!;
        if (closed[ni] === id) continue;
        const dc = STEP_DC[k]!;
        const dr = STEP_DR[k]!;
        // Parked robots this search: same tests as walls.
        if (dyn !== null && (dyn[ni] || (dc && dr && (dyn[ci + dc] || dyn[ci + dr * cols])))) continue;
        const ng = cg + (slow[ni] || (pen !== null && pen[ni]) ? STEP_COST_SLOW[k]! : STEP_COST[k]!);
        if (ng < (stamp[ni] === id ? g[ni]! : Infinity)) {
          g[ni] = ng;
          stamp[ni] = id;
          came[ni] = ci;
          open.push(ni, ng, ng + h(c + dc, r + dr));
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

/**
 * One alliance's navigation: a NavGrid laid out from that alliance's own wall.
 *
 * A grid starts at a corner of the field, and its cells rarely fit the field exactly (2023's 0.12 m
 * cells leave the red half 1.8 cm off-grid). A* and `nearestFree` also break ties in fixed
 * directions. One shared grid would therefore make red's half a slightly different maze from blue's:
 * other paths, other spots, other tie-breaks. Red plans instead on a grid of the field seen from the
 * red wall (`fieldFromRed`), and every query point and answer goes through the field's mirror /
 * rotation. On a symmetric field both alliances get exact mirror images of each other's paths and
 * spots (ADR 0007). Blue's grid is the plain field, so blue plans exactly as before.
 */
export class AllianceNav {
  readonly grid: NavGrid;
  /** Field point to this alliance's frame and back (its own inverse). Null for blue. */
  private readonly flip: ((p: Vec2) => Vec2) | null;
  private readonly flipZone: ((r: Region2D) => Region2D) | null;
  /** Penalty regions moved into this alliance's frame, by penalty key. */
  private readonly flippedPenalties = new Map<string, Region2D[]>();

  constructor(
    game: ExpandedGame,
    inflate: number,
    readonly alliance: Alliance,
    frameHeight = 0,
  ) {
    const field = game.def.field;
    if (alliance === 'blue') {
      this.flip = null;
      this.flipZone = null;
      this.grid = new NavGrid(game, inflate, undefined, frameHeight);
    } else {
      const { length: L, width: W, symmetry } = field;
      this.flip =
        symmetry === 'rotational' ? (p) => ({ x: L - p.x, y: W - p.y }) : (p) => ({ x: L - p.x, y: p.y });
      this.flipZone = (r) => flipRegion(r, symmetry, field);
      this.grid = new NavGrid(fieldFromRed(game), inflate, undefined, frameHeight);
    }
  }

  isFree(p: Vec2): boolean {
    return this.grid.isFree(this.flip ? this.flip(p) : p);
  }

  isSlow(p: Vec2): boolean {
    return this.grid.isSlow(this.flip ? this.flip(p) : p);
  }

  /** Nearest free point to `p`, or `p` itself if free. */
  nearestFree(p: Vec2): Vec2 {
    if (!this.flip) return this.grid.nearestFree(p);
    const q = this.flip(p);
    const free = this.grid.nearestFree(q);
    return free === q ? p : this.flip(free);
  }

  /** `NavGrid.findPath` in this alliance's frame. */
  findPath(
    a: Vec2,
    b: Vec2,
    avoid: readonly DynamicObstacle[] = [],
    penalty?: { key: string; regions: readonly Region2D[] },
  ): Vec2[] {
    const flip = this.flip;
    if (!flip) return this.grid.findPath(a, b, avoid, penalty);
    let regions: Region2D[] | undefined;
    if (penalty) {
      regions = this.flippedPenalties.get(penalty.key);
      if (!regions) this.flippedPenalties.set(penalty.key, (regions = penalty.regions.map(this.flipZone!)));
    }
    return this.grid
      .findPath(
        flip(a),
        flip(b),
        avoid.map((o) => ({ ...flip(o), radius: o.radius })),
        penalty && { key: penalty.key, regions: regions! },
      )
      .map(flip);
  }
}

/**
 * A footprint with a quick "could `p` be inside it or within `reach` of it" test: false only when `p`
 * is clearly (1e-9 m) farther than `reach` outside its bounding box, where the exact tests
 * (`pointInRegion`, `distToPoly(p) < reach`) are false too. It only skips work.
 */
function withBounds(region: Region2D, reach: number): { region: Region2D; near: (p: Vec2) => boolean } {
  if (region.kind === 'circle') return { region, near: () => true };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const q of regionOutline(region)) {
    minX = Math.min(minX, q.x);
    minY = Math.min(minY, q.y);
    maxX = Math.max(maxX, q.x);
    maxY = Math.max(maxY, q.y);
  }
  const m = reach + 1e-9;
  return {
    region,
    near: (p) => p.x >= minX - m && p.x <= maxX + m && p.y >= minY - m && p.y <= maxY + m,
  };
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

/**
 * Binary min-heap of A* nodes (cell index, g, f) on typed arrays. Same comparisons and sift order
 * as a textbook array heap (`<=` going up, strict `<` going down, left child first), so nodes with
 * equal f come out in the same order as they always did.
 */
class NodeHeap {
  private cell = new Int32Array(1024);
  private g = new Float64Array(1024);
  private f = new Float64Array(1024);
  size = 0;
  /** The node the last `pop()` removed. */
  poppedI = 0;
  poppedG = 0;

  clear(): void {
    this.size = 0;
  }

  push(i: number, g: number, f: number): void {
    if (this.size === this.cell.length) this.grow();
    const cell = this.cell;
    const gs = this.g;
    const fs = this.f;
    let k = this.size++;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (fs[p]! <= f) break;
      cell[k] = cell[p]!;
      gs[k] = gs[p]!;
      fs[k] = fs[p]!;
      k = p;
    }
    cell[k] = i;
    gs[k] = g;
    fs[k] = f;
  }

  pop(): void {
    const cell = this.cell;
    const gs = this.g;
    const fs = this.f;
    this.poppedI = cell[0]!;
    this.poppedG = gs[0]!;
    const n = --this.size;
    if (n === 0) return;
    // Sift the last node down from the root.
    const li = cell[n]!;
    const lg = gs[n]!;
    const lf = fs[n]!;
    let k = 0;
    for (;;) {
      const l = 2 * k + 1;
      const r = l + 1;
      let m = k;
      let mf = lf;
      if (l < n && fs[l]! < mf) {
        m = l;
        mf = fs[l]!;
      }
      if (r < n && fs[r]! < mf) m = r;
      if (m === k) break;
      cell[k] = cell[m]!;
      gs[k] = gs[m]!;
      fs[k] = fs[m]!;
      k = m;
    }
    cell[k] = li;
    gs[k] = lg;
    fs[k] = lf;
  }

  private grow(): void {
    const n = this.cell.length * 2;
    const cell = new Int32Array(n);
    const g = new Float64Array(n);
    const f = new Float64Array(n);
    cell.set(this.cell);
    g.set(this.g);
    f.set(this.f);
    this.cell = cell;
    this.g = g;
    this.f = f;
  }
}

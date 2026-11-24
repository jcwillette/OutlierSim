import type { Euler, Region2D, Vec2, Vec3 } from './types.ts';

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function wrapAngle(a: number): number {
  let r = a % (2 * Math.PI);
  if (r > Math.PI) r -= 2 * Math.PI;
  if (r < -Math.PI) r += 2 * Math.PI;
  return r;
}

/**
 * Signed turn from heading `from` to `to`, the short way round. Half a turn either way is a tie
 * (within a microradian, so float rounding can't decide it); `tie` picks the side, 1 =
 * counterclockwise. Pass the alliance's handedness so both alliances break it alike (ADR 0007).
 */
export function turnTo(from: number, to: number, tie: 1 | -1 = 1): number {
  const d = wrapAngle(to - from);
  return Math.PI - Math.abs(d) < 1e-6 ? tie * Math.PI : d;
}

export const dist2 = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Deterministic PRNG (mulberry32). */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample via Box-Muller. */
export function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

// ---------------------------------------------------------------- regions

export function pointInRegion(p: Vec2, r: Region2D): boolean {
  switch (r.kind) {
    case 'rect':
      return p.x >= r.min.x && p.x <= r.max.x && p.y >= r.min.y && p.y <= r.max.y;
    case 'circle':
      return dist2(p, r.center) <= r.radius;
    case 'poly': {
      let inside = false;
      const pts = r.points;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i]!;
        const b = pts[j]!;
        if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
          inside = !inside;
      }
      return inside;
    }
  }
}

export function regionCenter(r: Region2D): Vec2 {
  switch (r.kind) {
    case 'rect':
      return { x: (r.min.x + r.max.x) / 2, y: (r.min.y + r.max.y) / 2 };
    case 'circle':
      return { ...r.center };
    case 'poly': {
      const n = r.points.length;
      return {
        x: r.points.reduce((s, q) => s + q.x, 0) / n,
        y: r.points.reduce((s, q) => s + q.y, 0) / n,
      };
    }
  }
}

/** Polygon outline (for rendering / footprint checks). Circles are approximated with 24 segments. */
export function regionOutline(r: Region2D): Vec2[] {
  switch (r.kind) {
    case 'rect':
      return [
        { x: r.min.x, y: r.min.y },
        { x: r.max.x, y: r.min.y },
        { x: r.max.x, y: r.max.y },
        { x: r.min.x, y: r.max.y },
      ];
    case 'circle':
      return Array.from({ length: 24 }, (_, i) => ({
        x: r.center.x + r.radius * Math.cos((i / 24) * 2 * Math.PI),
        y: r.center.y + r.radius * Math.sin((i / 24) * 2 * Math.PI),
      }));
    case 'poly':
      return r.points.map((q) => ({ ...q }));
  }
}

const outlines = new WeakMap<Region2D, Vec2[]>();

/**
 * Distance from `p` to a region's outline (circles via their 24-gon outline); 0 on the outline. The
 * outline is computed once per region object: regions, like the definitions they come from, are
 * never mutated.
 */
export function distToRegion(p: Vec2, region: Region2D): number {
  const pts = outlineOf(region);
  let best = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++)
    best = Math.min(best, distToSegment(p, pts[j]!, pts[i]!));
  return best;
}

/** Corners of a robot footprint. */
export function footprint(x: number, y: number, yaw: number, length: number, width: number): Vec2[] {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const hl = length / 2;
  const hw = width / 2;
  return [
    [hl, hw],
    [hl, -hw],
    [-hl, -hw],
    [-hl, hw],
  ].map(([a, b]) => ({ x: x + a! * c - b! * s, y: y + a! * s + b! * c }));
}

/**
 * Whether a footprint (a convex polygon, corners in order, e.g. `footprint()`) and a region share any
 * point: a corner in the region, a region corner in the footprint, or crossing edges. Exact for
 * every region kind, so a zone corner poking into a robot's side counts, and so does a zone
 * narrower than the robot.
 */
export function footprintOverlaps(corners: readonly Vec2[], region: Region2D): boolean {
  for (const c of corners) if (pointInRegion(c, region)) return true;
  if (region.kind === 'circle') {
    if (inConvex(region.center, corners, false)) return true;
    for (let i = 0, j = corners.length - 1; i < corners.length; j = i++)
      if (distToSegment(region.center, corners[j]!, corners[i]!) <= region.radius) return true;
    return false;
  }
  const outline = outlineOf(region);
  for (const q of outline) if (inConvex(q, corners, false)) return true;
  return edgesMeet(corners, outline, false);
}

/**
 * Whether a footprint (convex, corners in order) lies entirely inside a region, its outline counting
 * as inside. Rects and circles are convex, so the corners decide; a polygon zone must also have no
 * corner inside the footprint and no edge crossing it (a notch reaching in).
 */
export function footprintInside(corners: readonly Vec2[], region: Region2D): boolean {
  for (const c of corners) if (!pointInRegion(c, region)) return false;
  if (region.kind !== 'poly') return true;
  const outline = outlineOf(region);
  for (const q of outline) if (inConvex(q, corners, true)) return false;
  return !edgesMeet(corners, outline, true);
}

function outlineOf(region: Region2D): Vec2[] {
  let pts = outlines.get(region);
  if (!pts) outlines.set(region, (pts = regionOutline(region)));
  return pts;
}

/** Twice the signed area of triangle abc (> 0 when c is left of a -> b). */
function orient(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** `p` is inside the convex polygon `poly` (either winding); `strict` leaves out its outline. */
function inConvex(p: Vec2, poly: readonly Vec2[], strict: boolean): boolean {
  let pos = false;
  let neg = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const o = orient(poly[j]!, poly[i]!, p);
    if (o > 0) pos = true;
    else if (o < 0) neg = true;
    else if (strict) return false;
    if (pos && neg) return false;
  }
  return true;
}

/**
 * Some edge of polygon `a` meets some edge of polygon `b`: crosses it, or with `!proper` also
 * touches it (an end on the other edge, or overlapping collinear edges).
 */
function edgesMeet(a: readonly Vec2[], b: readonly Vec2[], proper: boolean): boolean {
  for (let i = 0, j = a.length - 1; i < a.length; j = i++)
    for (let k = 0, l = b.length - 1; k < b.length; l = k++)
      if (segmentsMeet(a[j]!, a[i]!, b[l]!, b[k]!, proper)) return true;
  return false;
}

function segmentsMeet(p: Vec2, q: Vec2, r: Vec2, s: Vec2, proper: boolean): boolean {
  const d1 = orient(r, s, p);
  const d2 = orient(r, s, q);
  const d3 = orient(p, q, r);
  const d4 = orient(p, q, s);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  if (proper) return false;
  const on = (a: Vec2, b: Vec2, c: Vec2) =>
    Math.min(a.x, b.x) <= c.x &&
    c.x <= Math.max(a.x, b.x) &&
    Math.min(a.y, b.y) <= c.y &&
    c.y <= Math.max(a.y, b.y);
  return (
    (d1 === 0 && on(r, s, p)) ||
    (d2 === 0 && on(r, s, q)) ||
    (d3 === 0 && on(p, q, r)) ||
    (d4 === 0 && on(p, q, s))
  );
}

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1e-9)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// ---------------------------------------------------------------- symmetry

export type Symmetry = 'rotational' | 'mirror';

export interface FieldDims {
  length: number;
  width: number;
}

export function flipPoint<T extends Vec2>(p: T, sym: Symmetry, f: FieldDims): T {
  return { ...p, x: f.length - p.x, y: sym === 'rotational' ? f.width - p.y : p.y };
}

export function flipVec3(p: Vec3, sym: Symmetry, f: FieldDims): Vec3 {
  return { x: f.length - p.x, y: sym === 'rotational' ? f.width - p.y : p.y, z: p.z };
}

/** Direction vectors (velocities) under symmetry: no translation. */
export function flipDir3(v: Vec3, sym: Symmetry): Vec3 {
  return { x: -v.x, y: sym === 'rotational' ? -v.y : v.y, z: v.z };
}

/** Heading of a directional object (e.g. a robot) under symmetry. */
export function flipHeading(yaw: number, sym: Symmetry): number {
  return wrapAngle(sym === 'rotational' ? yaw + Math.PI : Math.PI - yaw);
}

/**
 * Orientation of a shape that is symmetric in its own frame (box, cylinder) under symmetry.
 * Reflection R' = M R M with M = diag(-1,1,1) gives (yaw,pitch,roll) -> (-yaw,-pitch,roll).
 */
export function flipEuler(e: Euler | undefined, sym: Symmetry): Euler {
  const yaw = e?.yaw ?? 0;
  const pitch = e?.pitch ?? 0;
  const roll = e?.roll ?? 0;
  if (sym === 'rotational') return { yaw: wrapAngle(yaw + Math.PI), pitch, roll };
  return { yaw: wrapAngle(-yaw), pitch: -pitch, roll };
}

export function flipRegion(r: Region2D, sym: Symmetry, f: FieldDims): Region2D {
  switch (r.kind) {
    case 'rect': {
      const a = flipPoint(r.min, sym, f);
      const b = flipPoint(r.max, sym, f);
      return {
        kind: 'rect',
        min: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
        max: { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) },
      };
    }
    case 'circle':
      return { kind: 'circle', center: flipPoint(r.center, sym, f), radius: r.radius };
    case 'poly':
      return { kind: 'poly', points: r.points.map((p) => flipPoint(p, sym, f)) };
  }
}

// ---------------------------------------------------------------- rotations

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** Quaternion for intrinsic Z-Y-X (yaw, pitch, roll). */
export function eulerToQuat(e: Euler | undefined): Quat {
  const hy = (e?.yaw ?? 0) / 2;
  const hp = (e?.pitch ?? 0) / 2;
  const hr = (e?.roll ?? 0) / 2;
  const cy = Math.cos(hy);
  const sy = Math.sin(hy);
  const cp = Math.cos(hp);
  const sp = Math.sin(hp);
  const cr = Math.cos(hr);
  const sr = Math.sin(hr);
  return {
    w: cr * cp * cy + sr * sp * sy,
    x: sr * cp * cy - cr * sp * sy,
    y: cr * sp * cy + sr * cp * sy,
    z: cr * cp * sy - sr * sp * cy,
  };
}

export function rotateVec(q: Quat, v: Vec3): Vec3 {
  // v' = q v q*
  const ix = q.w * v.x + q.y * v.z - q.z * v.y;
  const iy = q.w * v.y + q.z * v.x - q.x * v.z;
  const iz = q.w * v.z + q.x * v.y - q.y * v.x;
  const iw = -q.x * v.x - q.y * v.y - q.z * v.z;
  return {
    x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
  };
}

export function yawFromQuat(q: Quat): number {
  return Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z));
}

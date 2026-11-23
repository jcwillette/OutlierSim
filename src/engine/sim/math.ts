import type { Euler, Region2D, Vec2, Vec3 } from './types.ts';

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function wrapAngle(a: number): number {
  let r = a % (2 * Math.PI);
  if (r > Math.PI) r -= 2 * Math.PI;
  if (r < -Math.PI) r += 2 * Math.PI;
  return r;
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

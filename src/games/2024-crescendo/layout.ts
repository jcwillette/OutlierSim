/**
 * Shared CRESCENDO geometry (blue half, WPILib frame), used by the definition and the rules.
 *
 * Built from the kickoff (6 Jan 2024) Game Manual only: dimensions from the text where it gives them,
 * otherwise measured off Fig 6-2 (the dimensioned top view, ~47 px/m). See SOURCES.md.
 */

import { feet, poly } from '../../engine/sim/authoring.ts';
import type { Region2D, Vec2 } from '../../engine/sim/types.ts';

/** Field 54 ft 3¼ in long (Manual 5.1). */
export const L = feet(54, 3.25); // 16.54
/**
 * 26 ft 11¼ in wide (Manual 5.1). The kickoff text pairs it with "~802 cm", a slip; 323¼ in is
 * 821 cm, which the ALLIANCE AREA width (26 ft 11⅛ in, ~821 cm) and Fig 6-2 confirm.
 */
export const W = feet(26, 11.25); // 8.21
/** Field center line, y: the STAGE, the middle WING NOTE and the middle CENTER LINE NOTE (Fig 6-2). */
export const CY = W / 2;

// ---------------------------------------------------------------- alliance wall, SPEAKER

/** SPEAKER center, y: on the middle WING SPIKE MARK row, 4 ft 9 in from the center line (Fig 6-2). */
export const SPEAKER_Y = CY + feet(4, 9); // 5.55
/** SUBWOOFER: 3 ft ⅛ in from the wall, 3 ft 1 in tall, 8⅜ in vertical panels (Manual 5.6.1). */
export const SUB_DEPTH = feet(3, 0.125); // 0.92
export const SUB_HEIGHT = feet(3, 1); // 0.94
export const SUB_PANEL = 8.375 * 0.0254; // 0.21
/** SUBWOOFER footprint widths measured off Fig 6-2: ~1.93 m at the wall, ~0.95 m at the front face. */
export const SUB_BACK_HALF = 0.97;
export const SUB_FRONT_HALF = 0.475;
/**
 * SPEAKER opening (Manual 5.6.1): lowest edge 6 ft 6 in (the top of the ALLIANCE WALL), highest
 * edge 6 ft 10⅞ in, 3 ft 5⅜ in wide, extending 1 ft 6 in into the FIELD, the plane at 14° up.
 */
export const SPEAKER_LOW = feet(6, 6); // 1.98
export const SPEAKER_HIGH = feet(6, 10.875); // 2.11
export const SPEAKER_WIDTH = feet(3, 5.375); // 1.05
export const SPEAKER_DEPTH = feet(1, 6); // 0.46

// ---------------------------------------------------------------- AMP

/** AMP: its near edge 4 ft 1½ in from the ALLIANCE WALL (Manual 5.3); body ~1.16 m wide (Fig 6-2). */
export const AMP_NEAR = feet(4, 1.5); // 1.26
export const AMP_BODY = 1.16;
export const AMP_X = AMP_NEAR + AMP_BODY / 2; // 1.84
/** AMP pocket: 2 ft wide, 1 ft 6 in tall, bottom 2 ft 2 in above the carpet (Manual 5.3). */
export const AMP_POCKET_W = feet(2);
export const AMP_POCKET_Z = feet(2, 2);
export const AMP_POCKET_H = feet(1, 6);
/** AMP ZONE: 10 ft 10 in along the guardrail, 1 ft 5¾ in deep (Manual 5.2). */
export const AMP_ZONE_LEN = feet(10, 10); // 3.30
export const AMP_ZONE_DEPTH = feet(1, 5.75); // 0.46

// ---------------------------------------------------------------- SOURCE (blue's, at the red end)

/**
 * The SOURCE wall cuts the corner at 30° to the guardrail (Fig 6-2): from the opposing ALLIANCE
 * WALL ~1.04 m off the scoring-table guardrail to the guardrail ~1.80 m from that wall. Its 6 ft
 * 3¼ in opening (Manual 5.4) fits the ~2.08 m wall.
 */
export const SRC_WALL_Y = 1.04;
export const SRC_GUARD_X = 1.8;
/** SOURCE ZONE: 1 ft 6¾ in deep from the SOURCE wall, a parallelogram (Manual 5.2). */
export const SRC_ZONE_DEPTH = feet(1, 6.75); // 0.48
export const SRC_ANGLE = Math.atan2(SRC_WALL_Y, SRC_GUARD_X); // ~30°
/** Along the SOURCE wall from its ALLIANCE WALL end toward the guardrail (blue's, at the red end). */
const SRC_DIR: Vec2 = { x: -Math.cos(SRC_ANGLE), y: -Math.sin(SRC_ANGLE) };
/** Into the field, perpendicular to the SOURCE wall. */
export const SRC_NORMAL: Vec2 = { x: -Math.sin(SRC_ANGLE), y: Math.cos(SRC_ANGLE) };
/** Middle of the SOURCE wall (blue's). */
export const SRC_MID: Vec2 = { x: L - SRC_GUARD_X / 2, y: SRC_WALL_Y / 2 };
/** Offset of the SOURCE ZONE tape along the ALLIANCE WALL and the guardrail. */
const SRC_ZONE_STEP = SRC_ZONE_DEPTH / Math.cos(SRC_ANGLE); // 0.55

/** Blue SOURCE ZONE (at the red end), bounded by the SOURCE wall, the red ALLIANCE WALL and tape. */
export const SOURCE_ZONE: Region2D = poly(
  [L - SRC_GUARD_X, 0],
  [L, SRC_WALL_Y],
  [L, SRC_WALL_Y + SRC_ZONE_STEP],
  [L - SRC_GUARD_X, SRC_ZONE_STEP],
);

/** A point `along` the blue SOURCE wall from its middle (toward the ALLIANCE WALL end +) and `out` into the field. */
export function sourcePoint(along: number, out: number): Vec2 {
  return {
    x: SRC_MID.x - SRC_DIR.x * along + SRC_NORMAL.x * out,
    y: SRC_MID.y - SRC_DIR.y * along + SRC_NORMAL.y * out,
  };
}

// ---------------------------------------------------------------- ROBOT STARTING ZONE

/** ROBOT STARTING ZONE: 6 ft 4⅛ in deep from the ALLIANCE WALL (Manual 5.2). */
export const START_DEPTH = feet(6, 4.125); // 1.93
/**
 * Blue ROBOT STARTING ZONE: from the ALLIANCE WALL out 1.93 m, between the AMP ZONE and the red
 * SOURCE ZONE tape (the red SOURCE cuts the corner at the blue end). Its long edge comes out 7.28 m
 * against the manual's 23 ft 8⅛ in (7.22 m).
 */
export const START_ZONE: Region2D = poly(
  [0, SRC_WALL_Y + SRC_ZONE_STEP],
  [START_DEPTH, SRC_WALL_Y + SRC_ZONE_STEP - START_DEPTH * Math.tan(SRC_ANGLE)],
  [START_DEPTH, W - AMP_ZONE_DEPTH],
  [0, W - AMP_ZONE_DEPTH],
);

// ---------------------------------------------------------------- STAGE

/**
 * STAGE: 3 truss legs in an equilateral triangle pointing at the ALLIANCE WALL, centered on the
 * field's center line. The near (PODIUM) leg's wall side is 10 ft 1 in from the ALLIANCE WALL
 * (Manual 5.5); legs ~1 ft square trusses; leg centers ~2.62 m apart (Fig 6-2: the far legs at
 * x ~5.5, y ±1.31).
 */
export const STAGE_NEAR = feet(10, 1); // 3.07
export const LEG = 0.3;
export const STAGE_SIDE = 2.62;
const NEAR_LEG_X = STAGE_NEAR + LEG / 2;
/** Centroid of the leg triangle (and the core). */
export const STAGE_C: Vec2 = { x: NEAR_LEG_X + STAGE_SIDE / Math.sqrt(3), y: CY };
/** Leg centers: near (PODIUM) leg, then the two far legs. */
export const LEGS: Vec2[] = [180, 60, -60].map((deg) => polar(STAGE_C, (STAGE_SIDE / Math.sqrt(3)) * 1, deg));
/** Core: 6-sided column, bottom 2 ft 4¼ in up (2 ft 3⅞ in at the gussets: 0.71 m clearance). */
export const CORE_BOTTOM = feet(2, 3.875); // 0.71
export const CORE_TOP = feet(7, 4.25) - feet(1); // MICROPHONE top 7 ft 4¼ in, 1 ft tall: core top 1.93
/** Core circumradius (regular hexagon, measured off Fig 6-2 / Fig 5-9). */
export const CORE_R = 0.42;
/** TRAP opening bottom 4 ft 8½ in above the carpet (Manual 5.5). */
export const TRAP_Z = feet(4, 8.5); // 1.44
/** Chains: 4 ft up at the legs, lowest point 2 ft 4¼ in, resting 1 ft 4⅝ in from the core face. */
export const CHAIN_HIGH = feet(4);
export const CHAIN_LOW = feet(2, 4.25);
export const CHAIN_OFF = feet(1, 4.625); // 0.42
/** Chain line distance from the centroid: core apothem plus the chain's 0.42 m. */
export const CHAIN_R = CORE_R * (Math.sqrt(3) / 2) + CHAIN_OFF; // 0.78

/**
 * Chains, by the direction (deg) from the centroid to the middle of the chain: Center STAGE faces
 * the center line (0°); the other two face the AMP side (120°) and the scoring-table side (-120°).
 */
export const CHAINS = [
  { id: 'center', name: 'Center STAGE', deg: 0 },
  { id: 'amp-side', name: 'STAGE chain (AMP side)', deg: 120 },
  { id: 'table-side', name: 'STAGE chain (scoring-table side)', deg: -120 },
] as const;

/** A point `r` m from `c` in direction `deg`. */
export function polar(c: Vec2, r: number, deg: number): Vec2 {
  const a = (deg * Math.PI) / 180;
  return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) };
}

/**
 * Where a robot's center is while ONSTAGE on a chain, half of it (`side` +1 / -1 along the chain):
 * under the chain line, from 0.32 m inside it to 0.38 m outside, and 0.15-0.73 m from the chain's
 * middle (a robot's bumpers clear the legs, ±1.16 m). Two robots fit on one chain (HARMONY), their
 * spots 0.88 m apart.
 */
export function chainHalf(deg: number, side: 1 | -1): Region2D {
  const a = (deg * Math.PI) / 180;
  const n = { x: Math.cos(a), y: Math.sin(a) };
  const t = { x: -n.y * side, y: n.x * side };
  const at = (r: number, s: number): [number, number] => [
    STAGE_C.x + n.x * r + t.x * s,
    STAGE_C.y + n.y * r + t.y * s,
  ];
  return poly(
    at(CHAIN_R - 0.32, 0.15),
    at(CHAIN_R + 0.38, 0.15),
    at(CHAIN_R + 0.38, 0.73),
    at(CHAIN_R - 0.32, 0.73),
  );
}

/** The whole chain (both halves): where a robot can reach its TRAP. */
export function chainZone(deg: number): Region2D {
  const a = (deg * Math.PI) / 180;
  const n = { x: Math.cos(a), y: Math.sin(a) };
  const t = { x: -n.y, y: n.x };
  const at = (r: number, s: number): [number, number] => [
    STAGE_C.x + n.x * r + t.x * s,
    STAGE_C.y + n.y * r + t.y * s,
  ];
  return poly(
    at(CHAIN_R - 0.32, -0.73),
    at(CHAIN_R + 0.38, -0.73),
    at(CHAIN_R + 0.38, 0.73),
    at(CHAIN_R - 0.32, 0.73),
  );
}

/** The chain (index into CHAINS) a robot at `p` is on: the nearest chain line. */
export function chainAt(p: Vec2): number {
  let best = 0;
  let bestD = Infinity;
  CHAINS.forEach((c, i) => {
    const m = polar(STAGE_C, CHAIN_R, c.deg);
    const d = Math.hypot(p.x - m.x, p.y - m.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/**
 * STAGE ZONE: the 6-sided tape outline around the STAGE (Fig 5-5): the leg triangle scaled 1.25x
 * about its centroid, corners cut. Fig 6-2 reads 3.17 m to its tip and ~5.75 m to its far edge.
 */
const ZONE_SCALE = 1.25;
const zoneTri = LEGS.map((p) => ({
  x: STAGE_C.x + (p.x - STAGE_C.x) * ZONE_SCALE,
  y: STAGE_C.y + (p.y - STAGE_C.y) * ZONE_SCALE,
}));
/** The triangle's corners cut `cut` m along each edge: a convex hexagon, counter-clockwise. */
function cutCorners(tri: Vec2[], cut: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < 3; i++) {
    const p = tri[i]!;
    const prev = tri[(i + 2) % 3]!;
    const next = tri[(i + 1) % 3]!;
    const toward = (q: Vec2): [number, number] => {
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      return [p.x + ((q.x - p.x) / d) * cut, p.y + ((q.y - p.y) / d) * cut];
    };
    out.push(toward(prev), toward(next));
  }
  return out;
}
const ZONE_HEX = cutCorners(zoneTri, 0.28);
export const STAGE_ZONE: Region2D = poly(...ZONE_HEX);

/**
 * PARK counts a robot with any part of its BUMPERS in the STAGE ZONE (Manual 6.5.2); the engine
 * tests the robot's center, so PARK uses the STAGE ZONE grown by about half a robot (0.4 m).
 */
export const PARK_AREA: Region2D = poly(...grow(ZONE_HEX, 0.4));

/**
 * Bots only: G422-G424 count any part of either robot, while the bots test robot centers against
 * protected zones. These copies put the same robots off limits: the STAGE ZONE grown by about half
 * a robot, the AMP and SOURCE ZONES by a robot length, so an opponent going after a loose NOTE in
 * that corner (nothing else takes it there) can't brush the zone while it lines up (clipped to the
 * field).
 */
const clip = (pts: Array<[number, number]>): Array<[number, number]> =>
  pts.map(([x, y]) => [Math.min(L, Math.max(0, x)), Math.min(W, Math.max(0, y))]);
export const BOT_AMP_ZONE: Region2D = poly(
  ...clip(
    grow(
      [
        [0, W - AMP_ZONE_DEPTH],
        [AMP_ZONE_LEN, W - AMP_ZONE_DEPTH],
        [AMP_ZONE_LEN, W],
        [0, W],
      ],
      0.9,
    ),
  ),
);
export const BOT_SOURCE_ZONE: Region2D = poly(
  ...clip(
    grow(
      (SOURCE_ZONE as { points: Vec2[] }).points.map((p): [number, number] => [p.x, p.y]),
      0.9,
    ),
  ),
);
export const BOT_STAGE_ZONE: Region2D = poly(...grow(ZONE_HEX, 0.45));

/** A convex polygon's outline moved `d` m outward (either winding). */
function grow(pts: Array<[number, number]>, d: number): Array<[number, number]> {
  const n = pts.length;
  let area2 = 0;
  pts.forEach(([x0, y0], i) => {
    const [x1, y1] = pts[(i + 1) % n]!;
    area2 += x0 * y1 - x1 * y0;
  });
  const out = area2 > 0 ? 1 : -1; // (dy, -dx) points outward on a counter-clockwise outline
  const lines = pts.map(([x0, y0], i) => {
    const [x1, y1] = pts[(i + 1) % n]!;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const nx = (out * (y1 - y0)) / len;
    const ny = (-out * (x1 - x0)) / len;
    return { x: x0 + nx * d, y: y0 + ny * d, dx: x1 - x0, dy: y1 - y0 };
  });
  return lines.map((a, i) => {
    const b = lines[(i + n - 1) % n]!;
    // Intersection of line b (previous edge) and line a (this edge).
    const den = b.dx * a.dy - b.dy * a.dx;
    const t = ((a.x - b.x) * a.dy - (a.y - b.y) * a.dx) / den;
    return [b.x + b.dx * t, b.y + b.dy * t] as [number, number];
  });
}

/** PODIUM: on the near leg, facing the ALLIANCE WALL, 10 in wide (Manual 5.5). */
export const PODIUM_W = 10 * 0.0254;
/** Where a robot touching the PODIUM has part of its bumpers (G422): 5 cm in front of it. */
export const PODIUM_TOUCH: Region2D = poly(
  [STAGE_NEAR - 0.05, CY - PODIUM_W / 2],
  [STAGE_NEAR, CY - PODIUM_W / 2],
  [STAGE_NEAR, CY + PODIUM_W / 2],
  [STAGE_NEAR - 0.05, CY + PODIUM_W / 2],
);

// ---------------------------------------------------------------- WING, NOTES

/** WING line: the alliance-colored line across the field, measured off Fig 6-2 at ~5.84 m. */
export const WING_X = 5.84;
/** WING SPIKE MARKS: 9 ft 6 in from the ALLIANCE WALL, 4 ft 9 in apart from the center line (Fig 6-2). */
export const WING_NOTE_X = feet(9, 6);
export const WING_NOTE_Y = [0, 1, 2].map((k) => CY + k * feet(4, 9));
/** CENTER LINE SPIKE MARKS: 5 ft 6 in apart, the middle one on the field center (Fig 6-2). */
export const CENTER_NOTE_Y = [-2, -1, 0, 1, 2].map((k) => CY + k * feet(5, 6));

/** Every STAGE point source, for the ENSEMBLE RP (PARK, ONSTAGE, TRAP, HARMONY, SPOTLIT). */
export const STAGE_SOURCES = ['park', 'onstage', 'trap-1', 'trap-2', 'trap-3', 'harmony', 'spotlight'];

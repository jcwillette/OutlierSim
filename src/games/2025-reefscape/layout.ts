/**
 * Shared REEFSCAPE layout (blue half, WPILib frame, meters), used by the definition and the rules.
 *
 * Positions come from the 2025 Field Layout and Marking drawing (FE-2025, sheets 3-5) and its
 * AprilTag table (welded field, inches from the blue ALLIANCE WALL diamond plate and the
 * scoring-table guardrail): the blue REEF faces carry tags 17-22 (x 144.00-209.49, y 129.97-186.83),
 * the blue PROCESSOR tag 16 (235.73, -0.15), the blue CORAL STATIONS tags 12 and 13 (33.51, 25.80
 * facing 54° / 291.20 facing 306°), the BARGE tags 14 and 15 (x 325.68). Sizes come from the manual.
 *
 * The field is ROTATIONALLY symmetric: red's PROCESSOR (tag 3, 455.15, 317.15) is blue's rotated
 * 180° about the field center, and so are the REEFS, BARGE halves and CAGES.
 */

import type { Region2D, Vec2 } from '../../engine/sim/types.ts';

const IN = 0.0254;

// ---------------------------------------------------------------- field

/** ~57 ft 6⅞ in × ~26 ft 5 in (Manual 5.1). Tag pairs 1/12 (657.37 + 33.51 in) agree. */
export const L = 690.875 * IN; // 17.548
export const W = 317 * IN; // 8.052
export const CX = L / 2;
export const CY = W / 2;

// ---------------------------------------------------------------- REEF

/** Blue REEF center: between tags 18 (x 144.00) and 21 (209.49), on the field's center line. */
export const REEF_C: Vec2 = { x: ((144.0 + 209.49) / 2) * IN, y: 158.5 * IN }; // (4.489, 4.026)
/** 5 ft 5½ in hexagon, face to face (Manual 5.3; tags 18 and 21 are 65.49 in apart). */
export const REEF_APOTHEM = (65.5 / 2) * IN; // 0.832
export const REEF_R = REEF_APOTHEM / Math.cos(Math.PI / 6); // 0.961
/** REEF ZONE: 6-sided, 7 ft 9½ in face to face (Manual 5.2). */
export const REEF_ZONE_APOTHEM = (93.5 / 2) * IN; // 1.188
/** Trough (L1) front edge 1 ft 6 in up (Manual 5.3). */
export const TROUGH_Z = 18 * IN; // 0.457
/** Highest point of each BRANCH level (Manual 5.3). */
export const LEVEL_Z = { L2: 31.875 * IN, L3: 47.625 * IN, L4: 72 * IN }; // 0.810, 1.210, 1.829
/** BRANCH tips are inset 1⅝ in (L2, L3) and 1⅛ in (L4) from the REEF base (Manual 5.3). */
export const TIP_R = {
  L2: REEF_APOTHEM - 1.625 * IN,
  L3: REEF_APOTHEM - 1.625 * IN,
  L4: REEF_APOTHEM - 1.125 * IN,
};
/** Pipes on one face are 1 ft 1 in apart, center to center (Manual 5.3). */
export const PIPE_HALF = 6.5 * IN; // 0.165

/** Face k's outward normal points at k × 60°: face 0 toward the BARGE, face 3 toward the ALLIANCE WALL. */
export const FACES = [0, 1, 2, 3, 4, 5] as const;
export const faceAngle = (k: number): number => (k * Math.PI) / 3;
export const LEVELS = ['L2', 'L3', 'L4'] as const;
export type Level = (typeof LEVELS)[number];
/** The two BRANCHES (pipes) of a face: -1 to the face's right, +1 to its left (seen from outside). */
export const SIDES = [-1, 1] as const;

/** A point at `radial` m out from the REEF center along face k's normal, `lateral` m along the face. */
export function reefPoint(k: number, radial: number, lateral = 0): Vec2 {
  const a = faceAngle(k);
  return {
    x: REEF_C.x + radial * Math.cos(a) - lateral * Math.sin(a),
    y: REEF_C.y + radial * Math.sin(a) + lateral * Math.cos(a),
  };
}

/** A rectangle in front of face k: `r0`..`r1` out from the REEF center, `l0`..`l1` along the face. */
export function faceRect(k: number, r0: number, r1: number, l0: number, l1: number): Region2D {
  const c = [reefPoint(k, r0, l0), reefPoint(k, r1, l0), reefPoint(k, r1, l1), reefPoint(k, r0, l1)];
  return { kind: 'poly', points: c };
}

/** Hexagon around the REEF center with the given apothem (faces normal to the face angles). */
export function reefHex(apothem: number): Vec2[] {
  const r = apothem / Math.cos(Math.PI / 6);
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const a = faceAngle(i) + Math.PI / 6;
    return { x: REEF_C.x + r * Math.cos(a), y: REEF_C.y + r * Math.sin(a) };
  });
}

/**
 * Where a scoring robot's center stands in front of a face: its bumpers against the REEF base (half
 * a ~0.85-0.95 m robot beyond the face), with room for the smaller and bigger robot types.
 */
export const SCORE_R0 = REEF_APOTHEM + 0.3;
export const SCORE_R1 = REEF_APOTHEM + 0.72;
/** Half-width of one BRANCH's place zone along the face (the pipes are 0.33 m apart). */
export const BRANCH_HALF = 0.15;

/**
 * Staged ALGAE (Manual 6.3.4.2, Fig 6-3): one per face, resting on a pair of BRANCHES, alternating
 * between the low position (on the L2 BRANCHES, between L2 and L3) and the high one (on L3, between
 * L3 and L4). Which faces start high isn't stated; the sim starts the face toward the BARGE high.
 */
export const ALGAE_HIGH = (k: number): boolean => k % 2 === 0;
/** A 16¼ in ball cradled on two BRANCH tips 13 in apart sits 4⅞ in above them. */
const CRADLE = Math.sqrt(8.125 ** 2 - 6.5 ** 2) * IN; // 0.124
export const ALGAE_Z = { low: LEVEL_Z.L2 + CRADLE, high: LEVEL_Z.L3 + CRADLE }; // 0.934, 1.334
/**
 * BRANCHES a staged ALGAE keeps CORAL off (a CORAL touching ALGAE isn't scored, Manual 6.5.1): the
 * level it rests on, and for the low position also L3 above it (the ball's top, ~45 in, reaches the
 * L3 BRANCHES' lower ends). "Staged ALGAE will not contact CORAL placed on L4" (6.3.4.2).
 */
export const BLOCKED_BY_ALGAE = (k: number): Level[] => (ALGAE_HIGH(k) ? ['L3'] : ['L2', 'L3']);

/** Base target ids. Expanded ids add `.blue` / `.red`. */
export const branchId = (level: Level, k: number, side: -1 | 1): string =>
  `${level.toLowerCase()}-${k}${side < 0 ? 'r' : 'l'}`;
export const troughId = (k: number): string => `l1-${k}`;
export const reefAlgaeId = (k: number): string => `reef-algae-${k}`;

// ---------------------------------------------------------------- CORAL STATIONS

/**
 * The two blue CORAL STATIONS cut the blue ALLIANCE WALL's corners (Manual 5.6.2). Tag 12 (33.51,
 * 25.80 in, facing 54°) and tag 13 (33.51, 291.20 in, facing 306°) are centered on them; each
 * station's face runs at right angles to the tag's facing, from the guardrail to the ALLIANCE WALL.
 */
export const STATIONS = [
  { id: 'coral-station-right', tag: { x: 33.51 * IN, y: 25.8 * IN }, facing: (54 * Math.PI) / 180 },
  { id: 'coral-station-left', tag: { x: 33.51 * IN, y: 291.2 * IN }, facing: (-54 * Math.PI) / 180 },
] as const;
/** The CORAL STATION opening: 6 ft 4 in wide, bottom 3 ft 1½ in up (Manual 5.6.2). */
export const STATION_OPENING = 76 * IN; // 1.930
export const STATION_OPENING_Z = 37.5 * IN; // 0.953

/** A point `out` m in front of a station's face (along its facing) and `along` m along the face. */
export function stationPoint(st: (typeof STATIONS)[number], out: number, along = 0): Vec2 {
  const c = Math.cos(st.facing);
  const s = Math.sin(st.facing);
  return { x: st.tag.x + out * c - along * s, y: st.tag.y + out * s + along * c };
}

/** Where the face line meets the guardrail (y 0 or W) and the ALLIANCE WALL (x 0). */
export function stationEnds(st: (typeof STATIONS)[number]): [Vec2, Vec2] {
  const dx = -Math.sin(st.facing);
  const dy = Math.cos(st.facing);
  const yEdge = st.tag.y < CY ? 0 : W;
  const tRail = (yEdge - st.tag.y) / dy;
  const tWall = -st.tag.x / dx;
  return [
    { x: st.tag.x + tRail * dx, y: yEdge },
    { x: 0, y: st.tag.y + tWall * dy },
  ];
}

// ---------------------------------------------------------------- PROCESSOR

/** Blue PROCESSOR: in the scoring-table guardrail, tag 16 at x 235.73 in (Manual 5.5, FE-2025 sh. 5). */
export const PROCESSOR_X = 235.73 * IN; // 5.988
/** Opening 2 ft 4 in wide, 1 ft 8 in tall, 7 in up (Manual 5.5). */
export const PROCESSOR_W = 28 * IN;
export const PROCESSOR_H = 20 * IN;
export const PROCESSOR_Z = 7 * IN;

// ---------------------------------------------------------------- BARGE

/** The BARGE spans the field at mid-field: 3 ft 8 in deep, 8 ft 5 in tall, truss 5 ft 2 in up (5.4). */
export const BARGE_X = CX;
export const BARGE_DEPTH = 44 * IN; // 1.118
export const BARGE_TOP = 101 * IN; // 2.565
export const TRUSS_Z = 62 * IN; // 1.575
/** CAGES: 3 per alliance, 3 ft 5½ in, 7 ft ⅜ in and 10 ft 7⅜ in from mid-field (Manual 5.4). */
export const CAGE_OFFSETS = [41.5 * IN, 84.375 * IN, 127.375 * IN];
/** Blue's CAGES and NET hang over the half of the BARGE away from the blue PROCESSOR (Fig 5-4). */
export const CAGE_Y = CAGE_OFFSETS.map((d) => CY + d); // 5.080, 6.169, 7.261
/** CAGE: 2 ft tall, 7⅜ in wide; bottom 3⅛ in up (deep) or 2 ft 6⅛ in (shallow) (Manual 5.4.1). */
export const CAGE_W = 7.375 * IN;
export const CAGE_H = 24 * IN;
export const CAGE_BOTTOM = { deep: 3.125 * IN, shallow: 30.125 * IN };
/** BARGE ZONE: 3 ft 10 in deep by 12 ft 2½ in long, around the alliance's half of the BARGE (5.2). */
export const BARGE_ZONE: Extract<Region2D, { kind: 'rect' }> = {
  kind: 'rect',
  min: { x: BARGE_X - 23 * IN, y: W - 146.5 * IN },
  max: { x: BARGE_X + 23 * IN, y: W },
};
/** NET: 4 ft × 12 ft mesh hung from the BARGE top, lowest point 6 ft 4 in up (Manual 5.4.2). */
export const NET_LEN = 144 * IN; // 3.658
export const NET_WIDTH = 48 * IN; // 1.219
export const NET_Y = W - (146.5 / 2) * IN; // 6.192, centered over the alliance's BARGE half
export const NET_LOW = 76 * IN; // 1.930

/** Where a climbing robot's center stands, on its own side of the CAGE (x below mid-field for blue). */
export function cageZone(y: number): Region2D {
  return { kind: 'rect', min: { x: BARGE_X - 0.85, y: y - 0.3 }, max: { x: BARGE_X - 0.2, y: y + 0.3 } };
}

// ---------------------------------------------------------------- lines, marks, processors' humans

/** ROBOT STARTING LINE: black tape 7 ft 4 in from the REEF (209.49 + 88 = 297.49 in to its near edge). */
export const START_LINE_X = (209.49 + 88) * IN; // 7.556
export const TAPE = 2 * IN;
/** CORAL MARKS: 4 ft from the ALLIANCE WALL, 6 ft apart, centered on the field (FE-2025 sheet 3). */
export const MARK_X = 48 * IN; // 1.219
export const MARK_Y = [CY - 72 * IN, CY, CY + 72 * IN];

/**
 * The HUMAN PLAYER who throws ALGAE into blue's NET stands in blue's PROCESSOR AREA, behind RED's
 * PROCESSOR (Manual 5.5: processed ALGAE rolls into the opponent's PROCESSOR AREA). Red's PROCESSOR is
 * blue's rotated: x L - 5.988, on the far guardrail. The thrower stands ~0.6 m outside it.
 */
export const BLUE_THROWER = { x: L - PROCESSOR_X, y: W + 0.6, z: 1.7 };

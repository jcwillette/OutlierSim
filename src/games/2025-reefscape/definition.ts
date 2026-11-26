import { IN, LB, cite, feet, poly, rect } from '../../engine/sim/authoring.ts';
import { GEARINGS, MOTORS, driveFor, onFieldMass, swerve, tank } from '../../engine/sim/drivetrain.ts';
import type {
  AllianceSummary,
  FieldElement,
  GameDefinition,
  HumanPlayerStation,
  RobotArchetype,
  ScoringTarget,
} from '../../engine/sim/types.ts';
import {
  ALGAE_HIGH,
  ALGAE_Z,
  BARGE_DEPTH,
  BARGE_TOP,
  BARGE_X,
  BARGE_ZONE,
  CAGE_BOTTOM,
  CAGE_H,
  CAGE_W,
  CAGE_Y,
  CY,
  FACES,
  L,
  LEVELS,
  LEVEL_Z,
  MARK_X,
  MARK_Y,
  NET_LEN,
  NET_LOW,
  NET_WIDTH,
  NET_Y,
  PIPE_HALF,
  PROCESSOR_H,
  PROCESSOR_W,
  PROCESSOR_X,
  PROCESSOR_Z,
  REEF_APOTHEM,
  REEF_C,
  REEF_ZONE_APOTHEM,
  SCORE_R0,
  SCORE_R1,
  BRANCH_HALF,
  SIDES,
  START_LINE_X,
  STATIONS,
  STATION_OPENING,
  TAPE,
  TIP_R,
  TROUGH_Z,
  TRUSS_Z,
  W,
  branchId,
  cageZone,
  faceAngle,
  faceRect,
  reefAlgaeId,
  reefHex,
  reefPoint,
  stationEnds,
  stationPoint,
  troughId,
  type Level,
} from './layout.ts';
import {
  BARGE_RP_POINTS,
  BARGE_SOURCES,
  CORAL_RP_LEVELS_COOP,
  CORAL_RP_PER_LEVEL,
  coopAchieved,
  coralByLevel,
  rules,
} from './rules.ts';

/**
 * 2025 REEFSCAPE presented by Haas, built blind from the official game materials only: the Game
 * Manual (the copy FIRST serves now is the 8 Apr 2025 revision; every Team Update change after
 * January 2025 was undone, see SOURCES.md), the 2025 Field Layout and Marking drawing and its
 * AprilTag table, and the 2023 and 2024 builds of this repository as the only reference models. No
 * match data, no real-match video and nothing published after January 2025 was used. Unofficial
 * approximation for practice.
 *
 * Coordinates: WPILib field frame, meters; origin at the blue ALLIANCE WALL on the scoring-table
 * guardrail. BLUE half authored; red is the ROTATIONAL image (180° about the field center): red's
 * PROCESSOR is on the far guardrail, its CAGES and NET over the scoring-table half of the BARGE.
 *
 * Blue layout: REEF centered 4.49 m out on the field's center line | CORAL STATIONS cutting both
 * corners of the blue ALLIANCE WALL | PROCESSOR in the scoring-table guardrail at x 5.99 | CORAL
 * MARKS 1.22 m out | ROBOT STARTING LINE at x 7.56 | BARGE at mid-field, blue's CAGES and NET over
 * the far (y > 4.33) half.
 */

const M = cite('Manual');
const D = cite('FE-2025 Field Layout and Marking');
const SRC_PTS = M(50, 'Table 6-2');

// ---------------------------------------------------------------- field elements

const DEG = Math.PI / 180;
/** Tall convex prism over a polygon (world points), z0..z1, as hull vertices relative to `o`. */
function prism(points: { x: number; y: number }[], z0: number, z1: number, o: { x: number; y: number }) {
  return [z0, z1].flatMap((z) => points.map((p) => ({ x: p.x - o.x, y: p.y - o.y, z })));
}

const reefElements: FieldElement[] = [
  {
    id: 'reef-base',
    name: 'REEF',
    side: 'blue',
    // The hexagonal base up to the trough's front edge; robots score against it.
    shape: { kind: 'hull', vertices: prism(reefHex(REEF_APOTHEM), 0, TROUGH_Z, REEF_C) },
    position: { x: REEF_C.x, y: REEF_C.y, z: 0 },
    color: '#5b6270',
    source: M(
      23,
      '5.3 REEF: 5 ft 5½ in hexagon 12 ft from the ALLIANCE WALL, trough front edge 1 ft 6 in up',
    ),
  },
  {
    id: 'reef-core',
    name: 'REEF core',
    side: 'blue',
    // The center column the pipes rise around (keeps shots and ALGAE off the middle).
    shape: { kind: 'cylinder', radius: 0.45, height: LEVEL_Z.L4 - TROUGH_Z },
    position: { x: REEF_C.x, y: REEF_C.y, z: (TROUGH_Z + LEVEL_Z.L4) / 2 },
    nav: 'none',
    color: '#7c6ba8',
    opacity: 0.55,
    source: M(23, 'Fig 5-5'),
  },
  // Two vertical pipes per face, each with its three BRANCHES (visual).
  ...FACES.flatMap((k) =>
    SIDES.flatMap((s): FieldElement[] => {
      const lat = s * PIPE_HALF;
      const pipe = reefPoint(k, REEF_APOTHEM - 0.16, lat);
      const out: FieldElement[] = [
        {
          id: `reef-pipe-${k}${s < 0 ? 'r' : 'l'}`,
          side: 'blue',
          shape: { kind: 'cylinder', radius: 0.021, height: LEVEL_Z.L4 - 0.25 - TROUGH_Z },
          position: { x: pipe.x, y: pipe.y, z: (TROUGH_Z + LEVEL_Z.L4 - 0.25) / 2 },
          solid: false,
          color: '#8a4fbf',
          source: M(24, '5.3 1¼ in Schedule 40 pipes, 1 ft 1 in apart on a face'),
        },
      ];
      for (const lvl of LEVELS) {
        if (lvl === 'L4') {
          const tip = reefPoint(k, TIP_R.L4, lat);
          const mid = reefPoint(k, (TIP_R.L4 + REEF_APOTHEM - 0.16) / 2, lat);
          out.push(
            {
              id: `reef-l4-arm-${k}${s < 0 ? 'r' : 'l'}`,
              side: 'blue',
              shape: { kind: 'box', size: { x: 0.18, y: 0.04, z: 0.04 } },
              position: { x: mid.x, y: mid.y, z: LEVEL_Z.L4 - 0.27 },
              rotation: { yaw: faceAngle(k) },
              solid: false,
              color: '#8a4fbf',
            },
            {
              id: `reef-l4-${k}${s < 0 ? 'r' : 'l'}`,
              side: 'blue',
              shape: { kind: 'cylinder', radius: 0.021, height: 0.27 },
              position: { x: tip.x, y: tip.y, z: LEVEL_Z.L4 - 0.135 },
              solid: false,
              color: '#8a4fbf',
              source: M(24, '5.3 L4 BRANCHES vertical, top 6 ft up, inset 1⅛ in'),
            },
          );
        } else {
          // 35° up and out from the pipe to a tip inset 1⅝ in from the base.
          const len = 0.22;
          const c = reefPoint(k, TIP_R[lvl] - (len / 2) * Math.cos(35 * DEG), lat);
          out.push({
            id: `reef-${lvl.toLowerCase()}-${k}${s < 0 ? 'r' : 'l'}`,
            side: 'blue',
            shape: { kind: 'cylinder', radius: 0.021, height: len },
            position: { x: c.x, y: c.y, z: LEVEL_Z[lvl] - (len / 2) * Math.sin(35 * DEG) },
            rotation: { yaw: faceAngle(k), pitch: 55 * DEG },
            solid: false,
            color: '#8a4fbf',
            source: M(
              24,
              `5.3 ${lvl} BRANCHES angled up 35°, top ${lvl === 'L2' ? '2 ft 7⅞ in' : '3 ft 11⅝ in'}`,
            ),
          });
        }
      }
      return out;
    }),
  ),
];

const stationElements: FieldElement[] = STATIONS.map((st): FieldElement => {
  const [a, b] = stationEnds(st);
  const len = Math.hypot(b.x - a.x, b.y - a.y) + 0.6;
  // Centered 0.2 m behind the face line, so its front face is the CORAL STATION's.
  const c = {
    x: (a.x + b.x) / 2 - 0.2 * Math.cos(st.facing),
    y: (a.y + b.y) / 2 - 0.2 * Math.sin(st.facing),
  };
  return {
    id: st.id,
    name: 'CORAL STATION',
    side: 'blue',
    shape: { kind: 'box', size: { x: len, y: 0.4, z: 1.9 } },
    position: { x: c.x, y: c.y, z: 0.95 },
    rotation: { yaw: st.facing + Math.PI / 2 },
    color: '#9aa3ad',
    opacity: 0.6,
    source: `${M(32, '5.6.2 one CORAL STATION in each corner, 6 ft 4 in opening 3 ft 1½ in up')}; ${D('sheet 4', 'tags 12 / 13 at (33.51, 25.80 / 291.20) in facing 54° / 306°')}`,
  };
});

const bargeElements: FieldElement[] = [
  {
    // The horizontal truss: robots drive under it (5 ft 2 in clearance), ALGAE bounce off it.
    id: 'barge-truss',
    name: 'BARGE',
    side: 'neutral',
    shape: { kind: 'box', size: { x: BARGE_DEPTH, y: W, z: 0.3 } },
    position: { x: BARGE_X, y: CY, z: TRUSS_Z + 0.15 },
    nav: 'none',
    clearance: TRUSS_Z,
    color: '#c3c8cf',
    opacity: 0.8,
    source: M(
      25,
      '5.4 BARGE 29 ft 2 in wide, 3 ft 8 in deep, 8 ft 5 in tall; horizontal truss 5 ft 2 in above the carpet',
    ),
  },
  {
    id: 'barge-support',
    name: 'BARGE center support',
    side: 'neutral',
    shape: { kind: 'box', size: { x: 0.3, y: 0.3, z: BARGE_TOP } },
    position: { x: BARGE_X, y: CY, z: BARGE_TOP / 2 },
    color: '#c3c8cf',
    source: `${M(25, '5.4 supported in the center of the FIELD by vertical truss')}; ${D('sheet 3', '2 ft gap between the BARGE ZONES')}`,
  },
  {
    id: 'barge-top',
    side: 'neutral',
    shape: { kind: 'box', size: { x: BARGE_DEPTH, y: W, z: 0.08 } },
    position: { x: BARGE_X, y: CY, z: BARGE_TOP },
    solid: false,
    color: '#c3c8cf',
    opacity: 0.35,
  },
  {
    id: 'net',
    name: 'NET',
    side: 'blue',
    shape: { kind: 'box', size: { x: NET_WIDTH, y: NET_LEN, z: BARGE_TOP - NET_LOW } },
    position: { x: BARGE_X, y: NET_Y, z: (BARGE_TOP + NET_LOW) / 2 },
    solid: false,
    color: 'alliance',
    opacity: 0.22,
    source: M(27, '5.4.2 NET 4 ft × 12 ft, lowest point 6 ft 4 in up'),
  },
  ...CAGE_Y.map((y, i): FieldElement => ({
    id: `cage-${i + 1}`,
    name: 'CAGE',
    side: 'blue',
    shape: { kind: 'box', size: { x: CAGE_W, y: CAGE_W, z: CAGE_H } },
    // Drawn at the deep position, the default each day (6.3.5); hangs on its chain, not solid.
    position: { x: BARGE_X, y, z: CAGE_BOTTOM.deep + CAGE_H / 2 },
    solid: false,
    color: 'alliance',
    opacity: 0.7,
    source: `${M(26, '5.4.1 CAGE 2 ft × 7⅜ in, bottom 3⅛ in (deep) or 2 ft 6⅛ in (shallow) up')}; ${M(25, '3 ft 5½ in, 7 ft ⅜ in, 10 ft 7⅜ in from mid field')}`,
  })),
  {
    id: 'processor',
    name: 'PROCESSOR',
    side: 'blue',
    // The opening in the guardrail (visual: ALGAE pass out of the FIELD through it).
    shape: { kind: 'box', size: { x: PROCESSOR_W, y: 0.06, z: PROCESSOR_H } },
    position: { x: PROCESSOR_X, y: -0.03, z: PROCESSOR_Z + PROCESSOR_H / 2 },
    solid: false,
    color: 'alliance',
    opacity: 0.6,
    source: M(28, '5.5 PROCESSOR opening 2 ft 4 in wide, 1 ft 8 in tall, 7 in up'),
  },
];

// ---------------------------------------------------------------- zones

const REEF_ZONE = poly(...reefHex(REEF_ZONE_APOTHEM).map((p) => [p.x, p.y] as const));
const START_LINE = rect(START_LINE_X, 0, START_LINE_X + TAPE, W);
/** Where a robot's center is when its BUMPERS are at least partly in the BARGE ZONE (PARK). */
const BARGE_PARK = rect(BARGE_ZONE.min.x - 0.35, BARGE_ZONE.min.y - 0.35, BARGE_ZONE.max.x + 0.35, W);
/**
 * Bots' copies of the protected zones (`botHints.protectedZones`), grown by a robot's half-length:
 * G427 protects a robot with any part of itself in its zone, so its center can be that far outside
 * it, and a defender waiting just outside the real tape gets bumped by every robot scoring there.
 */
const BOT_GROW = 0.5;
const BOT_REEF_ZONE = poly(...reefHex(REEF_ZONE_APOTHEM + BOT_GROW).map((p) => [p.x, p.y] as const));
const BOT_BARGE_ZONE = rect(
  BARGE_ZONE.min.x - BOT_GROW,
  BARGE_ZONE.min.y - BOT_GROW,
  BARGE_ZONE.max.x + BOT_GROW,
  W,
);
/** The three climbing spots together, for G428 (an opponent touching a robot on its CAGE). */
const CAGE_AREA = rect(BARGE_X - 0.85, CAGE_Y[0]! - 0.3, BARGE_X - 0.2, CAGE_Y[2]! + 0.3);

// ---------------------------------------------------------------- scoring targets

/** CORAL points per level, AUTO / TELEOP (Table 6-2). */
export const CORAL_POINTS: Record<'L1' | Level, { auto: number; teleop: number }> = {
  L1: { auto: 3, teleop: 2 },
  L2: { auto: 4, teleop: 3 },
  L3: { auto: 6, teleop: 4 },
  L4: { auto: 7, teleop: 5 },
};
/** CORAL in the trough of one face: 3 end to end on the ~38 in face, plus any resting on them. */
const TROUGH_CAPACITY = 4;

const branchTargets: ScoringTarget[] = FACES.flatMap((k) =>
  LEVELS.flatMap((lvl) =>
    SIDES.map((s): ScoringTarget => {
      const lat = s * PIPE_HALF;
      const tip = reefPoint(k, TIP_R[lvl], lat);
      const disp =
        lvl === 'L4'
          ? { ...tip, z: LEVEL_Z.L4 - 0.08 }
          : { ...reefPoint(k, TIP_R[lvl] - 0.1, lat), z: LEVEL_Z[lvl] - 0.07 };
      return {
        id: branchId(lvl, k, s),
        name: `${lvl} BRANCH`,
        side: 'blue',
        accepts: ['coral'],
        points: CORAL_POINTS[lvl],
        tags: [lvl],
        capacity: 1,
        place: {
          zone: faceRect(k, SCORE_R0, SCORE_R1, lat - BRANCH_HALF, lat + BRANCH_HALF),
          facePoint: tip,
          faceToleranceRad: 0.5,
        },
        display: disp,
        ...(lvl === 'L4' ? {} : { displayRotation: { yaw: faceAngle(k), pitch: 55 * DEG } }),
        source: `${SRC_PTS} CORAL on ${lvl}; ${M(47, '6.5.1 only 1 CORAL per BRANCH')}; ${M(24, '5.3')}`,
      };
    }),
  ),
);

const troughTargets: ScoringTarget[] = FACES.map((k): ScoringTarget => {
  const a = faceAngle(k);
  const first = reefPoint(k, REEF_APOTHEM - 0.09, -0.3);
  return {
    id: troughId(k),
    name: 'L1 trough',
    side: 'blue',
    accepts: ['coral'],
    points: CORAL_POINTS.L1,
    tags: ['L1'],
    capacity: TROUGH_CAPACITY,
    place: {
      zone: faceRect(k, SCORE_R0, SCORE_R1, -0.45, 0.45),
      facePoint: reefPoint(k, 0),
      faceToleranceRad: 0.5,
    },
    // Laid along the trough, side by side.
    display: { ...first, z: TROUGH_Z + 0.03 },
    displayStep: { x: -Math.sin(a) * 0.2, y: Math.cos(a) * 0.2, z: 0.04 },
    displayRotation: { yaw: a, roll: 90 * DEG },
    source: `${SRC_PTS} CORAL in the trough (L1); ${M(47, '6.5.1 contacting the trough or supported by a CORAL that does')}; capacity ${TROUGH_CAPACITY} per face (estimate)`,
  };
});

const targets: ScoringTarget[] = [
  ...troughTargets,
  ...branchTargets,
  {
    id: 'processor',
    name: 'PROCESSOR',
    side: 'blue',
    accepts: ['algae'],
    points: { auto: 6, teleop: 6 },
    tags: ['processor'],
    place: {
      zone: rect(PROCESSOR_X - 0.25, 0.38, PROCESSOR_X + 0.25, 0.8),
      facePoint: { x: PROCESSOR_X, y: -3 },
      faceToleranceRad: 0.5,
    },
    source: `${SRC_PTS} ALGAE in PROCESSOR 6; ${M(28, '5.5')}; passes it to the opponent's HUMAN PLAYER (rules.ts)`,
  },
  {
    id: 'net',
    name: 'NET',
    side: 'blue',
    accepts: ['algae'],
    points: { auto: 4, teleop: 4 },
    tags: ['net'],
    // Above the NET and within its perimeter: ALGAE dropping in from over the BARGE's top.
    aperture: {
      center: { x: BARGE_X, y: NET_Y, z: (NET_LOW + BARGE_TOP) / 2 + 0.02 },
      size: { x: NET_WIDTH - 0.1, y: NET_LEN - 0.1, z: BARGE_TOP - NET_LOW - 0.04 },
      entry: 'down',
    },
    aimPoint: { x: BARGE_X, y: NET_Y, z: BARGE_TOP - 0.15 },
    arc: 'high',
    // A robot whose elevator reaches over the BARGE's 8 ft 5 in top drops the ALGAE in from its
    // side of the BARGE, under the NET.
    place: {
      zone: rect(BARGE_X - 1.15, NET_Y - 1.5, BARGE_X - 0.45, NET_Y + 1.5),
      facePoint: { x: BARGE_X + 6, y: NET_Y },
      faceToleranceRad: 0.7,
    },
    source: `${SRC_PTS} ALGAE in NET 4; ${M(47, '6.5.1 above the NET, within its perimeter')}; ${M(27, '5.4.2')}`,
  },
];

// ---------------------------------------------------------------- stations

const coralStations: HumanPlayerStation[] = STATIONS.map((st) => {
  const c = (out: number, along: number) => {
    const p = stationPoint(st, out, along);
    return [p.x, p.y] as const;
  };
  const half = STATION_OPENING / 2 - 0.2;
  return {
    id: st.id,
    name: 'CORAL STATION',
    side: 'blue',
    zone: poly(c(0.4, -half), c(0.4, half), c(0.95, half), c(0.95, -half)),
    pieceTypes: ['coral'],
    mode: 'direct',
    // The HUMAN PLAYER slides a CORAL down the CHUTE once the robot is lined up under the opening.
    feedIntervalSec: 1.5,
    handoffSec: 0.6,
    // 57-60 CORAL per ALLIANCE behind its two stations (6.3.4.1), so 29 each.
    supply: 29,
    // G402: a HUMAN PLAYER feeding CORAL to their ROBOT in AUTO is allowed.
    auto: true,
    source: `${M(32, '5.6.2')}; ${M(45, '6.3.4.1 57 to 60 CORAL per ALLIANCE split behind its CORAL STATIONS')}; ${M(65, 'G402')}`,
  };
});

/**
 * Each staged REEF ALGAE as a one-piece pickup in front of its face: a robot whose ALGAE mechanism
 * reaches it (`intake.maxHeight` at least the ball's center) dislodges and keeps it. Taking it
 * unblocks the BRANCHES it covered (rules.ts). Allowed in AUTO.
 */
const reefAlgae: HumanPlayerStation[] = FACES.map((k) => {
  const z = ALGAE_HIGH(k) ? ALGAE_Z.high : ALGAE_Z.low;
  return {
    id: reefAlgaeId(k),
    name: `REEF ALGAE (${ALGAE_HIGH(k) ? 'high' : 'low'})`,
    side: 'blue',
    zone: faceRect(k, SCORE_R0, SCORE_R1, -0.3, 0.3),
    pieceTypes: ['algae'],
    mode: 'direct',
    feedIntervalSec: 1,
    handoffSec: 0.4,
    supply: 1,
    handoffHeight: z,
    auto: true,
    // Not a loading area: defenders read the CORAL STATIONS as where robots come from.
    lane: false,
    display: { ...reefPoint(k, REEF_APOTHEM - 0.05), z },
    source: `${M(45, '6.3.4.2 6 ALGAE per REEF on pairs of BRANCHES, Fig 6-3 alternating high and low')}; ${M(17, '4 robots harvest ALGAE from the REEF')}`,
  };
});

// ---------------------------------------------------------------- ranking points

function autoCoral(own: AllianceSummary): number {
  let n = 0;
  for (const [id, c] of Object.entries(own.targetCounts))
    if (/^l[1-4]-/.test(id) && id.endsWith(`.${own.alliance}`)) n += c.auto;
  return n;
}

function bargePoints(own: AllianceSummary): number {
  let n = 0;
  for (const [src, pts] of Object.entries(own.sources))
    if (BARGE_SOURCES.includes(src.replace(/\.(blue|red)$/, ''))) n += pts;
  return n;
}

// ---------------------------------------------------------------- robots

const CORAL_ALGAE = ['coral', 'algae'];
/**
 * Robot weight R103: 115 lb without BUMPERS and battery (2025, down from 125). Frames: R104 120 in
 * ROBOT PERIMETER and 3 ft 6 in tall at the start; R105 1 ft 6 in extension. Drive limits come from
 * the COTS hardware (`drivetrain.ts`); mechanism and drive-team numbers start from the tiers in
 * robot-baselines.md (2023's tiers, 2024's lessons), scaled for REEF scoring (see SOURCES.md).
 */
const ROBOT_SRC = `${M(78, 'R103 115 lb, R104 120 in perimeter, 3 ft 6 in tall, R105 1 ft 6 in extension')}; tiers from robot-baselines.md`;

const archetypes: RobotArchetype[] = [
  {
    id: 'elevator',
    name: 'Full-REEF elevator',
    description:
      'A top-seventh robot: swerve, a ground and CORAL STATION intake, an elevator that scores CORAL on every level up to L4, an ALGAE arm that clears both REEF positions and lifts ALGAE over the BARGE into the NET (or scores the PROCESSOR), and a deep-CAGE climber.',
    frame: { length: 0.9, width: 0.9, height: 1.0 },
    mass: onFieldMass(115),
    drive: driveFor(
      swerve(MOTORS.krakenX60, GEARINGS.mk4L3, 115, { tipping: { cgHeight: 0.38, halfWheelbase: 0.3 } }),
      8,
    ),
    capacity: { coral: 1, algae: 1 },
    totalCapacity: 2,
    intake: { pieceTypes: CORAL_ALGAE, timeSec: 0.3, reach: 0.25, maxHeight: 1.45 },
    // NET: the elevator lifts the ALGAE over the BARGE's 8 ft 5 in top and drops it in.
    place: { L1: 0.4, L2: 0.7, L3: 0.9, L4: 1.3, processor: 0.5, net: 1.2 },
    alignSec: 2.6,
    auto: { pieces: 3, success: 0.9 },
    endgame: { deep: 6 },
    endgameSuccess: { deep: 0.45 },
    reliability: 0.97,
    source: `${ROBOT_SRC}; 4 Kraken X60 on MK4i L3, 115 lb; tier 7`,
  },
  {
    id: 'coral-elevator',
    name: 'CORAL elevator',
    description:
      'A second-seventh robot: swerve and an elevator that scores CORAL on L1-L4 from the CORAL STATION or the floor, clears REEF ALGAE into the PROCESSOR (no NET shot), and climbs a deep CAGE.',
    frame: { length: 0.88, width: 0.88, height: 1.0 },
    mass: onFieldMass(115),
    drive: driveFor(
      swerve(MOTORS.falcon500, GEARINGS.mk4L2, 115, { tipping: { cgHeight: 0.38, halfWheelbase: 0.29 } }),
      8,
    ),
    capacity: { coral: 1, algae: 1 },
    totalCapacity: 2,
    intake: { pieceTypes: CORAL_ALGAE, timeSec: 0.35, reach: 0.2, maxHeight: 1.4 },
    place: { L1: 0.5, L2: 0.8, L3: 1.0, L4: 1.5, processor: 0.6 },
    alignSec: 4.6,
    auto: { pieces: 2, success: 0.85 },
    endgame: { deep: 7 },
    endgameSuccess: { deep: 0.32 },
    reliability: 0.95,
    source: `${ROBOT_SRC}; Falcon 500 on MK4i L2, 115 lb; tier 6`,
  },
  {
    id: 'pivot-arm',
    name: 'Pivot arm (L1-L3)',
    description:
      'A third-seventh robot: swerve and a pivoting arm that scores CORAL up to L3 (not L4), clears both REEF ALGAE positions into the PROCESSOR, and hangs from a shallow CAGE.',
    frame: { length: 0.86, width: 0.86, height: 0.8 },
    mass: onFieldMass(110),
    drive: driveFor(swerve(MOTORS.neo, GEARINGS.maxSwerveHigh, 110), 8),
    capacity: { coral: 1, algae: 1 },
    totalCapacity: 2,
    intake: { pieceTypes: CORAL_ALGAE, timeSec: 0.4, reach: 0.2, maxHeight: 1.35 },
    place: { L1: 0.5, L2: 0.9, L3: 1.2, processor: 0.6 },
    alignSec: 8.9,
    auto: { pieces: 2, success: 0.75 },
    endgame: { shallow: 6 },
    endgameSuccess: { shallow: 0.35 },
    reliability: 0.92,
    source: `${ROBOT_SRC}; NEO MAXSwerve 14T, 110 lb; tier 5`,
  },
  {
    id: 'tank-arm',
    name: 'Tank-drive arm',
    description:
      'A middle-seventh robot on a West Coast (tank) drive: an arm that scores CORAL on L1-L3, reaches only the low REEF ALGAE, processes it, and sometimes hangs from a shallow CAGE.',
    frame: { length: 0.9, width: 0.8, height: 0.75 },
    mass: onFieldMass(115),
    drive: driveFor(tank(MOTORS.neo, 4, GEARINGS.tank845, 115), 6),
    capacity: { coral: 1, algae: 1 },
    totalCapacity: 2,
    intake: { pieceTypes: CORAL_ALGAE, timeSec: 0.45, reach: 0.2, maxHeight: 1.0 },
    place: { L1: 0.6, L2: 1.0, L3: 1.4, processor: 0.7 },
    alignSec: 12.1,
    auto: { pieces: 1, success: 0.6 },
    endgame: { shallow: 7 },
    endgameSuccess: { shallow: 0.22 },
    reliability: 0.9,
    source: `${ROBOT_SRC}; 4 NEO tank, 8.45:1 on 6 in wheels, 115 lb; tier 4`,
  },
  {
    id: 'l2-scorer',
    name: 'Trough and L2 scorer',
    description:
      'A fifth-seventh robot: swerve and a simple wrist that drops CORAL in the trough or on L2, knocks the low REEF ALGAE free into its PROCESSOR, and rarely climbs.',
    frame: { length: 0.84, width: 0.84, height: 0.6 },
    mass: onFieldMass(105),
    drive: driveFor(swerve(MOTORS.neo, GEARINGS.mk4L2, 105), 8),
    capacity: { coral: 1, algae: 1 },
    totalCapacity: 2,
    intake: { pieceTypes: CORAL_ALGAE, timeSec: 0.45, reach: 0.2, maxHeight: 0.95 },
    place: { L1: 0.5, L2: 1.0, processor: 0.8 },
    alignSec: 13.6,
    auto: { pieces: 1, success: 0.55 },
    endgame: { shallow: 8 },
    endgameSuccess: { shallow: 0.13 },
    reliability: 0.88,
    source: `${ROBOT_SRC}; NEO on MK4i L2, 105 lb; tier 3`,
  },
  {
    id: 'kitbot',
    name: 'KitBot',
    description:
      'The Kit of Parts robot as most rookies build it: a tank drive and a roller that takes CORAL from the CORAL STATION (no floor intake) and drops it in the trough (L1). No ALGAE mechanism and no climber: it PARKS.',
    frame: { length: 0.86, width: 0.76, height: 0.55 },
    mass: onFieldMass(90),
    drive: driveFor(tank(MOTORS.cim, 4, GEARINGS.tank1071, 90, { traction: 1.0 }), 5),
    capacity: { coral: 1 },
    intake: { pieceTypes: ['coral'], timeSec: 0.4, reach: 0.2, maxHeight: 0.3, floor: false },
    place: { L1: 0.6 },
    alignSec: 16.8,
    auto: { pieces: 1, success: 0.5 },
    reliability: 0.78,
    source: `${ROBOT_SRC}; kit chassis, 4 CIM tank, 10.71:1, 90 lb; tier 2 (see SOURCES.md: the KitBot's own documentation wasn't read)`,
  },
  {
    id: 'lowres',
    name: 'Low-resource robot',
    description:
      'A bottom-seventh robot: a heavy tank drive and a CORAL chute fed at the CORAL STATION that drops CORAL in the trough. Often breaks down; PARKS. Plays defense when given the job.',
    frame: { length: 0.93, width: 0.93, height: 0.5 },
    mass: onFieldMass(115, { bumpersLb: 15 }),
    drive: driveFor(tank(MOTORS.cim, 6, GEARINGS.tank1071, 115, { traction: 1.1 }), 5),
    capacity: { coral: 1 },
    intake: { pieceTypes: ['coral'], timeSec: 0.5, reach: 0.2, maxHeight: 0.3, floor: false },
    place: { L1: 0.8 },
    alignSec: 20.2,
    auto: { pieces: 1, success: 0.3 },
    reliability: 0.75,
    source: `${ROBOT_SRC}; 6 CIM tank, 10.71:1, 115 lb with heavy BUMPERS; tier 1`,
  },
  {
    id: 'defender',
    name: 'Dedicated defender',
    description:
      'Not dealt at random: a low, heavy six-motor tank built to push. Drops a CORAL in the trough now and then; plays defense by default.',
    frame: { length: 0.92, width: 0.92, height: 0.45 },
    mass: onFieldMass(115, { bumpersLb: 15 }),
    drive: driveFor(tank(MOTORS.krakenX60, 6, GEARINGS.tank1071, 115, { traction: 1.2 }), 6),
    capacity: { coral: 1 },
    intake: { pieceTypes: ['coral'], timeSec: 0.5, reach: 0.2, maxHeight: 0.3, floor: false },
    place: { L1: 0.8 },
    alignSec: 14,
    auto: { pieces: 1, success: 0.6 },
    defaultRole: 'defense',
    dealWeight: 0,
    reliability: 0.9,
    source: `${ROBOT_SRC}; 6 Kraken X60 tank, 10.71:1, 115 lb`,
  },
];

// ---------------------------------------------------------------- the definition

/** Base ids of every CORAL target. */
const CORAL_IDS = [...troughTargets, ...branchTargets].map((t) => t.id);
const weights = (ids: string[], w: number) => Object.fromEntries(ids.map((id) => [id, w]));

export const definition: GameDefinition = {
  id: '2025-reefscape',
  year: 2025,
  name: 'Reefscape',
  summary:
    'Score CORAL on your REEF (trough, then BRANCHES on L2-L4), clear the ALGAE resting on it into your PROCESSOR or the NET on top of the BARGE, and finish hanging from a CAGE or parked under the BARGE. Your PROCESSOR passes the ALGAE to the opposing HUMAN PLAYER, who throws it at their NET.',
  timing: {
    autoSec: 15,
    transitionSec: 3,
    teleopSec: 135,
    endgameSec: 20,
    source: M(46, '6.4 AUTO 15 s, 3 s delay, TELEOP 2:15; G428 and the BARGE lights mark the last 20 s'),
  },
  field: {
    length: L,
    width: W,
    wallHeight: feet(1, 8),
    symmetry: 'rotational',
    elements: [...reefElements, ...stationElements, ...bargeElements],
    zones: [
      {
        id: 'reef-zone',
        name: 'REEF ZONE',
        side: 'blue',
        region: REEF_ZONE,
        source: M(22, '5.2 REEF ZONE 7 ft 9½ in face to face'),
      },
      {
        id: 'barge-zone',
        name: 'BARGE ZONE',
        side: 'blue',
        region: BARGE_ZONE,
        source: `${M(22, '5.2 BARGE ZONE 3 ft 10 in × 12 ft 2½ in')}; ${D('sheet 3', '46 in, 146.5 in')}`,
      },
      {
        id: 'start-line',
        name: 'ROBOT STARTING LINE',
        side: 'blue',
        region: START_LINE,
        source: `${M(22, '5.2 7 ft 4 in from the REEF')}; ${D('sheet 5', '88 in')}`,
      },
      {
        id: 'bot-reef-zone',
        name: 'REEF ZONE (bots: + half a robot)',
        side: 'blue',
        region: BOT_REEF_ZONE,
        visible: false,
        source: M(71, 'G427: any part of the protected robot'),
      },
      {
        id: 'bot-barge-zone',
        name: 'BARGE ZONE (bots: + half a robot)',
        side: 'blue',
        region: BOT_BARGE_ZONE,
        visible: false,
        source: M(71, 'G427'),
      },
      {
        id: 'cage-area',
        name: 'CAGES (climbing robots)',
        side: 'blue',
        region: CAGE_AREA,
        visible: false,
        source: M(71, 'G428'),
      },
    ],
    source: `${M(19, '5.1 ~26 ft 5 in × ~57 ft 6⅞ in')}; ${D('sheets 3-5 and the AprilTag table')}`,
  },
  pieces: [
    {
      id: 'coral',
      name: 'CORAL',
      shape: { kind: 'cylinder', radius: 2.25 * IN, height: 11.875 * IN },
      mass: 1.45 * LB,
      color: '#f1ede4',
      friction: 0.6,
      restitution: 0.15,
      source: M(33, '5.7.1 CORAL 11⅞ in long, 4½ in OD PVC pipe, 1.1-1.8 lb'),
    },
    {
      id: 'algae',
      name: 'ALGAE',
      shape: { kind: 'sphere', radius: (16.25 / 2) * IN },
      // Not stated in the manual: a 16 in rubber playground ball, estimated.
      mass: 1.2 * LB,
      color: '#35c48c',
      friction: 0.8,
      restitution: 0.45,
      source: `${M(34, '5.7.2 16¼ in ±¼ in rubber playground ball')}; mass estimated`,
    },
  ],
  staging: [
    {
      type: 'coral',
      side: 'blue',
      // Standing on the CORAL MARKS (the CORAL covers both ends of the mark), each with an ALGAE on top.
      positions: MARK_Y.map((y) => ({ x: MARK_X, y })),
      source: `${M(45, '6.3.4.1 1 CORAL on each CORAL MARK')}; ${D('sheet 3', '48 in from the ALLIANCE WALL, 72 in apart')}`,
    },
    {
      type: 'algae',
      side: 'blue',
      positions: MARK_Y.map((y) => ({ x: MARK_X, y, z: 11.875 * IN + (16.25 / 2) * IN })),
      source: M(45, '6.3.4.2 1 ALGAE on top of each CORAL on a CORAL MARK'),
    },
  ],
  preload: { coral: 1 },
  // BUMPERS overlapping the ROBOT STARTING LINE (G303 D), facing the REEF.
  startPoses: [
    { x: START_LINE_X + TAPE / 2, y: CY + 1.9, yaw: Math.PI },
    { x: START_LINE_X + TAPE / 2, y: CY, yaw: Math.PI },
    { x: START_LINE_X + TAPE / 2, y: CY - 1.9, yaw: Math.PI },
  ],
  targets,
  stations: [...coralStations, ...reefAlgae],
  endgame: [
    {
      id: 'deep',
      name: 'Deep CAGE',
      side: 'blue',
      zones: CAGE_Y.map(cageZone),
      maxRobotsPerZone: 1,
      points: 12,
      availableAtRemainingSec: 30,
      source: `${SRC_PTS} off-the-ground via deep CAGE 12; ${M(48, '6.5.2 one and only one CAGE, not touching the carpet')}; ${M(46, '6.3.5 each team picks its CAGE height')}`,
    },
    {
      id: 'shallow',
      name: 'Shallow CAGE',
      side: 'blue',
      zones: CAGE_Y.map(cageZone),
      maxRobotsPerZone: 1,
      points: 6,
      availableAtRemainingSec: 30,
      source: `${SRC_PTS} off-the-ground via shallow CAGE 6`,
    },
  ],
  awards: [
    {
      id: 'leave',
      name: 'LEAVE',
      side: 'blue',
      kind: 'leaveZoneInAuto',
      zone: START_LINE,
      points: 3,
      source: `${SRC_PTS} LEAVE 3; ${M(48, '6.5.2 BUMPERS no longer overlap the ROBOT STARTING LINE at the end of AUTO')}`,
    },
    {
      id: 'park',
      name: 'PARK',
      side: 'blue',
      kind: 'inZoneAtEnd',
      zone: BARGE_PARK,
      points: 2,
      source: `${SRC_PTS} PARK 2; ${M(48, '6.5.2 BUMPERS partially or completely in their BARGE ZONE')}`,
    },
  ],
  rankingPoints: {
    win: 3,
    tie: 1,
    bonuses: [
      {
        id: 'auto',
        name: 'AUTO (all ROBOTS LEAVE, 1 CORAL scored in AUTO)',
        rp: 1,
        kind: 'custom',
        check: (own) => (own.sources[`leave.${own.alliance}`] ?? 0) >= 9 && autoCoral(own) >= 1,
        source: `${SRC_PTS} AUTO RP (Team Update 02: non-BYPASSED ROBOTS)`,
      },
      {
        id: 'coral',
        name: `CORAL (${CORAL_RP_PER_LEVEL} on each level; ${CORAL_RP_LEVELS_COOP} levels with Coopertition)`,
        rp: 1,
        kind: 'custom',
        check: (own, opp) => {
          const full = coralByLevel(own).filter((n) => n >= CORAL_RP_PER_LEVEL).length;
          return full >= (coopAchieved(own, opp) ? CORAL_RP_LEVELS_COOP : 4);
        },
        source: `${SRC_PTS} CORAL RP 5 per level (Team Update 03 wording; the April table's 7 is the Championship value, TU21)`,
      },
      {
        id: 'barge',
        name: `BARGE (${BARGE_RP_POINTS} BARGE points)`,
        rp: 1,
        kind: 'custom',
        // Also awarded when the opponent violates G428 (CAGE protection, last 20 s).
        check: (own, opp) =>
          bargePoints(own) >= BARGE_RP_POINTS ||
          Object.entries(opp.foulCalls).some(([why, n]) => why.startsWith('G428') && n > 0),
        source: `${SRC_PTS} BARGE RP 14 (the April table's 16 is the Championship value, TU21); ${M(71, 'G428')}`,
      },
    ],
  },
  fouls: {
    minor: 2,
    major: 6,
    contact: [
      {
        id: 'G427',
        name: 'contact with an opponent in its BARGE ZONE or REEF ZONE',
        zones: ['reef-zone', 'barge-zone'],
        inside: 'protected',
        severity: 'major',
        // "regardless of who initiates contact"; as in 2024, contact the zone's owner clearly drove
        // into isn't called (a lenient stand-in for G211's forced-violation exception).
        forgiveForced: true,
        source: M(
          71,
          "G427 ZONE protection: an opponent partially or fully inside the opponent's BARGE ZONE or REEF ZONE, regardless of who initiates contact: MAJOR FOUL",
        ),
      },
      {
        id: 'G428',
        name: 'contact with an opponent on its CAGE in the last 20 s',
        zones: ['cage-area'],
        inside: 'protected',
        severity: 'major',
        endgameOnly: true,
        // One call per pair of robots in the last 20 s (as 2024's G424).
        repeatSec: 20,
        forgiveForced: true,
        source: M(71, 'G428 CAGE protection: MAJOR FOUL and the opponent is awarded the BARGE RP'),
      },
    ],
    pinning: {
      id: 'G425',
      countSec: 3,
      severity: 'minor',
      repeatSeverity: 'major',
      releaseGap: feet(6),
      repinSec: 3,
      source: M(
        71,
        'G425 3-count on PINS; 6 ft for more than 3 s ends it; MINOR FOUL, then a MAJOR FOUL per 3 s',
      ),
    },
    source: M(50, 'Table 6-3 MINOR FOUL 2, MAJOR FOUL 6'),
  },
  archetypes,
  defaultArchetype: 'elevator',
  lineups: [
    {
      id: 'powerhouse',
      name: 'Powerhouse',
      description: 'Three full-REEF elevators: the ceiling for an alliance.',
      robots: [{ archetype: 'elevator' }, { archetype: 'elevator' }, { archetype: 'elevator' }],
    },
    {
      id: 'typical',
      name: 'Typical qualification alliance',
      description: 'One strong elevator, a trough-and-L2 scorer and a rookie KitBot.',
      robots: [{ archetype: 'elevator' }, { archetype: 'l2-scorer' }, { archetype: 'kitbot' }],
    },
    {
      id: 'reef-and-algae',
      name: 'REEF and ALGAE',
      description:
        'An elevator keeps scoring CORAL while an arm robot clears the REEF ALGAE and processes it, opening L2 and L3 for its partners.',
      robots: [
        { archetype: 'elevator', role: 'coral' },
        { archetype: 'coral-elevator', role: 'coral' },
        { archetype: 'pivot-arm', role: 'algae' },
      ],
    },
    {
      id: 'barge-rp',
      name: 'BARGE first',
      description: 'Three climbers head for the CAGES early to make the BARGE RP (14 BARGE points).',
      robots: [{ archetype: 'coral-elevator' }, { archetype: 'pivot-arm' }, { archetype: 'tank-arm' }],
      strategy: 'early-endgame',
    },
    {
      id: 'shutdown',
      name: 'Shutdown defense',
      description:
        'Two scorers and a defender that waits outside the opponents’ REEF ZONE (contact inside it is a MAJOR FOUL, G427).',
      robots: [
        { archetype: 'elevator' },
        { archetype: 'coral-elevator' },
        { archetype: 'defender', role: 'defense' },
      ],
      strategy: 'aggressive',
    },
    {
      id: 'station-choke',
      name: 'CORAL STATION defense',
      description:
        'Two scorers and a defender beside the opponents’ CORAL STATIONS, which no rule protects, holding robots up on their way in and out (only 1 defender may cross, G421).',
      robots: [
        { archetype: 'elevator' },
        { archetype: 'coral-elevator' },
        { archetype: 'lowres', role: 'station-defense' },
      ],
    },
    {
      id: 'rookies',
      name: 'Rookie alliance',
      description: 'Three KitBots: CORAL in the trough from the CORAL STATION, and the occasional breakdown.',
      robots: [{ archetype: 'kitbot' }, { archetype: 'kitbot' }, { archetype: 'kitbot' }],
    },
  ],
  roles: [
    {
      id: 'coral',
      name: 'CORAL first',
      description:
        'Scores CORAL and leaves the REEF ALGAE to its partners: an ALGAE counts half what the planner would give it.',
      targetWeights: { processor: 0.5, net: 0.5 },
    },
    {
      id: 'algae',
      name: 'ALGAE specialist',
      description:
        'Clears the REEF ALGAE (which opens L2 and L3 for its partners) and scores it; a CORAL counts half.',
      targetWeights: { ...weights(CORAL_IDS, 0.5), processor: 1.5, net: 1.5 },
    },
    {
      id: 'station-defense',
      name: 'CORAL STATION defense',
      description:
        'Plays defense beside the opponents’ CORAL STATIONS, holding up robots on their way in and out. No zone protects them there; contact at their REEF or BARGE is a MAJOR FOUL.',
      targetWeights: {},
      defense: 'source',
    },
  ],
  rules,
  botHints: {
    endgamePreference: ['deep', 'shallow'],
    endgameLeadSec: 3,
    defenseShare: 0,
    // Defense, and paths, keep away from robots partly in their REEF ZONE or BARGE ZONE (G427).
    protectedZones: ['bot-reef-zone', 'bot-barge-zone'],
    // G421: one robot at a time fully beyond the BARGE ZONES on the opponent's side (center past
    // the zones' far edge plus a small robot's half-length).
    oneAcrossLine: BARGE_ZONE.max.x + 0.3,
  },
};

export { CORAL_IDS };

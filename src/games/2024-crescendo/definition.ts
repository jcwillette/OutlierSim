import { IN, LB, cite, feet, poly, rect } from '../../engine/sim/authoring.ts';
import { GEARINGS, MOTORS, driveFor, onFieldMass, swerve, tank } from '../../engine/sim/drivetrain.ts';
import type { AllianceSummary, FieldElement, GameDefinition, ScoringTarget } from '../../engine/sim/types.ts';
import {
  AMP_BODY,
  AMP_POCKET_H,
  AMP_POCKET_W,
  AMP_POCKET_Z,
  AMP_X,
  AMP_ZONE_DEPTH,
  AMP_ZONE_LEN,
  BOT_AMP_ZONE,
  BOT_SOURCE_ZONE,
  BOT_STAGE_ZONE,
  CENTER_NOTE_Y,
  CHAINS,
  CHAIN_HIGH,
  CHAIN_LOW,
  CHAIN_R,
  CORE_BOTTOM,
  CORE_R,
  CORE_TOP,
  CY,
  L,
  LEG,
  LEGS,
  PARK_AREA,
  PODIUM_TOUCH,
  PODIUM_W,
  SOURCE_ZONE,
  SPEAKER_DEPTH,
  SPEAKER_HIGH,
  SPEAKER_LOW,
  SPEAKER_WIDTH,
  SPEAKER_Y,
  SRC_ANGLE,
  SRC_GUARD_X,
  SRC_MID,
  SRC_NORMAL,
  SRC_WALL_Y,
  STAGE_C,
  STAGE_NEAR,
  STAGE_SIDE,
  STAGE_SOURCES,
  STAGE_ZONE,
  START_ZONE,
  SUB_BACK_HALF,
  SUB_DEPTH,
  SUB_FRONT_HALF,
  SUB_HEIGHT,
  SUB_PANEL,
  TRAP_Z,
  W,
  WING_NOTE_X,
  WING_NOTE_Y,
  WING_X,
  chainHalf,
  chainZone,
  polar,
  sourcePoint,
} from './layout.ts';
import { AMP_POINTS, MELODY_NOTES, MELODY_NOTES_COOP, SPEAKER_POINTS, TRAP_POINTS, rules } from './rules.ts';

/**
 * 2024 CRESCENDO presented by Haas: generated from the kickoff Game Manual (6 Jan 2024) only. The
 * file FIRST serves now is the 9 Apr 2024 revision; every change Team Updates 01-21 made after
 * kickoff was undone to get back the kickoff rules (see SOURCES.md). No match data, no Team Update
 * rule and no post-kickoff field drawing was used. Unofficial approximation for practice.
 *
 * Coordinates: WPILib field frame, meters; origin at the blue ALLIANCE WALL on the scoring-table
 * guardrail. BLUE half authored; red is the MIRROR image across the center line (Fig 6-2: both
 * AMPS on the far guardrail, each SOURCE in the scoring-table corner at the opposing end).
 *
 * Blue layout: SPEAKER + SUBWOOFER on the ALLIANCE WALL at y 5.55 | AMP on the far guardrail at
 * x 1.84 | STAGE centered on the field's center line, near leg 3.07 m out | WING line at x 5.84 |
 * blue SOURCE in the scoring-table corner at the RED end.
 */

const M = cite('Manual');
const SRC_PTS = M(49, 'Table 6-2 (kickoff values)');

/** Hexagonal STAGE core outline (circumradius CORE_R), faces normal to the chains. */
const coreHex = (z0: number, z1: number) =>
  [z0, z1].flatMap((z) =>
    [30, 90, 150, 210, 270, 330].map((deg) => ({
      x: CORE_R * Math.cos((deg * Math.PI) / 180),
      y: CORE_R * Math.sin((deg * Math.PI) / 180),
      z,
    })),
  );
const CORE_APOTHEM = CORE_R * (Math.sqrt(3) / 2);

// ---------------------------------------------------------------- field elements

const stage: FieldElement[] = [
  ...LEGS.map((p, i): FieldElement => ({
    id: `stage-leg-${i}`,
    name: i === 0 ? 'STAGE leg (PODIUM)' : 'STAGE leg',
    side: 'blue',
    shape: { kind: 'box', size: { x: LEG, y: LEG, z: 2.3 } },
    position: { x: p.x, y: p.y, z: 1.15 },
    color: '#c3c8cf',
    source: M(27, '5.5 3-legged truss STAGE, near leg 10 ft 1 in from the ALLIANCE WALL; Fig 6-2'),
  })),
  // Top trusses between the legs (visual).
  ...[0, 1, 2].map((i): FieldElement => {
    const a = LEGS[i]!;
    const b = LEGS[(i + 1) % 3]!;
    return {
      id: `stage-truss-${i}`,
      side: 'blue',
      shape: { kind: 'box', size: { x: STAGE_SIDE, y: 0.3, z: 0.3 } },
      position: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: 2.3 },
      rotation: { yaw: Math.atan2(b.y - a.y, b.x - a.x) },
      solid: false,
      color: '#c3c8cf',
      opacity: 0.8,
      source: M(27, 'Fig 5-8'),
    };
  }),
  {
    // Solid for NOTES, which bounce off it; robots up to 0.71 m tall drive under it.
    id: 'stage-core',
    name: 'STAGE core',
    side: 'blue',
    shape: { kind: 'hull', vertices: coreHex(CORE_BOTTOM, CORE_TOP) },
    position: { x: STAGE_C.x, y: STAGE_C.y, z: 0 },
    nav: 'none',
    clearance: CORE_BOTTOM,
    color: '#9aa3ad',
    opacity: 0.55,
    source: M(27, '5.5 core suspended 2 ft 4¼ in up, 2 ft 3⅞ in at the gussets (0.71 m clearance)'),
  },
  ...CHAINS.flatMap((c, i): FieldElement[] => {
    const chain = polar(STAGE_C, CHAIN_R, c.deg);
    const trap = polar(STAGE_C, CORE_APOTHEM + 0.02, c.deg);
    const mic = polar(STAGE_C, CORE_APOTHEM - 0.12, c.deg);
    const yaw = (c.deg * Math.PI) / 180;
    return [
      {
        id: `chain-${c.id}`,
        name: c.name,
        side: 'blue',
        shape: { kind: 'box', size: { x: 0.03, y: STAGE_SIDE - LEG, z: 0.03 } },
        position: { x: chain.x, y: chain.y, z: (CHAIN_HIGH + CHAIN_LOW) / 2 },
        rotation: { yaw },
        solid: false,
        opacity: 1,
        color: '#d9dde2',
        source: M(27, 'chains 4 ft up at the legs, lowest 2 ft 4¼ in, 1 ft 4⅝ in from the core'),
      },
      {
        id: `trap-${i + 1}-box`,
        name: 'TRAP',
        side: 'blue',
        shape: { kind: 'box', size: { x: 0.05, y: 0.5, z: 0.32 } },
        position: { x: trap.x, y: trap.y, z: TRAP_Z + 0.16 },
        rotation: { yaw },
        solid: false,
        opacity: 0.7,
        color: 'alliance',
        source: M(28, '5.5 TRAP opening bottom 4 ft 8½ in'),
      },
      {
        id: `microphone-${i + 1}`,
        name: 'MICROPHONE',
        side: 'blue',
        shape: { kind: 'cylinder', radius: (1.66 / 2) * IN, height: feet(1) },
        position: { x: mic.x, y: mic.y, z: CORE_TOP + feet(1) / 2 },
        solid: false,
        opacity: 1,
        color: '#c9ccd1',
        source: M(29, 'MICROPHONE 1 ft tall, 1.66 in OD, top 7 ft 4¼ in'),
      },
    ];
  }),
  {
    id: 'podium',
    name: 'PODIUM',
    side: 'blue',
    shape: { kind: 'box', size: { x: 0.02, y: PODIUM_W, z: feet(1, 5.75) } },
    position: { x: STAGE_NEAR - 0.01, y: CY, z: 0.12 + feet(1, 5.75) / 2 },
    solid: false,
    opacity: 1,
    color: 'alliance',
    source: M(29, 'PODIUM 1 ft 5¾ in tall by 10 in wide on the leg facing the ALLIANCE WALL'),
  },
];

const elements: FieldElement[] = [
  {
    // The ALLIANCE WALL below the SPEAKER opening (6 ft 6 in): missed shots bounce back into play.
    id: 'alliance-wall',
    name: 'ALLIANCE WALL',
    side: 'blue',
    shape: { kind: 'box', size: { x: 0.04, y: W - SRC_WALL_Y, z: SPEAKER_LOW } },
    position: { x: 0.02, y: (SRC_WALL_Y + W) / 2, z: SPEAKER_LOW / 2 },
    color: '#cfd6de',
    opacity: 0.2,
    source: M(32, '5.6.2 DRIVER STATIONS 6 ft 6 in tall; SPEAKER opening bottom = top of the wall'),
  },
  {
    id: 'subwoofer',
    name: 'SUBWOOFER',
    side: 'blue',
    shape: {
      kind: 'hull',
      vertices: [
        ...[0, SUB_PANEL].flatMap((z) => [
          { x: 0, y: -SUB_BACK_HALF, z },
          { x: 0, y: SUB_BACK_HALF, z },
          { x: SUB_DEPTH, y: -SUB_FRONT_HALF, z },
          { x: SUB_DEPTH, y: SUB_FRONT_HALF, z },
        ]),
        { x: 0.02, y: -0.5, z: SUB_HEIGHT },
        { x: 0.02, y: 0.5, z: SUB_HEIGHT },
      ],
    },
    position: { x: 0, y: SPEAKER_Y, z: 0 },
    color: 'alliance',
    source: M(32, '5.6.1 SUBWOOFER 3 ft 1 in tall, 3 ft ⅛ in deep, 8⅜ in panels; widths off Fig 6-2'),
  },
  {
    id: 'speaker-hood',
    name: 'SPEAKER',
    side: 'blue',
    shape: { kind: 'box', size: { x: SPEAKER_DEPTH, y: SPEAKER_WIDTH + 0.2, z: 0.5 } },
    position: { x: SPEAKER_DEPTH / 2, y: SPEAKER_Y, z: SPEAKER_HIGH + 0.25 },
    color: 'alliance',
    opacity: 0.45,
    source: M(31, '5.6.1 opening 6 ft 6 in to 6 ft 10⅞ in, 1 ft 6 in into the FIELD'),
  },
  ...[-1, 1].map((k, i): FieldElement => ({
    id: `speaker-side-${i}`,
    side: 'blue',
    shape: { kind: 'box', size: { x: SPEAKER_DEPTH, y: 0.1, z: SPEAKER_HIGH - SPEAKER_LOW } },
    position: {
      x: SPEAKER_DEPTH / 2,
      y: SPEAKER_Y + k * (SPEAKER_WIDTH / 2 + 0.05),
      z: (SPEAKER_LOW + SPEAKER_HIGH) / 2,
    },
    color: '#2b2e33',
    source: M(31, 'opening 3 ft 5⅜ in wide'),
  })),
  {
    // Visual: the AMP sits in the guardrail line; its FIELD face is the boundary (Fig 5-2).
    id: 'amp',
    name: 'AMP',
    side: 'blue',
    shape: { kind: 'box', size: { x: AMP_BODY, y: 0.3, z: 1.3 } },
    position: { x: AMP_X, y: W + 0.15, z: 0.65 },
    solid: false,
    opacity: 0.7,
    color: 'alliance',
    source: M(25, '5.3 AMP 4 ft 1½ in from the ALLIANCE WALL; width off Fig 6-2'),
  },
  {
    id: 'amp-pocket',
    side: 'blue',
    shape: { kind: 'box', size: { x: AMP_POCKET_W, y: 0.02, z: AMP_POCKET_H } },
    position: { x: AMP_X, y: W - 0.01, z: AMP_POCKET_Z + AMP_POCKET_H / 2 },
    solid: false,
    opacity: 1,
    color: '#2b2e33',
    source: M(25, 'pocket 2 ft wide, 1 ft 6 in tall, bottom 2 ft 2 in up'),
  },
  {
    // Blue's SOURCE, in the scoring-table corner at the red end.
    id: 'source',
    name: 'SOURCE',
    side: 'blue',
    shape: {
      kind: 'hull',
      vertices: [0, SPEAKER_LOW].flatMap((z) => [
        { x: 0, y: 0, z },
        { x: -SRC_GUARD_X, y: 0, z },
        { x: 0, y: SRC_WALL_Y, z },
      ]),
    },
    position: { x: L, y: 0, z: 0 },
    color: 'alliance',
    opacity: 0.6,
    source: M(26, '5.4 SOURCE wall across the corner, 30° to the guardrail (Fig 6-2)'),
  },
  {
    id: 'source-opening',
    side: 'blue',
    shape: { kind: 'box', size: { x: feet(6, 3.25), y: 0.02, z: 6 * IN } },
    position: {
      x: SRC_MID.x + SRC_NORMAL.x * 0.01,
      y: SRC_MID.y + SRC_NORMAL.y * 0.01,
      z: feet(3, 0.75) + 3 * IN,
    },
    rotation: { yaw: SRC_ANGLE },
    solid: false,
    opacity: 1,
    color: '#2b2e33',
    source: M('26-27', 'opening 6 ft 3¼ in by 6 in, bottom 3 ft ¾ in up'),
  },
  ...stage,
  {
    id: 'wing-line',
    name: 'WING line',
    side: 'blue',
    shape: { kind: 'box', size: { x: 2 * IN, y: W, z: 0.004 } },
    position: { x: WING_X, y: W / 2, z: 0.002 },
    solid: false,
    opacity: 1,
    color: 'alliance',
    source: M(25, 'WING bounded by the alliance-colored line across the FIELD; x off Fig 6-2'),
  },
  {
    id: 'center-line',
    name: 'CENTER LINE',
    side: 'neutral',
    shape: { kind: 'box', size: { x: 2 * IN, y: W, z: 0.004 } },
    position: { x: L / 2, y: W / 2, z: 0.002 },
    solid: false,
    opacity: 1,
    color: '#e8e8e8',
    source: M(24, 'CENTER LINE bisects the FIELD'),
  },
];

// ---------------------------------------------------------------- scoring targets

const traps: ScoringTarget[] = CHAINS.map((c, i) => ({
  id: `trap-${i + 1}`,
  name: `TRAP (${c.name})`,
  side: 'blue',
  accepts: ['note'],
  points: TRAP_POINTS,
  tags: ['trap'],
  capacity: 1,
  place: { zone: chainZone(c.deg), facePoint: { x: STAGE_C.x, y: STAGE_C.y }, faceToleranceRad: 0.6 },
  display: { ...polar(STAGE_C, CORE_APOTHEM - 0.1, c.deg), z: TRAP_Z + 0.08 },
  source: `${SRC_PTS} NOTE in TRAP 5 (max 1/TRAP); ${M(46, '6.5.1')}; open in the last 20 s (rules.ts)`,
}));

const targets: ScoringTarget[] = [
  {
    id: 'speaker',
    name: 'SPEAKER',
    side: 'blue',
    accepts: ['note'],
    points: SPEAKER_POINTS,
    tags: ['speaker'],
    // The opening between the top of the ALLIANCE WALL and the hood, under the hood.
    aperture: {
      center: { x: 0.235, y: SPEAKER_Y, z: (SPEAKER_LOW + SPEAKER_HIGH) / 2 },
      size: { x: 0.43, y: SPEAKER_WIDTH, z: SPEAKER_HIGH - SPEAKER_LOW - 0.01 },
    },
    // The middle of the opening's plane (14° up, from the wall top out to the hood's edge). Shots
    // arrive rising, the way the opening faces (down and out).
    aimPoint: { x: SPEAKER_DEPTH / 2, y: SPEAKER_Y, z: (SPEAKER_LOW + SPEAKER_HIGH) / 2 },
    arc: 'rising',
    source: `${SRC_PTS} SPEAKER 5 / 2, AMPLIFIED 5 (rules.ts); ${M(31, '5.6.1')}`,
  },
  {
    id: 'amp',
    name: 'AMP',
    side: 'blue',
    accepts: ['note'],
    points: AMP_POINTS,
    tags: ['amp'],
    place: {
      zone: rect(AMP_X - 0.3, W - 1.0, AMP_X + 0.3, W - 0.38),
      facePoint: { x: AMP_X, y: W + 3 },
      faceToleranceRad: 0.5,
    },
    source: `${SRC_PTS} AMP 2 / 1; ${M(25, '5.3 pocket 2 ft wide, 2 ft 2 in up')}`,
  },
  ...traps,
];

// ---------------------------------------------------------------- ranking points

/** AMP and SPEAKER NOTES an alliance scored, AUTO and TELEOP. */
function melodyNotes(own: AllianceSummary): number {
  let n = 0;
  for (const base of ['amp', 'speaker']) {
    const c = own.targetCounts[`${base}.${own.alliance}`];
    if (c) n += c.auto + c.teleop;
  }
  return n;
}

/** STAGE points (PARK, ONSTAGE, TRAP, HARMONY, SPOTLIT). */
function stagePoints(own: AllianceSummary): number {
  let n = 0;
  for (const [src, pts] of Object.entries(own.sources))
    if (STAGE_SOURCES.includes(src.replace(/\.(blue|red)$/, ''))) n += pts;
  return n;
}

// ---------------------------------------------------------------- robots

const NOTE = ['note'];
/** A shooter launches over its own frame (the engine's launch height); arms and hoods stow below. */
const shooter = (
  frameHeight: number,
  s: {
    exitSpeed: number;
    spreadDeg: number;
    reloadSec: number;
    maxRange: number;
    pitchRangeDeg: [number, number];
    turret?: boolean;
    passRange?: number;
  },
) => ({ pieceTypes: NOTE, height: frameHeight + 0.2, ...s });

/** Calibrated against the real 2024 season (CALIBRATION.md). */
const REAL = (what: string) => `CALIBRATION.md (real 2024 season): ${what}`;

export const definition: GameDefinition = {
  id: '2024-crescendo',
  year: 2024,
  name: 'Crescendo',
  summary:
    'Pick up orange NOTES from the floor or your SOURCE and shoot them into your SPEAKER (5 in auto, ' +
    '2 in teleop) or place them in your AMP (2 / 1). Two AMP NOTES let your human player AMPLIFY the ' +
    'SPEAKER for 10 s: 5 points a NOTE. In the last 20 s get ONSTAGE on a STAGE chain (3, +2 per ' +
    'partner on the same chain), score a TRAP (5) or PARK (1).',
  timing: {
    autoSec: 15,
    transitionSec: 3,
    teleopSec: 135,
    endgameSec: 20,
    source: M(45, '6.4 AUTO 15 s, 3 s delay, TELEOP 2:15; last 20 s per G424 / G430'),
  },
  field: {
    length: L,
    width: W,
    wallHeight: feet(1, 8),
    symmetry: 'mirror',
    carpetColor: '#3a3d42',
    source: `${M(21, '5.1 26 ft 11¼ in x 54 ft 3¼ in; guardrail 1 ft 8 in (p.22)')}; mirror per Fig 6-2`,
    elements,
    zones: [
      {
        id: 'start',
        name: 'Robot starting zone',
        side: 'blue',
        region: START_ZONE,
        source: M(24, 'ROBOT STARTING ZONE 6 ft 4⅛ in by 23 ft 8⅛ in, from the AMP ZONE to the SOURCE ZONE'),
      },
      {
        id: 'amp-zone',
        name: 'AMP ZONE',
        side: 'blue',
        region: rect(0, W - AMP_ZONE_DEPTH, AMP_ZONE_LEN, W),
        source: M(24, 'AMP ZONE 10 ft 10 in by 1 ft 5¾ in'),
      },
      {
        // The WING line (Fig 5-5): G414 forbids passing into a WING from the opponent's WING.
        id: 'wing',
        name: 'WING',
        side: 'blue',
        region: rect(0, 0, WING_X, W),
        visible: false,
        source: M(25, 'WING: the area between the ALLIANCE WALL and the WING line'),
      },
      {
        id: 'source-zone',
        name: 'SOURCE ZONE',
        side: 'blue',
        region: SOURCE_ZONE,
        source: M(24, 'SOURCE ZONE parallelogram, 1 ft 6¾ in deep from the SOURCE wall'),
      },
      {
        id: 'stage-zone',
        name: 'STAGE ZONE',
        side: 'blue',
        region: STAGE_ZONE,
        source: `${M(25, 'STAGE ZONE 6-sided, Fig 5-5')}; outline measured off Fig 6-2`,
      },
      {
        // Not drawn: PARK counts any part of the bumpers in the STAGE ZONE; the engine tests the
        // center, so this is the STAGE ZONE grown by ~half a robot.
        id: 'park-area',
        name: 'STAGE ZONE (any part of the robot)',
        side: 'blue',
        region: PARK_AREA,
        visible: false,
        source: M(46, '6.5.2 PARK: BUMPERS partially or completely in the STAGE ZONE'),
      },
      // Not drawn, bots only: the SOURCE, AMP and STAGE ZONES grown by half a robot (botHints).
      ...(
        [
          ['bot-source-zone', BOT_SOURCE_ZONE],
          ['bot-amp-zone', BOT_AMP_ZONE],
          ['bot-stage-zone', BOT_STAGE_ZONE],
        ] as const
      ).map(([id, region]) => ({
        id,
        name: `${id.slice(4).replace('-zone', '').toUpperCase()} ZONE (bots' margin)`,
        side: 'blue' as const,
        region,
        visible: false,
        source: M(71, 'G422-G424 count any part of either robot; bots keep their centers out of these'),
      })),
      {
        // Not drawn: touching the PODIUM (G422).
        id: 'podium',
        name: 'PODIUM',
        side: 'blue',
        region: PODIUM_TOUCH,
        visible: false,
        source: M(71, 'G422 PODIUM protection'),
      },
    ],
  },
  pieces: [
    {
      id: 'note',
      name: 'NOTE',
      shape: { kind: 'torus', outerRadius: 7 * IN, innerRadius: 5 * IN, height: 2 * IN },
      mass: (8.3 / 16) * LB,
      color: '#f28a1d',
      friction: 0.9,
      restitution: 0.25,
      source: M(34, '5.7 NOTE 14 in OD, 10 in ID, 2 in thick, 8.3 oz, orange foam'),
    },
  ],
  staging: [
    {
      type: 'note',
      side: 'blue',
      positions: WING_NOTE_Y.map((y) => ({ x: WING_NOTE_X, y })),
      source: M(45, '6.3.4 3 NOTES on the WING SPIKE MARKS, 9 ft 6 in out, 4 ft 9 in apart (Fig 6-2)'),
    },
    {
      type: 'note',
      side: 'neutral',
      positions: CENTER_NOTE_Y.map((y) => ({ x: L / 2, y })),
      source: M(45, '6.3.4 5 NOTES on the CENTER LINE SPIKE MARKS, 5 ft 6 in apart (Fig 6-2)'),
    },
  ],
  preload: { note: 1 },
  // Bumpers in the ROBOT STARTING ZONE, against the SUBWOOFER's front and to either side of it.
  startPoses: [
    { x: 1.42, y: SPEAKER_Y + 1.4, yaw: Math.PI },
    { x: 1.42, y: SPEAKER_Y, yaw: Math.PI },
    { x: 1.42, y: SPEAKER_Y - 1.4, yaw: Math.PI },
  ],
  targets,
  stations: [
    {
      id: 'source',
      name: 'SOURCE',
      side: 'blue',
      zone: poly(
        [sourcePoint(-0.6, 0.42).x, sourcePoint(-0.6, 0.42).y],
        [sourcePoint(0.6, 0.42).x, sourcePoint(0.6, 0.42).y],
        [sourcePoint(0.6, 0.95).x, sourcePoint(0.6, 0.95).y],
        [sourcePoint(-0.6, 0.95).x, sourcePoint(-0.6, 0.95).y],
      ),
      pieceTypes: NOTE,
      mode: 'direct',
      // The HUMAN PLAYER feeds a NOTE down the CHUTE once the robot is lined up in front of it.
      feedIntervalSec: 1.5,
      handoffSec: 1.0,
      supply: 45,
      source: `${M(26, '5.4 SOURCE, CHUTE')}; ${M(45, '6.3.4 45 NOTES per SOURCE AREA')}`,
    },
  ],
  endgame: [
    {
      id: 'onstage',
      name: 'ONSTAGE',
      side: 'blue',
      // Two robots per chain (HARMONY), one per half.
      zones: CHAINS.flatMap((c) => [chainHalf(c.deg, 1), chainHalf(c.deg, -1)]),
      maxRobotsPerZone: 1,
      points: 3,
      availableAtRemainingSec: 30,
      source: `${SRC_PTS} ONSTAGE 3 (SPOTLIT 4, HARMONY +2: rules.ts); ${M(46, '6.5.2')}`,
    },
  ],
  awards: [
    {
      id: 'leave',
      name: 'LEAVE',
      side: 'blue',
      kind: 'leaveZoneInAuto',
      zone: START_ZONE,
      points: 2,
      source: `${SRC_PTS} LEAVE; ${M(46, '6.5.2 BUMPERS completely clear the ROBOT STARTING ZONE')}`,
    },
    {
      id: 'park',
      name: 'PARK',
      side: 'blue',
      kind: 'inZoneAtEnd',
      zone: PARK_AREA,
      points: 1,
      source: `${SRC_PTS} PARK; ${M(46, '6.5.2')}`,
    },
  ],
  rankingPoints: {
    win: 2,
    tie: 1,
    bonuses: [
      {
        id: 'melody',
        name: `MELODY (${MELODY_NOTES} AMP & SPEAKER NOTES, ${MELODY_NOTES_COOP} with Coopertition)`,
        rp: 1,
        kind: 'custom',
        check: (own) =>
          melodyNotes(own) >= ((own.sources['coopertition'] ?? 0) > 0 ? MELODY_NOTES_COOP : MELODY_NOTES),
        source: `${SRC_PTS} MELODY: 18 (15 with the Coopertition Bonus), kickoff threshold`,
      },
      {
        id: 'ensemble',
        name: 'ENSEMBLE (10 STAGE points and 2 ROBOTS ONSTAGE)',
        rp: 1,
        kind: 'custom',
        // Also awarded when the opponent violates G424 (STAGE protection) in a Qualification MATCH.
        check: (own, opp) =>
          (stagePoints(own) >= 10 && (own.endgame['onstage'] ?? 0) >= 2) ||
          Object.entries(opp.foulCalls).some(([why, n]) => why.startsWith('G424') && n > 0),
        source: `${SRC_PTS} ENSEMBLE; ${M(72, 'G424 violation awards the opponent the ENSEMBLE RP')}`,
      },
    ],
  },
  fouls: {
    minor: 2,
    major: 5,
    contact: [
      {
        id: 'G423',
        name: "contact with either robot in the opponent's SOURCE ZONE or AMP ZONE",
        zones: ['source-zone', 'amp-zone'],
        inside: 'either',
        severity: 'major',
        // "regardless of who initiates contact"; only deliberately forced violations are excused
        // (G211), so not calling contact the zone's owner clearly drove into is a lenient stand-in.
        forgiveForced: true,
        source: M(
          71,
          "G423 any part of either ROBOT'S BUMPERS in the opponent's SOURCE ZONE or AMP ZONE: TECH FOUL",
        ),
      },
      {
        id: 'G422',
        name: 'contact with an opponent touching its PODIUM',
        zones: ['podium'],
        inside: 'protected',
        severity: 'major',
        source: M(71, 'G422 PODIUM protection: TECH FOUL'),
      },
      // G424 B: 2 TECH FOULS per contact in the last 20 s (two calls), and the ENSEMBLE RP.
      ...[1, 2].map((k) => ({
        id: k === 1 ? 'G424' : 'G424 (2nd)',
        name: "contact with either robot in the opponent's STAGE ZONE in the last 20 s",
        zones: ['stage-zone'],
        inside: 'either' as const,
        severity: 'major' as const,
        endgameOnly: true,
        // One call per pair of robots in the last 20 s: a lasting contact (a robot that broke down
        // next to a climbing opponent) is one instance, not one every 3 s.
        repeatSec: 20,
        forgiveForced: true,
        source: M(71, "G424 B: either ROBOT'S BUMPERS in the opponent's STAGE ZONE, last 20 s: 2 TECH FOULS"),
      })),
    ],
    pinning: {
      id: 'G420',
      countSec: 5,
      severity: 'minor',
      repeatSeverity: 'major',
      releaseGap: feet(6),
      // The count only ends after the robots stay 6 ft apart for more than 5 s.
      repinSec: 5,
      source: M(70, 'G420 5-count on PINS; 6 ft for more than 5 s ends it; FOUL then a TECH FOUL per 5 s'),
    },
    source: M(49, 'Table 6-3 FOUL 2, TECH FOUL 5'),
  },
  // Robot types as real 2024 robots were built, one tier per seventh of real robots (best to worst,
  // by component OPR per event; CALIBRATION.md). The top seventh comes in two builds, dealt in the
  // proportion they appeared: short robots that drive under the STAGE, and full-size ones that can't.
  // Mechanisms and drivetrains are engineering estimates (R103 125 lb, R104 120 in frame perimeter,
  // R502 4 drive motors, the 0.71 m STAGE clearance); drive-team line-ups, autos, climbs and
  // reliability are fitted to the real season, tier by tier.
  archetypes: [
    {
      id: 'allround',
      name: 'Under-stage all-rounder',
      description:
        'A top-seventh robot built to fit under the STAGE: swerve, an under-bumper intake, a pivoting shooter that scores from the PODIUM and the WING line, lobs NOTES to partners, scores the AMP, climbs and sometimes scores a TRAP.',
      frame: { length: 0.84, width: 0.84, height: 0.62 },
      mass: onFieldMass(125),
      drive: driveFor(swerve(MOTORS.krakenX60, GEARINGS.mk4L3, 125), 9),
      capacity: { note: 1 },
      intake: { pieceTypes: NOTE, timeSec: 0.25, reach: 0.2, maxHeight: 0.3 },
      shooter: shooter(0.62, {
        exitSpeed: 14,
        spreadDeg: 1.0,
        reloadSec: 0.3,
        maxRange: 5.5,
        pitchRangeDeg: [18, 66],
        passRange: 11,
      }),
      place: { amp: 0.6, trap: 3 },
      alignSec: 0.5,
      auto: { pieces: 2, success: 0.95 },
      endgame: { onstage: 5 },
      endgameSuccess: { onstage: 0.4 },
      reliability: 0.97,
      dealWeight: 0.6,
      source: `mechanism: fits under the 0.71 m STAGE (p.27); 4 Kraken X60 on MK4i L3, 125 lb (R103). ${REAL('tier 7: line-up, auto, climb, TRAP use')}`,
    },
    {
      id: 'fullsize',
      name: 'Full-size turret shooter',
      description:
        'The other top-seventh build: a tall robot (elevator or turret) that shoots from anywhere in the WING without turning and lobs NOTES across the field, but is too tall for the STAGE, so it drives around it. Scores the AMP and climbs; no TRAP.',
      frame: { length: 0.84, width: 0.84, height: 1.0 },
      mass: onFieldMass(125),
      drive: driveFor(
        swerve(MOTORS.krakenX60, GEARINGS.mk4L3, 125, { tipping: { cgHeight: 0.42, halfWheelbase: 0.29 } }),
        8,
      ),
      capacity: { note: 1 },
      intake: { pieceTypes: NOTE, timeSec: 0.25, reach: 0.2, maxHeight: 0.3 },
      shooter: shooter(1.0, {
        exitSpeed: 15,
        spreadDeg: 1.0,
        reloadSec: 0.3,
        maxRange: 6,
        pitchRangeDeg: [15, 66],
        turret: true,
        passRange: 12,
      }),
      place: { amp: 0.8 },
      alignSec: 1.0,
      auto: { pieces: 2, success: 0.95 },
      endgame: { onstage: 6 },
      endgameSuccess: { onstage: 0.45 },
      reliability: 0.97,
      dealWeight: 0.4,
      source: `mechanism: over 0.71 m tall, so the STAGE core (p.27) blocks it; turret shooter; 4 Kraken X60 on MK4i L3. ${REAL('tier 7, as the under-stage all-rounder')}`,
    },
    {
      id: 'shooter',
      name: 'Pivot shooter',
      description:
        'A second-seventh robot: swerve, a ground intake and a pivoting shooter that scores the SPEAKER from the PODIUM, also scores the AMP and climbs. Can lob a NOTE to a partner.',
      frame: { length: 0.84, width: 0.84, height: 0.6 },
      mass: onFieldMass(120),
      drive: driveFor(swerve(MOTORS.falcon500, GEARINGS.mk4L2, 120), 8),
      capacity: { note: 1 },
      intake: { pieceTypes: NOTE, timeSec: 0.3, reach: 0.2, maxHeight: 0.3 },
      shooter: shooter(0.6, {
        exitSpeed: 13,
        spreadDeg: 1.5,
        reloadSec: 0.4,
        maxRange: 4,
        pitchRangeDeg: [20, 66],
        passRange: 9,
      }),
      place: { amp: 0.8 },
      alignSec: 5.0,
      auto: { pieces: 2, success: 0.8 },
      endgame: { onstage: 7 },
      endgameSuccess: { onstage: 0.32 },
      reliability: 0.95,
      source: `mechanism: hood or pivot shooter, Falcon 500 on MK4i L2, 120 lb; every real tier scored ~30 % of its teleop NOTES in the AMP. ${REAL('tier 6')}`,
    },
    {
      id: 'ampbot',
      name: 'AMP and SUBWOOFER scorer',
      description:
        'A third-seventh robot: one roller path feeds the AMP or a fixed-angle shot from against the SUBWOOFER; climbs.',
      frame: { length: 0.8, width: 0.8, height: 0.55 },
      mass: onFieldMass(110),
      drive: driveFor(swerve(MOTORS.neo, GEARINGS.maxSwerveHigh, 110), 9),
      capacity: { note: 1 },
      intake: { pieceTypes: NOTE, timeSec: 0.3, reach: 0.2, maxHeight: 0.3 },
      shooter: shooter(0.55, {
        exitSpeed: 8,
        spreadDeg: 2.5,
        reloadSec: 0.5,
        maxRange: 2.0,
        pitchRangeDeg: [52, 68],
      }),
      place: { amp: 0.5 },
      alignSec: 6.0,
      auto: { pieces: 3, success: 0.74 },
      endgame: { onstage: 6 },
      endgameSuccess: { onstage: 0.25 },
      reliability: 0.92,
      source: `mechanism: one roller path to the AMP pocket (2 ft 2 in up, p.25) and a fixed SUBWOOFER shot; NEO MAXSwerve 14T, 110 lb. ${REAL('tier 5')}`,
    },
    {
      id: 'tank',
      name: 'Tank-drive shooter',
      description:
        'A middle-seventh robot on a tank (West Coast) drive: a ground intake, a fixed shooter for shots near the SUBWOOFER, scores the AMP, sometimes climbs.',
      frame: { length: 0.86, width: 0.76, height: 0.6 },
      mass: onFieldMass(120),
      drive: driveFor(tank(MOTORS.falcon500, 4, GEARINGS.tank845, 120), 7),
      capacity: { note: 1 },
      intake: { pieceTypes: NOTE, timeSec: 0.35, reach: 0.2, maxHeight: 0.3 },
      shooter: shooter(0.6, {
        exitSpeed: 9,
        spreadDeg: 2.5,
        reloadSec: 0.5,
        maxRange: 2.6,
        pitchRangeDeg: [45, 66],
      }),
      place: { amp: 0.8 },
      alignSec: 10,
      auto: { pieces: 2, success: 0.55 },
      endgame: { onstage: 7 },
      endgameSuccess: { onstage: 0.22 },
      reliability: 0.9,
      source: `mechanism: West Coast drive, 4 Falcon 500 (R502) at 8.45:1 on 6 in wheels, 120 lb; tank stayed competitive in 2024 (Chief Delphi, "Competitive Tank Drive in Crescendo Examples"). ${REAL('tier 4')}`,
    },
    {
      id: 'midbot',
      name: 'SUBWOOFER shooter',
      description:
        'A fifth-seventh robot: swerve and a fixed-angle shooter that scores from against the SUBWOOFER, scores the AMP; its climber works now and then.',
      frame: { length: 0.84, width: 0.84, height: 0.6 },
      mass: onFieldMass(118),
      drive: driveFor(swerve(MOTORS.neo, GEARINGS.mk4L2, 118), 7),
      capacity: { note: 1 },
      intake: { pieceTypes: NOTE, timeSec: 0.45, reach: 0.2, maxHeight: 0.3 },
      shooter: shooter(0.6, {
        exitSpeed: 8.5,
        spreadDeg: 3,
        reloadSec: 0.6,
        maxRange: 2.4,
        pitchRangeDeg: [45, 68],
      }),
      place: { amp: 1.0 },
      alignSec: 11,
      auto: { pieces: 2, success: 0.5 },
      endgame: { onstage: 8 },
      endgameSuccess: { onstage: 0.13 },
      reliability: 0.88,
      source: `mechanism: fixed-angle shooter; NEO MK4i L2, 118 lb; SUBWOOFER-only shooters were common (Chief Delphi, "Source Choke Point" thread). ${REAL('tier 3')}`,
    },
    {
      id: 'kitbot',
      name: 'KitBot',
      description:
        'The Kit of Parts robot as most rookies built it: a tank drive and a launcher that shoots from against the SUBWOOFER and loads only at the SOURCE (no floor intake); scores the AMP; a few added a climber.',
      frame: { length: 0.86, width: 0.76, height: 0.5 },
      mass: onFieldMass(90),
      drive: driveFor(tank(MOTORS.cim, 4, GEARINGS.tank1071, 90, { traction: 1.0 }), 5),
      capacity: { note: 1 },
      intake: { pieceTypes: NOTE, timeSec: 0.6, maxHeight: 0.3, floor: false },
      shooter: shooter(0.5, {
        exitSpeed: 7,
        spreadDeg: 2.5,
        reloadSec: 0.8,
        maxRange: 2.0,
        pitchRangeDeg: [55, 68],
      }),
      place: { amp: 1.2 },
      alignSec: 10,
      auto: { pieces: 1, success: 0.5 },
      endgame: { onstage: 10 },
      endgameSuccess: { onstage: 0.12 },
      reliability: 0.78,
      source: `mechanism: 2024 Kit of Parts launcher (loads through the launcher at the SOURCE), 4 CIM, 10.71:1, 6 in wheels, 90 lb. ${REAL('tier 2')}`,
    },
    {
      id: 'starter',
      name: 'Low-resource robot',
      description:
        'A bottom-seventh robot: a heavy tank drive and a simple roller that scores the AMP or from against the SUBWOOFER, often breaks down, rarely climbs. Plays defense when given the job.',
      frame: { length: 0.93, width: 0.93, height: 0.45 },
      mass: onFieldMass(115, { bumpersLb: 15 }),
      drive: driveFor(tank(MOTORS.cim, 4, GEARINGS.tank1071, 115, { bumpersLb: 15, traction: 1.2 }), 5),
      capacity: { note: 1 },
      intake: { pieceTypes: NOTE, timeSec: 0.5, maxHeight: 0.3 },
      shooter: shooter(0.45, {
        exitSpeed: 7,
        spreadDeg: 5,
        reloadSec: 0.8,
        maxRange: 2.0,
        pitchRangeDeg: [55, 68],
      }),
      place: { amp: 1.2 },
      alignSec: 26,
      auto: { pieces: 1, success: 0.3 },
      endgame: { onstage: 10 },
      endgameSuccess: { onstage: 0.05 },
      reliability: 0.75,
      source: `mechanism: KoP-style tank, 4 CIM, simple roller; the real bottom tier still scored ~1 NOTE a match. ${REAL('tier 1')}`,
    },
    {
      id: 'defender',
      name: 'Defender',
      description:
        'A dedicated defense robot: low, heavy, high-traction tank drive and a token roller. Never dealt by the random preset (real defense was mostly played by capable robots given the job); pick it, or give any robot the defense role.',
      frame: { length: 0.93, width: 0.93, height: 0.4 },
      mass: onFieldMass(125, { bumpersLb: 15 }),
      drive: driveFor(
        tank(MOTORS.falcon500, 4, GEARINGS.tank1071, 125, { bumpersLb: 15, traction: 1.35 }),
        6,
      ),
      capacity: { note: 1 },
      intake: { pieceTypes: NOTE, timeSec: 0.5, maxHeight: 0.3 },
      shooter: shooter(0.4, {
        exitSpeed: 7,
        spreadDeg: 5,
        reloadSec: 0.8,
        maxRange: 2.0,
        pitchRangeDeg: [55, 68],
      }),
      alignSec: 20.2,
      auto: { pieces: 0, success: 0.3 },
      reliability: 0.75,
      defaultRole: 'defense',
      dealWeight: 0,
      source:
        'mechanism: max weight (R103) and frame (R104), 4 Falcon 500 (R502) at 10.71:1 on high-traction tread; G423 keeps it out of the SOURCE and AMP ZONES',
    },
  ],
  defaultArchetype: 'allround',
  lineups: [
    {
      id: 'powerhouse',
      name: 'Powerhouse',
      description: 'Three under-stage all-rounders: the ceiling for an alliance.',
      robots: [{ archetype: 'allround' }, { archetype: 'allround' }, { archetype: 'allround' }],
    },
    {
      id: 'typical',
      name: 'Typical qualification alliance',
      description: 'One strong all-rounder, a SUBWOOFER shooter and a rookie KitBot.',
      robots: [{ archetype: 'allround' }, { archetype: 'midbot' }, { archetype: 'kitbot' }],
    },
    {
      id: 'double-feed',
      name: 'Double feed',
      description:
        'A playoff tactic from week 6 on: two robots load at the SOURCE and lob every NOTE into the WING, where a full-size turret shooter scores them at close range.',
      robots: [
        { archetype: 'fullsize' },
        { archetype: 'allround', role: 'feeder' },
        { archetype: 'shooter', role: 'feeder' },
      ],
    },
    {
      id: 'feed-and-choke',
      name: 'Feed and choke',
      description:
        "One feeder supplies a full-size shooter while the third robot holds the opponents up beside their SOURCE, using the STAGE as a choke point (tall robots can't slip under it).",
      robots: [
        { archetype: 'fullsize' },
        { archetype: 'allround', role: 'feeder' },
        { archetype: 'shooter', role: 'source-defense' },
      ],
    },
    {
      id: 'amplify',
      name: 'Amplify',
      description:
        'An AMP scorer keeps the SPEAKER AMPLIFIED while two shooters cycle into it: 5 points a NOTE, up to 4 NOTES a press.',
      robots: [{ archetype: 'ampbot', role: 'amp' }, { archetype: 'allround' }, { archetype: 'shooter' }],
    },
    {
      id: 'shutdown',
      name: 'Shutdown defense',
      description: 'Two scorers and a defender waiting in front of the opponents’ SUBWOOFER.',
      robots: [
        { archetype: 'allround' },
        { archetype: 'shooter' },
        { archetype: 'defender', role: 'defense' },
      ],
      strategy: 'aggressive',
    },
    {
      id: 'source-choke',
      name: 'Source choke',
      description:
        'Two scorers and a defender at the opponents’ SOURCE, between their STAGE and the wall (the Chief Delphi "Source Choke Point").',
      robots: [
        { archetype: 'allround' },
        { archetype: 'shooter' },
        { archetype: 'defender', role: 'source-defense' },
      ],
    },
    {
      id: 'ensemble',
      name: 'Ensemble first',
      description: 'Three climbers head for the chains early for the ENSEMBLE RP.',
      robots: [{ archetype: 'shooter' }, { archetype: 'ampbot' }, { archetype: 'tank' }],
      strategy: 'early-endgame',
    },
    {
      id: 'ideal',
      name: 'Monte Carlo pick (qualifications)',
      description:
        'The most ranking points per match the Monte Carlo search found with the calibrated robots: two under-stage all-rounders as TRAP specialists and a full-size shooter, climbing early once the lead is safe (SOURCES.md, "Alliance composition").',
      robots: [
        { archetype: 'allround', role: 'trap' },
        { archetype: 'allround', role: 'trap' },
        { archetype: 'fullsize' },
      ],
      strategy: 'close-out',
    },
    {
      id: 'ideal-playoff',
      name: 'Monte Carlo pick (playoffs)',
      description:
        'The best playoff alliance the search found: a full-size turret shooter, an all-rounder feeding it from the SOURCE, and an all-rounder scoring. It beat three all-rounders 88 % of the time.',
      robots: [
        { archetype: 'fullsize' },
        { archetype: 'allround', role: 'feeder' },
        { archetype: 'allround' },
      ],
    },
    {
      id: 'rookies',
      name: 'Rookie alliance',
      description:
        'Three KitBots: SUBWOOFER shots and the AMP from the SOURCE, and the occasional breakdown.',
      robots: [{ archetype: 'kitbot' }, { archetype: 'kitbot' }, { archetype: 'kitbot' }],
    },
  ],
  // Jobs a bot can be given in the lineup menu besides scoring freely and defense. They change what
  // the bot goes for in TELEOP, never the robot; AUTO routines are unchanged.
  roles: [
    {
      id: 'amp',
      name: 'AMP specialist',
      description:
        'Keeps the AMP bank full so the HUMAN PLAYER can AMPLIFY as often as possible: an AMP NOTE counts four times what the planner would give it. Still shoots when the SPEAKER is AMPLIFIED and the AMP is not banking.',
      targetWeights: { amp: 4 },
    },
    {
      id: 'speaker',
      name: 'SPEAKER only',
      description: 'Shoots every NOTE into the SPEAKER and leaves the AMP to its partners.',
      targetWeights: { amp: 0 },
    },
    {
      id: 'trap',
      name: 'TRAP specialist',
      description:
        'In the last 20 s, a NOTE in a TRAP counts three times what the planner would give it, so it goes for the TRAP before climbing.',
      targetWeights: { 'trap-1': 3, 'trap-2': 3, 'trap-3': 3 },
    },
    {
      id: 'feeder',
      name: 'Feeder',
      description:
        "Loads at the SOURCE and lobs each NOTE into the WING for its partners (from outside the opponents' WING, G414), unless it's already close enough to score it. Needs a robot that can pass.",
      targetWeights: {},
      feeds: true,
      source: 'Chief Delphi, "Did the 2 passing bots strategy … break the game?" (East Bay 2024)',
    },
    {
      id: 'source-defense',
      name: 'SOURCE defense',
      description:
        "Plays defense beside the opponents' SOURCE, holding up robots on their way in and out between their STAGE and the wall.",
      targetWeights: {},
      defense: 'source',
      source: 'Chief Delphi, "Effective Crescendo Defense: The Source Choke Point" (March 2024)',
    },
  ],
  passing: {
    // In the WING between the SUBWOOFER and the AMP, where partners pick passed NOTES up.
    landing: [
      { x: 2.4, y: 6.6 },
      { x: 3.6, y: 6.8 },
    ],
    notFromOpponent: ['wing'],
    minDistance: 7,
    source: M(66, "G414 no NOTE may be launched into or through a WING from the opponent's WING (TELEOP)"),
  },
  rules,
  botHints: {
    endgameLeadSec: 2,
    defenseShare: 0,
    // Bots keep defense, and their paths, away from the opponent's SOURCE and AMP ZONES (G423) and
    // its PODIUM (G422), grown by half a robot: the fouls count any part of either robot. The
    // opponent's STAGE ZONE (G424 B) only from 5 s before the last 20 s: until then robots drive
    // under the opponent's STAGE on their way to and from the SOURCE, as real robots did.
    protectedZones: ['bot-source-zone', 'bot-amp-zone', 'podium'],
    endgamePathZones: ['bot-stage-zone'],
    endgameProtectedZones: [],
  },
};

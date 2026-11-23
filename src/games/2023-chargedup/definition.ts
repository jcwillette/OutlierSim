import type {
  EndgameAction,
  FieldElement,
  GameDefinition,
  Region2D,
  ScoringTarget,
} from '../../engine/sim/types.ts';
import {
  CHARGE_SOURCES,
  columnY,
  COLUMN_PITCH,
  COLUMNS,
  coopPieces,
  countLinks,
  CUBE_COLUMNS,
  filledNodes,
  nodeId,
} from './layout.ts';
import { rules } from './rules.ts';

/**
 * 2023 CHARGED UP presented by Haas: generated from the 2023 Game Manual (the copy served at
 * FIRST's manual URL, revision of 11 Apr 2023) plus January Team Updates 01-07. No match data and
 * no post-January information was used. Unofficial approximation for practice. See SOURCES.md for
 * every value's citation and the list of simplifications.
 *
 * Coordinates: WPILib field frame, meters; origin at the blue alliance wall on the scoring-table
 * guardrail. BLUE half authored; red is the MIRROR image across the center line (both GRIDS sit on
 * the scoring-table side, Fig 6-1).
 *
 * Blue layout: GRIDS against the wall at y 0-5.50 | BARRIER at y 5.49 | red LOADING ZONE and red
 * DOUBLE SUBSTATION at y 5.50-8.02 beside the blue wall | CHARGE STATION centered (3.94, 2.745) |
 * STAGING MARKS at x 7.12 | blue LOADING ZONE + DOUBLE/SINGLE SUBSTATIONS at the RED end, high y.
 */

const IN = 0.0254;
const LB = 0.4536;
const L = 651.25 * IN; // 54 ft 3 1/4 in = 16.54 m
const W = 315.5 * IN; // 26 ft 3 1/2 in = 8.01 m
const rect = (x0: number, y0: number, x1: number, y1: number): Region2D => ({
  kind: 'rect',
  min: { x: x0, y: y0 },
  max: { x: x1, y: y1 },
});
const M = (page: number | string, what = '') => `Manual p.${page}${what ? ', ' + what : ''}`;

// ---------------------------------------------------------------- geometry (Manual 5.2-5.6)

/** GRID front face (structure); the 2 in alliance tape in front brings the depth to 4 ft 8 1/4 in. */
const GRID_FACE = 1.38;
const GRID_DEPTH = (4 * 12 + 8.25) * IN; // 1.43
const GRID_WIDTH = (18 * 12 + 0.5) * IN; // 5.50
const HYBRID_DEPTH = 16 * IN; // 0.41
const MID_X = GRID_FACE - 22.75 * IN; // mid cone node 1 ft 10 3/4 in behind the face -> 0.80
const HIGH_X = GRID_FACE - 39.75 * IN; // top cone node 3 ft 3 3/4 in behind the face -> 0.37
const MID_CUBE_X = GRID_FACE - (14.25 + 8.5) * IN; // shelf front 14 1/4 in + half of 17 in depth
const HIGH_CUBE_X = GRID_FACE - (31.625 + 8.5) * IN;

const COMMUNITY_SHALLOW = (11 * 12 + 0.375) * IN; // 3.36
const COMMUNITY_DEEP = (16 * 12 + 1.25) * IN; // 4.91
const COMMUNITY_WIDTH = 18 * 12 * IN; // 5.49

const CS_X = GRID_DEPTH + (8 * 12 + 2.625) * IN; // 2.51 beyond the grid tape -> 3.94
const CS_Y = COMMUNITY_WIDTH / 2; // centered in the community width
const CS_DEPTH = (6 * 12 + 4.125) * IN; // 1.93
const CS_WIDTH = (8 * 12 + 1.25) * IN; // 2.47
const CS_TOP_DEPTH = 4 * 12 * IN; // 1.22
const CS_TOP_WIDTH = 8 * 12 * IN; // 2.44
/** Real top is 9 1/8 in (0.23 m); modeled 0.18 m so the bot nav grid treats it as drivable. */
const CS_TOP_Z = 0.18;

const LZ_SHALLOW = (11 * 12 + 0.25) * IN; // 3.36
const LZ_DEEP = (22 * 12 + 0.25) * IN; // 6.71
const LZ_STEP_Y = 6.75; // read off Fig 5-6
const DS_DEPTH = 14 * IN; // double substation protrudes 1 ft 2 in
const DS_WIDTH = 8 * 12 * IN; // 2.44
const DS_Y = (GRID_WIDTH + W) / 2;
const SHELF_Z = (3 * 12 + 1.375) * IN; // 0.95
const SS_X = L - 2.0; // single substation chute, measured off Fig 6-1

const STAGE_X = GRID_DEPTH + (18 * 12 + 8) * IN; // 5.69 beyond the grid tape -> 7.12
const STAGE_Y = [36.25, 84.25, 132.25, 180.25].map((v) => v * IN); // 3 ft 1/4 in, then every 4 ft

const SRC_GRID = M('25-27', '5.5 GRIDS, Fig 5-15/5-16');
const SRC_CS = M('22-23', '5.4 CHARGE STATION');
const SRC_SUB = M('28-31', '5.6 SUBSTATIONS, Fig 5-20/5-21');
const SRC_PTS = M(47, 'Table 6-2');

// ---------------------------------------------------------------- field elements

const dividers: FieldElement[] = Array.from({ length: 10 }, (_, i) => {
  const y = i === 0 ? 0.02 : i === 9 ? GRID_WIDTH - 0.02 : columnY(i) + COLUMN_PITCH / 2;
  return {
    id: `grid-divider-${i}`,
    side: 'blue',
    shape: { kind: 'box', size: { x: HYBRID_DEPTH, y: 0.04, z: 5 * IN } },
    position: { x: GRID_FACE - HYBRID_DEPTH / 2, y, z: 2.5 * IN },
    color: '#d8d8d8',
    source: M(26, 'HYBRID NODE dividers 5 in tall'),
  };
});

const poles: FieldElement[] = COLUMNS.filter((c) => !CUBE_COLUMNS.has(c)).flatMap((c) => [
  {
    id: `pole-mid-${c}`,
    side: 'blue' as const,
    shape: { kind: 'cylinder' as const, radius: 0.83 * IN, height: 34 * IN },
    position: { x: MID_X, y: columnY(c), z: 17 * IN },
    solid: false,
    color: '#c9ccd1',
    opacity: 1,
    source: M(26, 'mid CONE NODE 2 ft 10 in'),
  },
  {
    id: `pole-high-${c}`,
    side: 'blue' as const,
    shape: { kind: 'cylinder' as const, radius: 0.83 * IN, height: 46 * IN },
    position: { x: HIGH_X, y: columnY(c), z: 23 * IN },
    solid: false,
    color: '#c9ccd1',
    opacity: 1,
    source: M(26, 'top CONE NODE 3 ft 10 in'),
  },
]);

const elements: FieldElement[] = [
  {
    id: 'grid-low',
    name: 'Grid (middle row)',
    side: 'blue',
    shape: { kind: 'box', size: { x: GRID_FACE - HYBRID_DEPTH - 0.55, y: GRID_WIDTH, z: 0.5 } },
    position: { x: (0.55 + GRID_FACE - HYBRID_DEPTH) / 2, y: GRID_WIDTH / 2, z: 0.25 },
    color: 'alliance',
    source: SRC_GRID,
  },
  {
    id: 'grid-high',
    name: 'Grid (top row)',
    side: 'blue',
    shape: { kind: 'box', size: { x: 0.55, y: GRID_WIDTH, z: 0.8 } },
    position: { x: 0.275, y: GRID_WIDTH / 2, z: 0.4 },
    color: 'alliance',
    source: SRC_GRID,
  },
  {
    id: 'grid-tape',
    side: 'blue',
    shape: { kind: 'box', size: { x: GRID_DEPTH - GRID_FACE, y: GRID_WIDTH, z: 0.01 } },
    position: { x: (GRID_FACE + GRID_DEPTH) / 2, y: GRID_WIDTH / 2, z: 0.005 },
    solid: false,
    opacity: 1,
    color: 'alliance',
    source: M(25, 'alliance tape defines the GRID front plane'),
  },
  ...dividers,
  ...poles,
  {
    id: 'barrier',
    name: 'Barrier',
    side: 'blue',
    shape: { kind: 'box', size: { x: 88 * IN, y: 0.05, z: 12.25 * IN } },
    position: { x: COMMUNITY_SHALLOW - 44 * IN, y: COMMUNITY_WIDTH, z: 6.125 * IN },
    color: '#e6e9ee',
    opacity: 0.6,
    source: M(22, '5.3 BARRIER 7 ft 4 in long, 1 ft 1/4 in tall (wall modeled 5 cm thick)'),
  },
  {
    id: 'charge-station',
    name: 'Charge Station',
    side: 'blue',
    shape: {
      kind: 'hull',
      vertices: [
        ...[-1, 1].flatMap((sx) =>
          [-1, 1].map((sy) => ({ x: (sx * CS_DEPTH) / 2, y: (sy * CS_WIDTH) / 2, z: 0 })),
        ),
        ...[-1, 1].flatMap((sx) =>
          [-1, 1].map((sy) => ({ x: (sx * CS_TOP_DEPTH) / 2, y: (sy * CS_TOP_WIDTH) / 2, z: CS_TOP_Z })),
        ),
      ],
    },
    position: { x: CS_X, y: CS_Y, z: 0 },
    color: '#aab0b8',
    friction: 0.9,
    source: SRC_CS,
  },
  // Guards on the short edges (5.4): robots can only drive on over the ramps on the long edges. Modeled
  // 0.20 m tall so bot navigation also treats them as walls.
  ...[-1, 1].map((k, i): FieldElement => ({
    id: `charge-station-guard-${i}`,
    side: 'blue',
    shape: { kind: 'box', size: { x: CS_DEPTH - 0.1, y: 0.03, z: 0.2 } },
    // Just outside the top, so three robots can overhang the short edges as real ones do.
    position: { x: CS_X, y: CS_Y + k * (CS_TOP_WIDTH / 2 + 0.09), z: 0.1 },
    color: '#7d838c',
    source: M(23, 'short edges have guards restricting access'),
  })),
  {
    id: 'charge-station-light',
    side: 'blue',
    shape: { kind: 'box', size: { x: CS_TOP_DEPTH, y: 0.06, z: 0.04 } },
    position: { x: CS_X, y: CS_Y + CS_TOP_WIDTH / 2 + 0.03, z: CS_TOP_Z },
    solid: false,
    opacity: 1,
    color: 'alliance',
    source: M(24, '5.4.1 alliance-colored lights on the short edges'),
  },
  {
    id: 'double-substation',
    name: 'Double Substation',
    side: 'blue',
    shape: { kind: 'box', size: { x: DS_DEPTH, y: DS_WIDTH, z: 78 * IN } },
    position: { x: L - DS_DEPTH / 2, y: DS_Y, z: 39 * IN },
    color: 'alliance',
    opacity: 0.55,
    source: SRC_SUB,
  },
  ...[DS_Y + 0.85, DS_Y - 0.85].map((y, i): FieldElement => ({
    id: `ds-shelf-${i}`,
    side: 'blue',
    shape: { kind: 'box', size: { x: 13 * IN, y: 14 * IN, z: 0.5 * IN } },
    position: { x: L - DS_DEPTH - 0.02, y, z: SHELF_Z },
    solid: false,
    opacity: 1,
    color: '#202225',
    source: M(30, 'sliding shelves 1 ft 2 in x 1 ft 1 in at 3 ft 1 3/8 in'),
  })),
  {
    id: 'single-substation',
    name: 'Single Substation',
    side: 'blue',
    shape: { kind: 'box', size: { x: 105.625 * IN, y: 27 * IN, z: 81.75 * IN } },
    position: { x: SS_X, y: W + 0.08 + 13.5 * IN, z: 40.875 * IN },
    solid: false,
    color: 'alliance',
    opacity: 0.25,
    source: M(29, '5.6.1 SINGLE SUBSTATION; x position measured off Fig 6-1'),
  },
  {
    id: 'single-substation-chute',
    side: 'blue',
    shape: { kind: 'box', size: { x: 22.75 * IN, y: 0.3, z: 18 * IN } },
    position: { x: SS_X, y: W + 0.1, z: (27.125 + 9) * IN },
    solid: false,
    color: '#3a3d42',
    opacity: 0.9,
    source: M(29, 'chute opening 2 ft 3 1/8 in high, 1 ft 6 in tall, 1 ft 10 3/4 in wide'),
  },
];

// ---------------------------------------------------------------- scoring targets

const nodeZone = (c: number) =>
  rect(GRID_DEPTH + 0.12, columnY(c) - 0.28, GRID_DEPTH + 1.02, columnY(c) + 0.28);
const facing = (c: number) => ({ facePoint: { x: 0, y: columnY(c) }, faceToleranceRad: 0.6 });

const nodes: ScoringTarget[] = COLUMNS.flatMap((c): ScoringTarget[] => {
  const y = columnY(c);
  const place = { zone: nodeZone(c), ...facing(c) };
  const cube = CUBE_COLUMNS.has(c);
  return [
    {
      id: nodeId('hybrid', c),
      name: `Hybrid node ${c}`,
      side: 'blue',
      accepts: ['cone', 'cube'],
      points: { auto: 3, teleop: 2 },
      tags: ['hybrid'],
      capacity: 1,
      place,
      display: { x: GRID_FACE - HYBRID_DEPTH / 2, y, z: 0.14 },
      source: `${SRC_PTS}; ${SRC_GRID}`,
    },
    {
      id: nodeId('mid', c),
      name: `Mid ${cube ? 'cube' : 'cone'} node ${c}`,
      side: 'blue',
      accepts: [cube ? 'cube' : 'cone'],
      points: { auto: 4, teleop: 3 },
      tags: [cube ? 'mid-cube' : 'mid-cone'],
      capacity: 1,
      place,
      display: cube ? { x: MID_CUBE_X, y, z: 0.64 } : { x: MID_X, y, z: 0.755 },
      source: `${SRC_PTS}; ${SRC_GRID}`,
    },
    {
      id: nodeId('high', c),
      name: `Top ${cube ? 'cube' : 'cone'} node ${c}`,
      side: 'blue',
      accepts: [cube ? 'cube' : 'cone'],
      points: { auto: 6, teleop: 5 },
      tags: [cube ? 'high-cube' : 'high-cone'],
      capacity: 1,
      place,
      display: cube ? { x: HIGH_CUBE_X, y, z: 0.94 } : { x: HIGH_X, y, z: 1.055 },
      source: `${SRC_PTS}; ${SRC_GRID}`,
    },
  ];
});

const supercharge: ScoringTarget = {
  id: 'supercharge',
  name: 'Supercharge (complete grid)',
  side: 'blue',
  accepts: ['cone', 'cube'],
  points: { auto: 0, teleop: 3 },
  tags: ['hybrid'],
  capacity: 27,
  place: {
    zone: rect(GRID_DEPTH + 0.12, 0.25, GRID_DEPTH + 1.02, GRID_WIDTH - 0.25),
    facePoint: { x: -40, y: GRID_WIDTH / 2 },
    faceToleranceRad: 0.6,
  },
  source: `${M(46, 'SUPERCHARGED NODES')}; ${SRC_PTS}; enabled by rules.ts`,
};

// ---------------------------------------------------------------- charge station actions

const slotY = [-1, 0, 1].map((k) => CS_Y + k * 0.85);
const slots = slotY.map((y, i) =>
  rect(CS_X - 0.4, y - (i === 1 ? 0.3 : 0.25), CS_X + 0.4, y + (i === 1 ? 0.3 : 0.25)),
);
const autoZone = [rect(CS_X - 0.45, CS_Y - 0.6, CS_X + 0.45, CS_Y + 0.6)];

const charge = (
  id: string,
  name: string,
  pts: { points: number; autoPoints?: number },
  zones: Region2D[],
  auto: boolean,
): EndgameAction => ({
  id,
  name,
  side: 'blue',
  zones,
  maxRobotsPerZone: 1,
  oneAtATime: true,
  points: pts.points,
  ...(auto
    ? { allowInAuto: true, autoPoints: pts.autoPoints ?? pts.points, availableAtRemainingSec: -1 }
    : {}),
  source: `${SRC_PTS}; ${M(47, '6.4.2 DOCKED / ENGAGED')}`,
});

// ---------------------------------------------------------------- the definition

export const definition: GameDefinition = {
  id: '2023-chargedup',
  year: 2023,
  name: 'Charged Up (2023)',
  summary:
    'Grab cones and cubes from the substations at the far end and score them on your grid: ' +
    'bottom row any piece, middle and top rows cones on poles and cubes on shelves. Three filled ' +
    'nodes in a row make a link (+5). Leave the community in auto, then dock or engage on your ' +
    'Charge Station in auto and in the last 30 s.',
  timing: {
    autoSec: 15,
    transitionSec: 3,
    teleopSec: 135,
    endgameSec: 30,
    source: M(44, '6.2 AUTO 15 s + 3 s delay, 6.3 TELEOP 2:15, ENDGAME last 30 s'),
  },
  field: {
    length: L,
    width: W,
    wallHeight: 20 * IN,
    symmetry: 'mirror',
    carpetColor: '#3a3d42',
    source: `${M(17, '5.1 ~1654 x ~802 cm, guardrail 1 ft 8 in')}; mirror per Fig 6-1`,
    elements,
    zones: [
      {
        id: 'community',
        name: 'Community',
        side: 'blue',
        region: {
          kind: 'poly',
          points: [
            { x: 0, y: 0 },
            { x: COMMUNITY_DEEP, y: 0 },
            { x: COMMUNITY_DEEP, y: CS_Y + CS_WIDTH / 2 },
            { x: COMMUNITY_SHALLOW, y: CS_Y + CS_WIDTH / 2 },
            { x: COMMUNITY_SHALLOW, y: COMMUNITY_WIDTH },
            { x: 0, y: COMMUNITY_WIDTH },
          ],
        },
        source: M(21, 'COMMUNITY 18 ft wide, 3.36-4.91 m deep; step at the Charge Station edge (Fig 5-6)'),
      },
      {
        id: 'loading-zone',
        name: 'Loading zone',
        side: 'blue',
        region: {
          kind: 'poly',
          points: [
            { x: L, y: GRID_WIDTH },
            { x: L - LZ_SHALLOW, y: GRID_WIDTH },
            { x: L - LZ_SHALLOW, y: LZ_STEP_Y },
            { x: L - LZ_DEEP, y: LZ_STEP_Y },
            { x: L - LZ_DEEP, y: W },
            { x: L, y: W },
          ],
        },
        source: M(21, 'LOADING ZONE 8 ft 3 in wide, 3.36-6.71 m deep; step read off Fig 5-6'),
      },
    ],
  },
  pieces: [
    {
      id: 'cone',
      name: 'Cone',
      shape: { kind: 'cone', radius: 0.105, height: 12.8125 * IN },
      mass: (1 + 7 / 16) * LB,
      color: '#f2c40f',
      friction: 0.8,
      restitution: 0.2,
      source: M(36, '5.8.1 CONE ~33 cm tall, 8 3/8 in base, 1 lb 7 oz'),
    },
    {
      id: 'cube',
      name: 'Cube',
      shape: { kind: 'box', size: { x: 9.5 * IN, y: 9.5 * IN, z: 9.5 * IN } },
      mass: (2.5 / 16) * LB,
      color: '#7b3fc4',
      friction: 0.6,
      restitution: 0.25,
      source: M(37, '5.8.2 CUBE 9 1/2 in, 2.5 oz'),
    },
  ],
  staging: [
    {
      type: 'cube',
      side: 'blue',
      positions: [STAGE_Y[0]!, STAGE_Y[3]!].map((y) => ({ x: STAGE_X, y })),
      source: M(43, '6.1.1 B.a default: CUBES on the 2 outer STAGING MARKS; Fig 5-7'),
    },
    {
      type: 'cone',
      side: 'blue',
      positions: [STAGE_Y[1]!, STAGE_Y[2]!].map((y) => ({ x: STAGE_X, y })),
      source: M(43, '6.1.1 B.a default: CONES on the 2 inner STAGING MARKS; Fig 5-7'),
    },
  ],
  preload: { cone: 1, cube: 1 },
  startPoses: [
    { x: GRID_DEPTH + 0.5, y: columnY(9), yaw: Math.PI },
    { x: GRID_DEPTH + 0.5, y: columnY(5), yaw: Math.PI },
    { x: GRID_DEPTH + 0.5, y: columnY(1), yaw: Math.PI },
  ],
  targets: [...nodes, supercharge],
  stations: [
    {
      id: 'double-cone',
      name: 'Double substation (cone shelf)',
      side: 'blue',
      zone: rect(L - DS_DEPTH - 1.1, DS_Y + 0.15, L - DS_DEPTH - 0.35, W - 0.3),
      pieceTypes: ['cone'],
      mode: 'direct',
      feedIntervalSec: 3,
      supply: 16,
      handoffHeight: 1.0,
      handoffSec: 1.5,
      source: `${SRC_SUB}; supply split assumed (see SOURCES.md)`,
    },
    {
      id: 'double-cube',
      name: 'Double substation (cube shelf)',
      side: 'blue',
      zone: rect(L - DS_DEPTH - 1.1, GRID_WIDTH + 0.3, L - DS_DEPTH - 0.35, DS_Y - 0.15),
      pieceTypes: ['cube'],
      mode: 'direct',
      feedIntervalSec: 3,
      supply: 14,
      handoffHeight: 1.0,
      handoffSec: 1.5,
      source: `${SRC_SUB}; supply split assumed (see SOURCES.md)`,
    },
    {
      id: 'single',
      name: 'Single substation (chute)',
      side: 'blue',
      zone: rect(SS_X - 0.7, W - 2.1, SS_X + 0.7, W - 0.95),
      pieceTypes: ['cube', 'cone'],
      mode: 'drop',
      feedIntervalSec: 2.5,
      dropPoint: { x: SS_X, y: W - 0.2, z: 0.75 },
      dropVelocity: { x: 0, y: -1.2, z: 0 },
      supply: 12,
      source: `${M(29, '5.6.1 chute exits 2 ft 3 1/8 in above carpet')}; supply split assumed`,
    },
  ],
  endgame: [
    charge('auto-engage', 'Engage (auto)', { points: 0, autoPoints: 12 }, autoZone, true),
    charge('auto-dock', 'Dock (auto)', { points: 0, autoPoints: 8 }, autoZone, true),
    charge('engage', 'Dock & engage', { points: 10 }, slots, false),
    charge('dock', 'Dock', { points: 6 }, slots, false),
  ],
  awards: [
    {
      id: 'mobility',
      name: 'Mobility',
      side: 'blue',
      kind: 'leaveZoneInAuto',
      zone: {
        kind: 'poly',
        points: [
          { x: 0, y: 0 },
          { x: COMMUNITY_DEEP, y: 0 },
          { x: COMMUNITY_DEEP, y: CS_Y + CS_WIDTH / 2 },
          { x: COMMUNITY_SHALLOW, y: CS_Y + CS_WIDTH / 2 },
          { x: COMMUNITY_SHALLOW, y: COMMUNITY_WIDTH },
          { x: 0, y: COMMUNITY_WIDTH },
        ],
      },
      points: 3,
      source: `${SRC_PTS} MOBILITY`,
    },
    {
      id: 'park',
      name: 'Park',
      side: 'blue',
      kind: 'inZoneAtEnd',
      zone: {
        kind: 'poly',
        points: [
          { x: 0, y: 0 },
          { x: COMMUNITY_DEEP, y: 0 },
          { x: COMMUNITY_DEEP, y: CS_Y + CS_WIDTH / 2 },
          { x: COMMUNITY_SHALLOW, y: CS_Y + CS_WIDTH / 2 },
          { x: COMMUNITY_SHALLOW, y: COMMUNITY_WIDTH },
          { x: 0, y: COMMUNITY_WIDTH },
        ],
      },
      points: 2,
      source: `${SRC_PTS} PARK; TU04 glossary`,
    },
  ],
  rankingPoints: {
    win: 2,
    tie: 1,
    bonuses: [
      {
        id: 'sustainability',
        name: 'Sustainability (6 links, 5 with Coopertition)',
        rp: 1,
        kind: 'custom',
        check: (own, opp) => {
          const mine = filledNodes(own.targetCounts, own.alliance);
          const theirs = filledNodes(opp.targetCounts, opp.alliance);
          const coop = coopPieces(mine) >= 3 && coopPieces(theirs) >= 3;
          return countLinks(mine) >= (coop ? 5 : 6);
        },
        source: `${SRC_PTS} SUSTAINABILITY + COOPERTITION BONUS`,
      },
      {
        id: 'activation',
        name: 'Activation (26 Charge Station pts)',
        rp: 1,
        kind: 'custom',
        check: (own) =>
          Object.entries(own.sources).reduce(
            (s, [src, p]) => s + (CHARGE_SOURCES.has(src.split('.')[0]!) ? p : 0),
            0,
          ) >= 26,
        source: `${SRC_PTS} ACTIVATION BONUS`,
      },
    ],
  },
  fouls: { minor: 5, major: 12, source: M(48, 'Table 6-3 FOUL 5, TECH FOUL 12') },
  archetypes: [
    {
      id: 'elevator',
      name: 'Elevator all-rounder',
      description:
        'Swerve with an angled elevator and claw. Floor and shelf pickup, scores cones and cubes on all three rows, balances the Charge Station.',
      frame: { length: 0.84, width: 0.84, height: 0.7 },
      mass: 125 * LB + 8,
      drive: { maxSpeed: 4.3, maxAccel: 9, maxOmega: 8 },
      capacity: { cone: 1, cube: 1 },
      totalCapacity: 1,
      intake: { pieceTypes: ['cone', 'cube'], timeSec: 0.35, reach: 0.2, maxHeight: 1.3 },
      place: { hybrid: 0.8, 'mid-cone': 2.0, 'mid-cube': 1.3, 'high-cone': 2.8, 'high-cube': 1.6 },
      endgame: { 'auto-engage': 4, 'auto-dock': 2, engage: 4, dock: 2 },
      source: 'engineering estimate: R104 frame + bumpers, G107 48 in reach covers the 1.01 m-deep top pole',
    },
    {
      id: 'arm',
      name: 'Mid-level arm',
      description:
        'Swerve with a single-jointed arm. Shelf and floor pickup, scores hybrid and middle rows only. Docks and engages, a bit slower.',
      frame: { length: 0.84, width: 0.84, height: 0.6 },
      mass: 120 * LB + 8,
      drive: { maxSpeed: 4.0, maxAccel: 8, maxOmega: 7 },
      capacity: { cone: 1, cube: 1 },
      totalCapacity: 1,
      intake: { pieceTypes: ['cone', 'cube'], timeSec: 0.4, reach: 0.2, maxHeight: 1.2 },
      place: { hybrid: 0.8, 'mid-cone': 2.4, 'mid-cube': 1.4 },
      endgame: { 'auto-engage': 5.5, 'auto-dock': 3, engage: 5.5, dock: 2.5 },
      source:
        'engineering estimate: a simpler arm reaches the 0.58 m-deep mid pole but not the 1.01 m top pole',
    },
    {
      id: 'cubebot',
      name: 'Cube specialist',
      description:
        'Fast swerve with a low cube intake that flings cubes onto any row. Cubes only, floor pickup only (single substation chute or field).',
      frame: { length: 0.82, width: 0.82, height: 0.5 },
      mass: 110 * LB + 8,
      drive: { maxSpeed: 4.6, maxAccel: 10, maxOmega: 9 },
      capacity: { cube: 1 },
      intake: { pieceTypes: ['cube'], timeSec: 0.25, reach: 0.2, maxHeight: 0.3 },
      place: { hybrid: 0.6, 'mid-cube': 1.0, 'high-cube': 1.3 },
      endgame: { 'auto-engage': 3.5, 'auto-dock': 2, engage: 3.5, dock: 2 },
      source:
        'engineering estimate: 71 g cube, walled cube shelves, launching allowed in the community (G404)',
    },
    {
      id: 'kitbot',
      name: 'Kitbot',
      description:
        'Tank drive with a simple roller intake. Pushes cones and cubes into the bottom row and drives up onto the Charge Station, but cannot balance it.',
      frame: { length: 0.86, width: 0.76, height: 0.45 },
      mass: 100 * LB + 8,
      drive: { maxSpeed: 3.2, maxAccel: 6, maxOmega: 5 },
      capacity: { cone: 1, cube: 1 },
      totalCapacity: 1,
      intake: { pieceTypes: ['cone', 'cube'], timeSec: 0.6, maxHeight: 0.3 },
      place: { hybrid: 1.2 },
      endgame: { 'auto-dock': 4, dock: 3 },
      source: 'engineering estimate: rookie tank drive (3-3.5 m/s), floor-only roller intake',
    },
  ],
  defaultArchetype: 'elevator',
  rules,
  botHints: { endgameLeadSec: 2, defenseShare: 0 },
};

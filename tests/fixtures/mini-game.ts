import type { GameDefinition } from '../../src/engine/sim/index.ts';

/**
 * Minimal test game. Blue half authored; rotational symmetry.
 * - 'ball' pieces staged at x=3; robots start at x=1 facing +X.
 * - 'goal': top-entry aperture at (2, 6, 2) for shooting (5/2 pts).
 * - 'shelf': place target at x~1.5, y~1 (3/2 pts, tag 'low').
 * - 'bar': endgame at (1.2, 4) worth 10.
 * - 'leave': leave x<2 zone in auto for 3.
 */
export function miniGame(overrides: Partial<GameDefinition> = {}): GameDefinition {
  return {
    id: 'test-mini',
    year: 2000,
    name: 'Mini',
    summary: 'test',
    timing: { autoSec: 15, transitionSec: 3, teleopSec: 135, endgameSec: 20, source: 'test' },
    field: {
      length: 16,
      width: 8,
      wallHeight: 0.5,
      symmetry: 'rotational',
      elements: [
        {
          id: 'pillar',
          side: 'blue',
          shape: { kind: 'box', size: { x: 0.5, y: 0.5, z: 1 } },
          position: { x: 5, y: 6, z: 0.5 },
        },
      ],
      zones: [
        { id: 'start', side: 'blue', region: { kind: 'rect', min: { x: 0, y: 0 }, max: { x: 2, y: 8 } } },
      ],
    },
    pieces: [
      {
        id: 'ball',
        name: 'Ball',
        shape: { kind: 'sphere', radius: 0.1 },
        mass: 0.2,
        color: '#ff0',
        source: 'test',
      },
    ],
    staging: [
      {
        type: 'ball',
        side: 'blue',
        positions: [
          { x: 3, y: 2 },
          { x: 3, y: 4 },
        ],
      },
    ],
    preload: { ball: 1 },
    startPoses: [
      { x: 1, y: 2, yaw: 0 },
      { x: 1, y: 4, yaw: 0 },
      { x: 1, y: 6, yaw: 0 },
    ],
    targets: [
      {
        id: 'goal',
        name: 'Goal',
        side: 'blue',
        accepts: ['ball'],
        points: { auto: 5, teleop: 2 },
        aperture: { center: { x: 2, y: 6, z: 2 }, size: { x: 0.6, y: 0.6, z: 0.3 }, entry: 'down' },
        source: 'test',
      },
      {
        id: 'shelf',
        name: 'Shelf',
        side: 'blue',
        accepts: ['ball'],
        points: { auto: 3, teleop: 2 },
        tags: ['low'],
        place: { zone: { kind: 'rect', min: { x: 0.5, y: 0.5 }, max: { x: 1.5, y: 1.5 } } },
        source: 'test',
      },
    ],
    stations: [],
    endgame: [
      {
        id: 'bar',
        name: 'Bar',
        side: 'blue',
        zones: [{ kind: 'circle', center: { x: 1.2, y: 4 }, radius: 0.5 }],
        maxRobotsPerZone: 1,
        points: 10,
        source: 'test',
      },
    ],
    awards: [
      {
        id: 'leave',
        name: 'Leave',
        side: 'blue',
        kind: 'leaveZoneInAuto',
        zone: { kind: 'rect', min: { x: 0, y: 0 }, max: { x: 2, y: 8 } },
        points: 3,
      },
    ],
    rankingPoints: {
      win: 3,
      tie: 1,
      bonuses: [{ id: 'twoPieces', name: 'Two pieces', rp: 1, kind: 'piecesAtLeast', count: 2 }],
    },
    fouls: { minor: 2, major: 6 },
    archetypes: [
      {
        id: 'basic',
        name: 'Basic',
        description: 'test',
        frame: { length: 0.8, width: 0.8, height: 0.3 },
        mass: 60,
        drive: { maxSpeed: 4, maxAccel: 8, maxOmega: 6 },
        capacity: { ball: 2 },
        intake: { pieceTypes: ['ball'], timeSec: 0.2 },
        place: { low: 0.5 },
        shooter: {
          pieceTypes: ['ball'],
          exitSpeed: 9,
          spreadDeg: 0,
          reloadSec: 0.3,
          maxRange: 8,
          height: 0.6,
          turret: true,
        },
        endgame: { bar: 2 },
      },
    ],
    defaultArchetype: 'basic',
    ...overrides,
  };
}

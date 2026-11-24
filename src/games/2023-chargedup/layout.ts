/**
 * Shared GRID layout for CHARGED UP (blue side, WPILib frame), used by the definition and the rules.
 * Manual 5.5: 9 node columns per alliance; the middle column of each 3-column GRID is a CUBE column;
 * the middle GRID (columns 4-6) is the Coopertition (CO-OP) GRID.
 */

import type { Region2D } from '../../engine/sim/types.ts';

const IN = 0.0254;
/** Field length, 54 ft 3 1/4 in (Manual 5.1). */
const FIELD_LENGTH = 651.25 * IN;
const FIELD_WIDTH = 315.5 * IN;
const COMMUNITY_SHALLOW = (11 * 12 + 0.375) * IN; // 3.36
const COMMUNITY_DEEP = (16 * 12 + 1.25) * IN; // 4.91
const COMMUNITY_WIDTH = 18 * 12 * IN; // 5.49
const CHARGE_STATION_EDGE_Y = COMMUNITY_WIDTH / 2 + ((8 * 12 + 1.25) * IN) / 2; // 3.98
const GRID_WIDTH = (18 * 12 + 0.5) * IN; // 5.50
const LZ_SHALLOW = (11 * 12 + 0.25) * IN; // 3.36
const LZ_DEEP = (22 * 12 + 0.25) * IN; // 6.71
const LZ_STEP_Y = 6.75; // read off Fig 5-6

/** Blue COMMUNITY (Manual 5.2, Fig 5-6): deep around the Charge Station, shallow by the barrier. */
export const COMMUNITY: Region2D = {
  kind: 'poly',
  points: [
    { x: 0, y: 0 },
    { x: COMMUNITY_DEEP, y: 0 },
    { x: COMMUNITY_DEEP, y: CHARGE_STATION_EDGE_Y },
    { x: COMMUNITY_SHALLOW, y: CHARGE_STATION_EDGE_Y },
    { x: COMMUNITY_SHALLOW, y: COMMUNITY_WIDTH },
    { x: 0, y: COMMUNITY_WIDTH },
  ],
};

/** Blue LOADING ZONE, at the red end (Manual 5.2, Fig 5-6): deep along the guardrail. */
export const LOADING_ZONE: Region2D = {
  kind: 'poly',
  points: [
    { x: FIELD_LENGTH, y: GRID_WIDTH },
    { x: FIELD_LENGTH - LZ_SHALLOW, y: GRID_WIDTH },
    { x: FIELD_LENGTH - LZ_SHALLOW, y: LZ_STEP_Y },
    { x: FIELD_LENGTH - LZ_DEEP, y: LZ_STEP_Y },
    { x: FIELD_LENGTH - LZ_DEEP, y: FIELD_WIDTH },
    { x: FIELD_LENGTH, y: FIELD_WIDTH },
  ],
};

export const COLUMNS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const CUBE_COLUMNS = new Set([2, 5, 8]);
export const COOP_COLUMNS = new Set([4, 5, 6]);
export const ROWS = ['hybrid', 'mid', 'high'] as const;
export type Row = (typeof ROWS)[number];

/** Column pitch: 0.47 m hybrid node + ~0.09 m divider (Fig 5-15), so ~22 in. Grid is centered at y 2.75. */
export const COLUMN_PITCH = 0.559;
export const columnY = (c: number): number => 2.75 + (c - 5) * COLUMN_PITCH;

/** Base target id of a node, e.g. `high-3`. Expanded ids add `.blue` / `.red`. */
export const nodeId = (row: Row, c: number): string => `${row}-${c}`;

/** Expanded node target ids of an alliance as [row][column-1], built once per alliance. */
const NODE_IDS = new Map<string, string[][]>();
function allianceNodeIds(alliance: string): string[][] {
  let ids = NODE_IDS.get(alliance);
  if (!ids) {
    ids = ROWS.map((row) => COLUMNS.map((c) => `${nodeId(row, c)}.${alliance}`));
    NODE_IDS.set(alliance, ids);
  }
  return ids;
}

/** Which nodes of an alliance hold a piece, as [row][column-1]. */
export function filledNodes(
  counts: Record<string, { auto: number; teleop: number }> | ((id: string) => number),
  alliance: string,
): boolean[][] {
  const get =
    typeof counts === 'function'
      ? counts
      : (id: string) => (counts[id] ? counts[id].auto + counts[id].teleop : 0);
  return allianceNodeIds(alliance).map((row) => row.map((id) => get(id) > 0));
}

/**
 * LINKS (Manual 6.4.1): 3 adjacent filled nodes in a row, each piece in at most one link, counted to
 * maximize links. In one row that's floor(run / 3) summed over runs of consecutive filled nodes.
 */
export function countLinks(filled: boolean[][]): number {
  let links = 0;
  for (const row of filled) {
    let run = 0;
    for (const f of [...row, false]) {
      if (f) run++;
      else {
        links += Math.floor(run / 3);
        run = 0;
      }
    }
  }
  return links;
}

/**
 * SUSTAINABILITY BONUS: LINKS needed for the ranking point, one fewer with the COOPERTITION BONUS.
 * The April 2023 manual (V4) says 6 (5): that was the Championship's threshold. Real 2023 results
 * (The Blue Alliance, weeks 1-6 and every district championship) award it at 5 (4), the in-season
 * rule this game plays. Found in the owner-requested comparison with real matches (CALIBRATION.md).
 */
export const SUSTAINABILITY_LINKS = 5;

/** Pieces on the CO-OP GRID (columns 4-6, all rows). */
export function coopPieces(filled: boolean[][]): number {
  let n = 0;
  for (const row of filled) for (const c of COOP_COLUMNS) if (row[c - 1]) n++;
  return n;
}

export const isComplete = (filled: boolean[][]): boolean => filled.every((row) => row.every(Boolean));

/**
 * Charge Station point sources, for the ACTIVATION BONUS (auto + endgame): the dock / engage
 * actions plus the rules.ts adjustments (engaged partners, a tipped station, the 1-robot auto limit).
 */
export const CHARGE_SOURCES = [
  'auto-dock',
  'auto-engage',
  'dock',
  'engage',
  'engaged-partner',
  'station-tipped',
  'auto-charge-limit',
];

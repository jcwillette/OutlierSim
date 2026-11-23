/**
 * Shared GRID layout for CHARGED UP (blue side, WPILib frame), used by the definition and the rules.
 * Manual 5.5: 9 node columns per alliance; the middle column of each 3-column GRID is a CUBE column;
 * the middle GRID (columns 4-6) is the Coopertition (CO-OP) GRID.
 */

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

/** Which nodes of an alliance hold a piece, as [row][column-1]. */
export function filledNodes(
  counts: Record<string, { auto: number; teleop: number }> | ((id: string) => number),
  alliance: string,
): boolean[][] {
  const get =
    typeof counts === 'function'
      ? counts
      : (id: string) => (counts[id] ? counts[id].auto + counts[id].teleop : 0);
  return ROWS.map((row) => COLUMNS.map((c) => get(`${nodeId(row, c)}.${alliance}`) > 0));
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

/** Pieces on the CO-OP GRID (columns 4-6, all rows). */
export function coopPieces(filled: boolean[][]): number {
  let n = 0;
  for (const row of filled) for (const c of COOP_COLUMNS) if (row[c - 1]) n++;
  return n;
}

export const isComplete = (filled: boolean[][]): boolean => filled.every((row) => row.every(Boolean));

/** Charge Station sources whose points count toward the ACTIVATION BONUS (auto + endgame). */
export const CHARGE_SOURCES = new Set([
  'auto-dock',
  'auto-engage',
  'dock',
  'engage',
  'engaged-partner',
  'station-tipped',
  'auto-charge-limit',
]);

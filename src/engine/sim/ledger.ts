import type { Alliance, ScoreCategory } from './types.ts';

export interface LedgerEntry {
  time: number;
  alliance: Alliance;
  category: ScoreCategory;
  points: number;
  /** Expanded target / action / award id, or a free-form rules source. */
  source: string;
  robotId: number | null;
}

export const CATEGORIES: readonly ScoreCategory[] = ['auto', 'teleop', 'endgame', 'penalty'];

/** Append-only record of every point awarded. All score displays derive from this. */
export class ScoreLedger {
  readonly entries: LedgerEntry[] = [];

  add(entry: LedgerEntry): void {
    if (entry.points !== 0) this.entries.push(entry);
  }

  total(alliance: Alliance): number {
    let s = 0;
    for (const e of this.entries) if (e.alliance === alliance) s += e.points;
    return s;
  }

  breakdown(alliance: Alliance): Record<ScoreCategory, number> {
    const out: Record<ScoreCategory, number> = { auto: 0, teleop: 0, endgame: 0, penalty: 0 };
    for (const e of this.entries) if (e.alliance === alliance) out[e.category] += e.points;
    return out;
  }

  bySource(alliance: Alliance): Record<string, number> {
    const out: Record<string, number> = {};
    for (const e of this.entries)
      if (e.alliance === alliance) out[e.source] = (out[e.source] ?? 0) + e.points;
    return out;
  }

  byRobot(robotId: number): number {
    let s = 0;
    for (const e of this.entries) if (e.robotId === robotId) s += e.points;
    return s;
  }
}

import type { Alliance, GameRules, RulesContext } from '../../engine/sim/types.ts';
import {
  COOP_COLUMNS,
  ROWS,
  SUSTAINABILITY_LINKS,
  coopPieces,
  countLinks,
  filledNodes,
  isComplete,
  type Row,
} from './layout.ts';

/**
 * CHARGED UP mechanics the schema can't express (Manual 6.4):
 *  - LINKS: 5 pts per 3 adjacent filled nodes in a row, assessed at match end; live HUD count.
 *  - SUPERCHARGED nodes: the `supercharge` target opens only once all 27 nodes hold a piece.
 *  - Charge Station: only 1 robot's auto dock/engage counts (Table 6-2). At the end the station is
 *    LEVEL only if the last robot to get on was one that balances it (an `engage` action): then every
 *    DOCKED partner is ENGAGED too (6.4.2). A dock-only robot climbing on afterwards tips it, so
 *    nobody is ENGAGED.
 *
 * G207 (right of way) and G202 (pinning) are declared in `definition.fouls`; the engine calls them.
 */

const ALLIANCES: Alliance[] = ['blue', 'red'];
const LINKS_INDICATOR = { blue: 'blue links', red: 'red links' } as const;
const COOP_INDICATOR = { blue: 'blue co-op', red: 'red co-op' } as const;

const filled = (ctx: RulesContext, a: Alliance) => filledNodes((id) => ctx.targetCount(id), a);

/** Each alliance's GRID as last read by `updateGrids` (current whenever bots plan). */
const gridOf = (ctx: RulesContext, a: Alliance) => (ctx.vars.grids as Record<Alliance, boolean[][]>)[a];

/** Length of the run of filled nodes through column index `c` of a row. */
function runThrough(row: boolean[], c: number): number {
  let lo = c;
  let hi = c;
  while (lo > 0 && row[lo - 1]) lo--;
  while (hi < row.length - 1 && row[hi + 1]) hi++;
  return hi - lo + 1;
}

/** Re-read the GRIDS (supercharge, links and co-op indicators); only needed after a piece scores. */
function updateGrids(ctx: RulesContext): void {
  const grids = ALLIANCES.map((a) => filled(ctx, a));
  ctx.vars.grids = { blue: grids[0], red: grids[1] };
  const coop = grids.map((f) => coopPieces(f));
  const coopBonus = coop.every((n) => n >= 3);
  ALLIANCES.forEach((a, i) => {
    const f = grids[i]!;
    const key = `supercharge.${a}`;
    if (isComplete(f) && !(ctx.vars[key] as boolean | undefined)) {
      ctx.vars[key] = true;
      ctx.setTargetEnabled(key, true);
      ctx.announce(`${a.toUpperCase()} GRID complete: extra pieces SUPERCHARGE (+3)`, a);
    }
    const need = coopBonus ? SUSTAINABILITY_LINKS - 1 : SUSTAINABILITY_LINKS;
    ctx.setIndicator(LINKS_INDICATOR[a], `${countLinks(f)} / ${need}`);
    ctx.setIndicator(COOP_INDICATOR[a], `${Math.min(coop[i]!, 3)}/3`);
  });
  if (coopBonus && !ctx.vars.coopAnnounced) {
    ctx.vars.coopAnnounced = true;
    ctx.announce(`COOPERTITION BONUS: link RP threshold drops to ${SUSTAINABILITY_LINKS - 1}`);
  }
}

export const rules: GameRules = {
  onInit(ctx) {
    for (const a of ALLIANCES) ctx.setTargetEnabled(`supercharge.${a}`, false);
    updateGrids(ctx);
  },

  onScore(ctx) {
    // Picked up at the end of this tick, as before (a node filled now opens supercharge next tick).
    ctx.vars.gridsChanged = true;
  },

  onTick(ctx) {
    // When each robot finished its endgame action (to know who got on the Charge Station last).
    const doneAt = (ctx.vars.doneAt ??= {}) as Record<number, number>;
    for (const r of ctx.robots()) {
      if (r.endgameAction && doneAt[r.id] === undefined) doneAt[r.id] = ctx.time;
      if (!r.endgameAction) delete doneAt[r.id]; // released after auto
    }
    if (ctx.vars.gridsChanged) {
      ctx.vars.gridsChanged = false;
      updateGrids(ctx);
    }
  },

  onPhaseChange(ctx, phase) {
    if (phase !== 'teleop') return; // auto actions may finish during the 3 s transition
    // "1 ROBOT max in AUTO": keep the best auto dock/engage per alliance, take back the rest.
    for (const a of ALLIANCES) {
      const pts = ctx
        .robots()
        .filter((r) => r.alliance === a && r.endgameAction)
        .map((r) => (r.endgameAction!.startsWith('auto-engage') ? 12 : 8))
        .sort((x, y) => y - x);
      for (const p of pts.slice(1)) ctx.addPoints(a, 'auto', -p, 'auto-charge-limit');
    }
  },

  /**
   * What drive teams aim for (bots only; never scored): a piece that completes a LINK is worth its
   * 5 points more, one that makes a pair a third piece can finish a little more, and one of the
   * first 3 on the CO-OP GRID a little more (the COOPERTITION BONUS lowers the RP threshold).
   */
  botValue(ctx, alliance, targetId) {
    const m = /^(hybrid|mid|high)-(\d)\./.exec(targetId);
    if (!m) return 0;
    const grid = gridOf(ctx, alliance);
    const row = grid[ROWS.indexOf(m[1] as Row)]!;
    const c = Number(m[2]) - 1;
    if (row[c]) return 0;
    const coop = COOP_COLUMNS.has(c + 1) && coopPieces(grid) < 3 ? 0.25 : 0;
    const after = row.map((f, i) => f || i === c);
    const gain = countLinks([after]) - countLinks([row]);
    if (gain > 0) return 5 * gain + coop;
    return (runThrough(after, c) % 3 === 2 ? 1.5 : 0) + coop;
  },

  onMatchEnd(ctx) {
    for (const a of ALLIANCES) {
      const links = countLinks(filled(ctx, a));
      if (links) ctx.addPoints(a, 'teleop', links * 5, 'links');
      const doneAt = (ctx.vars.doneAt ?? {}) as Record<number, number>;
      const onStation = ctx
        .robots()
        .filter((r) => r.alliance === a && r.endgameAction)
        .sort((x, y) => (doneAt[x.id] ?? 0) - (doneAt[y.id] ?? 0));
      const last = onStation[onStation.length - 1];
      if (!last) continue;
      const level = last.endgameAction === `engage.${a}`;
      for (const r of onStation) {
        if (level && r.endgameAction === `dock.${a}`) ctx.addPoints(a, 'endgame', 4, 'engaged-partner');
        if (!level && r.endgameAction === `engage.${a}`) ctx.addPoints(a, 'endgame', -4, 'station-tipped');
      }
      if (!level && onStation.some((r) => r.endgameAction === `engage.${a}`))
        ctx.announce(`${a.toUpperCase()} Charge Station not level: docked, not engaged`, a);
    }
  },
};

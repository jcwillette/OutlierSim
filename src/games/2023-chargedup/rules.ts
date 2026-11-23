import type { Alliance, GameRules, RulesContext } from '../../engine/sim/types.ts';
import { coopPieces, countLinks, filledNodes, isComplete } from './layout.ts';

/**
 * CHARGED UP mechanics the schema can't express (Manual 6.4):
 *  - LINKS: 5 pts per 3 adjacent filled nodes in a row, assessed at match end; live HUD count.
 *  - SUPERCHARGED nodes: the `supercharge` target opens only once all 27 nodes hold a piece.
 *  - Charge Station: only 1 robot's auto dock/engage counts (Table 6-2). At the end the station is
 *    LEVEL only if the last robot to get on was one that balances it (an `engage` action): then every
 *    DOCKED partner is ENGAGED too (6.4.2). A dock-only robot climbing on afterwards tips it, so
 *    nobody is ENGAGED.
 */

const ALLIANCES: Alliance[] = ['blue', 'red'];

const filled = (ctx: RulesContext, a: Alliance) => filledNodes((id) => ctx.targetCount(id), a);

export const rules: GameRules = {
  onInit(ctx) {
    for (const a of ALLIANCES) ctx.setTargetEnabled(`supercharge.${a}`, false);
  },

  onTick(ctx) {
    // When each robot finished its endgame action (to know who got on the Charge Station last).
    const doneAt = (ctx.vars.doneAt ??= {}) as Record<number, number>;
    for (const r of ctx.robots()) {
      if (r.endgameAction && doneAt[r.id] === undefined) doneAt[r.id] = ctx.time;
      if (!r.endgameAction) delete doneAt[r.id]; // released after auto
    }
    const coop = ALLIANCES.map((a) => coopPieces(filled(ctx, a)));
    const coopBonus = coop.every((n) => n >= 3);
    ALLIANCES.forEach((a, i) => {
      const f = filled(ctx, a);
      const complete = isComplete(f);
      const key = `supercharge.${a}`;
      if (complete && !(ctx.vars[key] as boolean | undefined)) {
        ctx.vars[key] = true;
        ctx.setTargetEnabled(key, true);
        ctx.announce(`${a.toUpperCase()} GRID complete: extra pieces SUPERCHARGE (+3)`, a);
      }
      ctx.setIndicator(`${a} links`, `${countLinks(f)} / ${coopBonus ? 5 : 6}`);
      ctx.setIndicator(`${a} co-op`, `${Math.min(coop[i]!, 3)}/3`);
    });
    if (coopBonus && !ctx.vars.coopAnnounced) {
      ctx.vars.coopAnnounced = true;
      ctx.announce('COOPERTITION BONUS: link RP threshold drops to 5');
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

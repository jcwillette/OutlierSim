import type { Alliance, GameRules, RobotInfo, RulesContext } from '../../engine/sim/types.ts';
import { pointInRegion } from '../../engine/sim/math.ts';
import {
  COMMUNITY,
  coopPieces,
  countLinks,
  filledNodes,
  forAlliance,
  isComplete,
  LOADING_ZONE,
} from './layout.ts';

/**
 * CHARGED UP mechanics the schema can't express (Manual 6.4):
 *  - LINKS: 5 pts per 3 adjacent filled nodes in a row, assessed at match end; live HUD count.
 *  - SUPERCHARGED nodes: the `supercharge` target opens only once all 27 nodes hold a piece.
 *  - Charge Station: only 1 robot's auto dock/engage counts (Table 6-2). At the end the station is
 *    LEVEL only if the last robot to get on was one that balances it (an `engage` action): then every
 *    DOCKED partner is ENGAGED too (6.4.2). A dock-only robot climbing on afterwards tips it, so
 *    nobody is ENGAGED.
 *  - G207 right of way: a robot in its opponent's LOADING ZONE or COMMUNITY that touches an
 *    opponent robot draws a FOUL, whoever started the contact (Manual 7.2), except when the
 *    opponent clearly drove into it (G201: violations forced by the opponent aren't penalized).
 *  - G202 pinning: 5 s of driving into an opponent that can't move is a FOUL, then a TECH FOUL every
 *    further 5 s.
 */

/** Centers closer than this count as robots touching (two ~0.84 m frames side by side). */
const CONTACT_DIST = 0.95;
/** Seconds before the same pair of robots can draw another G207 foul ("per instance"). */
const G207_REPEAT_SEC = 3;
const PROTECTED = {
  blue: [forAlliance(COMMUNITY, 'blue'), forAlliance(LOADING_ZONE, 'blue')],
  red: [forAlliance(COMMUNITY, 'red'), forAlliance(LOADING_ZONE, 'red')],
} as const;

/** G202: a pin longer than this is a FOUL, plus a TECH FOUL for each further period. */
const PIN_COUNT_SEC = 5;

/**
 * G202 pinning: a robot that keeps driving into an opponent that is trying to move but can't (it's
 * pinned against something) for 5 s draws a FOUL, then a TECH FOUL every further 5 s. The count
 * resets once they separate.
 */
function checkG202(ctx: RulesContext, dt: number, robots: readonly RobotInfo[]): void {
  if (ctx.phase !== 'teleop' && ctx.phase !== 'auto') return;
  const pins = (ctx.vars.pins ??= {}) as Record<string, { t: number; called: number }>;
  // Each ordered pair is visited once per tick, so only pins that existed before can need clearing.
  let anyPins = false;
  for (const _ in pins) {
    anyPins = true;
    break;
  }
  for (const a of robots) {
    for (const v of robots) {
      if (a.alliance === v.alliance) continue;
      const dx = v.x - a.x;
      const dy = v.y - a.y;
      const d = Math.hypot(dx, dy);
      const contact =
        d < CONTACT_DIST &&
        // victim stuck: trying to move but not moving
        Math.hypot(v.vx, v.vy) < 0.25 &&
        Math.hypot(v.cmdX, v.cmdY) > 0.3 &&
        !v.endgameAction &&
        // pushing: driving into the victim
        d > 1e-3 &&
        (a.cmdX * dx + a.cmdY * dy) / d > 0.3;
      if (contact) {
        const p = (pins[`${a.id}>${v.id}`] ??= { t: 0, called: 0 });
        p.t += dt;
        const periods = Math.floor(p.t / PIN_COUNT_SEC);
        if (periods > p.called) {
          p.called = periods;
          ctx.foul(
            a.alliance,
            periods === 1 ? 'minor' : 'major',
            `G202 pinning for ${periods * PIN_COUNT_SEC} s`,
          );
        }
      } else if (anyPins && d > CONTACT_DIST + 0.3) delete pins[`${a.id}>${v.id}`];
    }
  }
}

function checkG207(ctx: RulesContext, robots: readonly RobotInfo[]): void {
  if (ctx.phase !== 'auto' && ctx.phase !== 'teleop') return;
  const last = (ctx.vars.g207 ??= {}) as Record<string, number>;
  for (const a of robots) {
    if (a.alliance !== 'blue') continue;
    for (const b of robots) {
      if (b.alliance !== 'red' || Math.hypot(a.x - b.x, a.y - b.y) > CONTACT_DIST) continue;
      // Each robot is checked against the other alliance's protected zones.
      for (const [intruder, owner] of [
        [a, 'red'],
        [b, 'blue'],
      ] as const) {
        if (!PROTECTED[owner].some((z) => pointInRegion(intruder, z))) continue;
        // G201: a violation forced by the opponent isn't penalized. If the zone's owner drove into the
        // intruder harder than the intruder drove into it, no foul.
        const other = intruder === a ? b : a;
        const dx = other.x - intruder.x;
        const dy = other.y - intruder.y;
        const d = Math.hypot(dx, dy) || 1;
        const intruderClosing = (intruder.vx * dx + intruder.vy * dy) / d;
        const ownerClosing = -(other.vx * dx + other.vy * dy) / d;
        if (ownerClosing > intruderClosing) continue;
        const key = `${a.id}-${b.id}-${intruder.id}`;
        if (ctx.time - (last[key] ?? -Infinity) < G207_REPEAT_SEC) continue;
        last[key] = ctx.time;
        ctx.foul(intruder.alliance, 'minor', `G207 contact in the ${owner} loading zone/community`);
      }
    }
  }
}

const ALLIANCES: Alliance[] = ['blue', 'red'];
const LINKS_INDICATOR = { blue: 'blue links', red: 'red links' } as const;
const COOP_INDICATOR = { blue: 'blue co-op', red: 'red co-op' } as const;

const filled = (ctx: RulesContext, a: Alliance) => filledNodes((id) => ctx.targetCount(id), a);

export const rules: GameRules = {
  onInit(ctx) {
    for (const a of ALLIANCES) ctx.setTargetEnabled(`supercharge.${a}`, false);
  },

  onTick(ctx, dt) {
    // One snapshot of the robots and of each GRID per tick (nothing here moves robots or scores).
    const robots = ctx.robots();
    checkG207(ctx, robots);
    checkG202(ctx, dt, robots);
    // When each robot finished its endgame action (to know who got on the Charge Station last).
    const doneAt = (ctx.vars.doneAt ??= {}) as Record<number, number>;
    for (const r of robots) {
      if (r.endgameAction && doneAt[r.id] === undefined) doneAt[r.id] = ctx.time;
      if (!r.endgameAction) delete doneAt[r.id]; // released after auto
    }
    const grids = ALLIANCES.map((a) => filled(ctx, a));
    const coop = grids.map((f) => coopPieces(f));
    const coopBonus = coop.every((n) => n >= 3);
    ALLIANCES.forEach((a, i) => {
      const f = grids[i]!;
      const complete = isComplete(f);
      const key = `supercharge.${a}`;
      if (complete && !(ctx.vars[key] as boolean | undefined)) {
        ctx.vars[key] = true;
        ctx.setTargetEnabled(key, true);
        ctx.announce(`${a.toUpperCase()} GRID complete: extra pieces SUPERCHARGE (+3)`, a);
      }
      ctx.setIndicator(LINKS_INDICATOR[a], `${countLinks(f)} / ${coopBonus ? 5 : 6}`);
      ctx.setIndicator(COOP_INDICATOR[a], `${Math.min(coop[i]!, 3)}/3`);
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

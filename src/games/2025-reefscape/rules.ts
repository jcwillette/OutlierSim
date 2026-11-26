import type { Alliance, AllianceSummary, GameRules, RulesContext, Vec3 } from '../../engine/sim/types.ts';
import {
  BARGE_X,
  BARGE_ZONE,
  BLOCKED_BY_ALGAE,
  BLUE_THROWER,
  FACES,
  L,
  NET_LEN,
  NET_WIDTH,
  NET_Y,
  SIDES,
  W,
  branchId,
  reefAlgaeId,
  type Level,
} from './layout.ts';

/**
 * REEFSCAPE mechanics the schema can't express (Manual 5.3-5.5, 6.3.4, 6.5, Table 6-2, G421):
 *  - REEF ALGAE blocks BRANCHES: each face starts with an ALGAE resting on its L2 (low) or L3 (high)
 *    BRANCHES, and a CORAL touching ALGAE isn't scored. Those BRANCHES are closed until a robot takes
 *    the face's ALGAE (its one-piece REEF ALGAE station, see the definition).
 *  - PROCESSOR to the opposing HUMAN PLAYER: an ALGAE scored in an alliance's PROCESSOR rolls into the
 *    opponent's PROCESSOR AREA. That HUMAN PLAYER throws it at their own NET in TELEOP (G404: not in
 *    AUTO): a real ballistic ALGAE that lands in the NET with `NET_THROW_CHANCE` and otherwise falls
 *    short onto the FIELD beside the BARGE (the opponents' half), where robots can pick it up.
 *  - Coopertition: at least 2 ALGAE in each alliance's PROCESSOR lowers the CORAL RP to 3 levels.
 *  - G421: no more than 1 robot of an alliance fully beyond the BARGE ZONES on the opponent's side:
 *    MINOR FOUL, then a MAJOR FOUL for every 3 s it isn't corrected.
 *
 * G427, G428 and G425 are declared in `definition.fouls`; the engine calls them.
 *
 * The HUD shows each alliance's CORAL per level against the RP, Coopertition progress and the ALGAE
 * waiting with its HUMAN PLAYER. Nothing prefers an alliance or a direction (ADR 0007): red's
 * thrower, NET and REEF are blue's rotated about the field center.
 */

const ALLIANCES: Alliance[] = ['blue', 'red'];
const other = (a: Alliance): Alliance => (a === 'blue' ? 'red' : 'blue');

/** CORAL RP: 5 CORAL on each of the 4 levels, or on 3 levels with Coopertition (Table 6-2, TU03). */
export const CORAL_RP_PER_LEVEL = 5;
export const CORAL_RP_LEVELS_COOP = 3;
/** Coopertition: at least 2 ALGAE in each alliance's PROCESSOR (6.5.3). */
export const COOP_ALGAE = 2;
/** BARGE RP: at least 14 BARGE points (Table 6-2; 16 only at the Championship, TU21). */
export const BARGE_RP_POINTS = 14;
/** Ledger sources that are BARGE points: PARK and the two CAGE actions. */
export const BARGE_SOURCES = ['park', 'deep', 'shallow'];
/**
 * Chance a HUMAN PLAYER's throw lands in the NET: a 16 in ball over the 8 ft 5 in BARGE top into a
 * 4 ft × 12 ft NET, ~3.5 m away. An estimate, kept low (robot-baselines.md, "Human players": real
 * throws at a small far target landed 8 % of the time in 2024; this target is far bigger and nearer).
 */
export const NET_THROW_CHANCE = 0.35;
/** Seconds from an ALGAE reaching the HUMAN PLAYER to the throw, and between throws. */
const HP_FIRST_SEC = 2.5;
const HP_THROW_SEC = 3;
/** Flight time of a throw, s. */
const THROW_T = 1.25;
const G = 9.81;
/** G421: a robot is beyond the BARGE ZONES when its center is this far past their far edge. */
const HALF_ROBOT = 0.45;
const G421_REPEAT_SEC = 3;
/** What bots add to a PROCESSOR ALGAE: before Coopertition it helps the CORAL RP... */
const COOP_VALUE = 2;
/** ...after, it hands the opponents' HUMAN PLAYER a throw at their NET (4 × NET_THROW_CHANCE). */
const FEEDS_OPPONENT = -4 * NET_THROW_CHANCE;
/** What bots add to a CORAL on a level still short of the CORAL RP (teleop), and to the one completing it. */
const LEVEL_VALUE = 0.8;
const LEVEL_FILL_VALUE = 2;

export const LEVEL_NAMES = ['L1', 'L2', 'L3', 'L4'] as const;
/** Level index (0 = L1) of a CORAL target's base id, or -1. */
export function levelOf(baseId: string): number {
  const m = /^l([1-4])-/.exec(baseId);
  return m ? Number(m[1]) - 1 : -1;
}

/** CORAL scored per level [L1, L2, L3, L4] (AUTO and TELEOP). */
export function coralByLevel(own: AllianceSummary): number[] {
  const out = [0, 0, 0, 0];
  const suffix = `.${own.alliance}`;
  for (const [id, c] of Object.entries(own.targetCounts)) {
    if (!id.endsWith(suffix)) continue;
    const lv = levelOf(id);
    if (lv >= 0) out[lv]! += c.auto + c.teleop;
  }
  return out;
}

const processed = (s: AllianceSummary) => {
  const c = s.targetCounts[`processor.${s.alliance}`];
  return c ? c.auto + c.teleop : 0;
};
/** Both alliances put at least 2 ALGAE in their PROCESSOR. */
export const coopAchieved = (own: AllianceSummary, opp: AllianceSummary): boolean =>
  processed(own) >= COOP_ALGAE && processed(opp) >= COOP_ALGAE;

interface AllianceState {
  /** Faces whose REEF ALGAE is gone (its BRANCHES open). */
  freed: boolean[];
  /** ALGAE waiting with this alliance's HUMAN PLAYER (processed by the opponent). */
  hpAlgae: number;
  /** Match time of the HUMAN PLAYER's next throw. */
  nextThrow: number;
  /** CORAL per level, L1-L4. */
  levels: number[];
  processed: number;
  /** G421: match time the violation began (or -1), and when the next MAJOR FOUL is due. */
  g421Since: number;
  g421Next: number;
}

const state = (ctx: RulesContext) => ctx.vars.reef as Record<Alliance, AllianceState>;

/** The HUMAN PLAYER who throws at `a`'s NET, and that NET (rotational symmetry). */
function thrower(a: Alliance): Vec3 {
  return a === 'blue' ? BLUE_THROWER : { x: L - BLUE_THROWER.x, y: W - BLUE_THROWER.y, z: BLUE_THROWER.z };
}
function netCenter(a: Alliance): { x: number; y: number } {
  return a === 'blue' ? { x: BARGE_X, y: NET_Y } : { x: L - BARGE_X, y: W - NET_Y };
}

/** Velocity that carries a ball from `from` to `to` in `t` seconds. */
function lob(from: Vec3, to: Vec3, t: number): Vec3 {
  return {
    x: (to.x - from.x) / t,
    y: (to.y - from.y) / t,
    z: (to.z - from.z + 0.5 * G * t * t) / t,
  };
}

/** A HUMAN PLAYER throw at `a`'s NET: in with `NET_THROW_CHANCE`, else short or long onto the carpet. */
function throwAlgae(ctx: RulesContext, a: Alliance): void {
  const from = thrower(a);
  const net = netCenter(a);
  const along = (ctx.random() - 0.5) * (NET_LEN - 1.2);
  let to: Vec3;
  if (ctx.random() < NET_THROW_CHANCE) {
    const across = (ctx.random() - 0.5) * (NET_WIDTH - 0.6);
    to = { x: net.x + across, y: net.y + along, z: 2.2 };
  } else {
    // Short: it drops on the thrower's side of the BARGE (the opponents' half), clear of the NET.
    // A long miss would pass down through the NET's volume, which counts as scored.
    const short = Math.sign(from.x - net.x) * (1.0 + ctx.random() * 0.8);
    to = { x: net.x + short, y: net.y + along, z: 0.3 };
  }
  ctx.spawnPiece('algae', from, lob(from, to, THROW_T));
}

/** Robots of `a` fully beyond the BARGE ZONES on the opponent's side (G421). */
function beyondBarge(ctx: RulesContext, a: Alliance, robots: ReturnType<RulesContext['robots']>): number {
  let n = 0;
  for (const r of robots) {
    if (r.alliance !== a) continue;
    if (a === 'blue' ? r.x - HALF_ROBOT > BARGE_ZONE.max.x : r.x + HALF_ROBOT < L - BARGE_ZONE.max.x) n++;
  }
  return n;
}

function showStatus(ctx: RulesContext): void {
  const st = state(ctx);
  for (const a of ALLIANCES) {
    const s = st[a];
    const coop = st.blue.processed >= COOP_ALGAE && st.red.processed >= COOP_ALGAE;
    const need = coop ? CORAL_RP_LEVELS_COOP : 4;
    const full = s.levels.filter((n) => n >= CORAL_RP_PER_LEVEL).length;
    ctx.setIndicator(
      `${a} CORAL`,
      s.levels.map((n, i) => `${LEVEL_NAMES[i]} ${Math.min(n, 99)}`).join(' · ') +
        ` (RP: ${need} levels of 5)`,
      full >= need ? { active: true } : undefined,
    );
    ctx.setIndicator(
      `${a} Coopertition`,
      coop ? '✓' : `${Math.min(s.processed, COOP_ALGAE)}/${COOP_ALGAE} in PROCESSOR`,
      coop ? { active: true } : undefined,
    );
    ctx.setIndicator(`${a} HUMAN PLAYER`, s.hpAlgae > 0 ? `${s.hpAlgae} ALGAE to throw` : null);
  }
}

export const rules: GameRules = {
  onInit(ctx) {
    const st = {} as Record<Alliance, AllianceState>;
    for (const a of ALLIANCES) {
      st[a] = {
        freed: FACES.map(() => false),
        hpAlgae: 0,
        nextThrow: 0,
        levels: [0, 0, 0, 0],
        processed: 0,
        g421Since: -1,
        g421Next: 0,
      };
      for (const k of FACES)
        for (const lvl of BLOCKED_BY_ALGAE(k))
          for (const s of SIDES) ctx.setTargetEnabled(`${branchId(lvl, k, s)}.${a}`, false);
    }
    ctx.vars.reef = st;
    showStatus(ctx);
  },

  onScore(ctx, ev) {
    const st = state(ctx);
    const base = ev.targetId.replace(/\.(blue|red)$/, '');
    const own = st[ev.alliance];
    if (base === 'processor') {
      own.processed++;
      const opp = st[other(ev.alliance)];
      if (opp.hpAlgae === 0) opp.nextThrow = Math.max(opp.nextThrow, ctx.time + HP_FIRST_SEC);
      opp.hpAlgae++;
    } else {
      const lv = levelOf(base);
      if (lv >= 0) own.levels[lv]!++;
    }
    ctx.vars.dirty = true;
  },

  onTick(ctx) {
    const st = state(ctx);
    let dirty = ctx.vars.dirty === true;
    // REEF ALGAE taken: open the BRANCHES it covered.
    for (const a of ALLIANCES) {
      const s = st[a];
      for (const k of FACES) {
        if (s.freed[k] || ctx.stationUsed(`${reefAlgaeId(k)}.${a}`, a) === 0) continue;
        s.freed[k] = true;
        for (const lvl of BLOCKED_BY_ALGAE(k) as Level[])
          for (const side of SIDES) ctx.setTargetEnabled(`${branchId(lvl, k, side)}.${a}`, true);
      }
    }
    if (ctx.phase === 'teleop') {
      // HUMAN PLAYER throws at the NET.
      for (const a of ALLIANCES) {
        const s = st[a];
        if (s.hpAlgae > 0 && ctx.time >= s.nextThrow) {
          throwAlgae(ctx, a);
          s.hpAlgae--;
          s.nextThrow = ctx.time + HP_THROW_SEC;
          dirty = true;
        }
      }
    }
    if (ctx.phase === 'auto' || ctx.phase === 'teleop') {
      // G421: one defender at a time.
      const robots = ctx.robots();
      for (const a of ALLIANCES) {
        const s = st[a];
        if (beyondBarge(ctx, a, robots) < 2) {
          s.g421Since = -1;
          continue;
        }
        if (s.g421Since < 0) {
          s.g421Since = ctx.time;
          s.g421Next = ctx.time + G421_REPEAT_SEC;
          ctx.foul(a, 'minor', 'G421 more than 1 ROBOT on the opponent’s side');
        } else if (ctx.time >= s.g421Next) {
          s.g421Next += G421_REPEAT_SEC;
          ctx.foul(a, 'major', 'G421 more than 1 ROBOT on the opponent’s side');
        }
      }
    }
    if (dirty) {
      ctx.vars.dirty = false;
      showStatus(ctx);
    }
  },

  botValue(ctx, alliance, targetId) {
    const st = state(ctx);
    const s = st[alliance];
    const base = targetId.slice(0, targetId.length - alliance.length - 1);
    // Programmed autos go for points, not bonuses (robot-baselines.md, "Lessons from 2024").
    if (ctx.phase !== 'teleop') return 0;
    if (base === 'processor') return s.processed < COOP_ALGAE ? COOP_VALUE : FEEDS_OPPONENT;
    const lv = levelOf(base);
    if (lv < 0) return 0;
    const n = s.levels[lv]!;
    if (n >= CORAL_RP_PER_LEVEL) return 0;
    return n === CORAL_RP_PER_LEVEL - 1 ? LEVEL_FILL_VALUE : LEVEL_VALUE;
  },
};

import type { Alliance, GameRules, RulesContext } from '../../engine/sim/types.ts';
import { CHAINS, L, SPEAKER_Y, chainAt } from './layout.ts';

/**
 * CRESCENDO mechanics the schema can't express (kickoff manual, 6.5.3-6.5.5 and Table 6-2):
 *  - AMPLIFICATION: NOTES through the AMP bank toward AMPLIFICATION (2 at most). With 2 banked the
 *    HUMAN PLAYER presses the AMP button and the SPEAKER is AMPLIFIED for 10 s: 5 points per NOTE
 *    instead of 2. NOTES through the AMP while AMPLIFIED don't bank. The kickoff manual has no
 *    4-NOTE cap (that came with Team Update 01, after the cutoff).
 *  - Coopertition: in the first 45 s of TELEOP a HUMAN PLAYER may spend a banked NOTE on the
 *    Coopertition button. If both alliances do, the MELODY threshold drops from 18 to 15 NOTES.
 *  - TRAPS are open only in the last 20 s (a ROBOT must be ONSTAGE to reach one; see SOURCES.md).
 *  - HARMONY: +2 per extra ROBOT ONSTAGE on the same chain. SPOTLIT: the HUMAN PLAYER throws the 3
 *    HIGH NOTES at MICROPHONES over ONSTAGE ROBOTS in the last 20 s; each lands with a fixed chance,
 *    and every ROBOT ONSTAGE under a spotlit MICROPHONE gets +1 (4 instead of 3).
 *
 * G422, G423, G424 and G420 are declared in `definition.fouls`; the engine calls them.
 *
 * The HUMAN PLAYERS here are the same for every alliance and robot type: they press AMP as soon as
 * an alliance robot holding a NOTE is within shooting range (or time is running out) and always
 * cooperate. Nothing prefers an alliance or a direction (ADR 0007).
 */

const ALLIANCES: Alliance[] = ['blue', 'red'];
/** AMPLIFICATION length, s (Manual 6.5.3). */
export const AMPLIFY_SEC = 10;
/** SPEAKER NOTE points while AMPLIFIED over not (Table 6-2: 5 / 2). */
export const AMPLIFIED_MULTIPLIER = 5 / 2;
/** Coopertition window: the first 45 s of TELEOP (remaining time above 1:30, Manual 6.5.5). */
const COOP_UNTIL_REMAINING = 90;
/** MELODY: 18 AMP and SPEAKER NOTES, 15 with the Coopertition Bonus (Table 6-2, kickoff). */
export const MELODY_NOTES = 18;
export const MELODY_NOTES_COOP = 15;
/**
 * Chance one HIGH NOTE thrown from the AMP corner lands on a MICROPHONE (a 1.66 in post 7 ft 4¼ in
 * up, ~5-6 m away). An estimate for a practiced HUMAN PLAYER; no match data used.
 */
export const SPOTLIGHT_CHANCE = 0.25;
const HIGH_NOTES = 3;
/** A robot holding a NOTE this close to its SPEAKER (m) is about to shoot: worth AMPLIFYING for. */
const READY_RANGE = 5.5;

interface AllianceState {
  /** NOTES banked toward AMPLIFICATION / Coopertition (0-2). */
  bank: number;
  /** Match time AMPLIFICATION ends, or 0. */
  ampUntil: number;
  coopPressed: boolean;
}

/** Each alliance's SPEAKER opening (mirror symmetry: same y, opposite ends). */
const SPEAKER = { blue: { x: 0.3, y: SPEAKER_Y }, red: { x: L - 0.3, y: SPEAKER_Y } };

const state = (ctx: RulesContext) => ctx.vars.amp as Record<Alliance, AllianceState>;
const amplified = (ctx: RulesContext, a: Alliance) => state(ctx)[a].ampUntil > ctx.time;
const coopWindow = (ctx: RulesContext) => ctx.phase === 'teleop' && ctx.remaining > COOP_UNTIL_REMAINING;

function showAmp(ctx: RulesContext, a: Alliance): void {
  const s = state(ctx)[a];
  ctx.setIndicator(
    `${a} amp`,
    s.ampUntil > ctx.time ? `AMPLIFIED ${Math.ceil(s.ampUntil - ctx.time)} s` : `${s.bank} / 2`,
  );
}

function coopDone(ctx: RulesContext): boolean {
  const s = state(ctx);
  return s.blue.coopPressed && s.red.coopPressed;
}

/** The HUMAN PLAYERS' buttons, every tick. */
function humanPlayers(ctx: RulesContext): void {
  const s = state(ctx);
  const robots = ctx.robots();
  for (const a of ALLIANCES) {
    const st = s[a];
    if (st.ampUntil && st.ampUntil <= ctx.time) {
      st.ampUntil = 0;
      ctx.setTargetMultiplier(`speaker.${a}`, 1);
      showAmp(ctx, a);
    }
    if (ctx.phase !== 'teleop') continue;
    // Coopertition first: one banked NOTE, in the first 45 s of TELEOP.
    if (!st.coopPressed && st.bank >= 1 && coopWindow(ctx)) {
      st.coopPressed = true;
      st.bank -= 1;
      ctx.setIndicator(`${a} co-op`, 'pressed');
      ctx.announce(`${a.toUpperCase()} pressed the Coopertition button`, a);
      if (coopDone(ctx)) {
        // Both alliances: the Coopertition Bonus (MELODY threshold 15). It earns no MATCH points; the
        // pair of entries nets to zero and leaves a 'coopertition' source for the MELODY check.
        for (const b of ALLIANCES) {
          ctx.addPoints(b, 'teleop', 1, 'coopertition');
          ctx.addPoints(b, 'teleop', -1, 'coopertition-offset');
          ctx.setIndicator(`${b} co-op`, 'BONUS');
        }
        ctx.announce(`COOPERTITION BONUS: MELODY needs ${MELODY_NOTES_COOP} NOTES`);
      }
      showAmp(ctx, a);
      continue;
    }
    if (st.ampUntil || st.bank < 2) continue;
    const ready = robots.some(
      (r) =>
        r.alliance === a &&
        r.held.length > 0 &&
        Math.hypot(r.x - SPEAKER[a].x, r.y - SPEAKER[a].y) < READY_RANGE,
    );
    if (!ready && ctx.remaining > AMPLIFY_SEC + 2) continue;
    st.bank = 0;
    st.ampUntil = ctx.time + AMPLIFY_SEC;
    ctx.setTargetMultiplier(`speaker.${a}`, AMPLIFIED_MULTIPLIER);
    ctx.announce(`${a.toUpperCase()} SPEAKER AMPLIFIED (10 s)`, a);
    showAmp(ctx, a);
  }
}

export const rules: GameRules = {
  onInit(ctx) {
    ctx.vars.amp = {
      blue: { bank: 0, ampUntil: 0, coopPressed: false },
      red: { bank: 0, ampUntil: 0, coopPressed: false },
    } satisfies Record<Alliance, AllianceState>;
    for (const a of ALLIANCES) {
      for (let i = 1; i <= CHAINS.length; i++) ctx.setTargetEnabled(`trap-${i}.${a}`, false);
      showAmp(ctx, a);
      ctx.setIndicator(`${a} co-op`, '-');
    }
  },

  onScore(ctx, ev) {
    const a = ev.alliance;
    if (ev.targetId !== `amp.${a}`) return;
    const st = state(ctx)[a];
    if (!amplified(ctx, a) && st.bank < 2) st.bank++;
    showAmp(ctx, a);
  },

  onTick(ctx) {
    humanPlayers(ctx);
    for (const a of ALLIANCES) if (amplified(ctx, a)) showAmp(ctx, a);
    if (ctx.endgame && !ctx.vars.trapsOpen) {
      ctx.vars.trapsOpen = true;
      for (const a of ALLIANCES)
        for (let i = 1; i <= CHAINS.length; i++) ctx.setTargetEnabled(`trap-${i}.${a}`, true);
    }
  },

  /**
   * What drive teams aim for (bots only; never scored): a SPEAKER NOTE is worth 3 more while
   * AMPLIFIED, and an AMP NOTE that banks toward AMPLIFICATION about 2 more (half of one press's
   * gain, which usually AMPLIFIES one or two NOTES), plus 1.5 for the Coopertition NOTE early in
   * TELEOP.
   */
  botValue(ctx, alliance, targetId) {
    const st = state(ctx)[alliance];
    if (targetId === `speaker.${alliance}`) return ctx.phase === 'teleop' && amplified(ctx, alliance) ? 3 : 0;
    if (targetId !== `amp.${alliance}`) return 0;
    if (amplified(ctx, alliance) || st.bank >= 2) return 0;
    const coop = !st.coopPressed && st.bank < 1 && (ctx.phase === 'auto' || coopWindow(ctx)) ? 1.5 : 0;
    return 2 + coop;
  },

  onMatchEnd(ctx) {
    for (const a of ALLIANCES) {
      const onstage = ctx.robots().filter((r) => r.alliance === a && r.endgameAction === `onstage.${a}`);
      const perChain = CHAINS.map(() => 0);
      // The chains are laid out on blue's STAGE: read red robots in blue's frame (mirror image).
      for (const r of onstage) perChain[chainAt(a === 'blue' ? r : { x: L - r.x, y: r.y })]!++;
      // HARMONY: 2 points per ROBOT past the first on a chain.
      const harmony = perChain.reduce((n, k) => n + Math.max(0, k - 1), 0);
      if (harmony) ctx.addPoints(a, 'endgame', 2 * harmony, 'harmony');
      // SPOTLIT: the HUMAN PLAYER throws at the MICROPHONES over the most ONSTAGE ROBOTS first.
      const order = perChain
        .map((k, i) => ({ k, i }))
        .filter((c) => c.k > 0)
        .sort((x, y) => y.k - x.k || x.i - y.i);
      let throws = HIGH_NOTES;
      let spotlit = 0;
      for (const c of order) {
        while (throws > 0) {
          throws--;
          if (ctx.random() < SPOTLIGHT_CHANCE) {
            spotlit += c.k;
            break;
          }
        }
      }
      if (spotlit) {
        ctx.addPoints(a, 'endgame', spotlit, 'spotlight');
        ctx.announce(`${a.toUpperCase()} HUMAN PLAYER SPOTLIT ${spotlit} ROBOT${spotlit > 1 ? 'S' : ''}`, a);
      }
    }
  },
};

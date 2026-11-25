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
 * The HUD shows each alliance's timing state (`showStatus`): what a SPEAKER and an AMP NOTE score
 * right now (AUTO or TELEOP, AMPLIFIED with its 10 s countdown), the AMP bank, the Coopertition
 * window's countdown and when the TRAPS open.
 *
 * The HUMAN PLAYERS here are the same for every alliance and robot type: they press AMP as soon as
 * an alliance robot holding a NOTE is within shooting range (or time is running out) and always
 * cooperate. Nothing prefers an alliance or a direction (ADR 0007).
 */

const ALLIANCES: Alliance[] = ['blue', 'red'];
/** NOTE points, AUTO / TELEOP (Table 6-2). */
export const SPEAKER_POINTS = { auto: 5, teleop: 2 };
export const AMP_POINTS = { auto: 2, teleop: 1 };
export const TRAP_POINTS = { auto: 0, teleop: 5 };
/** TRAPS open in the last 20 s (the endgame, `timing.endgameSec`). */
const TRAPS_OPEN_REMAINING = 20;
/** AMPLIFICATION length, s (Manual 6.5.3). */
export const AMPLIFY_SEC = 10;
/** SPEAKER NOTE points while AMPLIFIED (Table 6-2: 5, over 2 otherwise in TELEOP). */
const AMPLIFIED_POINTS = 5;
export const AMPLIFIED_MULTIPLIER = AMPLIFIED_POINTS / SPEAKER_POINTS.teleop;
/** Coopertition window: the first 45 s of TELEOP (remaining time above 1:30, Manual 6.5.5). */
const COOP_UNTIL_REMAINING = 90;
const COOP_SEC = 45;
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
const coopDone = (ctx: RulesContext) => state(ctx).blue.coopPressed && state(ctx).red.coopPressed;

const pts = (n: number) => `${n} pt${n === 1 ? '' : 's'}`;
const secs = (t: number) => `${Math.max(0, Math.ceil(t))} s`;
const clock = (t: number) => {
  const s = Math.max(0, Math.ceil(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
/** AUTO points count until TELEOP starts (NOTES landing in the 3 s delay still score as AUTO). */
const period = (ctx: RulesContext) => (ctx.phase === 'teleop' || ctx.phase === 'post' ? 'teleop' : 'auto');

/**
 * The HUD's timing chips: what each NOTE scores right now and the windows that change it. Display
 * only; nothing here changes the match.
 */
function showStatus(ctx: RulesContext): void {
  const per = period(ctx);
  const teleop = ctx.phase === 'teleop';
  for (const a of ALLIANCES) {
    const s = state(ctx)[a];
    const amp = amplified(ctx, a);
    // SPEAKER: AUTO 5, TELEOP 2, AMPLIFIED 5 with the 10 s countdown.
    if (amp)
      ctx.setIndicator(
        `${a} SPEAKER`,
        `AMPLIFIED ${pts(AMPLIFIED_POINTS)} · ${secs(s.ampUntil - ctx.time)}`,
        {
          active: true,
          until: s.ampUntil,
          span: AMPLIFY_SEC,
        },
      );
    else ctx.setIndicator(`${a} SPEAKER`, `${pts(SPEAKER_POINTS[per])}${per === 'auto' ? ' (auto)' : ''}`);
    // AMP: its points and the bank toward AMPLIFICATION (no banking while AMPLIFIED).
    const ampPts = `${pts(AMP_POINTS[per])}${per === 'auto' ? ' (auto)' : ''}`;
    if (amp) ctx.setIndicator(`${a} AMP`, `${ampPts} · not banking`);
    else if (s.bank >= 2)
      ctx.setIndicator(`${a} AMP`, `${ampPts} · 2/2: AMPLIFY ${teleop ? 'ready' : 'in teleop'}`);
    else ctx.setIndicator(`${a} AMP`, `${ampPts} · ${s.bank}/2 to AMPLIFY`);
    // Coopertition: the first 45 s of TELEOP.
    const key = `${a} Coopertition`;
    if (s.coopPressed && coopDone(ctx)) ctx.setIndicator(key, `BONUS: MELODY at ${MELODY_NOTES_COOP}`);
    else if (s.coopPressed) ctx.setIndicator(key, 'pressed, waiting on the other alliance');
    else if (!teleop && ctx.phase !== 'post') ctx.setIndicator(key, 'opens in teleop');
    else if (coopWindow(ctx)) {
      const left = ctx.remaining - COOP_UNTIL_REMAINING;
      ctx.setIndicator(key, `open ${secs(left)} · needs 1 AMP NOTE`, {
        active: true,
        until: ctx.time + left,
        span: COOP_SEC,
      });
    } else ctx.setIndicator(key, 'closed');
  }
  // TRAPS: the last 20 s.
  if (ctx.endgame)
    ctx.setIndicator('TRAPS', `OPEN · ${pts(TRAP_POINTS.teleop)} · ${secs(ctx.remaining)}`, {
      active: true,
      until: ctx.time + ctx.remaining,
      span: TRAPS_OPEN_REMAINING,
    });
  else if (teleop) ctx.setIndicator('TRAPS', `open in ${clock(ctx.remaining - TRAPS_OPEN_REMAINING)}`);
  else if (ctx.phase === 'post') ctx.setIndicator('TRAPS', 'closed');
  else ctx.setIndicator('TRAPS', `open in the last ${TRAPS_OPEN_REMAINING} s`);
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
      ctx.announce(`${a.toUpperCase()} AMPLIFICATION over: SPEAKER back to ${pts(SPEAKER_POINTS.teleop)}`, a);
    }
    if (ctx.phase !== 'teleop') continue;
    // Coopertition first: one banked NOTE, in the first 45 s of TELEOP.
    if (!st.coopPressed && st.bank >= 1 && coopWindow(ctx)) {
      st.coopPressed = true;
      st.bank -= 1;
      ctx.announce(`${a.toUpperCase()} pressed the Coopertition button`, a);
      if (coopDone(ctx)) {
        // Both alliances: the Coopertition Bonus (MELODY threshold 15). It earns no MATCH points; the
        // pair of entries nets to zero and leaves a 'coopertition' source for the MELODY check.
        for (const b of ALLIANCES) {
          ctx.addPoints(b, 'teleop', 1, 'coopertition');
          ctx.addPoints(b, 'teleop', -1, 'coopertition-offset');
        }
        ctx.announce(`COOPERTITION BONUS: MELODY needs ${MELODY_NOTES_COOP} NOTES`);
      }
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
    ctx.announce(
      `${a.toUpperCase()} SPEAKER AMPLIFIED: ${pts(AMPLIFIED_POINTS)} a NOTE for ${AMPLIFY_SEC} s`,
      a,
    );
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
    }
    showStatus(ctx);
  },

  onPhaseChange(ctx, phase) {
    if (phase === 'teleop')
      ctx.announce(
        `TELEOP: SPEAKER ${SPEAKER_POINTS.auto} → ${SPEAKER_POINTS.teleop}, AMP ${AMP_POINTS.auto} → ${AMP_POINTS.teleop}. ` +
          `Coopertition open ${COOP_SEC} s`,
      );
    showStatus(ctx);
  },

  onScore(ctx, ev) {
    const a = ev.alliance;
    if (ev.targetId !== `amp.${a}`) return;
    const st = state(ctx)[a];
    if (!amplified(ctx, a) && st.bank < 2) st.bank++;
    showStatus(ctx);
  },

  onTick(ctx) {
    humanPlayers(ctx);
    if (ctx.endgame && !ctx.vars.trapsOpen) {
      ctx.vars.trapsOpen = true;
      for (const a of ALLIANCES)
        for (let i = 1; i <= CHAINS.length; i++) ctx.setTargetEnabled(`trap-${i}.${a}`, true);
      ctx.announce(`ENDGAME: TRAPS open (${pts(TRAP_POINTS.teleop)} a NOTE from ONSTAGE)`);
    }
    showStatus(ctx);
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

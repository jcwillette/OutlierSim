import type { Alliance, GameRules } from '../../engine/sim/types.ts';

/**
 * Overdrive (fictional): each alliance's 5th teleop tower orb since its last Overdrive doubles its
 * tower points for 10 s. This exercises onScore, onTick, multipliers, indicators and announcements.
 */
const TRIGGER = 5;
const DURATION = 10;

interface State {
  progress: Record<Alliance, number>;
  until: Record<Alliance, number>;
}

const state = (vars: Record<string, unknown>): State =>
  (vars.overdrive ??= { progress: { blue: 0, red: 0 }, until: { blue: 0, red: 0 } }) as State;

export const rules: GameRules = {
  onInit(ctx) {
    state(ctx.vars);
    for (const a of ['blue', 'red'] as const) ctx.setIndicator(`${a} overdrive`, `0/${TRIGGER}`);
  },
  onScore(ctx, ev) {
    if (!ev.targetId.startsWith('tower.') || ctx.phase !== 'teleop') return;
    const s = state(ctx.vars);
    if (ctx.time < s.until[ev.alliance]) return;
    s.progress[ev.alliance]++;
    if (s.progress[ev.alliance] >= TRIGGER) {
      s.progress[ev.alliance] = 0;
      s.until[ev.alliance] = ctx.time + DURATION;
      ctx.setTargetMultiplier(`tower.${ev.alliance}`, 2);
      ctx.announce(`${ev.alliance.toUpperCase()} OVERDRIVE! Tower x2 for ${DURATION}s`, ev.alliance);
    }
  },
  onTick(ctx) {
    const s = state(ctx.vars);
    for (const a of ['blue', 'red'] as const) {
      const active = ctx.time < s.until[a];
      if (!active && s.until[a] > 0) {
        s.until[a] = 0;
        ctx.setTargetMultiplier(`tower.${a}`, 1);
      }
      ctx.setIndicator(
        `${a} overdrive`,
        active ? `ACTIVE ${Math.ceil(s.until[a] - ctx.time)}s` : `${s.progress[a]}/${TRIGGER}`,
      );
    }
  },
};

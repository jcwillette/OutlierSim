import { attachBots, type Difficulty } from '../engine/ai/bot.ts';
import { Match } from '../engine/sim/match.ts';
import { makeRng } from '../engine/sim/math.ts';
import type { Alliance, GameDefinition } from '../engine/sim/types.ts';
import { resolveLineup, type LineupChoice } from './lineup.ts';
import type { GameTuning } from './tuning.ts';

/**
 * Monte Carlo match-ups for spectator mode: play the same alliance setup (robots, roles, strategy,
 * difficulty) many times, bot vs bot and headless, and estimate how likely each alliance is to win.
 * DOM-free so it runs in Node tests and in the Web Workers of `montecarloPool.ts`.
 */

export interface MonteCarloSpec {
  gameId: string;
  /** Robot type and role per slot plus strategy, per alliance ('random' slots are re-dealt each match). */
  lineup: LineupChoice;
  difficulty: Record<Alliance, Difficulty>;
  /** Robots can break down / lose power. */
  breakdowns: boolean;
  /** Menu tuning for this game (display units); applied before the matches. */
  tuning?: GameTuning;
}

/** One played match-up, kept small so thousands can cross the worker boundary cheaply. */
export interface MatchupSample {
  seed: number;
  score: Record<Alliance, number>;
  winner: Alliance | 'tie';
  rp: Record<Alliance, number>;
  /** Bonus RP ids earned (not win/tie). */
  bonuses: Record<Alliance, string[]>;
  /** Archetype per robot id 0-5 (differs between samples when slots are 'random'). */
  archetypes: string[];
}

/**
 * The random stream that deals a match-up's 'random' robot slots. It is separate from the match's
 * own stream, so the deal doesn't shift the breakdown rolls. Spectator mode uses it to replay a
 * sampled match-up exactly.
 */
export const dealRng = (seed: number): (() => number) => makeRng(seed ^ 0x5bd1e995);

/** Play one match-up. `def` must already have the spec's tuning applied. Deterministic per seed. */
export function runMatchup(def: GameDefinition, spec: MonteCarloSpec, seed: number): MatchupSample {
  const lineup = resolveLineup(def, spec.lineup, null, dealRng(seed));
  const m = new Match(def, { seed, archetypes: lineup.archetypes, breakdowns: spec.breakdowns });
  attachBots(m, {
    partners: spec.difficulty.blue,
    opponents: spec.difficulty.red,
    playerId: null,
    roles: lineup.roles,
    strategies: lineup.strategies,
  });
  const r = m.runToEnd();
  const bonuses = (a: Alliance) =>
    Object.keys(r[a].rpBreakdown).filter((k) => k !== 'win' && k !== 'tie' && r[a].rpBreakdown[k]! > 0);
  return {
    seed,
    score: { blue: r.blue.score, red: r.red.score },
    winner: r.blue.won ? 'blue' : r.red.won ? 'red' : 'tie',
    rp: { blue: r.blue.rp, red: r.red.rp },
    bonuses: { blue: bonuses('blue'), red: bonuses('red') },
    archetypes: m.robots.map((x) => x.archetype.id),
  };
}

/** 95 % Wilson score interval for k successes in n trials. */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n;
  const z2 = z * z;
  const center = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

export interface ScoreStats {
  mean: number;
  sd: number;
  p10: number;
  median: number;
  p90: number;
}

export interface AllianceOutcome {
  wins: number;
  /** Share of match-ups won, with a 95 % confidence interval. */
  winRate: number;
  winCI: [number, number];
  score: ScoreStats;
  /** Mean ranking points per match. */
  rp: number;
  /** Share of match-ups that earned each bonus RP. */
  bonusRates: Record<string, number>;
}

export interface MonteCarloSummary {
  n: number;
  ties: number;
  blue: AllianceOutcome;
  red: AllianceOutcome;
  /** Blue score minus red score. */
  margin: ScoreStats;
  /** Share of match-ups decided by no more than `closeMargin` points. */
  closeRate: number;
  closeMargin: number;
  /** Histogram of blue − red margins: `bins[i]` counts margins in [start + i·width, start + (i+1)·width). */
  histogram: { start: number; width: number; bins: number[] };
}

const quantile = (sorted: number[], q: number) => {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
};

function stats(xs: number[]): ScoreStats {
  const n = xs.length;
  const mean = n ? xs.reduce((a, b) => a + b, 0) / n : 0;
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  const s = [...xs].sort((a, b) => a - b);
  return { mean, sd, p10: quantile(s, 0.1), median: quantile(s, 0.5), p90: quantile(s, 0.9) };
}

/** A "nice" bin width (1, 2, 5 × 10^k) giving roughly `target` bins over `span`. */
function niceWidth(span: number, target: number): number {
  const raw = Math.max(1, span / target);
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}

export function summarize(samples: MatchupSample[]): MonteCarloSummary {
  const n = samples.length;
  const outcome = (a: Alliance): AllianceOutcome => {
    const wins = samples.filter((s) => s.winner === a).length;
    const bonusRates: Record<string, number> = {};
    for (const s of samples) for (const b of s.bonuses[a]) bonusRates[b] = (bonusRates[b] ?? 0) + 1 / n;
    return {
      wins,
      winRate: n ? wins / n : 0,
      winCI: wilson(wins, n),
      score: stats(samples.map((s) => s.score[a])),
      rp: n ? samples.reduce((t, s) => t + s.rp[a], 0) / n : 0,
      bonusRates,
    };
  };
  const margins = samples.map((s) => s.score.blue - s.score.red);
  const blue = outcome('blue');
  const red = outcome('red');
  // "Close" scales with the game: within a tenth of a typical alliance score, at least 3 points.
  const closeMargin = Math.max(3, Math.round((blue.score.mean + red.score.mean) / 20));
  // Bins are symmetric around zero (one bin is centered on 0) so the blue and red sides line up.
  const reach = Math.max(1, ...margins.map(Math.abs));
  const width = niceWidth(2 * reach, 24);
  const half = Math.ceil((reach - width / 2) / width);
  const start = -width / 2 - half * width;
  const bins = new Array<number>(2 * half + 1).fill(0);
  for (const d of margins) bins[Math.min(bins.length - 1, Math.max(0, Math.floor((d - start) / width)))]!++;
  return {
    n,
    ties: samples.filter((s) => s.winner === 'tie').length,
    blue,
    red,
    margin: stats(margins),
    closeRate: n ? margins.filter((d) => Math.abs(d) <= closeMargin).length / n : 0,
    closeMargin,
    histogram: { start, width, bins },
  };
}

/** Identifies a setup, so the menu can show the last result only while it still matches. */
export function specKey(spec: MonteCarloSpec): string {
  return JSON.stringify([spec.gameId, spec.lineup, spec.difficulty, spec.breakdowns, spec.tuning ?? null]);
}

/**
 * Match-ups worth replaying: the one closest to the median margin ("typical"), and the biggest win
 * by the alliance that won less often ("upset"), if it ever won.
 */
export function pickReplays(samples: MatchupSample[]): { typical?: MatchupSample; upset?: MatchupSample } {
  if (!samples.length) return {};
  const margin = (s: MatchupSample) => s.score.blue - s.score.red;
  const median = stats(samples.map(margin)).median;
  const typical = samples.reduce((a, b) =>
    Math.abs(margin(b) - median) < Math.abs(margin(a) - median) ? b : a,
  );
  const blueWins = samples.filter((s) => s.winner === 'blue').length;
  const redWins = samples.filter((s) => s.winner === 'red').length;
  if (blueWins === redWins) return { typical };
  const under: Alliance = blueWins < redWins ? 'blue' : 'red';
  const sign = under === 'blue' ? 1 : -1;
  const upsets = samples.filter((s) => s.winner === under);
  const upset = upsets.length
    ? upsets.reduce((a, b) => (sign * margin(b) > sign * margin(a) ? b : a))
    : undefined;
  return upset ? { typical, upset } : { typical };
}

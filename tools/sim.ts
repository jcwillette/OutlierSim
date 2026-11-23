/**
 * Headless bot-vs-bot matches for sanity checks and calibration.
 *
 *   npm run sim -- --game 0000-reference --matches 20 [--seed 1] [--difficulty normal] [--json out.json]
 *   [--archetypes allround,turret,stacker]  (blue 1-3, mirrored for red)
 */
import { writeFileSync } from 'node:fs';
import { attachBots, type Difficulty } from '../src/engine/ai/bot.ts';
import { Match, initPhysics, type MatchResult } from '../src/engine/sim/index.ts';
import { GAMES, findGame } from '../src/games/index.ts';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

export interface SimSummary {
  game: string;
  matches: number;
  difficulty: Difficulty;
  stats: Record<string, { mean: number; sd: number; min: number; max: number }>;
  rpRates: Record<string, number>;
  targetMeans: Record<string, { auto: number; teleop: number }>;
  endgameMeans: Record<string, number>;
  wallMs: number;
}

const summarize = (xs: number[]) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, xs.length - 1));
  return { mean: +mean.toFixed(2), sd: +sd.toFixed(2), min: Math.min(...xs), max: Math.max(...xs) };
};

export async function runSims(
  gameId: string,
  matches: number,
  opts: { seed?: number; difficulty?: Difficulty; archetypes?: string[] } = {},
): Promise<{ summary: SimSummary; results: MatchResult[] }> {
  await initPhysics();
  const def = findGame(gameId);
  if (!def)
    throw new Error(`Unknown game '${gameId}'. Known: ${GAMES.map((g) => g.definition.id).join(', ')}`);
  const difficulty = opts.difficulty ?? 'normal';
  const results: MatchResult[] = [];
  const t0 = performance.now();
  for (let i = 0; i < matches; i++) {
    const archetypes: Record<number, string> = {};
    opts.archetypes?.forEach((a, k) => {
      archetypes[k] = a;
      archetypes[k + 3] = a;
    });
    const m = new Match(def, { seed: (opts.seed ?? 1) + i, archetypes });
    attachBots(m, { partners: difficulty, opponents: difficulty, playerId: null });
    results.push(m.runToEnd());
  }
  // Each alliance-match is one sample (both alliances play the same game).
  const sides = results.flatMap((r) => [r.blue, r.red]);
  const stats: SimSummary['stats'] = {
    total: summarize(sides.map((s) => s.score)),
    auto: summarize(sides.map((s) => s.breakdown.auto)),
    teleop: summarize(sides.map((s) => s.breakdown.teleop)),
    endgame: summarize(sides.map((s) => s.breakdown.endgame)),
    penalty: summarize(sides.map((s) => s.breakdown.penalty)),
    margin: summarize(results.map((r) => Math.abs(r.blue.score - r.red.score))),
  };
  const rpRates: Record<string, number> = {};
  for (const s of sides)
    for (const k of Object.keys(s.rpBreakdown)) rpRates[k] = (rpRates[k] ?? 0) + 1 / sides.length;
  const targetMeans: SimSummary['targetMeans'] = {};
  for (const s of sides) {
    for (const [id, c] of Object.entries(s.targetCounts)) {
      const base = id.replace(/\.(blue|red)$/, '');
      const t = (targetMeans[base] ??= { auto: 0, teleop: 0 });
      t.auto += c.auto / sides.length;
      t.teleop += c.teleop / sides.length;
    }
  }
  const endgameMeans: Record<string, number> = {};
  for (const s of sides)
    for (const [k, n] of Object.entries(s.endgame))
      endgameMeans[k] = (endgameMeans[k] ?? 0) + n / sides.length;
  return {
    summary: {
      game: gameId,
      matches,
      difficulty,
      stats,
      rpRates,
      targetMeans,
      endgameMeans,
      wallMs: Math.round(performance.now() - t0),
    },
    results,
  };
}

async function main() {
  const game = arg('game', GAMES[0]!.definition.id)!;
  const matches = Number(arg('matches', '10'));
  const { summary } = await runSims(game, matches, {
    seed: Number(arg('seed', '1')),
    difficulty: (arg('difficulty', 'normal') as Difficulty) ?? 'normal',
    ...(arg('archetypes') ? { archetypes: arg('archetypes')!.split(',') } : {}),
  });
  const json = arg('json');
  if (json) writeFileSync(json, JSON.stringify(summary, null, 2));
  console.log(`${summary.game}: ${summary.matches} matches (${summary.difficulty}) in ${summary.wallMs} ms`);
  console.table(summary.stats);
  console.log('Pieces scored per alliance per match (mean):');
  console.table(summary.targetMeans);
  console.log('Endgame actions per alliance per match (mean):', summary.endgameMeans);
  console.log('RP rates per alliance:', summary.rpRates);
}

if (import.meta.url === `file://${process.argv[1]}`) void main();

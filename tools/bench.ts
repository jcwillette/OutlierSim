/**
 * Speed benchmark with an exactness check: plays fixed seeds (bot vs bot, breakdowns on) and records
 * the time and a fingerprint of every match (full result, final robot and piece poses, ledger).
 * A speed-up must leave every fingerprint unchanged.
 *
 *   npm run bench                              (every registered game, 6 seeds each)
 *   npm run bench -- --game 2023-chargedup --matches 10 --json before.json
 *   npm run bench -- --compare before.json    (same seeds again; fails if any match differs)
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { attachBots } from '../src/engine/ai/bot.ts';
import { Match, initPhysics } from '../src/engine/sim/index.ts';
import { GAMES, findGame } from '../src/games/index.ts';
import { defaultLineup, resolveLineup } from '../src/ui/lineup.ts';
import { dealRng } from '../src/ui/montecarlo.ts';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export interface BenchRow {
  game: string;
  seed: number;
  ms: number;
  score: string;
  fingerprint: string;
}

export async function bench(gameIds: string[], matches: number): Promise<BenchRow[]> {
  await initPhysics();
  const rows: BenchRow[] = [];
  for (const id of gameIds) {
    const def = findGame(id);
    if (!def) throw new Error(`Unknown game '${id}'`);
    for (let seed = 1; seed <= matches; seed++) {
      const t0 = performance.now();
      const lineup = resolveLineup(def, defaultLineup(), null, dealRng(seed));
      const m = new Match(def, { seed, archetypes: lineup.archetypes, breakdowns: true });
      attachBots(m, {
        partners: 'normal',
        opponents: 'normal',
        playerId: null,
        roles: lineup.roles,
        strategies: lineup.strategies,
      });
      const r = m.runToEnd();
      const ms = performance.now() - t0;
      const state = JSON.stringify({
        r,
        robots: m.robots.map((x) => [x.body.translation(), x.body.rotation(), x.body.linvel()]),
        pieces: m.pieces.map((p) => [p.status, p.body.translation()]),
        ledger: m.ledger,
      });
      rows.push({
        game: id,
        seed,
        ms: +ms.toFixed(1),
        score: `${r.blue.score}-${r.red.score}`,
        fingerprint: createHash('sha256').update(state).digest('hex').slice(0, 16),
      });
    }
  }
  return rows;
}

async function main() {
  const compare = arg('compare');
  const before = compare ? (JSON.parse(readFileSync(compare, 'utf8')) as BenchRow[]) : null;
  const games = before
    ? [...new Set(before.map((r) => r.game))]
    : arg('game')
      ? [arg('game')!]
      : GAMES.map((g) => g.definition.id);
  const matches = before ? Math.max(...before.map((r) => r.seed)) : Number(arg('matches') ?? 6);
  const rows = await bench(games, matches);
  const json = arg('json');
  if (json) writeFileSync(json, JSON.stringify(rows, null, 1));
  const mean = (xs: BenchRow[]) => xs.reduce((a, r) => a + r.ms, 0) / xs.length;
  for (const g of games) {
    const rs = rows.filter((r) => r.game === g);
    const old = before?.filter((r) => r.game === g);
    console.log(
      `${g}: ${mean(rs).toFixed(0)} ms/match over ${rs.length}` +
        (old?.length ? ` (was ${mean(old).toFixed(0)}, ${(mean(old) / mean(rs)).toFixed(2)}x)` : ''),
    );
  }
  if (!before) return;
  const changed = rows.filter((r) => {
    const b = before.find((x) => x.game === r.game && x.seed === r.seed);
    return !b || b.fingerprint !== r.fingerprint;
  });
  if (changed.length) {
    for (const r of changed) console.log(`  CHANGED ${r.game} seed ${r.seed}: ${r.score}`);
    console.log(`${changed.length} of ${rows.length} matches changed`);
    process.exit(1);
  }
  console.log(`All ${rows.length} matches identical to ${compare}`);
}

if (import.meta.url === `file://${process.argv[1]}`) void main();

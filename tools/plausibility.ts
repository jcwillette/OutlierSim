/**
 * The skill's Step 4 in one command: is a game definition plausible, judged only against the
 * manual (ADR 0004, no real match data)?
 *
 *   npm run plausibility -- --game <id> [--matches 12] [--difficulties easy,normal,hard]
 *                          [--lineups all | id,id,...] [--workers N] [--md report.md]
 *
 * 1. `validateDefinition` and the bots' geometry audit (`auditDefinition`).
 * 2. A piece ceiling per alliance from the definition: pieces available (preload, staged, human
 *    player supply) against target capacity.
 * 3. Every lineup preset (or the default robot x3 if the game has none) against itself at each
 *    difficulty, bot vs bot with breakdowns on, in parallel worker threads. Both alliances play the
 *    same setup, so each match gives two samples and the blue / red split is a symmetry check.
 * 4. Checks: difficulty ordering, bonus-RP rates (stretch goals), pieces under the ceiling, targets
 *    and endgame actions the bots never use, robot types that never score, blue vs red.
 *
 * Prints markdown (the plausibility table in SOURCES.md has the same columns) and exits non-zero if
 * validation or the audit found errors.
 */
import { writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { auditDefinition } from '../src/engine/ai/audit.ts';
import { attachBots, type Difficulty } from '../src/engine/ai/bot.ts';
import { Match, initPhysics, validateDefinition, type MatchResult } from '../src/engine/sim/index.ts';
import type { AllianceStrategy, GameDefinition, RobotRole } from '../src/engine/sim/types.ts';
import { GAMES, findGame } from '../src/games/index.ts';

interface Lineup {
  id: string;
  name: string;
  archetypes: [string, string, string];
  roles: Array<RobotRole | undefined>;
  strategy: AllianceStrategy;
}

interface Job {
  gameId: string;
  lineup: Lineup;
  difficulty: Difficulty;
  seeds: number[];
}

/** What one match contributes (both alliances played the same lineup). */
interface Sample {
  lineup: string;
  difficulty: Difficulty;
  seed: number;
  sides: Array<{
    alliance: 'blue' | 'red';
    score: number;
    auto: number;
    teleop: number;
    endgame: number;
    /** Foul points this alliance was awarded (the opponents' fouls). */
    fouls: number;
    pieces: number;
    bonuses: string[];
    won: boolean;
    targets: Record<string, number>;
    endgameActions: Record<string, number>;
  }>;
  robots: Array<{ archetype: string; points: number; brokeDown: boolean; mechFailed: boolean }>;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

/** The lineups to play: the game's presets, or its default robot three times. */
export function lineupsFor(def: GameDefinition, ids?: string[]): Lineup[] {
  const presets = (def.lineups ?? []).map((l): Lineup => ({
    id: l.id,
    name: l.name,
    archetypes: l.robots.map((r) => r.archetype) as Lineup['archetypes'],
    roles: l.robots.map((r) => r.role),
    strategy: l.strategy ?? 'balanced',
  }));
  const all = presets.length
    ? presets
    : [
        {
          id: 'default',
          name: `${def.defaultArchetype} x3`,
          archetypes: [
            def.defaultArchetype,
            def.defaultArchetype,
            def.defaultArchetype,
          ] as Lineup['archetypes'],
          roles: [],
          strategy: 'balanced' as const,
        },
      ];
  if (!ids) return all;
  return ids.map((id) => {
    const l = all.find((x) => x.id === id);
    if (!l) throw new Error(`Unknown lineup '${id}'. Known: ${all.map((x) => x.id).join(', ')}`);
    return l;
  });
}

function summarizeMatch(job: Job, seed: number, m: Match, r: MatchResult): Sample {
  const base = (id: string) => id.replace(/\.(blue|red)$/, '');
  return {
    lineup: job.lineup.id,
    difficulty: job.difficulty,
    seed,
    sides: (['blue', 'red'] as const).map((a) => {
      const s = r[a];
      const targets: Record<string, number> = {};
      for (const [id, c] of Object.entries(s.targetCounts)) {
        const n = c.auto + c.teleop;
        if (n) targets[base(id)] = (targets[base(id)] ?? 0) + n;
      }
      return {
        alliance: a,
        score: s.score,
        auto: s.breakdown.auto,
        teleop: s.breakdown.teleop,
        endgame: s.breakdown.endgame,
        fouls: s.breakdown.penalty,
        pieces: r.robots.filter((x) => x.alliance === a).reduce((t, x) => t + x.piecesScored, 0),
        bonuses: Object.keys(s.rpBreakdown).filter((k) => k !== 'win' && k !== 'tie'),
        won: s.won,
        targets,
        endgameActions: { ...s.endgame },
      };
    }),
    robots: r.robots.map((x) => ({
      archetype: x.archetype,
      points: x.points,
      brokeDown: x.brokeDownAt !== null,
      mechFailed: x.mechFailedAt !== null,
    })),
  };
}

async function runJob(job: Job): Promise<Sample[]> {
  await initPhysics();
  const def = findGame(job.gameId)!;
  const out: Sample[] = [];
  for (const seed of job.seeds) {
    const archetypes: Record<number, string> = {};
    const roles: Record<number, RobotRole> = {};
    job.lineup.archetypes.forEach((a, k) => {
      archetypes[k] = a;
      archetypes[k + 3] = a;
      const role = job.lineup.roles[k];
      if (role) roles[k] = roles[k + 3] = role;
    });
    const m = new Match(def, { seed, archetypes, breakdowns: true });
    attachBots(m, {
      partners: job.difficulty,
      opponents: job.difficulty,
      playerId: null,
      roles,
      strategies: { blue: job.lineup.strategy, red: job.lineup.strategy },
    });
    out.push(summarizeMatch(job, seed, m, m.runToEnd()));
  }
  return out;
}

// ------------------------------------------------------------------ worker

/** Set in `workerData` by `main`, so only this tool's own workers run jobs (not test runners). */
const WORKER_MARK = 'outliersim-plausibility';

if (!isMainThread && (workerData as { mark?: string } | null)?.mark === WORKER_MARK) {
  const { job } = workerData as { job: Job };
  void runJob(job).then((samples) => parentPort!.postMessage(samples));
}

// ------------------------------------------------------------------ report

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const f0 = (x: number) => x.toFixed(0);
const f1 = (x: number) => x.toFixed(1);

/** Pieces an alliance could possibly score, from the definition (Infinity when unbounded). */
export function pieceCeiling(def: GameDefinition): { available: number; capacity: number; note: string } {
  const perRobot = Math.max(
    ...def.archetypes.map((a) => {
      let n = 0;
      let room = a.totalCapacity ?? Object.values(a.capacity).reduce((x, y) => x + y, 0);
      for (const [type, count] of Object.entries(def.preload)) {
        const k = Math.min(count, a.capacity[type] ?? 0, room);
        n += k;
        room -= k;
      }
      return n;
    }),
    0,
  );
  let staged = 0;
  for (const s of def.staging) staged += s.positions.length * (s.side === 'neutral' ? 0.5 : 1);
  const supply = def.stations.reduce((t, st) => t + (st.supply ?? Infinity), 0);
  const recycles = def.targets.some((t) => t.afterScore?.kind === 'recycle');
  const available = recycles ? Infinity : 3 * perRobot + staged + supply;
  const capacity = def.targets.reduce(
    (t, x) => t + (x.side === 'neutral' ? 0.5 : 1) * (x.capacity ?? Infinity),
    0,
  );
  const note = recycles
    ? 'scored pieces recycle, so pieces are unbounded'
    : `${3 * perRobot} preloaded + ${staged} staged (half the neutral ones) + ${Number.isFinite(supply) ? supply : 'unlimited'} from human players`;
  return { available, capacity, note };
}

function report(
  def: GameDefinition,
  lineups: Lineup[],
  difficulties: Difficulty[],
  samples: Sample[],
): string {
  const lines: string[] = [];
  const out = (s = '') => lines.push(s);
  const bonusIds = def.rankingPoints.bonuses.map((b) => b.id);
  const bonusName = (id: string) => def.rankingPoints.bonuses.find((b) => b.id === id)?.name ?? id;
  const sides = (xs: Sample[]) => xs.flatMap((s) => s.sides);
  const checks: Array<[boolean, string]> = [];

  out(`## Plausibility: ${def.name} (${def.id})`);
  out();
  out(
    `${samples.length} matches: each lineup against itself, ${difficulties.join(' / ')} bots, breakdowns on. Means per alliance per match.`,
  );
  out();
  const head = ['Lineup', 'Difficulty', 'Total', 'Auto', 'Teleop', 'Endgame', 'Fouls drawn', 'Pieces'];
  for (const b of bonusIds) head.push(`${b} RP`);
  head.push('Broke down', 'Mech failed');
  out(`| ${head.join(' | ')} |`);
  out(`| ${head.map(() => '---').join(' | ')} |`);
  const byCell = new Map<string, Sample[]>();
  for (const s of samples) {
    const k = `${s.lineup}|${s.difficulty}`;
    if (!byCell.has(k)) byCell.set(k, []);
    byCell.get(k)!.push(s);
  }
  const total = (l: Lineup, d: Difficulty) =>
    mean(sides(byCell.get(`${l.id}|${d}`) ?? []).map((x) => x.score));
  for (const l of lineups)
    for (const d of difficulties) {
      const cell = byCell.get(`${l.id}|${d}`) ?? [];
      const ss = sides(cell);
      const robots = cell.flatMap((c) => c.robots);
      const row = [
        l.name,
        d,
        f0(mean(ss.map((x) => x.score))),
        f0(mean(ss.map((x) => x.auto))),
        f0(mean(ss.map((x) => x.teleop))),
        f0(mean(ss.map((x) => x.endgame))),
        f0(mean(ss.map((x) => x.fouls))),
        f1(mean(ss.map((x) => x.pieces))),
      ];
      for (const b of bonusIds) row.push(pct(mean(ss.map((x) => (x.bonuses.includes(b) ? 1 : 0)))));
      row.push(
        pct(mean(robots.map((x) => (x.brokeDown ? 1 : 0)))),
        pct(mean(robots.map((x) => (x.mechFailed ? 1 : 0)))),
      );
      out(`| ${row.join(' | ')} |`);
    }
  out();

  // Difficulty ordering.
  if (difficulties.length > 1)
    for (const l of lineups) {
      const scores = difficulties.map((d) => total(l, d));
      const ordered = scores.every((s, i) => i === 0 || s > scores[i - 1]!);
      checks.push([
        ordered,
        `Difficulty ordering for ${l.name}: ${difficulties.map((d, i) => `${d} ${f0(scores[i]!)}`).join(' < ')}`,
      ]);
    }

  // Bonus RPs as stretch goals (normal bots, best lineup).
  const ref = difficulties.includes('normal') ? 'normal' : difficulties[0]!;
  for (const b of bonusIds) {
    const rates = lineups.map((l) =>
      mean(sides(byCell.get(`${l.id}|${ref}`) ?? []).map((x) => (x.bonuses.includes(b) ? 1 : 0))),
    );
    const best = Math.max(...rates);
    checks.push([
      best <= 0.8,
      `${bonusName(b)}: up to ${pct(best)} of alliances at ${ref} (bonus RPs are stretch goals; most matches reaching one suggests robots that are too strong or a misread threshold)`,
    ]);
  }

  // Piece ceiling.
  const ceiling = pieceCeiling(def);
  const most = Math.max(...sides(samples).map((x) => x.pieces));
  const cap = Math.min(ceiling.available, ceiling.capacity);
  checks.push([
    most > 0 && most < cap,
    `Pieces: at most ${most} by one alliance in one match; ceiling ${Number.isFinite(cap) ? f0(cap) : 'none'} (available ${Number.isFinite(ceiling.available) ? f0(ceiling.available) : 'unbounded'}: ${ceiling.note}; target capacity ${Number.isFinite(ceiling.capacity) ? f0(ceiling.capacity) : 'unbounded'})`,
  ]);

  // Targets and endgame actions nobody used.
  const used = new Set(sides(samples).flatMap((x) => Object.keys(x.targets)));
  const unused = def.targets
    .map((t) => t.id)
    .filter((id) => !used.has(id) && def.botHints?.targetWeights?.[id] !== 0);
  checks.push([
    unused.length === 0,
    unused.length
      ? `Targets the bots never scored in: ${unused.join(', ')} (unreachable, an impossible shot, or never worth it)`
      : 'Every target was scored in',
  ]);
  const doneEg = new Set(sides(samples).flatMap((x) => Object.keys(x.endgameActions)));
  const canEg = def.endgame.filter((a) => def.archetypes.some((x) => x.endgame?.[a.id] !== undefined));
  const neverEg = canEg.filter((a) => !doneEg.has(a.id)).map((a) => a.id);
  checks.push([
    neverEg.length === 0,
    neverEg.length
      ? `Endgame actions never completed: ${neverEg.join(', ')}`
      : 'Every endgame action was completed',
  ]);

  // Robot types that never score.
  const played = new Map<string, number[]>();
  for (const s of samples)
    for (const r of s.robots) {
      if (!played.has(r.archetype)) played.set(r.archetype, []);
      played.get(r.archetype)!.push(r.points);
    }
  out('Points per robot per match, by robot type:');
  out();
  out('| Robot | Matches | Points |');
  out('| --- | --- | --- |');
  for (const [a, pts] of played) out(`| ${a} | ${pts.length} | ${f1(mean(pts))} |`);
  out();
  const idle = [...played].filter(([, pts]) => mean(pts) <= 0).map(([a]) => a);
  checks.push([
    idle.length === 0,
    idle.length ? `Robot types that never scored: ${idle.join(', ')}` : 'Every robot type scored',
  ]);

  // Blue vs red (identical setups): wins and score.
  const blue = samples.map((s) => s.sides[0]!);
  const red = samples.map((s) => s.sides[1]!);
  const bw = blue.filter((x) => x.won).length;
  const rw = red.filter((x) => x.won).length;
  const n = samples.length;
  // Wins of one side in n decided-or-tied matches: flag when outside ~3 standard errors of even.
  const decided = bw + rw;
  const z = decided ? Math.abs(bw - rw) / Math.sqrt(decided) : 0;
  checks.push([
    z < 3,
    `Blue vs red with identical setups: wins ${bw} : ${rw} of ${n} (z ${z.toFixed(1)}), score ${f1(mean(blue.map((x) => x.score)))} : ${f1(mean(red.map((x) => x.score)))}`,
  ]);

  out('Checks:');
  out();
  for (const [ok, text] of checks) out(`- ${ok ? 'PASS' : 'WARN'} ${text}`);
  out();
  out(
    'Also do by hand: cycle math per robot type (travel ÷ speed + intake + score action) against the pieces each scores, and the visual check against the field drawings and reveal video.',
  );
  return lines.join('\n');
}

async function main() {
  const gameId = arg('game') ?? GAMES[0]!.definition.id;
  const def = findGame(gameId);
  if (!def)
    throw new Error(`Unknown game '${gameId}'. Known: ${GAMES.map((g) => g.definition.id).join(', ')}`);
  const matches = Number(arg('matches') ?? 12);
  const difficulties = (arg('difficulties')?.split(',') ?? DIFFICULTIES) as Difficulty[];
  const which = arg('lineups');
  const lineups = lineupsFor(def, which && which !== 'all' ? which.split(',') : undefined);
  const workers = Math.max(1, Number(arg('workers') ?? Math.min(16, availableParallelism())));

  const text: string[] = [];
  const issues = validateDefinition(def);
  const audit = auditDefinition(def);
  const bad = [...issues, ...audit].filter((i) => i.level === 'error').length;
  text.push(`## Static checks: ${def.id}`, '');
  text.push(
    `- validateDefinition: ${issues.filter((i) => i.level === 'error').length} errors, ${issues.filter((i) => i.level === 'warning').length} warnings`,
  );
  for (const i of issues) text.push(`  - ${i.level} ${i.path}: ${i.message}`);
  text.push(
    `- auditDefinition (can the bots use every target, station, endgame zone and staged piece?): ${audit.filter((i) => i.level === 'error').length} errors, ${audit.filter((i) => i.level === 'warning').length} warnings`,
  );
  for (const i of audit) text.push(`  - ${i.level} ${i.subject}: ${i.message}`);
  text.push('');
  console.log(text.join('\n'));
  if (bad) {
    console.log('Fix the errors above first.');
    process.exit(1);
  }

  // One job per (lineup, difficulty), split into chunks so all workers stay busy. Each cell gets
  // its own seeds (cell k plays seeds 1000k + 1...), so the cells' luck (breakdowns, lapses) is
  // independent; within a cell consecutive seeds alternate the physics frame (ADR 0007).
  const jobs: Job[] = [];
  const chunk = Math.max(1, Math.ceil((lineups.length * difficulties.length * matches) / (workers * 3)));
  let cell = 0;
  for (const lineup of lineups)
    for (const difficulty of difficulties) {
      const first = 1000 * cell++ + 1;
      for (let s = 0; s < matches; s += chunk)
        jobs.push({
          gameId,
          lineup,
          difficulty,
          seeds: Array.from({ length: Math.min(chunk, matches - s) }, (_, k) => first + s + k),
        });
    }
  const t0 = performance.now();
  const samples: Sample[] = [];
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(workers, jobs.length) }, async () => {
      while (next < jobs.length) {
        const job = jobs[next++]!;
        const got = await new Promise<Sample[]>((resolve, reject) => {
          const w = new Worker(new URL(import.meta.url), { workerData: { mark: WORKER_MARK, job } });
          w.once('message', (m: Sample[]) => {
            resolve(m);
            void w.terminate();
          });
          w.once('error', reject);
        });
        samples.push(...got);
        done += job.seeds.length;
        process.stderr.write(`\r${done} / ${lineups.length * difficulties.length * matches} matches`);
      }
    }),
  );
  process.stderr.write(`\r${samples.length} matches in ${((performance.now() - t0) / 1000).toFixed(0)} s\n`);
  samples.sort(
    (a, b) => a.lineup.localeCompare(b.lineup) || a.difficulty.localeCompare(b.difficulty) || a.seed - b.seed,
  );
  const md = report(def, lineups, difficulties, samples);
  console.log(md);
  const file = arg('md');
  if (file) writeFileSync(file, `${text.join('\n')}\n${md}\n`);
}

if (isMainThread && import.meta.url === `file://${process.argv[1]}`) void main();

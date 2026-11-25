/**
 * Alliance composition search with the spectator menu's Monte Carlo match-ups (`ui/montecarlo.ts`,
 * ADR 0005): every candidate alliance plays the same seeds against each opponent field, bot vs bot,
 * headless, in worker threads. Robot types are used as the game defines them (no tuning).
 *
 *   npm run alliances -- --game 2024-crescendo --candidates all --vs random,powerhouse --matches 200
 *       [--difficulty normal] [--perfect] [--seed 1] [--workers N] [--json out.json] [--md out.md]
 *       [--sort rp|win|margin] [--top 20]
 *
 * --candidates: 'all' (every multiset of three robot types, default roles, balanced), a game
 *   lineup preset id, or an alliance spec; several separated by ';'. A spec is three slots
 *   `type[:role]` joined by ',' with an optional `@strategy`, e.g.
 *   `allround,allround:amp,allround@max-cycles`. Prefix a file path with '@' to read one spec per
 *   line ('#' comments).
 * --vs: opponent fields, separated by ';' (or ',' when none is a spec): 'random' (the menu's
 *   random preset: three different robot types dealt per match), a lineup preset id, or a spec.
 *
 * Common random numbers: candidate k and seed s see the same opponent deal and the same match
 * seed, so differences between candidates are paired. The candidate plays blue on seeds with
 * bit 1 clear and red otherwise, so it meets both physics frames on both sides (ADR 0007).
 *
 * Reports per candidate and field: win share (ties count half, 95 % Wilson interval), mean score
 * and margin (± standard error), qualification RP per match and bonus-RP rates, and the mean
 * auto / teleop / endgame / foul points.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import type { Difficulty } from '../src/engine/ai/bot.ts';
import { initPhysics } from '../src/engine/sim/index.ts';
import type { Alliance, AllianceStrategy, GameDefinition, RobotRole } from '../src/engine/sim/types.ts';
import { GAMES, findGame } from '../src/games/index.ts';
import { STRATEGIES, applyPreset, type AllianceChoice, type LineupChoice } from '../src/ui/lineup.ts';
import { runMatchup, wilson, type MatchupSample, type MonteCarloSpec } from '../src/ui/montecarlo.ts';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

/** One alliance setup: a label and the menu's `AllianceChoice`. */
export interface Setup {
  label: string;
  choice: AllianceChoice;
}

/** Parse `type[:role],type[:role],type[:role][@strategy]`, a preset id or 'random'. */
export function parseSetup(def: GameDefinition, text: string): Setup {
  const t = text.trim();
  if (t === 'random') return { label: 'random', choice: applyPreset(def, 'random') };
  const preset = def.lineups?.find((l) => l.id === t);
  if (preset) return { label: preset.id, choice: applyPreset(def, preset.id) };
  const [slotsText, strategyText] = t.split('@') as [string, string | undefined];
  const strategy = (strategyText ?? 'balanced') as AllianceStrategy;
  if (!STRATEGIES.some(([s]) => s === strategy)) throw new Error(`Unknown strategy '${strategy}' in '${t}'`);
  const ids = new Set(def.archetypes.map((a) => a.id));
  const slots = slotsText.split(',').map((s) => {
    const [archetype, role = 'auto'] = s.trim().split(':') as [string, string | undefined];
    if (archetype !== 'random' && !ids.has(archetype))
      throw new Error(`Unknown robot type '${archetype}' in '${t}'. Known: ${[...ids].join(', ')}`);
    const roles = ['auto', 'score', 'defense', ...(def.roles ?? []).map((r) => r.id)];
    if (!roles.includes(role))
      throw new Error(`Unknown role '${role}' in '${t}'. Known: ${roles.join(', ')}`);
    return { archetype, role: role as RobotRole | 'auto' };
  });
  if (slots.length !== 3) throw new Error(`An alliance has three robots: '${t}'`);
  return { label: t, choice: { preset: 'custom', strategy, slots: slots as AllianceChoice['slots'] } };
}

/** Every multiset of three robot types (default roles, balanced): 84 for seven types. */
export function allCompositions(def: GameDefinition): string[] {
  const ids = def.archetypes.map((a) => a.id);
  const out: string[] = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i; j < ids.length; j++)
      for (let k = j; k < ids.length; k++) out.push(`${ids[i]},${ids[j]},${ids[k]}`);
  return out;
}

function candidateTexts(def: GameDefinition, text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(';').map((s) => s.trim())) {
    if (!part) continue;
    if (part === 'all') out.push(...allCompositions(def));
    else if (part.startsWith('@'))
      out.push(
        ...readFileSync(part.slice(1), 'utf8')
          .split('\n')
          .map((l) => l.replace(/#.*/, '').trim())
          .filter(Boolean),
      );
    else out.push(part);
  }
  return out;
}

/** The candidate's side for a seed: blue when bit 1 is clear (both physics frames on both sides). */
export const candidateSide = (seed: number): Alliance => ((seed >> 1) & 1 ? 'red' : 'blue');

/** What one match tells about the candidate, from its side. */
export interface Outcome {
  seed: number;
  score: number;
  opp: number;
  /** 1 win, 0.5 tie, 0 loss. */
  win: number;
  rp: number;
  bonuses: string[];
  auto: number;
  teleop: number;
  endgame: number;
  /** Foul points awarded to the candidate / to the opponent. */
  fouls: number;
  oppFouls: number;
  /** Opponent robot types (random fields differ per seed). */
  oppTypes: string[];
}

export function outcome(sample: MatchupSample, side: Alliance): Outcome {
  const opp: Alliance = side === 'blue' ? 'red' : 'blue';
  const b = sample.breakdown[side];
  return {
    seed: sample.seed,
    score: sample.score[side],
    opp: sample.score[opp],
    win: sample.winner === side ? 1 : sample.winner === 'tie' ? 0.5 : 0,
    rp: sample.rp[side],
    bonuses: sample.bonuses[side],
    auto: b.auto,
    teleop: b.teleop,
    endgame: b.endgame,
    fouls: b.penalty,
    oppFouls: sample.breakdown[opp].penalty,
    oppTypes: sample.archetypes.slice(opp === 'blue' ? 0 : 3, opp === 'blue' ? 3 : 6),
  };
}

interface Job {
  gameId: string;
  candidate: Setup;
  field: Setup;
  difficulty: Difficulty;
  breakdowns: boolean;
  seeds: number[];
}

interface JobResult {
  candidate: string;
  field: string;
  outcomes: Outcome[];
}

function specFor(job: Job, side: Alliance): MonteCarloSpec {
  const lineup: LineupChoice =
    side === 'blue'
      ? { blue: job.candidate.choice, red: job.field.choice }
      : { blue: job.field.choice, red: job.candidate.choice };
  return {
    gameId: job.gameId,
    lineup,
    difficulty: { blue: job.difficulty, red: job.difficulty },
    breakdowns: job.breakdowns,
  };
}

function runJob(job: Job): JobResult {
  const def = findGame(job.gameId)!;
  const outcomes = job.seeds.map((seed) => {
    const side = candidateSide(seed);
    return outcome(runMatchup(def, specFor(job, side), seed), side);
  });
  return { candidate: job.candidate.label, field: job.field.label, outcomes };
}

// ------------------------------------------------------------------ worker

/** Set in `workerData` by `main`, so only this tool's own workers run jobs (not test runners). */
const WORKER_MARK = 'outliersim-alliances';

if (!isMainThread && (workerData as { mark?: string } | null)?.mark === WORKER_MARK) {
  void initPhysics().then(() => {
    parentPort!.on('message', (job: Job | null) => {
      if (!job) process.exit(0);
      parentPort!.postMessage(runJob(job));
    });
    parentPort!.postMessage('ready');
  });
}

// ------------------------------------------------------------------ report

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const se = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1) / xs.length);
};

export interface Row {
  candidate: string;
  field: string;
  n: number;
  win: number;
  winCI: [number, number];
  score: number;
  opp: number;
  margin: number;
  marginSE: number;
  rp: number;
  rpSE: number;
  bonusRates: Record<string, number>;
  auto: number;
  teleop: number;
  endgame: number;
  fouls: number;
  oppFouls: number;
}

export function rowFor(candidate: string, field: string, os: Outcome[]): Row {
  const wins = os.reduce((t, o) => t + o.win, 0);
  const bonusRates: Record<string, number> = {};
  for (const o of os) for (const b of o.bonuses) bonusRates[b] = (bonusRates[b] ?? 0) + 1 / os.length;
  return {
    candidate,
    field,
    n: os.length,
    win: wins / os.length,
    winCI: wilson(wins, os.length),
    score: mean(os.map((o) => o.score)),
    opp: mean(os.map((o) => o.opp)),
    margin: mean(os.map((o) => o.score - o.opp)),
    marginSE: se(os.map((o) => o.score - o.opp)),
    rp: mean(os.map((o) => o.rp)),
    rpSE: se(os.map((o) => o.rp)),
    bonusRates,
    auto: mean(os.map((o) => o.auto)),
    teleop: mean(os.map((o) => o.teleop)),
    endgame: mean(os.map((o) => o.endgame)),
    fouls: mean(os.map((o) => o.fouls)),
    oppFouls: mean(os.map((o) => o.oppFouls)),
  };
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const f1 = (x: number) => x.toFixed(1);

function table(def: GameDefinition, rows: Row[], field: string): string {
  const bonusIds = def.rankingPoints.bonuses.map((b) => b.id);
  const lines = [
    `### Against ${field}`,
    '',
    `| # | Alliance | Win | 95% CI | Score | Opp. | Margin ± SE | RP | ${bonusIds.join(' | ')} | Auto | Teleop | Endgame | Fouls for / against |`,
    `| --- | --- | --- | --- | --- | --- | --- | --- | ${bonusIds.map(() => '---').join(' | ')} | --- | --- | --- | --- |`,
  ];
  rows.forEach((r, i) =>
    lines.push(
      `| ${i + 1} | ${r.candidate} | ${pct(r.win)} | ${pct(r.winCI[0])}-${pct(r.winCI[1])} | ${f1(r.score)} | ${f1(r.opp)} | ${f1(r.margin)} ± ${f1(r.marginSE)} | ${r.rp.toFixed(2)} | ${bonusIds.map((b) => pct(r.bonusRates[b] ?? 0)).join(' | ')} | ${f1(r.auto)} | ${f1(r.teleop)} | ${f1(r.endgame)} | ${f1(r.fouls)} / ${f1(r.oppFouls)} |`,
    ),
  );
  return lines.join('\n');
}

async function main(): Promise<void> {
  await initPhysics();
  const gameId = arg('game', '2024-crescendo')!;
  const def = findGame(gameId);
  if (!def)
    throw new Error(`Unknown game '${gameId}'. Known: ${GAMES.map((g) => g.definition.id).join(', ')}`);
  const matches = Number(arg('matches') ?? 100);
  const first = Number(arg('seed') ?? 1);
  const difficulty = (arg('difficulty') ?? 'normal') as Difficulty;
  const breakdowns = !process.argv.includes('--perfect');
  const sortBy = arg('sort') ?? 'rp';
  const top = Number(arg('top') ?? Infinity);
  const candidates = candidateTexts(def, arg('candidates') ?? 'all').map((t) => parseSetup(def, t));
  // Fields separated by ';', or by ',' when every one is 'random' or a preset id.
  const vsText = arg('vs') ?? 'random';
  const named = (x: string) => x === 'random' || !!def.lineups?.some((l) => l.id === x);
  const fieldTexts = vsText.includes(';')
    ? vsText.split(';')
    : vsText.split(',').every(named)
      ? vsText.split(',')
      : [vsText];
  const fields = fieldTexts.filter((t) => t.trim()).map((t) => parseSetup(def, t));
  const workers = Math.max(1, Number(arg('workers') ?? Math.min(16, availableParallelism())));
  const seeds = Array.from({ length: matches }, (_, k) => first + k);

  // Jobs of ~10 matches so every worker stays busy to the end.
  const chunk = Math.max(
    1,
    Math.min(10, Math.ceil((candidates.length * fields.length * matches) / (workers * 4))),
  );
  const jobs: Job[] = [];
  for (const candidate of candidates)
    for (const field of fields)
      for (let s = 0; s < seeds.length; s += chunk)
        jobs.push({ gameId, candidate, field, difficulty, breakdowns, seeds: seeds.slice(s, s + chunk) });

  const total = candidates.length * fields.length * matches;
  const t0 = performance.now();
  const results = new Map<string, Outcome[]>();
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(workers, jobs.length) }, async () => {
      const w = new Worker(new URL(import.meta.url), { workerData: { mark: WORKER_MARK } });
      // One error listener for the worker's life; each reply settles the job waiting on it.
      let waiting: { resolve: (r: JobResult) => void; reject: (e: unknown) => void } | null = null;
      let failed: unknown = null;
      w.on('error', (e) => {
        failed = e;
        waiting?.reject(e);
      });
      await new Promise<void>((resolve, reject) => {
        w.once('message', () => resolve());
        w.once('error', reject);
      });
      while (next < jobs.length) {
        if (failed) throw failed;
        const job = jobs[next++]!;
        const got = await new Promise<JobResult>((resolve, reject) => {
          waiting = { resolve, reject };
          w.once('message', resolve);
          w.postMessage(job);
        });
        const key = `${got.candidate}\u0000${got.field}`;
        if (!results.has(key)) results.set(key, []);
        results.get(key)!.push(...got.outcomes);
        done += job.seeds.length;
        const secs = (performance.now() - t0) / 1000;
        process.stderr.write(
          `\r${done} / ${total} matches, ${secs.toFixed(0)} s, ~${(((total - done) * secs) / done / 60).toFixed(1)} min left   `,
        );
      }
      w.postMessage(null);
    }),
  );
  const secs = (performance.now() - t0) / 1000;
  process.stderr.write(
    `\r${total} matches in ${secs.toFixed(0)} s (${((secs * workers * 1000) / total).toFixed(0)} ms per match per worker)\n`,
  );

  const key = (r: Row) => (sortBy === 'win' ? r.win : sortBy === 'margin' ? r.margin : r.rp + r.margin / 1e4);
  const out: string[] = [
    `## Alliance search: ${def.id}`,
    '',
    `${matches} matches per alliance and field (seeds ${first}-${first + matches - 1}, the same for every alliance), ${difficulty}, breakdowns ${breakdowns ? 'on' : 'off'}. Sorted by ${sortBy}.`,
    '',
  ];
  const json: Record<string, { rows: Row[]; outcomes: Record<string, Outcome[]> }> = {};
  for (const field of fields) {
    const rows = candidates
      .map((c) => {
        const os = (results.get(`${c.label}\u0000${field.label}`) ?? []).sort((a, b) => a.seed - b.seed);
        return rowFor(c.label, field.label, os);
      })
      .sort((a, b) => key(b) - key(a));
    out.push(table(def, rows.slice(0, top), field.label), '');
    json[field.label] = {
      rows,
      outcomes: Object.fromEntries(
        candidates.map((c) => [c.label, results.get(`${c.label}\u0000${field.label}`) ?? []]),
      ),
    };
  }
  const md = out.join('\n');
  console.log(md);
  const mdFile = arg('md');
  if (mdFile) writeFileSync(mdFile, `${md}\n`);
  const jsonFile = arg('json');
  if (jsonFile)
    writeFileSync(
      jsonFile,
      JSON.stringify({ game: def.id, matches, first, difficulty, breakdowns, fields: json }),
    );
}

if (isMainThread && import.meta.url === `file://${process.argv[1]}`) void main();

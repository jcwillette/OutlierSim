import { beforeAll, describe, expect, it } from 'vitest';
import { attachBots } from '../src/engine/ai/bot.ts';
import { Match, initPhysics } from '../src/engine/sim/index.ts';
import { findGame } from '../src/games/index.ts';
import { defaultLineup, resolveLineup } from '../src/ui/lineup.ts';
import {
  dealRng,
  pickReplays,
  runMatchup,
  specKey,
  summarize,
  wilson,
  type MatchupSample,
  type MonteCarloSpec,
} from '../src/ui/montecarlo.ts';
import {
  MonteCarloRun,
  type WorkerLike,
  type WorkerReply,
  type WorkerRequest,
} from '../src/ui/montecarloPool.ts';

beforeAll(async () => {
  await initPhysics();
});

const ref = findGame('0000-reference')!;
const spec = (over: Partial<MonteCarloSpec> = {}): MonteCarloSpec => ({
  gameId: ref.id,
  lineup: defaultLineup(),
  difficulty: { blue: 'normal', red: 'normal' },
  breakdowns: true,
  ...over,
});

const sample = (seed: number, blue: number, red: number, bonuses: string[] = []): MatchupSample => ({
  seed,
  score: { blue, red },
  winner: blue > red ? 'blue' : red > blue ? 'red' : 'tie',
  rp: { blue: blue > red ? 2 : blue === red ? 1 : 0, red: red > blue ? 2 : blue === red ? 1 : 0 },
  bonuses: { blue: bonuses, red: [] },
  archetypes: [],
  breakdown: {
    blue: { auto: 0, teleop: blue, endgame: 0, penalty: 0 },
    red: { auto: 0, teleop: red, endgame: 0, penalty: 0 },
  },
});

describe('wilson interval', () => {
  it('brackets the observed rate and narrows with more trials', () => {
    const [lo, hi] = wilson(60, 100);
    expect(lo).toBeLessThan(0.6);
    expect(hi).toBeGreaterThan(0.6);
    expect(lo).toBeCloseTo(0.502, 2);
    expect(hi).toBeCloseTo(0.691, 2);
    const [lo2, hi2] = wilson(600, 1000);
    expect(hi2 - lo2).toBeLessThan(hi - lo);
  });
  it('stays inside [0, 1] at the extremes', () => {
    expect(wilson(0, 10)[0]).toBe(0);
    expect(wilson(10, 10)[1]).toBe(1);
    expect(wilson(0, 0)).toEqual([0, 1]);
  });
});

describe('summarize', () => {
  const samples = [
    sample(1, 50, 40, ['bonusA']),
    sample(2, 30, 45),
    sample(3, 60, 20, ['bonusA']),
    sample(4, 35, 35),
  ];
  const s = summarize(samples);
  it('counts wins, ties and rates', () => {
    expect(s.n).toBe(4);
    expect(s.blue.wins).toBe(2);
    expect(s.red.wins).toBe(1);
    expect(s.ties).toBe(1);
    expect(s.blue.winRate).toBe(0.5);
    expect(s.blue.bonusRates.bonusA).toBeCloseTo(0.5);
    expect(s.blue.rp).toBeCloseTo((2 + 0 + 2 + 1) / 4);
  });
  it('computes score and margin stats', () => {
    expect(s.blue.score.mean).toBeCloseTo(43.75);
    expect(s.margin.mean).toBeCloseTo((10 - 15 + 40 + 0) / 4);
    expect(s.margin.median).toBeCloseTo(5);
  });
  it('bins every margin into a histogram centered on zero', () => {
    const { start, width, bins } = s.histogram;
    expect(bins.reduce((a, b) => a + b, 0)).toBe(4);
    // One bin is centered on 0 and holds the tie.
    const zero = Math.floor((0 - start) / width);
    expect(start + zero * width + width / 2).toBeCloseTo(0);
    expect(bins[zero]).toBeGreaterThanOrEqual(1);
    expect(start + bins.length * width).toBeGreaterThan(40);
    expect(start).toBeLessThan(-15);
  });
  it('picks a typical match-up and the biggest upset', () => {
    const r = pickReplays(samples);
    expect(r.upset?.seed).toBe(2); // red won less often; its only win
    expect(r.typical).toBeDefined();
    expect(pickReplays([sample(1, 10, 5), sample(2, 5, 10)]).upset).toBeUndefined();
  });
});

describe('runMatchup', () => {
  it('is deterministic per seed and deals random slots from the seed', () => {
    const sp = spec();
    const a = runMatchup(ref, sp, 7);
    const b = runMatchup(ref, sp, 7);
    expect(b).toEqual(a);
    expect(a.archetypes).toEqual(Object.values(resolveLineup(ref, sp.lineup, null, dealRng(7)).archetypes));
    expect(a.score.blue + a.score.red).toBeGreaterThan(0);
  });

  it('replays the same result when driven frame by frame like spectator mode', () => {
    const sp = spec();
    const s = runMatchup(ref, sp, 11);
    const lineup = resolveLineup(ref, sp.lineup, null, dealRng(11));
    const m = new Match(ref, { seed: 11, archetypes: lineup.archetypes, breakdowns: true });
    attachBots(m, {
      partners: 'normal',
      opponents: 'normal',
      playerId: null,
      roles: lineup.roles,
      strategies: lineup.strategies,
    });
    m.start();
    // Uneven frame times, chunked the way Session does at 4x playback.
    for (let i = 0; !m.isOver; i++) m.advance(i % 3 === 0 ? 0.2 : 0.0137);
    const r = m.getResult();
    expect({ blue: r.blue.score, red: r.red.score }).toEqual(s.score);
  });

  it('gives the stronger alliance the edge (hard vs easy bots)', () => {
    const sp = spec({ difficulty: { blue: 'hard', red: 'easy' }, breakdowns: false });
    const s = summarize([1, 2, 3, 4].map((seed) => runMatchup(ref, sp, seed)));
    expect(s.blue.wins).toBeGreaterThanOrEqual(3);
  });

  it('keys specs by everything that changes the outcome', () => {
    expect(specKey(spec())).toBe(specKey(spec()));
    expect(specKey(spec({ breakdowns: false }))).not.toBe(specKey(spec()));
  });
});

describe('MonteCarloRun', () => {
  /** A fake worker that runs match-ups synchronously on a later tick, like a real one would. */
  const fakeWorker = (): WorkerLike => {
    const w: WorkerLike = {
      onmessage: null,
      onerror: null,
      terminate: () => (w.onmessage = null),
      postMessage: (msg: WorkerRequest) =>
        setTimeout(() => {
          const send = (data: WorkerReply) => w.onmessage?.({ data } as MessageEvent<WorkerReply>);
          if (msg.type === 'init') {
            send({ type: 'ready' });
          } else {
            for (const seed of msg.seeds) send({ type: 'sample', sample: sample(seed, seed % 3, 1) });
            send({ type: 'batch-done' });
          }
        }, 0),
    };
    return w;
  };

  it('hands every seed out exactly once across workers', async () => {
    const run = await new Promise<MonteCarloRun>((resolve) => {
      new MonteCarloRun(spec(), {
        total: 20,
        baseSeed: 100,
        def: ref,
        threads: 3,
        makeWorker: fakeWorker,
        onUpdate: (r) => r.state !== 'running' && resolve(r),
      });
    });
    expect(run.state).toBe('done');
    expect(run.threads).toBe(3);
    expect(run.samples.map((s) => s.seed).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => 100 + i),
    );
  });

  it('stops early and keeps the samples so far', async () => {
    const run = await new Promise<MonteCarloRun>((resolve) => {
      new MonteCarloRun(spec(), {
        total: 1000,
        baseSeed: 1,
        def: ref,
        threads: 2,
        makeWorker: fakeWorker,
        onUpdate: (r) => {
          if (r.state === 'running' && r.samples.length >= 5) r.stop();
          else if (r.state !== 'running') resolve(r);
        },
      });
    });
    expect(run.state).toBe('stopped');
    expect(run.samples.length).toBe(5);
  });

  it('falls back to the main thread without workers', async () => {
    const run = await new Promise<MonteCarloRun>((resolve) => {
      new MonteCarloRun(spec({ breakdowns: false }), {
        total: 1,
        baseSeed: 3,
        def: ref,
        makeWorker: null,
        onUpdate: (r) => r.state !== 'running' && resolve(r),
      });
    });
    expect(run.inline).toBe(true);
    expect(run.state).toBe('done');
    expect(run.samples[0]).toEqual(runMatchup(ref, spec({ breakdowns: false }), 3));
  });
});

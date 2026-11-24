import type { GameDefinition } from '../engine/sim/types.ts';
import { runMatchup, type MatchupSample, type MonteCarloSpec } from './montecarlo.ts';

/**
 * Runs Monte Carlo match-ups in parallel Web Workers (one headless match takes ~0.6-0.9 s, so 1000
 * on one thread would take over ten minutes). Workers pull seeds one at a time from a shared queue,
 * so a slow core doesn't hold up the end of the run. Without Worker support it falls back to the
 * main thread, one match per task so the page stays responsive.
 */

/**
 * Default worker count: every logical core, up to 16. The page itself is nearly idle during a run
 * (it only redraws when a match-up finishes), so it doesn't need a core of its own: on 4 cores, 4
 * workers did 19 % more match-ups per second than 3, and 6 were no faster than 4.
 */
export function defaultThreads(cores: number): number {
  return Math.max(1, Math.min(16, cores));
}

export type WorkerRequest = { type: 'init'; spec: MonteCarloSpec } | { type: 'run'; seeds: number[] };
export type WorkerReply =
  | { type: 'ready' }
  | { type: 'sample'; sample: MatchupSample }
  | { type: 'batch-done' }
  | { type: 'error'; message: string };

/** The part of `Worker` the pool uses (lets tests pass a fake). */
export interface WorkerLike {
  postMessage(msg: WorkerRequest): void;
  terminate(): void;
  onmessage: ((e: MessageEvent<WorkerReply>) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
}

export interface RunOptions {
  /** Match-ups to play. */
  total: number;
  /** Seed of the first match-up; match-up i uses `baseSeed + i`. */
  baseSeed: number;
  /** The spec's game with its tuning applied (used by the main-thread fallback). */
  def: GameDefinition;
  /** Called after every finished match-up and when the run ends. */
  onUpdate: (run: MonteCarloRun) => void;
  /** Worker count (default: `defaultThreads(navigator.hardwareConcurrency)`). */
  threads?: number;
  /** Worker factory; null forces the main-thread fallback. */
  makeWorker?: (() => WorkerLike) | null;
}

const defaultWorker = (): WorkerLike =>
  new Worker(new URL('./montecarlo.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;

export class MonteCarloRun {
  readonly samples: MatchupSample[] = [];
  state: 'running' | 'done' | 'stopped' | 'error' = 'running';
  error: string | null = null;
  readonly threads: number;
  readonly startedAt = performance.now();
  finishedAt: number | null = null;
  /** True when the matches run on the main thread (no Worker support). */
  readonly inline: boolean;
  private next = 0;
  private readonly workers: WorkerLike[] = [];

  constructor(
    readonly spec: MonteCarloSpec,
    private readonly opts: RunOptions,
  ) {
    const make =
      opts.makeWorker === undefined
        ? typeof Worker === 'undefined'
          ? null
          : defaultWorker
        : opts.makeWorker;
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    this.inline = make === null;
    this.threads = this.inline ? 1 : Math.max(1, Math.min(opts.total, opts.threads ?? defaultThreads(cores)));
    if (make === null) {
      setTimeout(() => this.inlineStep(), 0);
      return;
    }
    for (let i = 0; i < this.threads; i++) {
      const w = make();
      w.onmessage = (e) => this.onReply(w, e.data);
      w.onerror = (e) => this.fail(e.message || 'worker failed to load');
      w.postMessage({ type: 'init', spec });
      this.workers.push(w);
    }
  }

  get total(): number {
    return this.opts.total;
  }

  /** Wall-clock seconds so far (or for the whole run, once it has ended). */
  get elapsedSec(): number {
    return ((this.finishedAt ?? performance.now()) - this.startedAt) / 1000;
  }

  /** Rough seconds left, from the rate so far (null until a match-up has finished). */
  get etaSec(): number | null {
    if (!this.samples.length || this.state !== 'running') return null;
    return (this.elapsedSec / this.samples.length) * (this.total - this.samples.length);
  }

  stop(): void {
    if (this.state !== 'running') return;
    this.end('stopped');
  }

  private takeSeed(): number | null {
    if (this.state !== 'running' || this.next >= this.total) return null;
    return this.opts.baseSeed + this.next++;
  }

  private onReply(w: WorkerLike, msg: WorkerReply): void {
    if (this.state !== 'running') return;
    if (msg.type === 'error') return this.fail(msg.message);
    if (msg.type === 'sample') {
      this.samples.push(msg.sample);
      if (this.samples.length >= this.total) return this.end('done');
      this.opts.onUpdate(this);
      return;
    }
    // 'ready' or 'batch-done': hand out the next seed (or let the worker idle).
    const seed = this.takeSeed();
    if (seed !== null) w.postMessage({ type: 'run', seeds: [seed] });
  }

  private inlineStep(): void {
    const seed = this.takeSeed();
    if (seed === null) return;
    try {
      this.samples.push(runMatchup(this.opts.def, this.spec, seed));
    } catch (err) {
      return this.fail(err instanceof Error ? err.message : String(err));
    }
    if (this.samples.length >= this.total) return this.end('done');
    this.opts.onUpdate(this);
    setTimeout(() => this.inlineStep(), 0);
  }

  private fail(message: string): void {
    if (this.state !== 'running') return;
    this.error = message;
    this.end('error');
  }

  private end(state: 'done' | 'stopped' | 'error'): void {
    this.state = state;
    this.finishedAt = performance.now();
    for (const w of this.workers) w.terminate();
    this.workers.length = 0;
    this.opts.onUpdate(this);
  }
}

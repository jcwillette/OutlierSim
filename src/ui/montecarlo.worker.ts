/**
 * Web Worker for Monte Carlo match-ups (see `montecarloPool.ts`). It receives the setup once, then
 * batches of seeds, and posts back one `MatchupSample` per match so the page can update live.
 */
import { initPhysics } from '../engine/sim/match.ts';
import type { GameDefinition } from '../engine/sim/types.ts';
import { findGame } from '../games/index.ts';
import { runMatchup, type MonteCarloSpec } from './montecarlo.ts';
import { applyTuning } from './tuning.ts';
import type { WorkerReply, WorkerRequest } from './montecarloPool.ts';

// The project's lib is DOM (not WebWorker, which conflicts with it), so type just what we use.
const ctx = self as unknown as {
  postMessage(msg: unknown): void;
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
};
let spec: MonteCarloSpec | null = null;
let def: GameDefinition | null = null;

const reply = (msg: WorkerReply) => ctx.postMessage(msg);

ctx.onmessage = (e) => void handle(e.data);

async function handle(msg: WorkerRequest): Promise<void> {
  try {
    if (msg.type === 'init') {
      await initPhysics();
      const base = findGame(msg.spec.gameId);
      if (!base) throw new Error(`Unknown game '${msg.spec.gameId}'`);
      spec = msg.spec;
      def = applyTuning(base, msg.spec.tuning);
      reply({ type: 'ready' });
    } else if (msg.type === 'run') {
      if (!spec || !def) throw new Error('worker not initialized');
      for (const seed of msg.seeds) reply({ type: 'sample', sample: runMatchup(def, spec, seed) });
      reply({ type: 'batch-done' });
    }
  } catch (err) {
    reply({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
}

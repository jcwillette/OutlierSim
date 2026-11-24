# 0006: Speed-ups must leave every match bit-identical

- Status: accepted
- Date: 2026-11-24

## Context

Win probability (ADR 0005) plays 1000 headless matches per run, so match speed is what students wait on. Many ways to speed up a physics and robot sim also change it a little: a lower physics rate, fewer solver iterations, bots that re-plan less often, or a different Rapier build. Rapier's SIMD build was 1.14× faster, but it changed every match. Each such change shifts the results in ways that are hard to judge from a few hundred matches. It would also break the replay of a sampled match-up and make any later comparison with real matches (ADR 0004) ambiguous.

## Decision

- An optimization must not change any match: the same seed gives the same physics, the same bot decisions and the same score, bit for bit. It changes speed, never the simulation.
- How the 2026-11 speed-ups (about 1.8-2× per match) keep that guarantee:
  - **Pose cache** (`src/engine/sim/bodyState.ts`). `Robot` x / y / z / yaw / velocity and `Piece.position` cache what Rapier reports, tagged with `bodyEpoch`. The epoch advances on every physics step and on every call of a `RigidBody` method that isn't on a list of pure reads; the engine wraps those methods once. Unknown and future methods count as writes. So no caller (bots, rules, tests that teleport robots) can see a stale value.
  - **`stepWorld`** calls Rapier's physics pipeline directly. That skips the soft-body bookkeeping `World.step()` runs after every step, which walks every body and collider. The engine has no soft bodies, so the physics is identical.
  - **A\*** reuses scratch arrays (with search-id stamps instead of clearing) and uses a typed-array heap. Static neighbor tests are precomputed per cell. Comparisons, tie order and the Float32 cost array are unchanged.
  - **Shot spots** sit in a bucket index (`PointIndex`) that returns exactly the linear scan's answer (earliest point among equal distances).
  - **Static data is shared across matches**: nav grids and shot spots are cached per `GameDefinition` object. Definitions are treated as immutable; `applyTuning` returns a copy.
  - **Game rules** take one robot snapshot and one GRID snapshot per tick instead of rebuilding them several times.
- Checks:
  - `npm run bench -- --json before.json` before a speed change, then `npm run bench -- --compare before.json` after. It fails if any match's fingerprint changed: the full result, final robot and piece poses, and the ledger.
  - `tests/speed.test.ts` pins each mechanism to the plain version it replaced:
    - cached poses equal live reads after every kind of mutation
    - `stepWorld` equals `world.step()`
    - the fast A* equals a verbatim copy of the original over random queries with parked robots, penalty zones and dead ends
    - the spot index equals a linear scan
    - matches replay exactly after other matches warm the shared caches
- Changes that would alter matches (Rapier SIMD, a lower physics rate, sparser re-planning) are a model change. They need their own decision and a statistical comparison, not a speed-up label.

## Consequences

- Speed work is slower to do, because each idea must preserve every rounding and tie-break, but it can be merged without re-validating the game models.
- Physics is now about half of a match (Rapier WASM). Without changing results, further gains come from parallelism: all logical cores, ADR 0005.
- Code that edits a body only through Rapier's raw sets (not `RigidBody` methods) would bypass the cache invalidation. The engine never does that.

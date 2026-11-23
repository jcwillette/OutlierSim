# 0002: Rapier physics with a headless, deterministic sim core

- Status: accepted
- Date: 2026-11-23

## Context

We need real collisions between robots, game pieces and field elements, because defense, traffic and spills shape how a game feels. We also need to run whole matches in Node, for tests and for calibration against real match data.

## Decision

- Use `@dimforge/rapier3d-compat` (WASM, deterministic, runs in browser and Node).
- `src/engine/sim` and `src/engine/ai` never import Three.js, the DOM, UI or input. ESLint enforces this. The renderer only reads sim state.
- Fixed 60 Hz timestep. Sim coordinates are WPILib field coordinates (meters, Z-up, origin at the blue alliance wall corner). The Three.js scene uses the same Z-up frame (camera `up = +Z`) rather than converting to Y-up. This was amended during M3 because it removes a whole class of axis bugs.

## Consequences

- Matches can run faster than real time in tests and calibration.
- Rapier must be `await RAPIER.init()`-ed before a world is created.

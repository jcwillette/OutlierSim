# Roadmap

Status of the build plan. Update this file in every PR.

| Milestone             | Scope                                                                                                    | Status                         |
| --------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------ |
| M0 Scaffold           | Vite/TS/ESLint/Vitest, CI, Pages deploy, CLAUDE.md, ADRs                                                 | done                           |
| M1 Headless sim core  | `GameDefinition` + validation, Rapier field, swerve, pieces, mechanisms, scoring, clock, ledger          | not started                    |
| M2 Reference game     | fictional `0000-reference` that exercises every engine feature, plus a games registry and per-game tests | done                           |
| M3 Playable 3D client | Three.js renderer, cameras, keyboard/gamepad, HUD, menus, post-match                                     | not started                    |
| M4 Bot AI             | generic 3v3 AI, nav grid, difficulty, `npm run sim`                                                      | not started                    |
| M5 Pipeline           | `frc-game-from-manual` skill, ingest + calibrate tools, Playwright smoke                                 | done                           |
| M6 Stress tests       | blind builds of past seasons from their manuals; real-match comparison only on request                   | waiting for manuals from owner |

## Known gaps / ideas

- There's no audio transcription for reveal videos. Captions are used only when a subtitle track exists, and the manual is the source of truth.
- The optional real-match comparison (`npm run calibrate`) covers alliance-level distributions only, not per-team cycle times.
- Bots don't reason about opponents beyond avoidance and the simple defense role. There's no shot-blocking or counter-defense.
- Bots don't plan auto routines per game. Auto uses the same planner, restricted to the bot's own half of the field.
- The reference game's tower recycles orbs right back to midfield, so scores are unrealistically high (~650/alliance). That's fine for an engine test.

- No touch controls, so phones and tablets can only use the menus. Matches need a keyboard or gamepad.
- The bundle is about 4.9 MB (Rapier's WASM is inlined by `rapier3d-compat`). Consider the non-compat build with a separate `.wasm` file if load time matters on school networks.
- Robots are drawn as generic boxes. Archetypes could get a simple visual hint per mechanism (shooter hood, elevator).
- Pieces held or scored inside targets aren't drawn in the target.

- The reference game was moved ahead of the client and AI (originally M4) so both have a real field to develop against.
- Shooters pick hood pitch and flywheel speed per shot (`solveShot`). Pieces are launched from above the robot's frame, not from a modeled exit point.

- No generic foul detection yet (pinning, protected zones, over-capacity). Games can call `ctx.foul()` from `rules.ts`.
- Robots are boxes with roll and pitch locked, so ramps and charge stations won't tip them realistically.
- Physics treats torus pieces as solid cylinders.
- Pieces aren't drawn inside targets after they're scored (they're consumed or recycled).

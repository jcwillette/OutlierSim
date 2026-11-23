# Roadmap

Status of the build plan. Update this file in every PR.

| Milestone             | Scope                                                                                           | Status                         |
| --------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------ |
| M0 Scaffold           | Vite/TS/ESLint/Vitest, CI, Pages deploy, CLAUDE.md, ADRs                                        | done                           |
| M1 Headless sim core  | `GameDefinition` + validation, Rapier field, swerve, pieces, mechanisms, scoring, clock, ledger | not started                    |
| M2 Playable 3D client | Three.js renderer, cameras, keyboard/gamepad, HUD, menus, post-match                            | not started                    |
| M3 Bot AI             | generic 3v3 AI, nav grid, difficulty, `npm run sim`                                             | not started                    |
| M4 Reference game     | fictional game exercising every engine feature                                                  | not started                    |
| M5 Pipeline           | `frc-game-from-manual` skill, ingest + calibrate tools, Playwright smoke                        | not started                    |
| M6 Stress tests       | past seasons from real manuals, calibrated vs TBA                                               | waiting for manuals from owner |

## Known gaps / ideas

- No generic foul detection yet (pinning, protected zones, over-capacity). Games can call `ctx.foul()` from `rules.ts`.
- Robots are boxes with roll and pitch locked, so ramps and charge stations won't tip them realistically.
- Physics treats torus pieces as solid cylinders.
- Pieces aren't drawn inside targets after they're scored (they're consumed or recycled).

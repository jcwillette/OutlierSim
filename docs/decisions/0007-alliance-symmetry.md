# 0007: Blue and red play the same game

- Status: accepted
- Date: 2026-11-24

## Context

Every match puts blue at the low-x end of the field and red at its mirror (or rotation) image. With identical alliances, both colors should therefore get the same distribution of results. A 2,500 match-up win-probability run of identical 2023 alliances (elevator, elevator, cube specialist on defense; hard bots; breakdowns on) didn't. The means matched (182 each), but red's score spread was wider (13.9 vs 12.7) and it earned fewer bonus RPs (Sustainability 98.2 % vs 99.5 %, Activation 79.5 % vs 82.3 %).

Replaying that setup headless (2,500 matches) reproduced it:

- score SD 13.8 vs 12.3 (z = 4.0)
- Sustainability 98.4 % vs 99.4 % (z = −3.4)

The clearest signature was in auto. Red's auto node count varied more (z = 9.4), and blue's robots missed Mobility three times as often (z = 5.5).

Each suspected cause was isolated two ways:

- **Auto-only experiments** of 2,000-5,000 matches, with breakdowns off.
- **Deterministic "mirror" runs.** Both alliances get the same random numbers, so any difference between them comes from the engine.

Three causes were found:

1. **Navigation grid.** The bots' 0.12 m occupancy grid started at the blue corner, and 2023's 16.54 m field isn't a whole number of cells, so red's half sat 1.8 cm off-grid. A* and `nearestFree` also break ties in fixed directions, and the approach-heading search tried left turns first. So red's bots drove a slightly different maze:
   - 12 % of the routes from the grid to the staged pieces had a different shape;
   - three of red's spots snapped 1.8 cm differently from blue's (the column 9 nodes and two Charge Station slots).

   This made red's auto erratic. When red plans in its own frame, the auto-node spread difference goes from z = 5.8 to −1.9.

2. **Float32 physics.** Rapier works in float32, and its origin was the blue corner, so red's half was rounded about 8× more coarsely at the grids. Tiny rounding differences decide near-deadlocks, such as the middle robot meeting a teammate head-on in the one-lane gaps beside the Charge Station. Centering the physics origin cut blue's extra Mobility misses from 123 to 52 per 5,000 matches.
3. **Rapier's contact solver isn't mirror-symmetric.** A contact and its mirror image are resolved a little differently (for example the order of the contact points). On a mirror-symmetric field this consistently favors the robots at one end. Running the physics in the mirrored frame moved the leftover gap to the other alliance:

   | Physics frame | Mobility misses blue : red | Auto points blue : red |
   | ------------- | -------------------------- | ---------------------- |
   | plain         | 118 : 66                   | 54.4 : 54.8            |
   | mirrored      | 74 : 117                   | 54.7 : 54.5            |

Checked and ruled out:

- **Processing order.** Blue's robots act first each tick, but running red first changed nothing.
- **The shared random stream.**
- **The 2023 rules.** G207 and G202 treat both alliances alike.
- **Definition expansion.** Red's objects are exact mirrors of blue's.
- **Head-on collisions.** They deflect robots to the same side for both alliances.

## Decision

- **Bots plan in their own alliance's frame** (`AllianceNav` in `src/engine/ai/navgrid.ts`).
  - Red's nav grid is laid out from the red wall: built from `fieldFromRed(game)`, with every query point and answer moved by the field's mirror or rotation. Sided elements come in exact pairs, so the red view of the field equals the field bit for bit; only neutral elements move. Red still sees the real field if a neutral element isn't symmetric.
  - Fixed turn and side preferences flip with the alliance's handedness (`handedness()` in `frame.ts`): which way approach headings are tried first, and which way a yielding robot steps when a teammate is dead ahead.
  - Turning half a turn is a tie that `wrapAngle` used to break by the sign of a rounding error (+π for blue but −π for red at spawn on a rotational field, so the two turned opposite ways). `turnTo()` breaks it by handedness, for the bots and for the shooter's auto-aim.
  - Blue plans exactly as before.
- **Rapier's world goes through `PhysicsFrame`** (`src/engine/sim/frame.ts`).
  - It is centered on the field.
  - On even seeds it is flipped: the field's mirror or rotation image, laid out from the red end (`MatchOptions.flipPhysics` overrides this). Consecutive seeds alternate ends, so a Monte Carlo run plays exactly half its matches each way and the solver's handedness cancels out.
  - Everything outside the physics calls uses field coordinates: the `Robot` and `Piece` getters, `setPosition` and `setVelocity`. Raw `body` calls see physics coordinates. The renderer draws robots from their field heading (a mirror would turn a robot's front around) and pieces through `PhysicsFrame.quat`.
- **`tests/symmetry.test.ts` pins the exact parts:**
  - for every registered game and robot size, red's nav answers are exact images of blue's;
  - with fixed random numbers, red's bots make the mirror image of blue's decisions, and robot positions stay exact mirrors in both physics frames: for every registered game over the opening 1.5 s, and for 2023 through the preload placements and the first approach to a staged piece (2.5 s);
  - a flipped-physics match is the plain one with the alliances' ends swapped in Rapier (to 1e-9 m);
  - the `PhysicsFrame` maps are self-inverse and consistent.

  The test fails on the old code: with a 1.8 cm spot offset, and without the centered origin with a 1e-5 m drift.

## Consequences

- Results, same setup and seeds (2,500 full matches, breakdowns on), blue vs red:

  | Metric            | Before                       | After                        |
  | ----------------- | ---------------------------- | ---------------------------- |
  | Wins              | 47.3 % vs 50.5 %             | 48.9 % vs 48.1 %             |
  | Score (mean ± SD) | 181.9 ± 12.3 vs 182.0 ± 13.8 | 182.4 ± 12.3 vs 181.8 ± 12.2 |
  | Spread difference | z = 4.0                      | z = −0.2                     |
  | Sustainability RP | 99.4 % vs 98.4 %             | 99.5 % vs 99.5 %             |
  | Activation RP     | 81.5 % vs 79.5 %             | 80.6 % vs 81.2 %             |
  | Mobility points   | 8.86 vs 8.94                 | 8.92 vs 8.92                 |

  In 5,000 auto-only matches (breakdowns off) the two halves of a run are mirror images: in the plain frame red averages 5.97 auto nodes to blue's 5.91, and in the flipped frame blue 5.95 to red's 5.90. Together that's 5.93 ± 0.72 vs 5.94 ± 0.73, and 98 vs 91 Mobility misses. Matches are no slower (783 vs 815 ms).

- Every match changes. This is a model change, not a speed-up (ADR 0006): bench fingerprints from before don't compare. The same seed still replays exactly.
- Within one match the alliances still aren't bit-for-bit mirror images once robots touch pieces or each other (Rapier's solver), but over a run neither end is favored. A run with an odd number of match-ups has one extra match in one frame.
- There are now two nav grids per game and robot size (one per alliance). They are built once per game per worker, in about 50 ms each.
- New code with a fixed direction preference (left first, +x first, a scan order) must go through the alliance's frame. New code that reads or writes Rapier state must go through `match.physics`. To check a change statistically, run identical alliances and compare blue with red, including the spread and bonus-RP rates, not just win rates.

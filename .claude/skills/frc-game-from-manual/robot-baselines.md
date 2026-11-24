# Robot baselines that carry from season to season

Calibrated once, at the owner's request, against every official 2023 qualification match on The Blue Alliance: 185 events, 27,076 alliance-matches. The full comparison is in `src/games/2023-chargedup/CALIBRATION.md`. A new season's blind build starts from these numbers. They describe how real drive teams and robots perform, not how any one game scores, so treat them as **general FRC engineering knowledge** (ADR 0009).

**Don't use them for a stress test of a season before 2023.** For that season they would be future knowledge, which ADR 0004 forbids. Any season from 2024 on (including 2027) may use them. Never look up the new season's own matches (ADR 0004).

## What a real qualification match looks like

2023 alliance score without fouls, qualification matches. Use it to sanity-check the scale of a new game's plausibility numbers, not as a target.

| Event level            | Alliance mean | Auto | Teleop pieces + bonuses | Endgame |
| ---------------------- | ------------- | ---- | ----------------------- | ------- |
| Week 1                 | 66            | 18   | 30                      | 17      |
| Week 3                 | 73            | 20   | 36                      | 18      |
| Week 5                 | 83            | 23   | 41                      | 18      |
| District championships | 121           | 33   | 66                      | 22      |
| Championship divisions | 136           | 35   | 79                      | 22      |
| Whole season           | 85            | 23   | 43                      | 19      |

- Within one event, alliance scores spread with a standard deviation of about a third of the event's mean (26 points at 85).
- Playoff alliances score about 30 % more than the same event's qualification alliances.
- Robots scored far fewer pieces than any bot cycle suggests. A 2023 alliance placed 2.1 pieces in auto and 9.2 in teleop, in a 135 s teleop with a full-field cycle.

## Seven tiers of real robots

Rank every robot at every event by its contribution, and cut the ranking into sevenths. One archetype per tier makes the menu's random preset (three different robot types per alliance) play like an average event. The 2023 archetypes map onto the tiers as follows. A new game's archetypes should cover the same spread: one elite all-rounder, a few good specialists, a mid-pack robot, a weak scorer, a rookie robot and a defender.

| Tier (2023 archetype)         | Teleop pieces / match | Auto pieces | Leaves the start zone | Auto dock (engaged) | Endgame dock (engaged) | Parks | Does nothing measurable |
| ----------------------------- | --------------------- | ----------- | --------------------- | ------------------- | ---------------------- | ----- | ----------------------- |
| 7, top (elevator all-rounder) | 6.1                   | 1.35        | 85 %                  | 46 % (39 %)         | 71 % (63 %)            | 24 %  | 1 %                     |
| 6 (cone specialist)           | 4.4                   | 1.0         | 68 %                  | 45 % (38 %)         | 72 % (63 %)            | 21 %  | 3 %                     |
| 5 (cube specialist)           | 3.4                   | 0.86        | 59 %                  | 33 % (26 %)         | 71 % (62 %)            | 19 %  | 4 %                     |
| 4 (Charge Station specialist) | 2.7                   | 0.72        | 55 %                  | 20 % (16 %)         | 66 % (58 %)            | 22 %  | 6 %                     |
| 3 (mid-level arm)             | 2.1                   | 0.54        | 53 %                  | 9 % (7 %)           | 57 % (50 %)            | 27 %  | 7 %                     |
| 2 (kitbot)                    | 1.6                   | 0.35        | 44 %                  | 5 % (4 %)           | 49 % (43 %)            | 29 %  | 13 %                    |
| 1, bottom (defender)          | 1.0                   | 0.16        | 29 %                  | 2 % (1 %)           | 33 % (28 %)            | 34 %  | 25 %                    |

The tiers come from least-squares contribution estimates (OPR) per event, so the two ends are a little more extreme than the robots really were. The calibrated sim's teleop pieces land within 0.3 of every row except the defender's (1.45: it scores when nobody is worth defending).

## Settings that produce those tiers

The engine models a pickup or placement as the mechanism's time (`intake.timeSec`, `place`), which programmed autos also use, plus the drive team's line-up in teleop (`alignSec`: lining up, misses, re-grabs). Bots plan with both. The player's own robot pays only the mechanism, because the student is its drive team.

| Tier | `alignSec` per pickup and per placement          | `auto` routine                              | Endgame                              | `reliability` |
| ---- | ------------------------------------------------ | ------------------------------------------- | ------------------------------------ | ------------- |
| 7    | 2.6 s                                            | `{ pieces: 2, success: 0.85 }`              | balance / climb 5-6 s, 85-90 %       | 0.97          |
| 6    | 4.6 s                                            | `{ pieces: 1, success: 0.85 }`              | 7 s, 85 %                            | 0.95          |
| 5    | 8.9 s                                            | `{ pieces: 1, success: 0.85 }`              | 6 s, 85 %; auto 80 %                 | 0.92          |
| 4    | 13.6 s (scores little; its value is the endgame) | `{ pieces: 1, leave: false, success: 0.8 }` | 4 s, 90 % (the endgame specialist)   | 0.90          |
| 3    | 12.1 s                                           | `{ pieces: 1, success: 0.65 }`              | 8 s, 70 %                            | 0.88          |
| 2    | 16.8 s                                           | `{ pieces: 1, success: 0.45 }`              | an 8 s dock that works 40 % of tries | 0.78          |
| 1    | 20.2 s (defends instead)                         | `{ pieces: 0, success: 0.3 }`               | none, parks                          | 0.75          |

How to carry these to a new game:

- **Mechanism times** come from the new robots' designs, as before (engineering estimates: intake 0.25-0.6 s, placing 0.6-3 s by height and precision).
- **Line-up** (`alignSec`) depends on how precise the new game's scoring is. 2023 asked for a cone over a 4 cm pole or a cube on a walled shelf, after a pickup at a human player shelf or off the floor. Keep the table's values for scoring that is about as precise. Scale them down for a big target or a forgiving pickup (a shot into a wide goal, a ground intake that swallows pieces), and up for harder ones. With about 100 s of teleop cycling, the calibrated 2023 time per teleop piece was 16 s (tier 7), 23, 29, 37, 48 and 62 s (tier 2). Tier 1 defends.
- **Auto routines**: most real robots score one preload or nothing in auto. Only the top tier runs multi-piece autos, and a quarter of the bottom-tier autos don't run at all (`success`). Robots that end auto on an auto-only endgame action (2023's auto dock) often skip leaving the start zone (`leave: false`).
- **Endgame**: about 60 % of robots finished on the platform and 88 % of those counted the higher level (engaged). Alliances rarely got three robots on one shared platform (11 % of 2023 alliances). Low tiers fail endgame attempts often (`endgameSuccess` below 50 %). Robots that can't do the endgame park.
- **Reliability**: chosen with the rest of the calibration, falling with the tier. Real robots did nothing measurable (didn't leave the start zone, not in the endgame zone at the end) in 1 % of top-tier matches and up to 25 % of bottom-tier ones. The sim's breakdowns at these values leave fewer bottom-tier robots idle (3 % of kitbots, 14 % of defenders), because a weak bot that still drives ends the match parked or docked.
- **Human player stations**: real match results can't separate human player speed from the robot's. Keep the station's own timing (`handoffSec`, `feedIntervalSec`) to what the human player does (1-3 s), and leave the robot's share in `alignSec`.

## Bot difficulty

`SKILL[difficulty].align` scales every robot type's `alignSec` for the bots of that difficulty. The factors were fitted so teleop scoring matches real event levels with the same robots:

- **easy** (×1.6): week-1 drive teams. 2023 teleop pieces + links: sim 30, real 30.
- **normal** (×1): the season's average match.
- **hard** (×0.35): district championship drive teams. Sim 66, real 66.

Auto and endgame come from the robot types, so a whole easy match still scores a little above week 1 (72 vs 66), and a hard one below a district championship (109 vs 121). Those events had worse and better robots, not only drivers.

## Strategy hints that mattered

- Real teams build the game's set bonuses (2023 LINKS: 2.5 per alliance from 11 pieces, two-thirds of the most those pieces could make). Bots don't, unless the game's `rules.ts` gives them a `botValue` for the target that completes one.
- Real teams fill whatever lowers a ranking-point threshold for both alliances (2023's co-op grid). A small `botValue` brings bots to the real rate.
- Point values and RP thresholds can change between events. 2023's Sustainability RP was 5 LINKS (4 with coopertition) at every in-season event, and 6 (5) only at the Championship. The April manual says 6 (5). Read which events a threshold applies to.

## Checking a new game against these baselines

Run `npm run sim -- --game <id> --random --matches 200`, and `--archetypes <id>,<id>,<id>` to see one type in every slot. Compare:

- teleop pieces per robot type with the tier table, after scaling for the new game's cycle (field length, precision);
- the share of auto points (2023: 27 % of the score) and endgame points (22 %);
- bonus-RP rates against the designers' intent. 2023's real rates were Sustainability 24 % and Activation 57 % across the season, and 14 % / 52 % at in-season events.

Report the gaps in `SOURCES.md`. The blind build still never looks at the new season's matches.

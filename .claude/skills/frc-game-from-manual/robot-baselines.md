# Robot baselines that carry from season to season

Calibrated twice, each time at the owner's request, against every official qualification match of a season on The Blue Alliance:

- 2023: 185 events, 27,076 alliance-matches (`src/games/2023-chargedup/CALIBRATION.md`, ADR 0009);
- 2024: 190 events, 28,250 alliance-matches, plus Chief Delphi's strategy discussion (`src/games/2024-crescendo/CALIBRATION.md`, ADR 0012). The 2024 blind build used only the 2023 tiers below; how far off that left it is the best evidence of what carries over and what doesn't ("Lessons from 2024").

A new season's blind build starts from these numbers. They describe how real drive teams and robots perform, not how any one game scores, so treat them as **general FRC engineering knowledge**.

**Don't use a season's numbers for a stress test of that season or an earlier one.** The 2023 tiers may inform seasons from 2024 on, the 2024 lessons seasons from 2025 on (including 2027). Never look up the new season's own matches (ADR 0004).

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

2024 (CRESCENDO), the same way:

| Event level            | Alliance mean | Auto | Teleop pieces | Endgame |
| ---------------------- | ------------- | ---- | ------------- | ------- |
| Week 1                 | 38            | 14   | 19            | 4       |
| Week 3                 | 42            | 16   | 22            | 4       |
| Week 5                 | 46            | 18   | 24            | 5       |
| District championships | 72            | 26   | 39            | 7       |
| Championship divisions | 84            | 28   | 48            | 8       |
| Whole season           | 49            | 18   | 26            | 5       |

- Within one event the standard deviation was 18.8 points at a mean of 49: again over a third of the mean.
- An alliance scored 2.9 NOTES in auto and 11.5 in teleop, with a ring that needs no orientation and a goal you can shoot from 5 m.
- Auto was 37 % of the score (2023: 27 %), the endgame 10 % (2023: 22 %). The share depends on the game; the pieces per robot (below) carry over better.

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

The tiers come from least-squares contribution estimates (OPR) per event, so the two ends are a little more extreme than the robots really were. The calibrated sim's teleop pieces land within 0.3 of every row except the defender's. It scored 1.45 when it went off to score with nobody worth defending; since ADR 0010 it waits for carriers instead, and scores almost nothing in teleop.

2024's tiers, per robot per match (NOTES from component OPRs; the 2023-tier line-ups scored within 15 % of these unchanged):

| Tier | NOTES (auto) | Teleop AMP share | ONSTAGE | Parks | Leaves the start zone | Neither climbs nor parks |
| ---- | ------------ | ---------------- | ------- | ----- | --------------------- | ------------------------ |
| 7    | 9.0 (2.0)    | 35 %             | 61 %    | 28 %  | 95 %                  | 11 %                     |
| 6    | 7.1 (1.5)    | 30 %             | 47 %    | 38 %  | 83 %                  | 15 %                     |
| 5    | 5.9 (1.1)    | 28 %             | 39 %    | 44 %  | 71 %                  | 17 %                     |
| 4    | 4.7 (0.9)    | 27 %             | 33 %    | 48 %  | 59 %                  | 19 %                     |
| 3    | 3.5 (0.6)    | 29 %             | 24 %    | 54 %  | 50 %                  | 22 %                     |
| 2    | 2.3 (0.4)    | 30 %             | 12 %    | 61 %  | 44 %                  | 27 %                     |
| 1    | 1.1 (0.2)    | 31 %             | 5 %     | 57 %  | 33 %                  | 38 %                     |

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

### 2024's fitted settings (a shooting game with a hanging climb)

The engine charges the line-up to pickups and placements, not to shots, so a shooter's cycle carries one line-up where a 2023 robot carried two.

| Tier (2024 type)                                     | `alignSec` | `auto` routine | Climb (s, success per try, retried) | `reliability` |
| ---------------------------------------------------- | ---------- | -------------- | ----------------------------------- | ------------- |
| 7 (under-stage all-rounder / full-size turret robot) | 0.5 / 1.0  | 2 pieces, 95 % | 5-6 s, 40-45 %                      | 0.97          |
| 6 (pivot shooter)                                    | 5.0        | 2, 80 %        | 7 s, 32 %                           | 0.95          |
| 5 (AMP and SUBWOOFER scorer)                         | 6.0        | 3, 74 %        | 6 s, 25 %                           | 0.92          |
| 4 (tank-drive shooter)                               | 10         | 2, 55 %        | 7 s, 22 %                           | 0.90          |
| 3 (SUBWOOFER shooter)                                | 11         | 2, 50 %        | 8 s, 13 %                           | 0.88          |
| 2 (KitBot, loads only at the human player station)   | 10         | 1, 50 %        | 10 s, 12 %                          | 0.78          |
| 1 (low-resource robot)                               | 26         | 1, 30 %        | 10 s, 5 %                           | 0.75          |

## Lessons from 2024 (what the 2023 tiers got right and wrong)

The 2024 blind build used the 2023 tiers above and nothing from 2024. Against the real season it scored 0.92 of the real total. The pieces and the scale carried over; the endgame and the strategies didn't.

- **Line-ups carry over** with the "scale down for a forgiving pickup and a big target" rule. NOTES per tier landed within 15 % unchanged. The fit then moved the top tier down to 0.5-1 s, the bottom tier up to 26 s, and the middle by 1-3 s.
- **Leaving the start zone carries over.** 2024's rates were within 10 points of 2023's for every tier, even though auto was worth far more.
- **Multi-piece autos follow the game, not the tier table.** With pieces close to the goal, the top tier averaged 2.0 auto pieces (2023: 1.35) and the bottom tiers still only 0.2-0.4. Cap the top tier at 2-3 pieces at 95 % success. Don't take "the planner's best", and don't double 2023's caps: the blind 4-piece cap overshot.
- **The endgame doesn't carry over.** A hanging climb is far harder than driving onto a platform. Per tier, 2024 robots climbed 86, 65, 55, 50, 42, 24 and 15 % as often as 2023 robots docked; the weaker the robot, the steeper the drop. For a climb on a bar or chain, start from 2024's ONSTAGE rates. For a drive-on platform, start from 2023's. Never give a middle tier a specialist's endgame: no real tier specialized in the STAGE.
- **Every tier did every kind of scoring.** Real 2024 robots of every tier put about 30 % of their NOTES in the low goal (the AMP). Archetypes that can't reach one of the game's scoring targets don't match a real tier.
- **Designs split on height.** When a structure has a clearance that matters (2024's 0.71 m STAGE), the top seventh came in two builds: short ones that drive under and full-size ones that can't. Use `FieldElement.clearance` and give the top tier both, dealt by share (`dealWeight`).
- **Kit of Parts robots have kit constraints.** 2024's KitBot loaded only at the human player station (`intake.floor: false`). Read the kit robot's documentation at kickoff; it's public that day.
- **Multipliers are timed.** Real alliances held a bonus window (2024's AMPLIFICATION) and their shots until it paid. Bots don't, unless the game's `rules.ts` gives a `botHold`. The low goal's share hardly changed with skill (21 % in week 1, 31 % at the Championship), but what each AMP NOTE earned grew fourfold.
- **Low goals feed bonus windows, not points.** The bots' `botValue` for a "bank" target is a knife edge against a free high-goal shot. Fit it to the real share of pieces in it, and value the piece that completes the bank more than the first.
- **Autos stay on the high-value goal.** 2024 autos put 0.03 NOTES per alliance in the AMP: nobody banked in auto. Give bank-style `botValue` in teleop only.
- **Human players**: both alliances pressed a "lower the RP threshold" button in 60 % of matches, rising from 44 % in week 1 to 94 % at the Championship. Throws at a small far target (a HIGH NOTE onto a 1.66 in post) landed about 8 % of the time.
- **Bonus RPs come from fouls too.** Half of the in-season ENSEMBLE RPs went to an alliance because the opponent touched it in the protected STAGE ZONE (G424). Earned on the field, the RP was 7 %. When a foul awards an RP, compare the earned rate with the designers' intent, not the total.
- **Thresholds change at championship events, every year.** 2023's Sustainability and 2024's MELODY both moved for district championships and the Championship. Play the in-season value, and say so.
- **Real strategies the manual makes possible will be used.** In 2024 they were passing from the loading side into the scoring area (G414 allowed it), defense at the loading area using a field structure as a choke point, and driving under the opponent's structure until its protected window. Check each one against the rules at kickoff and give the bots a role for it (`feeds`, `defense: 'source'`, `endgamePathZones`).

## Bot difficulty

`SKILL[difficulty].align` scales every robot type's `alignSec` for the bots of that difficulty. The factors were fitted so teleop scoring matches real event levels with the same robots:

- **easy** (×1.6): week-1 drive teams. 2023 teleop pieces + links: sim 30, real 30.
- **normal** (×1): the season's average match.
- **hard** (×0.35): district championship drive teams. Sim 66, real 66.

Auto and endgame come from the robot types, so a whole easy match still scores a little above week 1 (72 vs 66), and a hard one below a district championship (109 vs 121). Those events had worse and better robots, not only drivers.

The same factors held for 2024 without refitting. Easy teleop was 16.3 vs week 1's 19.3 (total 40 vs 38), and hard teleop 39.5 vs 39.0 at district championships (total 63 vs 72).

## Strategy hints that mattered

- Real teams build the game's set bonuses (2023 LINKS: 2.5 per alliance from 11 pieces, two-thirds of the most those pieces could make). Bots don't, unless the game's `rules.ts` gives them a `botValue` for the target that completes one.
- Real teams fill whatever lowers a ranking-point threshold for both alliances (2023's co-op grid). A small `botValue` brings bots to the real rate.
- Point values and RP thresholds can change between events. 2023's Sustainability RP was 5 LINKS (4 with coopertition) at every in-season event, and 6 (5) only at the Championship. The April manual says 6 (5). Read which events a threshold applies to.

## Checking a new game against these baselines

Run `npm run sim -- --game <id> --random --matches 200`, and `--archetypes <id>,<id>,<id>` to see one type in every slot. Compare:

- teleop pieces per robot type with the tier table, after scaling for the new game's cycle (field length, precision);
- the share of auto points (2023: 27 % of the score) and endgame points (22 %);
- bonus-RP rates against the designers' intent. 2023's real rates were Sustainability 24 % and Activation 57 % across the season, and 14 % / 52 % at in-season events. 2024's were MELODY 39 % (33 % in-season) and ENSEMBLE 18 % (7 % earned on the STAGE in-season).

Report the gaps in `SOURCES.md`. The blind build still never looks at the new season's matches.

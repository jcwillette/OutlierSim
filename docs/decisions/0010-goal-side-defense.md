# 0010: Defenders play goal-side; scorers slip round them

- Status: accepted
- Date: 2026-11-25

## Context

The owner's test of the defense role: two top robots and a defender (aggressive strategy) against three top robots, 2023 Charged Up (elevator, elevator, defender vs elevator ×3). It looked aimless and barely slowed the other alliance. In 240 paired matches at normal difficulty, with breakdowns on, the old defender cut red's score by 0.5 ± 0.7 points. Instrumenting the defender showed why. In teleop it was:

- defending 9 % of the time;
- driving to place, or placing, hybrid pieces 43 %, and fetching them 28 %;
- idle 19 %, mostly backing off.

The causes:

- It marked an opponent only while that opponent was clear of every protected zone. In 2023 those zones cover both ends of a carrier's trip. With nobody to mark, `defenseOption` returned null, and the defender went off to score with a 20 s line-up.
- The mark changed on every re-plan (the opponent with the most pieces, nearest first). That was a new robot whenever one picked up or scored.
- It chased a point 0.9 m in front of the opponent, toward that opponent's wall, slowing as it got close. A 12 ft/s tank can't get in front of a 14 ft/s swerve that way; it ended up beside or behind it.
- It broke off after 3 s of touching a slow opponent anywhere, so a robot it was holding up in the open got away.

The roadmap also listed "scorers don't route around a defender". Once the defender started getting in front of carriers, they drove straight into it while being shoved backwards. That was unrealistic and made defense look stronger than it is.

## Decision

Defense (`src/engine/ai/bot.ts`):

- **A lane per alliance** (`Lane`): the centroid of its stations (where it fetches) and of its targets (where it scores). This is what a scout knows from the field drawings.
- **Guard post.** A defense-role bot with nobody to mark waits at the opponents' **gate**, a new `guard` plan. The gate is the first free spot on the lane, walking out from the opponents' goal, that is clear of their protected zones with room for the defender. Every carrier has to come there, and near the goal a small step sideways covers a wide arc. Waiting at the source end instead (where pieces come out) did worse: carriers start in every direction there and outrun the defender. In an earlier version without the juke, it took −2.0 points against −4.0 for the goal end (100 paired matches).
- **Shadow, then step out.** A marked carrier more than `STEP_OUT` (3.5 m) from its own gate is met at that gate, on its line home. The defender keeps moving along the line as the carrier moves. Closer in, the defender intercepts: it goes to where it can first get in front of the carrier on the carrier's way home. Once in front (goal-side), it drives into the carrier at full effort, tracking its sideways moves, so the carrier is held up or pushed back. From beside or behind, it swings round the carrier's side instead of shoving it toward its goal. The step-out distance was swept: red's pieces fell by 1.62 / 1.82 / 2.02 / 1.83 / 1.59 / 1.51 at 2.5 / 3 / 3.5 / 4 / 5 / 7 m (±0.13, 120 paired matches).
- **Marks are chosen and kept.** The value of a mark is a carrier (1), or an empty robot near the post on its way back out (0.4), divided by one plus the seconds until the defender can be in front of it. A mark the defender can't reach before the robot gets into its zones is worth nothing. The current mark is kept unless another is worth 1.5× as much.
- **Pins by the referee's count.** The defender breaks off when the referee's visible count on it (`Match.pinCounts`, the hand count real drive teams see) reaches 3 s, or 2 s short of the game's count. Holding a robot up in the open is a shoving match, not a pin, and goes on.
- **Clean, both ways.** Besides the opponent's protected zones (any corner of the defender, by its half-diagonal), the defender lets go of an opponent within 0.25 m of the defender's own protected zones. Contact there counts against the opponent even when the defender forced it (ADR 0008). That would farm fouls, and the first version did: it shoved red robots 5 m back into blue's community for about 40 points of red fouls a match.
- A defense-role bot still scores when no opponent could carry a piece past it (every opponent defending, broken down or done).

Shooters and foul zones (added for 2024, where the first version took only 1.8 points):

- **A shooter's goal is its shot spot.** `scoringSpot` predicts where a carrier will score: for a robot with a shooter, the nearest spot its shooter can score from (the same `findShotSpots` the bots use, from the robot type's range, which any scout knows), else its alliance's targets. The gate, the guard post and the carrier's direction home use it. A 2024 all-rounder shoots from about 4.3 m out, so the post moved from near the SPEAKER to where red actually shoots (x ≈ 11.7). Meeting carriers 1.5 or 3 m before their shot spot instead took less off red's teleop (−2.8 and −2.6 against −3.6 to −5.0); at 3 m the margin looked better only because red drew more G424 fouls in blue's half.
- **Defense reads the declared fouls, not the bots' path zones** (`MatchAI.fouling`). `botHints.protectedZones` can be wider than the rules, to keep bots' paths out of trouble. 2024 keeps paths out of the STAGE ZONE all match, so red's whole shooting area was off limits to defense, though contact there is legal until the last 20 s (G424 B). Making the STAGE endgame-only in the 2024 data instead let scorers wander through it in teleop and get caught there at the 20 s mark (0.6 more G424 calls a match with no defender at all), so the data stays and defense uses the rules: the declared contact fouls (endgame-only ones in the endgame) plus the bot-only `endgameProtectedZones` (2023's G209). For 2023 that is the same set of zones as before.
- **Either robot counts.** Where a rule counts either robot's bumpers (`inside: 'either' | 'protected'`, 2024's G423 / G424 / G422), the defender lets go of an opponent whose corners are, or within 0.5 s will be, near the zone, and gives other opponents there the wide berth scorers give opponents in protected zones.
- **Out of the endgame zones in time.** Defenders treat the endgame's foul zones as live 5 s before the endgame starts, and the guard post is worked out again for the endgame (before, a defender sat in red's STAGE among the climbers).
- **Never in its own zones.** The defender keeps its own body, and its guard post, out of its own alliance's foul zones too. Opponents touching it there would draw fouls it farmed.

Counter-defense (`steer`, every bot that isn't defending):

- **Juke.** An opponent squarely in a bot's way, within 1 m of its bumpers, makes it slip round to one side after the driver's reaction time (`Skill.react`: easy 0.6 s, normal 0.35 s, hard 0.2 s). The bot keeps that side for 0.6 s and never picks the side that leads into the opponent's protected zones or a wall. In matches without a defender this changes nothing measurable: 120 paired 2023 matches with and without it differ by 0.0 ± 1.3 points.

## Consequences

- 2023, the owner's matchup (240 paired matches, normal, breakdowns on), before → after:
  - Red's score against the defender: 149.7 → 142.8. The defender's effect went from −0.5 to −6.6 ± 0.8 points and −1.86 ± 0.11 pieces (about 13 % of red's teleop pieces).
  - Blue's margin: −25.6 → −22.0. Blue's win rate: 8.8 % → 10.4 %. The defender no longer scores hybrid pieces (its points 4.9 → 2.4), which gives back part of the gain. That's the trade a real defender makes.
  - Fouls stay even: red's G207 calls go from 0.8 to 1.3 per match (carriers juking into blue's zones), blue's from 0.6 to 0.7, and there are no pin calls.
  - The balanced strategy does as well as the aggressive one (−7.0 ± 0.7). The aggressive scorers' extra harassment costs them about as much as it takes from red.
- At hard difficulty the effect is −8.9 ± 1.0 points (was −3.4 ± 1.2; 160 paired matches).
- 2024 Crescendo, all-rounder, all-rounder and an aggressive defender against three all-rounders (240 paired matches, normal): red's teleop falls by 4.3 ± 0.6 points (10 %; the first version of this ADR: 2.1, the old defender about 1). Blue's margin gains 4.2 ± 1.0 and its win rate goes from 5.8 % to 9.6 %. The defender defends 49 % of teleop. Blue's G424 calls go from 0.08 to 0.20 a match, mostly when the defender breaks down (reliability 0.75) while waiting in red's STAGE area and is still there when red climbs; the referee calls contact with a dead robot like any other.
- 2023 with the 2024 additions: the same defensive effect (red's teleop −6.7 ± 0.5, against −6.9 ± 0.5), with fewer red G207 calls (1.1 against 1.3), since the defender no longer stands in its own zones.
- This is a model change (ADR 0006): every match with a defense-role robot changes, and the juke can change any match where opponents meet head-on. Random 2023 alliances include the defender about 43 % of the time, and it no longer scores in teleop when no one is in reach (the calibration's 1.45 pieces against the real bottom tier's 1.0). Over the same 400 random-alliance seeds, the average moved from 87.9 to 84.2 points (teleop 43.3 → 40.9, fouls 3.3 → 2.0; the real season's average is 84.8). The calibration's line-ups were fitted while the defender slowed nobody, so teleop pieces now run about 6 % low. `npm run calibrate` was not rerun, because a real-match comparison happens only when the owner asks (ADR 0004).
- The defense is still simple: one defender per alliance marks one robot, and it never blocks shots or guards a loading area.

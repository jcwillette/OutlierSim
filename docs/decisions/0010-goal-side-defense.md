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

Counter-defense (`steer`, every bot that isn't defending):

- **Juke.** An opponent squarely in a bot's way, within 1 m of its bumpers, makes it slip round to one side after the driver's reaction time (`Skill.react`: easy 0.6 s, normal 0.35 s, hard 0.2 s). The bot keeps that side for 0.6 s and never picks the side that leads into the opponent's protected zones or a wall. In matches without a defender this changes nothing measurable: 120 paired 2023 matches with and without it differ by 0.0 ± 1.3 points.

## Consequences

- 2023, the owner's matchup (240 paired matches, normal, breakdowns on), before → after:
  - Red's score against the defender: 149.7 → 142.8. The defender's effect went from −0.5 to −6.6 ± 0.8 points and −1.86 ± 0.11 pieces (about 13 % of red's teleop pieces).
  - Blue's margin: −25.6 → −22.0. Blue's win rate: 8.8 % → 10.4 %. The defender no longer scores hybrid pieces (its points 4.9 → 2.4), which gives back part of the gain. That's the trade a real defender makes.
  - Fouls stay even: red's G207 calls go from 0.8 to 1.3 per match (carriers juking into blue's zones), blue's from 0.6 to 0.7, and there are no pin calls.
  - The balanced strategy does as well as the aggressive one (−7.0 ± 0.7). The aggressive scorers' extra harassment costs them about as much as it takes from red.
- At hard difficulty the effect is −8.9 ± 1.0 points (was −3.4 ± 1.2; 160 paired matches).
- 2024 Crescendo gains less: −1.8 ± 0.8 points against −1.2 ± 1.0 before, for all-rounder, all-rounder, defender against three all-rounders (160 paired matches). Shooters score from range, so a gate just outside the goal's zones meets fewer carriers. A gate for shooters would sit at their shot range, not at the goal.
- This is a model change (ADR 0006): every match with a defense-role robot changes, and the juke can change any match where opponents meet head-on. Random 2023 alliances include the defender about 43 % of the time, and it no longer scores in teleop when no one is in reach (the calibration's 1.45 pieces against the real bottom tier's 1.0). Over the same 400 random-alliance seeds, the average moved from 87.9 to 83.9 points (teleop 43.3 → 40.7, fouls 3.3 → 1.8; the real season's average is 84.8). The calibration's line-ups were fitted while the defender slowed nobody, so teleop pieces now run about 6 % low. `npm run calibrate` was not rerun, because a real-match comparison happens only when the owner asks (ADR 0004).
- The defense is still simple: one defender per alliance marks one robot, and it never blocks shots or guards a loading area.

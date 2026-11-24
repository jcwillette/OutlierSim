# 0008: Games declare their contact fouls; the engine calls them

- Status: accepted
- Date: 2026-11-24

## Context

ADR 0003 says a mechanic the schema can't express goes in the game's `rules.ts` first, and moves into the engine once a second game needs it. The 2023 build hand-wrote two foul rules in `rules.ts`:

- **G207 right of way**: contact by a robot in its opponent's protected zones (loading zone, community).
- **G202 pinning**: a 5-count on pressing an opponent that can't move.

Nearly every FRC season has both kinds: a pin count, and zones where an alliance's robots are protected from contact (loading areas, scoring areas, the endgame structure). At kickoff they would be rewritten from scratch each year. The bots also needed the same zones as `botHints.protectedZones`, so 2023 listed them twice.

Reading the 2023 manual again while porting showed where the first version had simplified:

- G207 applies to a robot with **any part** of itself in the opponent's zone; the rules used the robot's center.
- Contact was two centers within 0.95 m, a stand-in for bumpers touching. Side by side that called contact with an 11 cm gap, and corner to corner it missed contact up to 1.19 m apart.
- G202 pins last until the robots are 6 ft apart, either robot has moved 6 ft from where the pin started, or the pinning robot gets pinned; pinning the same robot again within 3 s resumes the count. The rules reset the count 30 cm after contact ended.

## Decision

- `GameDefinition.fouls` gains two declarative rules, enforced every tick of auto and teleop by `src/engine/sim/referee.ts`:
  - `contact: ContactFoulRule[]`: protected zones (sided zone base ids), whose position counts (`inside: 'intruder' | 'protected'`, any part of the robot unless `fully`), severity, `endgameOnly`, `repeatSec` ("per instance"), and an opt-in `forgiveForced` (the old G201 approximation).
  - `pinning: PinningRule`: count length, first and repeat severity, the release distance (default 6 ft: the robots that far apart, or either that far from where the pin started) and the re-pin window (default 3 s). The count pauses while the pin does, and a pin also ends when the pinning robot gets pinned (the usual FRC wording).
- Contact is bumper to bumper: the gap between the two robots' footprint boxes (separating-axis test) under 3 cm.
- Bots take their protected zones from the contact rules unless `botHints` overrides them. They now keep their whole body (not just their center) out of the opponent's protected zones when pathing, defending or fetching pieces, give opponents extra room while partly inside one, and back off past the pin release gap when they break off a pin.
- Rules the engine can't express as a foul stay in `rules.ts` or `botHints` (2023's G209 makes the touched robot count as engaged, so it is a bot-only `endgameProtectedZones` hint).

## Consequences

- A new game declares its pin count and protected zones as data; `rules.ts` is only for what is truly game-specific.
- 2023 is a model change (ADR 0006): every match changes. Over the same 150 random-lineup seeds, before → after:
  - G207 fouls per alliance per match: 0.6 → 1.6 (with the manual's wording and real contact but the old bots: 2.1).
  - Teleop points 74.6 / 72.6 → 73.4 / 73.7 (blue / red), within noise; total scores rise by the extra foul points.
  - Against a defender (Shutdown vs Typical, 100 seeds each way) the typical alliance draws 3.7-4.1 G207 fouls per match, mostly when the defender pushes it partly into the defender's own zone, which G201's blue box says is still a foul.
- The physics and the bots' play don't depend on fouls, so with the same bots only the ledger changes. That made the foul change measurable on identical play: 148 of 150 matches ended with identical robot poses before the bot changes.
- `forgiveForced` stays on for 2023 to keep the first build's decision; it is more lenient than the manual. The owner can turn it off.

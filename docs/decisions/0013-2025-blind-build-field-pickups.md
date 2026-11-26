# 0013: 2025 blind build: pickups on field structures, one-across limits, display poses

- Status: accepted
- Date: 2026-11-26

## Context

The owner asked for a blind build of 2025 REEFSCAPE from the official materials as of January 2025, with only the 2023 and 2024 builds as reference models. Three of its mechanics didn't fit the engine:

- **ALGAE resting on the REEF.** Six balls sit on each REEF's BRANCHES; a robot whose mechanism reaches one takes it, and until it does, the BRANCHES under it can't score. Physical pieces can't rest on the branches (the engine has no cradles, and a ball there would roll off), and the rules need to know when each one is gone. Robots also do this in AUTO, but bots only used stations in TELEOP, when human players feed.
- **G421**: at most one robot of an alliance fully on the opponent's side of the BARGE. Missed human-player throws land there and bots chased them in pairs, drawing ~4 foul points a match. The rules can call the foul, but nothing in a game definition can tell the bots about it.
- **CORAL on angled BRANCHES and in a trough** is drawn wrong when scored pieces are stacked straight up.

Defenders also read the alliance's "lane" from the centroid of its stations. With REEF ALGAE as stations, that centroid moved into the REEF, and the defender's guard post landed on a face's scoring spot, which G427 protects.

## Decision

All opt-in, so existing games are unchanged:

- `HumanPlayerStation.auto`: bots use the station in AUTO too. `HumanPlayerStation.lane: false`: the station isn't a loading area, so it doesn't count in the defenders' lane. `HumanPlayerStation.display`: a piece is drawn there while the station has supply left. A REEF ALGAE is a `supply: 1` station with `handoffHeight` at the ball's center.
- `RulesContext.stationUsed(stationId, alliance)`: rules see when a station's piece has been taken (2025 opens the BRANCHES).
- `BotHints.oneAcrossLine`: an x (blue's frame) past which at most one of an alliance's robots may be. Bots don't go past it for a loose piece, or to defend, while a teammate is there.
- `ScoringTarget.displayStep` and `displayRotation`: where each further scored piece is drawn, and how it's turned (render only).
- `Robot.setYaw` for tests and tools, next to `setPosition`.

`tests/symmetry.test.ts`'s opening-seconds check stops comparing a robot's position once it has touched a field element from the side, as it already did for robots chasing a piece. Rapier's contacts aren't mirror-exact, and in 2025 a robot's corner clips the REEF while it turns into a scoring spot within the first 1.5 s. Plans are still compared exactly.

## Consequences

- 2023, 2024 and the reference game are bit-identical (`npm run bench -- --compare`, 18 matches).
- A station that is really a piece on a structure isn't a physical piece: it can't be knocked off, and only the alliance that owns it can take it. 2025's `SOURCES.md` lists this under Simplifications.
- `oneAcrossLine` is a single line, which fits "one robot past mid-field" rules. A rule about a region of another shape would need more.

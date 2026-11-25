# 0011: Specialist roles are declared per game; close-out reads the scoreboard

- Status: accepted
- Date: 2026-11-25

## Context

The owner asked for the ideal 2024 alliance composition, found with the Monte Carlo match-ups and without changing any robot type. They also asked that new robot specialists and strategies be invented where needed. The search (`npm run alliances`, 2024 `SOURCES.md`) showed that three under-stage all-rounders lead every composition. What was left to choose was how they play: who goes for which target, and when they climb.

The engine had two roles (`score`, `defense`) and four alliance strategies. A role that keeps a robot to some targets (an AMP feeder, a TRAP robot) is game-specific: the targets are the game's. When an alliance climbs is generic: every FRC game ends with an endgame, and drive teams decide when to leave for it by the score.

## Decision

- **Specialist roles** are data in the game definition: `GameDefinition.roles`, each a `SpecialistRole` with teleop `targetWeights` that multiply `botHints.targetWeights` for that bot (0 = never). `RobotRole` is `'score' | 'defense'` or a game role's id. A specialist is a scoring bot in every other way. Auto routines ignore its weights, because they are programmed per robot type. The menu's role select lists the game's roles. The validator rejects unknown target ids, reserved ids and lineup slots naming a role the game doesn't have. A saved role is dropped when it isn't offered by the game.
- **'close-out'** is a fifth `AllianceStrategy`: balanced, but once the alliance's lead is safe (`safeLead`), its bots head for the endgame 15 s early like 'early-endgame'. A lead is safe when the opponents couldn't catch up in the time left even scoring at twice their rate so far. Bots read only the scoreboard (`Match.ledger.total`), which drive teams see too.
- 2024 declares three roles: AMP specialist (`amp` × 4), SPEAKER only (`amp` × 0), TRAP specialist (each TRAP × 3).

## Consequences

- Matches without a specialist role or 'close-out' are bit-identical (ADR 0006): the weight lookup returns the old value, and the endgame lead for the other strategies is unchanged.
- Weights bias a points-per-second planner. They don't script a job. A TRAP specialist still has to be holding a NOTE near the STAGE when the TRAPS open. Under 'close-out' with a safe lead it is already climbing by then, so the role changes nothing. Roles that need new behavior, like passing NOTES or holding one for AMPLIFICATION, would need planner code. 2024's `SOURCES.md` reads the kickoff G414 as forbidding full-court passes anyway.
- 'close-out' uses the ledger's running total, which counts foul points. A big foul swing can make a lead look safe a little early. It assumes a game where both alliances score at similar rates through the match. The factor of 2 was chosen as a margin, not fitted.

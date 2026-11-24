import { num, type CalibrationSpec } from '../../engine/sim/calibration.ts';
import { sourceBase, type AllianceResult } from '../../engine/sim/match.ts';

/**
 * OPT-IN (ADR 0004): the owner asked for this 2023 season comparison (CALIBRATION.md). Real: every
 * official 2023 event's qualification matches on The Blue Alliance. Sim: random robot types (the
 * menu's random preset) at normal difficulty. Per alliance per match.
 *
 *   npm run calibrate -- --game 2023-chargedup [--matches 200] [--write]
 */

/** Points an alliance got from ledger sources with these base ids. */
const pts = (s: AllianceResult, ...bases: string[]) =>
  Object.entries(s.sources).reduce((t, [k, v]) => t + (bases.includes(sourceBase(k)) ? v : 0), 0);

/** Pieces an alliance scored on its grid nodes in one period. */
const nodePieces = (s: AllianceResult, phase: 'auto' | 'teleop') =>
  Object.entries(s.targetCounts).reduce(
    (t, [id, c]) => t + (/^(hybrid|mid|high)-\d\./.test(id) ? c[phase] : 0),
    0,
  );

const docked = (s: AllianceResult) => (s.endgame.dock ?? 0) + (s.endgame.engage ?? 0);
/** Endgame Charge Station points: every docked robot gets 10 when the station is level, else 6. */
const endCs = (s: AllianceResult) => pts(s, 'dock', 'engage', 'engaged-partner', 'station-tipped');
const autoCs = (s: AllianceResult) => pts(s, 'auto-dock', 'auto-engage', 'auto-charge-limit');

const robotsDocked = (b: Record<string, unknown>) =>
  [1, 2, 3].filter((i) => b[`endGameChargeStationRobot${i}`] === 'Docked').length;

export const calibration: CalibrationSpec = {
  season: 2023,
  events: [],
  compLevels: ['qm'],
  metrics: [
    {
      name: 'Score excl. fouls',
      real: (b, score) => score - num(b, 'foulPoints'),
      sim: (s) => s.score - s.breakdown.penalty,
    },
    { name: 'Auto points', real: (b) => num(b, 'autoPoints'), sim: (s) => s.breakdown.auto },
    {
      name: 'Teleop game piece points',
      real: (b) => num(b, 'teleopGamePiecePoints'),
      sim: (s) => s.breakdown.teleop - pts(s, 'links'),
    },
    { name: 'Link points', real: (b) => num(b, 'linkPoints'), sim: (s) => pts(s, 'links') },
    {
      name: 'Endgame points (Charge Station + park)',
      real: (b) => num(b, 'endGameChargeStationPoints') + num(b, 'endGameParkPoints'),
      sim: (s) => s.breakdown.endgame,
    },
    { name: 'Auto pieces', real: (b) => num(b, 'autoGamePieceCount'), sim: (s) => nodePieces(s, 'auto') },
    {
      // TBA's teleopGamePieceCount is every piece on the grid at the end, auto ones included.
      name: 'Teleop pieces',
      real: (b) => num(b, 'teleopGamePieceCount') - num(b, 'autoGamePieceCount'),
      sim: (s) => nodePieces(s, 'teleop'),
    },
    {
      name: 'Robots with MOBILITY',
      real: (b) => num(b, 'autoMobilityPoints') / 3,
      sim: (s) => pts(s, 'mobility') / 3,
    },
    {
      name: 'Auto Charge Station: docked (share)',
      real: (b) => Number(num(b, 'autoChargeStationPoints') > 0),
      sim: (s) => Number(autoCs(s) > 0),
    },
    {
      name: 'Auto Charge Station: engaged (share)',
      real: (b) => Number(num(b, 'autoChargeStationPoints') === 12),
      sim: (s) => Number(autoCs(s) === 12),
    },
    { name: 'Robots docked at the end', real: (b) => robotsDocked(b), sim: (s) => docked(s) },
    {
      name: 'Robots engaged at the end',
      real: (b) => (b.endGameBridgeState === 'Level' ? robotsDocked(b) : 0),
      sim: (s) => (docked(s) > 0 && endCs(s) === 10 * docked(s) ? docked(s) : 0),
    },
    {
      name: 'Robots parked',
      real: (b) => num(b, 'endGameParkPoints') / 2,
      sim: (s) => pts(s, 'park') / 2,
    },
    {
      name: 'Sustainability RP (share)',
      real: (b) => num(b, 'sustainabilityBonusAchieved'),
      sim: (s) => Number(!!s.rpBreakdown.sustainability),
    },
    {
      name: 'Activation RP (share)',
      real: (b) => num(b, 'activationBonusAchieved'),
      sim: (s) => Number(!!s.rpBreakdown.activation),
    },
    {
      // Real fouls cover every rule; the sim calls only G207 and G202.
      name: 'Foul points drawn',
      real: (b) => num(b, 'foulPoints'),
      sim: (s) => s.breakdown.penalty,
    },
  ],
  notes: 'See the sections around this table.',
};

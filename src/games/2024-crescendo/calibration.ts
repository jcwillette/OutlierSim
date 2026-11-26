import { num, simCount, type CalibrationSpec } from '../../engine/sim/calibration.ts';
import { sourceBase, type AllianceResult } from '../../engine/sim/match.ts';
import { AMPLIFIED_MULTIPLIER, SPEAKER_POINTS } from './rules.ts';

/**
 * OPT-IN (ADR 0004): the owner asked for this 2024 season comparison (CALIBRATION.md, ADR 0012).
 * Real: every official 2024 event's qualification matches on The Blue Alliance. Sim: random robot
 * types (the menu's random preset) at normal difficulty. Per alliance per match.
 *
 *   npm run calibrate -- --game 2024-crescendo [--matches 200] [--write]
 */

/** Points an alliance got from ledger sources with these base ids. */
const pts = (s: AllianceResult, ...bases: string[]) =>
  Object.entries(s.sources).reduce((t, [k, v]) => t + (bases.includes(sourceBase(k)) ? v : 0), 0);

const ONSTAGE = new Set(['StageLeft', 'StageRight', 'CenterStage']);
const robots = (b: Record<string, unknown>, field: string, ok: (v: unknown) => boolean) =>
  [1, 2, 3].filter((i) => ok(b[`${field}${i}`])).length;

/** TELEOP SPEAKER NOTES scored while AMPLIFIED (5 points instead of 2). */
const amplifiedNotes = (s: AllianceResult) => {
  const teleopPts = pts(s, 'speaker') - SPEAKER_POINTS.auto * simCount(s, 'speaker', 'auto');
  const plain = SPEAKER_POINTS.teleop * simCount(s, 'speaker', 'teleop');
  return (teleopPts - plain) / (SPEAKER_POINTS.teleop * (AMPLIFIED_MULTIPLIER - 1));
};

const traps = (s: AllianceResult) => simCount(s, 'trap-1') + simCount(s, 'trap-2') + simCount(s, 'trap-3');

export const calibration: CalibrationSpec = {
  season: 2024,
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
      name: 'Teleop NOTE points (AMP + SPEAKER)',
      real: (b) => num(b, 'teleopTotalNotePoints'),
      sim: (s) =>
        pts(s, 'speaker', 'amp') -
        SPEAKER_POINTS.auto * simCount(s, 'speaker', 'auto') -
        2 * simCount(s, 'amp', 'auto'),
    },
    {
      name: 'Endgame points (STAGE)',
      real: (b) => num(b, 'endGameTotalStagePoints'),
      // TBA counts TRAP NOTES with the STAGE; the sim scores them as TELEOP target points.
      sim: (s) => s.breakdown.endgame + pts(s, 'trap-1', 'trap-2', 'trap-3'),
    },
    {
      name: 'Auto NOTES',
      real: (b) => num(b, 'autoAmpNoteCount') + num(b, 'autoSpeakerNoteCount'),
      sim: (s) => simCount(s, 'speaker', 'auto') + simCount(s, 'amp', 'auto'),
    },
    {
      name: 'Auto AMP NOTES',
      real: (b) => num(b, 'autoAmpNoteCount'),
      sim: (s) => simCount(s, 'amp', 'auto'),
    },
    {
      name: 'Teleop SPEAKER NOTES',
      real: (b) => num(b, 'teleopSpeakerNoteCount') + num(b, 'teleopSpeakerNoteAmplifiedCount'),
      sim: (s) => simCount(s, 'speaker', 'teleop'),
    },
    {
      name: 'Teleop SPEAKER NOTES, AMPLIFIED',
      real: (b) => num(b, 'teleopSpeakerNoteAmplifiedCount'),
      sim: amplifiedNotes,
    },
    {
      name: 'Teleop AMP NOTES',
      real: (b) => num(b, 'teleopAmpNoteCount'),
      sim: (s) => simCount(s, 'amp', 'teleop'),
    },
    {
      name: 'Robots with LEAVE',
      real: (b) => robots(b, 'autoLineRobot', (v) => v === 'Yes'),
      sim: (s) => pts(s, 'leave') / 2,
    },
    {
      name: 'Robots ONSTAGE',
      real: (b) => robots(b, 'endGameRobot', (v) => ONSTAGE.has(String(v))),
      sim: (s) => s.endgame['onstage'] ?? 0,
    },
    {
      name: 'Robots PARKED',
      real: (b) => robots(b, 'endGameRobot', (v) => v === 'Parked'),
      sim: (s) => pts(s, 'park'),
    },
    { name: 'NOTES in a TRAP', real: (b) => num(b, 'endGameNoteInTrapPoints') / 5, sim: traps },
    {
      name: 'HARMONY (share)',
      real: (b) => (num(b, 'endGameHarmonyPoints') > 0 ? 1 : 0),
      sim: (s) => (pts(s, 'harmony') > 0 ? 1 : 0),
    },
    {
      name: 'SPOTLIT points',
      real: (b) => num(b, 'endGameSpotLightBonusPoints'),
      sim: (s) => pts(s, 'spotlight'),
    },
    {
      name: 'Coopertition, both alliances (share)',
      real: (b) => num(b, 'coopertitionCriteriaMet'),
      sim: (s) => ((s.sources['coopertition'] ?? 0) > 0 ? 1 : 0),
    },
    {
      name: 'MELODY RP (share)',
      real: (b) => num(b, 'melodyBonusAchieved'),
      sim: (s) => (s.rpBreakdown['melody'] ? 1 : 0),
    },
    {
      name: 'ENSEMBLE RP (share)',
      real: (b) => num(b, 'ensembleBonusAchieved'),
      sim: (s) => (s.rpBreakdown['ensemble'] ? 1 : 0),
    },
    { name: 'Foul points drawn', real: (b) => num(b, 'foulPoints'), sim: (s) => s.breakdown.penalty },
  ],
};

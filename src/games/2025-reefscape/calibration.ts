import { num, simCount, type CalibrationSpec } from '../../engine/sim/calibration.ts';
import { sourceBase, type AllianceResult } from '../../engine/sim/match.ts';
import { CORAL_POINTS } from './definition.ts';
import { coopAchieved, levelOf } from './rules.ts';

/**
 * OPT-IN (ADR 0004): the owner asked for this 2025 season comparison (CALIBRATION.md, ADR 0014).
 * Real: every official 2025 event's qualification matches on The Blue Alliance. Sim: random robot
 * types (the menu's random preset) at normal difficulty. Per alliance per match.
 *
 *   npm run calibrate -- --game 2025-reefscape [--matches 200] [--write]
 *
 * How TBA records the REEF: `autoReef` is the REEF at the end of AUTO; `teleopReef` holds the
 * BRANCHES at the end of the match (AUTO CORAL still on them included) and the CORAL added to the
 * trough in TELEOP. A CORAL scores once (AUTO CORAL still on a BRANCH earns no TELEOP points), as in
 * the sim. `teleopCoralCount` changed meaning at the Championship (it counts AUTO CORAL there), so
 * TELEOP CORAL is counted from the REEF instead. `autoPoints` leaves ALGAE out (TBA puts every ALGAE
 * in `algaePoints`), so the sim's AUTO points leave them out too.
 */

/** Points an alliance got from ledger sources with these base ids. */
const pts = (s: AllianceResult, ...bases: string[]) =>
  Object.entries(s.sources).reduce((t, [k, v]) => t + (bases.includes(sourceBase(k)) ? v : 0), 0);

const LEVELS = ['L1', 'L2', 'L3', 'L4'] as const;
type Lv = (typeof LEVELS)[number];

/** CORAL an alliance scored in one period, per level [L1, L2, L3, L4]. */
function simCoral(s: AllianceResult, phase: 'auto' | 'teleop'): number[] {
  const out = [0, 0, 0, 0];
  for (const [id, c] of Object.entries(s.targetCounts)) {
    const lv = levelOf(sourceBase(id));
    if (lv >= 0) out[lv]! += c[phase];
  }
  return out;
}
const coralPoints = (counts: number[], phase: 'auto' | 'teleop') =>
  counts.reduce((t, n, i) => t + n * CORAL_POINTS[LEVELS[i]!][phase], 0);

/** TBA's REEF rows: botRow is L2, midRow L3, topRow L4. */
const ROWS: Record<Exclude<Lv, 'L1'>, string> = { L2: 'botRow', L3: 'midRow', L4: 'topRow' };
type Reef = Record<string, unknown> & { trough?: number };
const row = (reef: Reef, lv: Exclude<Lv, 'L1'>) => (reef[ROWS[lv]] ?? {}) as Record<string, boolean>;

/** Real CORAL per level in one period: AUTO from `autoReef`; TELEOP added to the end state. */
function realCoral(b: Record<string, unknown>, phase: 'auto' | 'teleop'): number[] {
  const auto = (b['autoReef'] ?? {}) as Reef;
  const end = (b['teleopReef'] ?? {}) as Reef;
  if (phase === 'auto') {
    return [
      num(auto, 'trough'),
      ...(['L2', 'L3', 'L4'] as const).map((lv) => Object.values(row(auto, lv)).filter((v) => v).length),
    ];
  }
  return [
    num(end, 'trough'),
    ...(['L2', 'L3', 'L4'] as const).map((lv) => {
      const a = row(auto, lv);
      return Object.entries(row(end, lv)).filter(([k, v]) => v && !a[k]).length;
    }),
  ];
}

const robots = (b: Record<string, unknown>, field: string, value: string) =>
  [1, 2, 3].filter((i) => b[`${field}${i}`] === value).length;

const coralMetric = (lv: number) => ({
  name: `Teleop CORAL on ${LEVELS[lv]}`,
  real: (b: Record<string, unknown>) => realCoral(b, 'teleop')[lv]!,
  sim: (s: AllianceResult) => simCoral(s, 'teleop')[lv]!,
});

export const calibration: CalibrationSpec = {
  season: 2025,
  events: [],
  compLevels: ['qm'],
  metrics: [
    {
      name: 'Score excl. fouls',
      real: (b, score) => score - num(b, 'foulPoints'),
      sim: (s) => s.score - s.breakdown.penalty,
    },
    {
      name: 'Auto points (LEAVE + CORAL)',
      real: (b) => num(b, 'autoPoints'),
      sim: (s) => pts(s, 'leave') + coralPoints(simCoral(s, 'auto'), 'auto'),
    },
    {
      name: 'Teleop CORAL points',
      real: (b) => num(b, 'teleopCoralPoints'),
      sim: (s) => coralPoints(simCoral(s, 'teleop'), 'teleop'),
    },
    { name: 'ALGAE points', real: (b) => num(b, 'algaePoints'), sim: (s) => pts(s, 'processor', 'net') },
    {
      name: 'BARGE points',
      real: (b) => num(b, 'endGameBargePoints'),
      sim: (s) => pts(s, 'park', 'deep', 'shallow'),
    },
    {
      name: 'Auto CORAL',
      real: (b) => realCoral(b, 'auto').reduce((t, n) => t + n, 0),
      sim: (s) => simCoral(s, 'auto').reduce((t, n) => t + n, 0),
    },
    { name: 'Auto CORAL on L4', real: (b) => realCoral(b, 'auto')[3]!, sim: (s) => simCoral(s, 'auto')[3]! },
    coralMetric(0),
    coralMetric(1),
    coralMetric(2),
    coralMetric(3),
    {
      name: 'PROCESSOR ALGAE',
      real: (b) => num(b, 'wallAlgaeCount'),
      sim: (s) => simCount(s, 'processor'),
    },
    {
      name: 'NET ALGAE (robots + HUMAN PLAYER)',
      real: (b) => num(b, 'netAlgaeCount'),
      sim: (s) => simCount(s, 'net'),
    },
    {
      name: 'Robots with LEAVE',
      real: (b) => robots(b, 'autoLineRobot', 'Yes'),
      sim: (s) => pts(s, 'leave') / 3,
    },
    {
      name: 'Robots on a deep CAGE',
      real: (b) => robots(b, 'endGameRobot', 'DeepCage'),
      sim: (s) => s.endgame['deep'] ?? 0,
    },
    {
      name: 'Robots on a shallow CAGE',
      real: (b) => robots(b, 'endGameRobot', 'ShallowCage'),
      sim: (s) => s.endgame['shallow'] ?? 0,
    },
    {
      name: 'Robots PARKED',
      real: (b) => robots(b, 'endGameRobot', 'Parked'),
      sim: (s) => pts(s, 'park') / 2,
    },
    {
      name: 'AUTO RP (share)',
      real: (b) => num(b, 'autoBonusAchieved'),
      sim: (s) => (s.rpBreakdown['auto'] ? 1 : 0),
    },
    {
      name: 'CORAL RP (share)',
      real: (b) => num(b, 'coralBonusAchieved'),
      sim: (s) => (s.rpBreakdown['coral'] ? 1 : 0),
    },
    {
      name: 'BARGE RP (share)',
      real: (b) => num(b, 'bargeBonusAchieved'),
      sim: (s) => (s.rpBreakdown['barge'] ? 1 : 0),
    },
    {
      // TBA's `coopertitionCriteriaMet` is per alliance: its own 2 PROCESSOR ALGAE.
      name: 'PROCESSOR 2+ ALGAE (share)',
      real: (b) => num(b, 'coopertitionCriteriaMet'),
      sim: (s) => (simCount(s, 'processor') >= 2 ? 1 : 0),
    },
    {
      name: 'Coopertition, both alliances (share)',
      real: (b, _score, opp) => num(b, 'coopertitionCriteriaMet') * num(opp, 'coopertitionCriteriaMet'),
      sim: (s, opp) => (coopAchieved(s, opp) ? 1 : 0),
    },
    { name: 'Foul points drawn', real: (b) => num(b, 'foulPoints'), sim: (s) => s.breakdown.penalty },
  ],
};

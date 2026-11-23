import { DEFAULT_METRICS, num, simCount, type CalibrationSpec } from '../../engine/sim/calibration.ts';

/**
 * Compare sim vs real for <YEAR>. Field names come from `npm run calibrate -- --game <id> --dump`.
 * Register in src/games/index.ts: { definition, calibration }.
 */
export const calibration: CalibrationSpec = {
  // early district event, strong district championship / regional, championship division
  events: ['<yyyy><event>', '<yyyy><event>'],
  metrics: [
    ...DEFAULT_METRICS,
    // {
    //   name: 'Teleop <piece> in <target>',
    //   real: (b) => num(b, 'teleop<Target>Count'),
    //   sim: (s) => simCount(s, '<target base id>', 'teleop'),
    // },
    // { name: 'Endgame points', real: (b) => num(b, 'endGame...Points'), sim: (s) => s.breakdown.endgame },
  ],
  notes: 'What was tuned to match, and the known gaps.',
};

void num;
void simCount;

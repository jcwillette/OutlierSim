import type { GameDefinition, Region2D } from '../../engine/sim/types.ts';
// import { rules } from './rules.ts';   // only if the game needs a custom mechanic

/**
 * <YEAR> <GAME NAME>: generated from the <YEAR> Game Manual (rev <X>, <date>) and reveal video.
 * Unofficial approximation for practice. See SOURCES.md for every value's citation and the list of
 * simplifications.
 *
 * Coordinates: WPILib field frame, meters. BLUE half authored; red derived by `field.symmetry`.
 */

const IN = 0.0254; // inches -> meters
const LB = 0.4536; // pounds -> kg
const L = 0; // TODO field length (m)
const W = 0; // TODO field width (m)
const rect = (x0: number, y0: number, x1: number, y1: number): Region2D => ({
  kind: 'rect',
  min: { x: x0, y: y0 },
  max: { x: x1, y: y1 },
});
const M = (page: number | string, what = '') => `Manual p.${page}${what ? ', ' + what : ''}`;

export const definition: GameDefinition = {
  id: '<year>-<slug>',
  year: 0,
  name: '<Game Name>',
  summary: '<2-3 sentences for students: what you score, where, and what the endgame is.>',
  timing: { autoSec: 15, transitionSec: 3, teleopSec: 135, endgameSec: 20, source: M(0) },
  field: {
    length: L,
    width: W,
    wallHeight: 20 * IN,
    symmetry: 'rotational', // or 'mirror': check the field drawings
    source: M(0),
    elements: [
      // { id: 'hub', name: 'Hub', side: 'blue', shape: { kind: 'box', size: { x, y, z } },
      //   position: { x, y, z: height / 2 }, color: 'alliance', source: M(0, 'Figure 5-x') },
    ],
    zones: [
      // { id: 'start', name: 'Starting zone', side: 'blue', region: rect(0, 0, x, W), source: M(0) },
    ],
  },
  pieces: [
    // { id: 'piece', name: 'Piece', shape: { kind: 'sphere', radius: 7 * IN }, mass: 0.5 * LB,
    //   color: '#f5c518', source: M(0) },
  ],
  staging: [],
  preload: {},
  startPoses: [
    { x: 0, y: 0, yaw: 0 },
    { x: 0, y: 0, yaw: 0 },
    { x: 0, y: 0, yaw: 0 },
  ],
  targets: [],
  stations: [],
  endgame: [],
  awards: [],
  rankingPoints: { win: 3, tie: 1, bonuses: [] },
  fouls: { minor: 0, major: 0, source: M(0) },
  archetypes: [
    // {
    //   id: 'allround', name: 'All-rounder', description: 'What students should picture.',
    //   frame: { length: 0.9, width: 0.9, height: 0.5 }, mass: 60,
    //   drive: { maxSpeed: 4.5, maxAccel: 10, maxOmega: 9 },
    //   capacity: { piece: 1 }, intake: { pieceTypes: ['piece'], timeSec: 0.3 },
    //   place: { L1: 0.6 }, endgame: { climb: 5 },
    // },
  ],
  defaultArchetype: 'allround',
  // rules,
  botHints: {},
};

// Silence unused helpers until they're needed.
void rect;
void LB;

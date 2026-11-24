import { IN, LB, cite, feet, rect } from '../../engine/sim/authoring.ts';
import type { GameDefinition } from '../../engine/sim/types.ts';
// import { GEARINGS, MOTORS, driveFor, onFieldMass, swerve, tank } from '../../engine/sim/drivetrain.ts';
// import { rules } from './rules.ts';   // only if the game needs a custom mechanic

/**
 * <YEAR> <GAME NAME>: generated from the <YEAR> Game Manual (rev <X>, <date>) and reveal video.
 * Unofficial approximation for practice. See SOURCES.md for every value's citation and the list of
 * simplifications.
 *
 * Coordinates: WPILib field frame, meters. BLUE half authored; red derived by `field.symmetry`.
 * Keep the manual's own figures in the expressions (`feet(54, 3.25)`, `14.25 * IN`) so a reviewer
 * can check them against the page.
 */

const M = cite('Manual'); // M(47, 'Table 6-2') -> "Manual p.47, Table 6-2"
const L = feet(0); // TODO field length, e.g. feet(54, 3.25)
const W = feet(0); // TODO field width

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
      // Ramps and platforms robots drive onto: a sloped `hull` at the manual's height with
      // nav: 'ramp'. Guards robots can't cross: nav: 'wall'. Structures robots fit under: nav: 'none'.
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
  rankingPoints: {
    win: 3,
    tie: 1,
    bonuses: [
      // { id: 'pieces', name: '<RP name>', rp: 1, kind: 'piecesAtLeast', count: 20, tags: ['<tag>'] },
      // { id: 'climb', name: '<RP name>', rp: 1, kind: 'pointsAtLeast', points: 14,
      //   sources: ['<endgame action id>', '<award id>'], source: M(0) },
    ],
  },
  fouls: {
    minor: 0,
    major: 0,
    // Protected zones (quote the rule: "any part of", "regardless of who initiates"):
    // contact: [{ id: 'G4xx', name: "contact in the opponent's <zone>", zones: ['<zone id>'],
    //   inside: 'intruder', severity: 'minor', repeatSec: 3, source: M(0, 'G4xx') }],
    // pinning: { id: 'G4xx', countSec: 5, releaseGap: feet(6), repinSec: 3, source: M(0, 'G4xx') },
    source: M(0),
  },
  archetypes: [
    // {
    //   id: 'allround', name: 'All-rounder', description: 'What students should picture.',
    //   frame: { length: 0.9, width: 0.9, height: 0.5 },
    //   // Weighed robot in lb (manual's weight rule); drive limits from COTS hardware, see drivetrain.ts.
    //   mass: onFieldMass(120),
    //   drive: driveFor(swerve(MOTORS.krakenX60, GEARINGS.mk4L2, 120), 9),
    //   capacity: { piece: 1 }, intake: { pieceTypes: ['piece'], timeSec: 0.3 },
    //   place: { L1: 0.6 }, endgame: { climb: 5 }, reliability: 0.95,
    // },
  ],
  defaultArchetype: 'allround',
  lineups: [
    // { id: 'powerhouse', name: 'Powerhouse', description: 'Three all-rounders.',
    //   robots: [{ archetype: 'allround' }, { archetype: 'allround' }, { archetype: 'allround' }] },
  ],
  // rules,
  botHints: {},
};

// Silence unused helpers until they're needed.
void rect;
void LB;

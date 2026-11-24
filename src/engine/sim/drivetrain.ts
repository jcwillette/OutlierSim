/**
 * Drive limits from real FRC drivetrain hardware, so archetypes state what they're built from
 * instead of a bare m/s number. Motor data are the vendors' published specs at 12 V; gearbox and
 * wheel options are the common COTS ones. Everything here is general FRC engineering knowledge, not
 * match data.
 *
 * The engine drives a robot with a constant acceleration up to `maxSpeed` (`Match.drive`). Real
 * drivetrains pull hardest from a stop (limited by traction or current) and taper off toward top
 * speed, so `driveFromHardware` integrates the motor curve and returns the constant acceleration
 * that covers a typical sprint in the same time.
 */

const LB = 0.45359237;
const IN = 0.0254;
const GRAVITY = 9.81;

export interface Motor {
  name: string;
  freeRpm: number;
  /** N·m at 12 V. */
  stallTorque: number;
  /** A at 12 V. */
  stallCurrent: number;
  /**
   * Typical per-motor current limit teams run on a drivetrain, A: high enough to accelerate hard,
   * low enough that four to six drive motors plus mechanisms don't brown out the robot.
   */
  driveCurrentLimit: number;
}

/** Published 12 V specs (CTRE / WCP for Falcon and Kraken, REV for NEO, VEX / AndyMark for CIM). */
export const MOTORS = {
  cim: { name: 'CIM', freeRpm: 5310, stallTorque: 2.42, stallCurrent: 133, driveCurrentLimit: 60 },
  neo: { name: 'NEO', freeRpm: 5676, stallTorque: 2.6, stallCurrent: 105, driveCurrentLimit: 50 },
  neoVortex: {
    name: 'NEO Vortex',
    freeRpm: 6784,
    stallTorque: 3.6,
    stallCurrent: 211,
    driveCurrentLimit: 60,
  },
  falcon500: {
    name: 'Falcon 500',
    freeRpm: 6380,
    stallTorque: 4.69,
    stallCurrent: 257,
    driveCurrentLimit: 70,
  },
  krakenX60: {
    name: 'Kraken X60',
    freeRpm: 6000,
    stallTorque: 7.09,
    stallCurrent: 366,
    driveCurrentLimit: 70,
  },
  krakenX60Foc: {
    name: 'Kraken X60 (FOC)',
    freeRpm: 5800,
    stallTorque: 9.37,
    stallCurrent: 483,
    driveCurrentLimit: 70,
  },
} as const satisfies Record<string, Motor>;

export interface Gearing {
  name: string;
  /** Motor turns per wheel turn. */
  ratio: number;
  wheelDiameterIn: number;
}

/** Common COTS drive gearings. Swerve modules have one drive motor each. */
export const GEARINGS = {
  /** Swerve Drive Specialties MK4 / MK4i / MK4n, 4 in wheel. */
  mk4L1: { name: 'SDS MK4i L1', ratio: 8.14, wheelDiameterIn: 4 },
  mk4L2: { name: 'SDS MK4i L2', ratio: 6.75, wheelDiameterIn: 4 },
  mk4L3: { name: 'SDS MK4i L3', ratio: 6.12, wheelDiameterIn: 4 },
  /** REV MAXSwerve, 3 in wheel, 12T / 13T / 14T pinion. */
  maxSwerveLow: { name: 'REV MAXSwerve 12T', ratio: 5.5, wheelDiameterIn: 3 },
  maxSwerveMid: { name: 'REV MAXSwerve 13T', ratio: 5.08, wheelDiameterIn: 3 },
  maxSwerveHigh: { name: 'REV MAXSwerve 14T', ratio: 4.71, wheelDiameterIn: 3 },
  /** Tank gearboxes on 6 in wheels: AndyMark Toughbox Mini ratios (Kit of Parts chassis) and 3-motor equivalents. */
  tank845: { name: '8.45:1 on 6 in wheels', ratio: 8.45, wheelDiameterIn: 6 },
  tank1071: { name: '10.71:1 on 6 in wheels', ratio: 10.71, wheelDiameterIn: 6 },
  tank1275: { name: '12.75:1 on 6 in wheels', ratio: 12.75, wheelDiameterIn: 6 },
} as const satisfies Record<string, Gearing>;

/**
 * Practical top speed as a share of theoretical free speed (load, voltage sag, friction). Chief
 * Delphi rules of thumb are 80-85 % for swerve; AndyMark rates its tank Kit of Parts chassis at 75-77 %
 * (a CIM at 4100 of 5310 rpm), as skid-steer scrub costs more.
 */
export const TOP_SPEED_SHARE = { swerve: 0.85, tank: 0.77 } as const;
/** Gearbox + wheel efficiency on force. */
const DRIVE_EFFICIENCY = 0.9;
/** Sprint length the effective acceleration is fitted over, m (a short cycle leg). */
const SPRINT_M = 5;

export interface DrivetrainSpec {
  kind: 'swerve' | 'tank';
  motor: Motor;
  /** Drive motors in total (4 for swerve, 4 or 6 for tank). */
  motors: number;
  gearing: Gearing;
  /** On-field mass incl. bumpers and battery, kg (see `onFieldMass`). */
  mass: number;
  /** Wheel-carpet friction coefficient. Default 1.1 (swerve tread); ~1.3-1.4 for high-grip tank tread. */
  traction?: number;
  /** Override the motor's typical drive current limit, A. */
  currentLimit?: number;
  /**
   * Tall robots: center-of-gravity height and the distance from the robot's center to its front
   * wheel contact, m. Acceleration is capped at g x wheelbase / cgHeight so the robot doesn't tip.
   */
  tipping?: { cgHeight: number; halfWheelbase: number };
}

export interface DriveLimits {
  /** Practical top speed, m/s. */
  maxSpeed: number;
  /** Constant acceleration that matches the motor-curve sprint time, m/s². */
  maxAccel: number;
  /** Theoretical free speed, m/s (for documentation). */
  freeSpeed: number;
  /** Seconds to cover a 5 m sprint from rest (for documentation). */
  sprintSec: number;
}

/** Robot mass on the field: the weighed robot plus battery and bumpers. */
export function onFieldMass(robotLb: number, opts: { batteryLb?: number; bumpersLb?: number } = {}): number {
  // A 17-18 Ah sealed lead-acid FRC battery with its leads is ~13 lb; a bumper set is 12-15 lb
  // (2023-2024 rules capped it at 15 lb).
  return (robotLb + (opts.batteryLb ?? 13) + (opts.bumpersLb ?? 14)) * LB;
}

export function driveFromHardware(s: DrivetrainSpec): DriveLimits {
  const r = (s.gearing.wheelDiameterIn * IN) / 2;
  const freeSpeed = ((s.motor.freeRpm / s.gearing.ratio) * 2 * Math.PI * r) / 60;
  const maxSpeed = freeSpeed * TOP_SPEED_SHARE[s.kind];
  const traction = (s.traction ?? 1.1) * s.mass * GRAVITY;
  const kT = s.motor.stallTorque / s.motor.stallCurrent;
  const limit = s.currentLimit ?? s.motor.driveCurrentLimit;
  const force = (v: number) => {
    const torque = Math.min(kT * limit, s.motor.stallTorque * (1 - v / freeSpeed));
    const tip = s.tipping ? (s.mass * GRAVITY * s.tipping.halfWheelbase) / s.tipping.cgHeight : Infinity;
    return Math.min(traction, tip, (s.motors * torque * s.gearing.ratio * DRIVE_EFFICIENCY) / r);
  };
  // Integrate a 5 m sprint from rest, speed capped at the practical top speed.
  let v = 0;
  let x = 0;
  let t = 0;
  const dt = 0.001;
  while (x < SPRINT_M && t < 20) {
    v = Math.min(maxSpeed, v + (force(v) / s.mass) * dt);
    x += v * dt;
    t += dt;
  }
  // Constant-acceleration ramp to maxSpeed covering the same distance in the same time:
  // T = d/v + v/(2a) with a cruise phase, else d = a T^2 / 2.
  const cruise = t - SPRINT_M / maxSpeed;
  let maxAccel = cruise > 0 ? maxSpeed / (2 * cruise) : (2 * SPRINT_M) / (t * t);
  if (cruise > 0 && (maxSpeed * maxSpeed) / (2 * maxAccel) > SPRINT_M) maxAccel = (2 * SPRINT_M) / (t * t);
  return { maxSpeed, maxAccel, freeSpeed, sprintSec: t };
}

/** Four-module swerve; `robotLb` is the weighed robot (battery and bumpers are added). */
export function swerve(
  motor: Motor,
  gearing: Gearing,
  robotLb: number,
  opts: { tipping?: DrivetrainSpec['tipping']; bumpersLb?: number; traction?: number } = {},
): DrivetrainSpec {
  return {
    kind: 'swerve',
    motor,
    motors: 4,
    gearing,
    mass: onFieldMass(robotLb, opts),
    ...(opts.tipping ? { tipping: opts.tipping } : {}),
    ...(opts.traction !== undefined ? { traction: opts.traction } : {}),
  };
}

/** Skid-steer tank with `motors` drive motors in total; `robotLb` as for `swerve`. */
export function tank(
  motor: Motor,
  motors: number,
  gearing: Gearing,
  robotLb: number,
  opts: { bumpersLb?: number; traction?: number } = {},
): DrivetrainSpec {
  return {
    kind: 'tank',
    motor,
    motors,
    gearing,
    mass: onFieldMass(robotLb, opts),
    ...(opts.traction !== undefined ? { traction: opts.traction } : {}),
  };
}

/**
 * `RobotArchetype.drive` fields from hardware (rounded to 0.01), plus the turn rate, which depends on
 * driver comfort more than on the motors.
 */
export function driveFor(
  s: DrivetrainSpec,
  maxOmega: number,
): { maxSpeed: number; maxAccel: number; maxOmega: number; traction?: number } {
  const d = driveFromHardware(s);
  const round = (x: number) => Math.round(x * 100) / 100;
  return {
    maxSpeed: round(d.maxSpeed),
    maxAccel: round(d.maxAccel),
    maxOmega,
    ...(s.traction !== undefined ? { traction: s.traction } : {}),
  };
}

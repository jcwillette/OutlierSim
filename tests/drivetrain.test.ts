import { describe, expect, it } from 'vitest';
import {
  GEARINGS,
  MOTORS,
  driveFor,
  driveFromHardware,
  onFieldMass,
  swerve,
  tank,
} from '../src/engine/sim/drivetrain.ts';
import { findGame } from '../src/games/index.ts';

const FT = 0.3048;
const LB = 0.45359237;

describe('drivetrain hardware -> drive limits', () => {
  it('free speed matches the vendor math (rpm / ratio x wheel circumference)', () => {
    // SDS MK4i L2 + Falcon 500: 6380 / 6.75 rpm on a 4 in wheel = 16.5 ft/s.
    const d = driveFromHardware(swerve(MOTORS.falcon500, GEARINGS.mk4L2, 125));
    expect(d.freeSpeed / FT).toBeCloseTo(16.5, 1);
    expect(d.maxSpeed / d.freeSpeed).toBeCloseTo(0.85, 5);
    // AndyMark rates the 8.45:1 Kit of Parts chassis at 12.7 ft/s (a CIM at 4100 rpm).
    const kop = driveFromHardware(tank(MOTORS.cim, 4, GEARINGS.tank845, 90));
    expect(kop.maxSpeed / FT).toBeCloseTo(12.7, 0);
  });

  it('adds battery and bumpers to the weighed robot', () => {
    expect(onFieldMass(125) / LB).toBeCloseTo(152, 5);
    expect(onFieldMass(125, { bumpersLb: 15, batteryLb: 12 }) / LB).toBeCloseTo(152, 5);
  });

  it('acceleration stays physical: below traction, lower for tall or heavy robots', () => {
    for (const spec of [
      swerve(MOTORS.falcon500, GEARINGS.mk4L2, 125),
      swerve(MOTORS.neo, GEARINGS.maxSwerveHigh, 100),
      swerve(MOTORS.krakenX60Foc, GEARINGS.mk4L3, 115),
      tank(MOTORS.cim, 4, GEARINGS.tank1071, 90, { traction: 1 }),
    ]) {
      const d = driveFromHardware(spec);
      expect(d.maxAccel).toBeGreaterThan(4);
      expect(d.maxAccel).toBeLessThanOrEqual((spec.traction ?? 1.1) * 9.81 + 0.01);
      expect(d.sprintSec).toBeGreaterThan(1);
      expect(d.sprintSec).toBeLessThan(2.5);
    }
    const low = driveFromHardware(swerve(MOTORS.falcon500, GEARINGS.mk4L2, 125));
    const tall = driveFromHardware(
      swerve(MOTORS.falcon500, GEARINGS.mk4L2, 125, { tipping: { cgHeight: 0.6, halfWheelbase: 0.29 } }),
    );
    expect(tall.maxAccel).toBeLessThan(low.maxAccel);
    const light = driveFromHardware(swerve(MOTORS.neo, GEARINGS.mk4L2, 90));
    const heavy = driveFromHardware(swerve(MOTORS.neo, GEARINGS.mk4L2, 125));
    expect(light.maxAccel).toBeGreaterThan(heavy.maxAccel);
  });

  it('driveFor gives archetype-ready fields', () => {
    const d = driveFor(tank(MOTORS.falcon500, 6, GEARINGS.tank1071, 125, { traction: 1.35 }), 6);
    expect(d.maxOmega).toBe(6);
    expect(d.traction).toBe(1.35);
    expect(Number.isInteger(d.maxSpeed * 100)).toBe(true);
  });

  it('every shipped robot is a plausible FRC robot', () => {
    for (const id of ['2023-chargedup', '0000-reference']) {
      for (const a of findGame(id)!.archetypes) {
        expect(a.drive.maxSpeed / FT, `${id} ${a.id} speed`).toBeGreaterThan(9);
        expect(a.drive.maxSpeed / FT, `${id} ${a.id} speed`).toBeLessThan(17);
        expect(a.mass / LB, `${id} ${a.id} weight`).toBeGreaterThan(100);
        expect(a.mass / LB, `${id} ${a.id} weight`).toBeLessThan(156);
      }
    }
  });
});

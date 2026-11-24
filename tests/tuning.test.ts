import { beforeAll, describe, expect, it } from 'vitest';
import { Match, faultRates, initPhysics } from '../src/engine/sim/index.ts';
import { findGame } from '../src/games/index.ts';
import { applyTuning, robotFields, sanitizeTuning, stationFields } from '../src/ui/tuning.ts';

beforeAll(async () => {
  await initPhysics();
});

const cu = findGame('2023-chargedup')!;
const arch = (def: typeof cu, id: string) => def.archetypes.find((a) => a.id === id)!;
const FT = 0.3048;

describe('menu tuning', () => {
  it('lists only the mechanisms a robot has, with defaults in display units', () => {
    const kit = arch(cu, 'kitbot');
    const fields = robotFields(cu, kit);
    const keys = fields.map((f) => f.key);
    expect(keys).toContain('maxSpeed');
    expect(keys).toContain('place:hybrid');
    expect(keys).toContain('endgame:dock');
    expect(keys).not.toContain('place:high-cone');
    expect(keys).not.toContain('reloadSec'); // no shooter
    const speed = fields.find((f) => f.key === 'maxSpeed')!;
    expect(speed.get(kit)).toBeCloseTo(kit.drive.maxSpeed / FT, 5); // ft/s
    const fail = fields.find((f) => f.key === 'mechFailChance')!;
    expect(fail.get(kit)).toBeCloseTo(faultRates(kit).mechFailChance * 100, 5);
  });

  it('applies overrides to a copy and leaves the game untouched', () => {
    const tuned = applyTuning(cu, {
      robots: {
        kitbot: { maxSpeed: 15, maxAccel: 30, 'place:hybrid': 0.5, breakdownChance: 50, stallsPerMatch: 2 },
      },
      stations: { 'double-cone': { handoffSec: 4, feedIntervalSec: 6, supply: 5 } },
    });
    const k = arch(tuned, 'kitbot');
    expect(k.drive.maxSpeed).toBeCloseTo(15 * FT, 6);
    expect(k.drive.maxAccel).toBeCloseTo(30 * FT, 6);
    expect(k.place!.hybrid).toBe(0.5);
    expect(faultRates(k).breakdownChance).toBeCloseTo(0.5, 6);
    expect(faultRates(k).stallsPerMatch).toBe(2);
    const st = tuned.stations.find((s) => s.id === 'double-cone')!;
    expect(st).toMatchObject({ handoffSec: 4, feedIntervalSec: 6, supply: 5 });
    // Original definition unchanged.
    expect(arch(cu, 'kitbot').drive.maxSpeed).toBeLessThan(15 * FT);
    expect(arch(cu, 'kitbot').faults).toBeUndefined();
    expect(cu.stations.find((s) => s.id === 'double-cone')!.handoffSec).toBe(1.5);
    // Untouched robots are shared, not copied.
    expect(arch(tuned, 'elevator')).toBe(arch(cu, 'elevator'));
    // A match runs with the tuned definition.
    const m = new Match(tuned, { seed: 1, archetypes: { 0: 'kitbot' } });
    expect(m.robots[0]!.archetype.drive.maxSpeed).toBeCloseTo(15 * FT, 6);
  });

  it('sanitizes saved tuning: unknown keys dropped, values clamped', () => {
    const t = sanitizeTuning(cu, {
      robots: {
        kitbot: { maxSpeed: 999, bogus: 3, reloadSec: 1, 'place:hybrid': 'x' },
        nope: { maxSpeed: 10 },
      },
      stations: { 'double-cone': { handoffSec: -5 } },
    });
    expect(t.robots).toEqual({ kitbot: { maxSpeed: 22 } });
    expect(t.stations).toEqual({ 'double-cone': { handoffSec: 0 } });
    expect(sanitizeTuning(cu, null)).toEqual({ robots: {}, stations: {} });
    expect(applyTuning(cu, undefined)).toBe(cu);
  });

  it('every field round-trips its own default and passes validation at both ends of its range', () => {
    for (const a of cu.archetypes) {
      for (const f of robotFields(cu, a)) {
        for (const v of [f.min, f.max]) {
          const tuned = applyTuning(cu, { robots: { [a.id]: { [f.key]: v } }, stations: {} });
          const fresh = robotFields(tuned, arch(tuned, a.id)).find((g) => g.key === f.key)!;
          expect(fresh.get(arch(tuned, a.id)), `${a.id} ${f.key}`).toBeCloseTo(v, 6);
          expect(() => new Match(tuned, { seed: 1 })).not.toThrow();
        }
      }
    }
    for (const st of cu.stations) expect(stationFields(st).length).toBeGreaterThan(0);
  });

  it('fault-rate overrides drive the breakdown roll', () => {
    const tuned = applyTuning(cu, {
      robots: { elevator: { breakdownChance: 90, mechFailChance: 90, breakdownRecoverChance: 0 } },
      stations: {},
    });
    let dead = 0;
    let back = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const m = new Match(tuned, {
        seed,
        archetypes: Object.fromEntries([0, 1, 2, 3, 4, 5].map((i) => [i, 'elevator'])),
        breakdowns: true,
      });
      for (const r of m.robots) {
        if (r.breakdownAt !== null) dead++;
        if (r.breakdownRecoverAt !== null) back++;
      }
    }
    expect(dead / 120).toBeGreaterThan(0.8);
    expect(back).toBe(0);
  });
});

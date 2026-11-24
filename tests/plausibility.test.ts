import { describe, expect, it } from 'vitest';
import { findGame } from '../src/games/index.ts';
import { lineupsFor, pieceCeiling } from '../tools/plausibility.ts';

describe('plausibility tool helpers', () => {
  const cu = findGame('2023-chargedup')!;
  const ref = findGame('0000-reference')!;
  it("plays the game's lineup presets, or its default robot three times", () => {
    expect(lineupsFor(cu).map((l) => l.id)).toEqual(cu.lineups!.map((l) => l.id));
    expect(lineupsFor(cu, ['shutdown'])[0]!.roles).toEqual([undefined, undefined, 'defense']);
    expect(lineupsFor(ref)).toEqual([
      expect.objectContaining({ id: 'default', archetypes: ['allround', 'allround', 'allround'] }),
    ]);
    expect(() => lineupsFor(cu, ['nope'])).toThrow(/Unknown lineup 'nope'/);
  });
  it('bounds the pieces an alliance can score from the definition', () => {
    // 2023: 3 preloads + 4 staged + 42 at the substations, into 27 nodes + 27 supercharge slots.
    expect(pieceCeiling(cu)).toMatchObject({ available: 49, capacity: 54 });
    // The reference game recycles its orbs: no bound.
    expect(pieceCeiling(ref).available).toBe(Infinity);
  });
});

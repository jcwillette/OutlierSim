import { describe, expect, it } from 'vitest';
import { findGame } from '../src/games/index.ts';
import { lineupsFor, pieceCeiling } from '../tools/plausibility.ts';

describe('plausibility tool helpers', () => {
  const cu = findGame('2023-chargedup')!;
  const ref = findGame('0000-reference')!;
  it("plays the game's lineup presets, or its default robot three times", () => {
    expect(lineupsFor(cu).map((l) => l.id)).toEqual(cu.lineups!.map((l) => l.id));
    expect(lineupsFor(cu, ['shutdown'])[0]!.roles).toEqual([undefined, undefined, 'defense']);
    expect(lineupsFor({ ...ref, lineups: [] })).toEqual([
      expect.objectContaining({ id: 'default', archetypes: ['allround', 'allround', 'allround'] }),
    ]);
    expect(() => lineupsFor(cu, ['nope'])).toThrow(/Unknown lineup 'nope'/);
  });
  it('bounds the pieces an alliance can score from the definition', () => {
    // 2023: 3 preloads + 8 staged (4 per alliance, either can take them) + 42 at its substations,
    // into 27 nodes + 27 supercharge slots.
    expect(pieceCeiling(cu)).toMatchObject({ available: 53, capacity: 54 });
    // The reference game recycles its orbs: no bound.
    expect(pieceCeiling(ref).available).toBe(Infinity);
  });
});

describe('plausibility tool, end to end', () => {
  it('runs validation, the audit and a tiny matrix in worker threads', async () => {
    const { execFile } = await import('node:child_process');
    const out = await new Promise<string>((resolve, reject) =>
      execFile(
        process.execPath,
        [
          '--import',
          'tsx',
          'tools/plausibility.ts',
          '--game',
          '2023-chargedup',
          '--matches',
          '1',
          '--difficulties',
          'normal',
          '--lineups',
          'typical',
          '--workers',
          '1',
        ],
        { timeout: 120_000 },
        (err, stdout) => (err ? reject(err) : resolve(stdout)),
      ),
    );
    expect(out).toContain('validateDefinition: 0 errors');
    expect(out).toContain('auditDefinition');
    expect(out).toMatch(/\| Typical qualification alliance \| normal \| \d+/);
    expect(out).toMatch(/^- (PASS|WARN) Difficulty|^- (PASS|WARN) Pieces/m);
  }, 120_000);
});

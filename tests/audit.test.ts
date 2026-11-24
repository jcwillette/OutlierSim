import { describe, expect, it } from 'vitest';
import { auditDefinition } from '../src/engine/ai/audit.ts';
import type { GameDefinition } from '../src/engine/sim/types.ts';
import { GAMES } from '../src/games/index.ts';
import { miniGame } from './fixtures/mini-game.ts';

/** The static "can the bots play this?" audit catches the usual kickoff-build geometry mistakes. */

const errors = (def: GameDefinition) =>
  auditDefinition(def)
    .filter((i) => i.level === 'error')
    .map((i) => `${i.subject}: ${i.message}`);

describe.each(GAMES.map((g) => [g.definition.id, g.definition] as const))('audit of %s', (_id, def) => {
  it('finds nothing the bots could not use', () => {
    expect(errors(def)).toEqual([]);
  });
});

describe('auditDefinition', () => {
  it('accepts the fixture', () => {
    expect(errors(miniGame())).toEqual([]);
  });

  it('flags a place zone too small for any robot to stand in', () => {
    const def = miniGame();
    def.targets[1]!.place!.zone = { kind: 'rect', min: { x: 0.05, y: 0.05 }, max: { x: 0.25, y: 0.25 } };
    expect(errors(def)).toEqual([expect.stringMatching(/^target shelf: bots can't place here/)]);
  });

  it('flags a goal too high for every shooter', () => {
    const def = miniGame();
    def.targets[0]!.aperture!.center.z = 12;
    expect(errors(def)).toEqual([
      expect.stringMatching(/^target goal: no reachable spot .* can make the shot/),
    ]);
  });

  it('flags an endgame zone walled off from the start', () => {
    const def = miniGame();
    // A closed box of walls around the bar zone at (1.2, 4)... and the robots start at x = 1:
    // move the bar to the middle of a walled pen at (10, 4).
    def.endgame[0]!.zones = [{ kind: 'circle', center: { x: 10, y: 4 }, radius: 0.5 }];
    const wall = (id: string, x: number, y: number, sx: number, sy: number) => ({
      id,
      side: 'neutral' as const,
      shape: { kind: 'box' as const, size: { x: sx, y: sy, z: 0.5 } },
      position: { x, y, z: 0.25 },
    });
    def.field.elements.push(
      wall('pen-n', 10, 5.5, 3.2, 0.1),
      wall('pen-s', 10, 2.5, 3.2, 0.1),
      wall('pen-w', 8.45, 4, 0.1, 3.1),
      wall('pen-e', 11.55, 4, 0.1, 3.1),
    );
    expect(errors(def)).toEqual([expect.stringMatching(/^endgame bar: no reachable zone/)]);
  });

  it('flags a staged piece nobody can get an intake on', () => {
    const def = miniGame();
    def.staging[0]!.positions = [{ x: 5, y: 6 }]; // inside the pillar (a coordinate mistake)
    expect(errors(def)).toEqual([expect.stringMatching(/^staged ball at \(5.00, 6.00\): no robot can line/)]);
  });

  it('flags a start pose inside a field element', () => {
    const def = miniGame();
    def.startPoses[2] = { x: 5, y: 6, yaw: 0 }; // on the pillar
    expect(errors(def)).toContain('start pose 3: a basic robot there overlaps a field element');
  });

  it('flags a station zone no robot can get into', () => {
    const def = miniGame({
      stations: [
        {
          id: 'feeder',
          name: 'Feeder',
          side: 'blue',
          zone: { kind: 'rect', min: { x: 4.8, y: 5.8 }, max: { x: 5.2, y: 6.2 } }, // under the pillar
          pieceTypes: ['ball'],
          mode: 'direct',
          feedIntervalSec: 1,
          source: 'test',
        },
      ],
    });
    expect(errors(def)).toEqual(["station feeder: bots can't get into the station zone (basic)"]);
  });
});

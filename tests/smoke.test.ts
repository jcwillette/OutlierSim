import { describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';

describe('toolchain', () => {
  it('loads Rapier physics in Node', async () => {
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: 0, z: -9.81 });
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0, 1));
    world.createCollider(RAPIER.ColliderDesc.ball(0.1), body);
    for (let i = 0; i < 30; i++) world.step();
    expect(body.translation().z).toBeLessThan(1);
  });
});

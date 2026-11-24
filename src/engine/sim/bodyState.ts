import RAPIER from '@dimforge/rapier3d-compat';

/**
 * Fast, exact access to rigid-body state.
 *
 * Reading a body's translation through Rapier costs about five JS↔WASM calls and two allocations,
 * and the bots read robot and piece positions millions of times per match. `Robot` and `Piece`
 * therefore cache what they read, tagged with `bodyEpoch`. The epoch advances on every physics
 * step and on every call of a `RigidBody` method that isn't a known pure read (`setTranslation`,
 * `applyImpulse`, `setBodyType`, …, from any code, tests included). So a cached value is always
 * exactly what Rapier would return: the cache changes speed, never results.
 */
export let bodyEpoch = 0;

/** `RigidBody` methods that only read state. Every other method advances the epoch. */
const PURE_READS = new Set([
  'additionalPgsIterations',
  'additionalSolverIterations',
  'angularDamping',
  'angvel',
  'bodyType',
  'collider',
  'dominanceGroup',
  'effectiveAngularInertia',
  'effectiveInvMass',
  'effectiveWorldInvInertia',
  'gravityScale',
  'invMass',
  'invPrincipalInertia',
  'isCcdEnabled',
  'isDynamic',
  'isEnabled',
  'isFixed',
  'isKinematic',
  'isMoving',
  'isSleeping',
  'isSoftFrame',
  'isValid',
  'linearDamping',
  'linvel',
  'localCom',
  'mass',
  'nextRotation',
  'nextTranslation',
  'numColliders',
  'principalInertia',
  'principalInertiaLocalFrame',
  'rotation',
  'softBody',
  'softCcdPrediction',
  'softCluster',
  'translation',
  'userForce',
  'userTorque',
  'velocityAtPoint',
  'worldCom',
]);

/** Wrap a prototype method so calling it first advances the epoch. */
function invalidating(proto: object, name: string): void {
  const d = Object.getOwnPropertyDescriptor(proto, name);
  if (!d || typeof d.value !== 'function') return;
  const original = d.value as (...args: unknown[]) => unknown;
  Object.defineProperty(proto, name, {
    ...d,
    value: function (this: unknown, ...args: unknown[]) {
      bodyEpoch++;
      return original.apply(this, args);
    },
  });
}

// Installed once, when the engine is first imported. Unknown (e.g. newer) methods count as writes.
for (const name of Object.getOwnPropertyNames(RAPIER.RigidBody.prototype))
  if (name !== 'constructor' && !PURE_READS.has(name)) invalidating(RAPIER.RigidBody.prototype, name);
invalidating(RAPIER.World.prototype, 'step');

/**
 * Advance the physics one step. Same as `world.step()` minus the soft-body bookkeeping Rapier 0.21
 * runs after every step (it walks every body and collider through JS↔WASM callbacks to pick up
 * bodies that soft bodies created or removed). The engine has no soft bodies, and bodies it creates
 * or removes are registered by those calls themselves, so the physics is identical.
 */
export function stepWorld(w: RAPIER.World): void {
  w.physicsPipeline.step(
    w.gravity,
    w.integrationParameters,
    w.islands,
    w.broadPhase,
    w.narrowPhase,
    w.bodies,
    w.colliders,
    w.softBodies,
    w.impulseJoints,
    w.multibodyJoints,
    w.ccdSolver,
  );
  bodyEpoch++;
}

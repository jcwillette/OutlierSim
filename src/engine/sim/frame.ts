import { wrapAngle, type Quat, type Symmetry } from './math.ts';
import type { Alliance, Vec2, Vec3 } from './types.ts';

/**
 * 1, or -1 where an alliance's frame is blue's mirrored (red on a mirror-symmetric field). Blue's
 * left is then red's right, so a fixed turn or side preference (try left first, break a half-turn
 * tie counterclockwise) must be multiplied by this to treat both alliances alike (ADR 0007). A
 * rotational field keeps handedness.
 */
export function handedness(alliance: Alliance, symmetry: Symmetry): 1 | -1 {
  return alliance === 'red' && symmetry === 'mirror' ? -1 : 1;
}

/**
 * Field coordinates <-> Rapier's (ADR 0007). Everything outside the physics calls works in field
 * coordinates (WPILib frame); only this map knows where Rapier's world sits.
 *
 * - Centered: Rapier's origin is the field center. Rapier works in float32, whose steps grow with
 *   distance from the origin, so an origin at the blue corner would round red's half more coarsely
 *   than blue's (8x at the grids). Centered, both halves round alike.
 * - Flipped in every other match: Rapier's world is then the field's mirror / rotation image, i.e.
 *   laid out from the red end. Rapier's contact solver resolves a contact a little differently from
 *   its mirror image, and on a symmetric field that consistently favors the robots at one end.
 *   Alternating the ends between matches leaves neither alliance with the edge over a run.
 *
 * Every map here is its own inverse (field -> physics and physics -> field alike).
 */
export class PhysicsFrame {
  private readonly sx: 1 | -1;
  private readonly sy: 1 | -1;
  /** A mirror reverses turning (heading, turn rate); a rotation doesn't. */
  private readonly mirrored: boolean;

  constructor(
    /** Field position of Rapier's origin. */
    readonly origin: Vec2,
    /** Rapier's world is the field's mirror / rotation image (`symmetry`). */
    readonly flipped = false,
    readonly symmetry: Symmetry = 'mirror',
  ) {
    this.sx = flipped ? -1 : 1;
    this.sy = flipped && symmetry === 'rotational' ? -1 : 1;
    this.mirrored = flipped && symmetry === 'mirror';
  }

  /** A field point in physics coordinates. */
  toPhysics(p: Vec3): Vec3 {
    return { x: this.sx * (p.x - this.origin.x), y: this.sy * (p.y - this.origin.y), z: p.z };
  }
  /** Field x / y of a physics position. */
  fieldX(x: number): number {
    return this.origin.x + this.sx * x;
  }
  fieldY(y: number): number {
    return this.origin.y + this.sy * y;
  }
  /** A direction (velocity, impulse, vertex offset) in the other frame. */
  vector(v: Vec3): Vec3 {
    return { x: this.sx * v.x, y: this.sy * v.y, z: v.z };
  }
  /** The heading of something with a front (a robot) in the other frame. */
  yaw(yaw: number): number {
    if (!this.flipped) return yaw;
    return wrapAngle(this.mirrored ? Math.PI - yaw : yaw + Math.PI);
  }
  /** A turn rate about z in the other frame. */
  omega(w: number): number {
    return this.mirrored ? -w : w;
  }
  /**
   * The orientation of a shape that is symmetric about its own x-axis (boxes, cylinders, cones) in
   * the other frame. Under a mirror that is M R M, which turns a robot's front around: use `yaw` for
   * robots. (A quaternion and its negative are the same rotation.)
   */
  quat(q: Quat): Quat {
    if (!this.flipped) return q;
    // Mirror x -> -x: M R M, i.e. (w, x, -y, -z). Rotation by pi about z: (0, 0, 0, 1) * q.
    return this.mirrored ? { w: q.w, x: q.x, y: -q.y, z: -q.z } : { w: -q.z, x: -q.y, y: q.x, z: q.w };
  }
}

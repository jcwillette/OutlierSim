import * as THREE from 'three';
import type { Match, Robot } from '../sim/match.ts';
import type { Alliance } from '../sim/types.ts';

export type CameraMode = 'driver' | 'chase' | 'overhead';
export const CAMERA_MODES: CameraMode[] = ['driver', 'chase', 'overhead'];

/**
 * Camera presets in the Z-up field frame. `driveYaw` is the field heading that "stick up" maps to,
 * so translation controls stay intuitive from every viewpoint (field-oriented swerve).
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  mode: CameraMode = 'driver';
  private chaseYaw = 0;
  private readonly look = new THREE.Vector3();

  constructor(
    private readonly match: Match,
    private readonly alliance: Alliance,
    private readonly station: number,
  ) {
    this.camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.05, 120);
    this.camera.up.set(0, 0, 1);
  }

  get driveYaw(): number {
    if (this.mode === 'chase') return this.chaseYaw;
    return this.alliance === 'blue' ? 0 : Math.PI;
  }

  cycle(): CameraMode {
    this.mode = CAMERA_MODES[(CAMERA_MODES.indexOf(this.mode) + 1) % CAMERA_MODES.length]!;
    return this.mode;
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  update(robot: Robot | null, dt: number): void {
    const { length: L, width: W } = this.match.def.field;
    const sign = this.alliance === 'blue' ? 1 : -1;
    const wallX = this.alliance === 'blue' ? 0 : L;
    const cam = this.camera;
    switch (this.mode) {
      case 'driver': {
        // Behind the alliance wall, lined up with your robot's starting spot. Eye height is raised a
        // little above a real driver's (~1.7 m) so tall field elements don't hide the whole field.
        const start = this.match.game.startPoses[this.alliance][this.station];
        const y = Math.min(W - 1, Math.max(1, start?.y ?? W / 2));
        cam.fov = 55;
        cam.position.set(wallX - sign * 1.8, y, 2.4);
        this.look.set(L / 2, W / 2 + (y - W / 2) * 0.3, 0);
        break;
      }
      case 'chase': {
        const rx = robot?.x ?? L / 2;
        const ry = robot?.y ?? W / 2;
        const target = robot?.yaw ?? 0;
        let d = target - this.chaseYaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.chaseYaw += d * Math.min(1, dt * 3);
        cam.fov = 65;
        cam.position.set(rx - Math.cos(this.chaseYaw) * 2.8, ry - Math.sin(this.chaseYaw) * 2.8, 1.8);
        this.look.set(rx + Math.cos(this.chaseYaw) * 2, ry + Math.sin(this.chaseYaw) * 2, 0.3);
        break;
      }
      case 'overhead': {
        cam.fov = 50;
        cam.position.set(L / 2 - sign * 3.5, W / 2, 15);
        this.look.set(L / 2 + sign * 0.3, W / 2, 0);
        break;
      }
    }
    cam.updateProjectionMatrix();
    cam.lookAt(this.look);
  }
}

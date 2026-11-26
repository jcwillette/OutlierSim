import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { restHeight, type ExpandedGame, type XElement } from '../sim/expand.ts';
import { eulerToQuat, regionOutline } from '../sim/math.ts';
import type { Match, Piece, Robot } from '../sim/match.ts';
import type { Alliance, PieceShape, Region2D } from '../sim/types.ts';

/**
 * Three.js scene built from an ExpandedGame. The scene uses the sim's Z-up WPILib frame directly
 * (cameras set `up = +Z`), so poses copy straight across from Rapier with no axis conversion.
 * Read-only with respect to the match.
 */

export const ALLIANCE_COLOR: Record<Alliance, number> = { blue: 0x1f6fd1, red: 0xd12f2f };
const NEUTRAL = 0x8a8f98;

function colorFor(spec: string | undefined, alliance: Alliance | null): THREE.ColorRepresentation {
  if (!spec || spec === 'alliance') return alliance ? ALLIANCE_COLOR[alliance] : NEUTRAL;
  if (spec === 'neutral') return NEUTRAL;
  return spec;
}

function pieceGeometry(shape: PieceShape): THREE.BufferGeometry {
  switch (shape.kind) {
    case 'sphere':
      return new THREE.SphereGeometry(shape.radius, 20, 14);
    case 'cylinder':
      return new THREE.CylinderGeometry(shape.radius, shape.radius, shape.height, 20).rotateX(Math.PI / 2);
    case 'torus': {
      const tube = (shape.outerRadius - shape.innerRadius) / 2;
      return new THREE.TorusGeometry(shape.innerRadius + tube, tube, 10, 24);
    }
    case 'cone':
      return new THREE.CylinderGeometry(shape.radius * 0.18, shape.radius, shape.height, 20).rotateX(
        Math.PI / 2,
      );
    case 'box':
      return new THREE.BoxGeometry(shape.size.x, shape.size.y, shape.size.z);
  }
}

function elementMesh(e: XElement): THREE.Mesh {
  let geo: THREE.BufferGeometry;
  switch (e.shape.kind) {
    case 'box':
      geo = new THREE.BoxGeometry(e.shape.size.x, e.shape.size.y, e.shape.size.z);
      break;
    case 'cylinder':
      geo = new THREE.CylinderGeometry(e.shape.radius, e.shape.radius, e.shape.height, 32).rotateX(
        Math.PI / 2,
      );
      break;
    case 'hull':
      geo = new ConvexGeometry(e.shape.vertices.map((v) => new THREE.Vector3(v.x, v.y, v.z)));
      break;
  }
  const opacity = e.opacity ?? (e.solid === false ? 0.35 : 1);
  const mat = new THREE.MeshStandardMaterial({
    color: colorFor(e.color, e.alliance),
    roughness: 0.6,
    metalness: 0.1,
    transparent: opacity < 1,
    opacity,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(e.position.x, e.position.y, e.position.z);
  const r = e.rotation ?? {};
  mesh.rotation.set(r.roll ?? 0, r.pitch ?? 0, r.yaw ?? 0, 'ZYX');
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function outline(
  region: Region2D,
  color: THREE.ColorRepresentation,
  z = 0.004,
  opacity = 0.9,
): THREE.LineLoop {
  const pts = regionOutline(region).map((p) => new THREE.Vector3(p.x, p.y, z));
  const line = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }),
  );
  return line;
}

export function textSprite(text: string, color = '#fff', bg = 'rgba(0,0,0,0.55)', scale = 0.5): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(8, 24, 240, 80, 20);
  ctx.fill();
  ctx.fillStyle = color;
  // Shrink long labels to fit the pill.
  let size = 64;
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  while (size > 24 && ctx.measureText(text).width > 216) {
    size -= 4;
    ctx.font = `bold ${size}px system-ui, sans-serif`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 66);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.set(scale * 2, scale, 1);
  sprite.renderOrder = 10;
  return sprite;
}

interface RobotVisual {
  group: THREE.Group;
  heldGroup: THREE.Group;
  progress: THREE.Sprite;
  heldKey: string;
  chassis: THREE.Mesh;
  /** Breakdown / outage tag above the robot, rebuilt when the state changes. */
  status: THREE.Sprite | null;
  statusKey: string;
}

export class FieldView {
  readonly scene = new THREE.Scene();
  private readonly robots = new Map<number, RobotVisual>();
  private readonly pieces = new Map<number, THREE.Mesh>();
  private readonly pieceGeo = new Map<string, THREE.BufferGeometry>();
  private readonly pieceMat = new Map<string, THREE.Material>();
  private readonly endgameZones: THREE.Object3D[] = [];
  /** Pieces drawn resting at supply-limited stations (`HumanPlayerStation.display`), by station. */
  private readonly stationPieces: Array<{ key: string; supply: number; mesh: THREE.Mesh }> = [];
  private readonly playerRing: THREE.Mesh;

  constructor(
    readonly game: ExpandedGame,
    private playerId: number | null,
  ) {
    const { length: L, width: W, wallHeight: H } = game.def.field;
    this.scene.background = new THREE.Color(0x14171c);
    this.scene.fog = new THREE.Fog(0x14171c, 30, 60);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 1.6);
    hemi.position.set(0, 0, 10);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(L * 0.3, W * 0.2, 12);
    sun.target.position.set(L / 2, W / 2, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -L / 1.6,
      right: L / 1.6,
      top: W,
      bottom: -W,
      near: 1,
      far: 30,
    });
    this.scene.add(sun, sun.target);

    // carpet + surroundings
    const carpet = new THREE.Mesh(
      new THREE.PlaneGeometry(L, W),
      new THREE.MeshStandardMaterial({ color: game.def.field.carpetColor ?? '#4a4f57', roughness: 0.95 }),
    );
    carpet.position.set(L / 2, W / 2, 0);
    carpet.receiveShadow = true;
    this.scene.add(carpet);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(L + 20, W + 20),
      new THREE.MeshStandardMaterial({ color: 0x24282f, roughness: 1 }),
    );
    floor.position.set(L / 2, W / 2, -0.01);
    this.scene.add(floor);

    // perimeter: alliance walls tinted, side walls clear
    const wallMat = (c: number) =>
      new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: 0.25, roughness: 0.2 });
    const wall = (x: number, y: number, sx: number, sy: number, c: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, H), wallMat(c));
      m.position.set(x, y, H / 2);
      this.scene.add(m);
    };
    wall(L / 2, -0.05, L, 0.1, 0xdddddd);
    wall(L / 2, W + 0.05, L, 0.1, 0xdddddd);
    wall(-0.05, W / 2, 0.1, W, ALLIANCE_COLOR.blue);
    wall(L + 0.05, W / 2, 0.1, W, ALLIANCE_COLOR.red);
    // center line
    this.scene.add(
      outline({ kind: 'rect', min: { x: L / 2 - 0.025, y: 0 }, max: { x: L / 2 + 0.025, y: W } }, 0xffffff),
    );

    for (const e of game.elements) this.scene.add(elementMesh(e));
    for (const z of game.zones) {
      if (z.visible === false) continue;
      this.scene.add(outline(z.region, z.alliance ? ALLIANCE_COLOR[z.alliance] : 0xffffff, 0.003, 0.7));
    }
    for (const t of game.targets) {
      const c = t.alliance ? ALLIANCE_COLOR[t.alliance] : 0xffffff;
      if (t.place) this.scene.add(outline(t.place.zone, c, 0.006, 0.45));
      if (t.aperture) {
        const ap = t.aperture;
        const box = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(ap.size.x, ap.size.y, ap.size.z)),
          new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.6 }),
        );
        box.position.set(ap.center.x, ap.center.y, ap.center.z);
        box.rotation.z = ap.yaw ?? 0;
        this.scene.add(box);
      }
    }
    for (const st of game.stations) {
      this.scene.add(outline(st.zone, st.alliance ? ALLIANCE_COLOR[st.alliance] : 0xffffff, 0.006, 0.8));
      const type = game.def.pieces.find((p) => p.id === st.pieceTypes[0]);
      if (st.display && type) {
        const mesh = new THREE.Mesh(
          pieceGeometry(type.shape),
          new THREE.MeshStandardMaterial({ color: type.color, roughness: 0.5 }),
        );
        mesh.position.set(st.display.x, st.display.y, st.display.z);
        mesh.castShadow = true;
        this.scene.add(mesh);
        // A station shared by both alliances (no `alliance`) is drawn until either has used it up.
        this.stationPieces.push({ key: `${st.id}:${st.alliance ?? 'blue'}`, supply: st.supply ?? 1, mesh });
      }
    }
    for (const a of game.endgame) {
      for (const z of a.zones) {
        const o = outline(z, a.alliance ? ALLIANCE_COLOR[a.alliance] : 0xffffff, 0.008);
        (o.material as THREE.LineBasicMaterial).color.offsetHSL(0, 0, 0.2);
        this.endgameZones.push(o);
        this.scene.add(o);
      }
    }

    this.playerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.7, 40),
      new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9 }),
    );
    this.playerRing.position.z = 0.01;
    this.playerRing.visible = playerId !== null;
    this.scene.add(this.playerRing);
  }

  private robotVisual(r: Robot): RobotVisual {
    let v = this.robots.get(r.id);
    if (v) return v;
    const { length, width, height } = r.archetype.frame;
    const group = new THREE.Group();
    const bumperH = Math.min(0.13, height * 0.4);
    const bumper = new THREE.Mesh(
      new THREE.BoxGeometry(length, width, bumperH),
      new THREE.MeshStandardMaterial({ color: ALLIANCE_COLOR[r.alliance], roughness: 0.8 }),
    );
    bumper.position.z = -height / 2 + bumperH / 2 + 0.03;
    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(length * 0.86, width * 0.86, height - 0.03),
      new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.5, metalness: 0.4 }),
    );
    chassis.position.z = 0.015;
    const front = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, width * 0.7, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0x554400 }),
    );
    front.position.set(length * 0.43, 0, height / 2 + 0.01);
    for (const m of [bumper, chassis, front]) {
      m.castShadow = true;
      group.add(m);
    }
    const label = textSprite(
      `${r.alliance === 'blue' ? 'B' : 'R'}${r.station + 1}`,
      '#fff',
      'rgba(0,0,0,0.5)',
      0.35,
    );
    label.position.z = height / 2 + 0.45;
    group.add(label);
    const heldGroup = new THREE.Group();
    heldGroup.position.z = height / 2;
    group.add(heldGroup);
    const progress = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x7cfc00, depthTest: false }));
    progress.center.set(0, 0.5);
    progress.position.set(0, 0, height / 2 + 0.75);
    progress.renderOrder = 11;
    progress.visible = false;
    group.add(progress);
    this.scene.add(group);
    v = { group, heldGroup, progress, heldKey: '', chassis, status: null, statusKey: '' };
    this.robots.set(r.id, v);
    return v;
  }

  private pieceMesh(p: Piece): THREE.Mesh {
    let m = this.pieces.get(p.id);
    if (m) return m;
    const t = p.type;
    let geo = this.pieceGeo.get(t.id);
    if (!geo) {
      geo = pieceGeometry(t.shape);
      this.pieceGeo.set(t.id, geo);
    }
    let mat = this.pieceMat.get(t.id);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({ color: t.color, roughness: 0.5 });
      this.pieceMat.set(t.id, mat);
    }
    m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    this.scene.add(m);
    this.pieces.set(p.id, m);
    return m;
  }

  /**
   * Show a broken-down robot (gray, "DISABLED"), one in a short outage (blinking "NO POWER") or one
   * whose mechanisms failed ("NO MECH": it still drives).
   */
  private syncStatus(v: RobotVisual, r: Robot, time: number): void {
    const key = r.brokenDown ? 'dead' : r.isOut(time) ? 'stall' : r.mechDown && !r.endgameDone ? 'mech' : '';
    if (key !== v.statusKey) {
      v.statusKey = key;
      if (v.status) {
        v.group.remove(v.status);
        v.status.material.map?.dispose();
        v.status.material.dispose();
        v.status = null;
      }
      (v.chassis.material as THREE.MeshStandardMaterial).color.set(key === 'dead' ? 0x1b1d21 : 0x3a3f47);
      if (key) {
        const [text, bg] = (
          {
            dead: ['DISABLED', '#c62828'],
            stall: ['NO POWER', '#b26a00'],
            mech: ['NO MECH', '#6a4c93'],
          } as const
        )[key];
        v.status = textSprite(text, '#fff', bg, 0.45);
        v.status.position.z = r.archetype.frame.height / 2 + 0.95;
        v.group.add(v.status);
      }
    }
    if (v.status && key === 'stall') v.status.visible = Math.floor(time * 3) % 2 === 0;
  }

  /** Move the ring marker to another robot (spectator follow), or hide it with null. */
  highlight(robotId: number | null): void {
    this.playerId = robotId;
    this.playerRing.visible = robotId !== null;
  }

  /** Copy the current match state into the scene. */
  sync(match: Match): void {
    for (const r of match.robots) {
      const v = this.robotVisual(r);
      // Field pose (Rapier's world is centered, and flipped in every other match). Robots only turn
      // about z, and their front matters, so draw them from the field heading.
      const t = { x: r.x, y: r.y, z: r.z };
      v.group.position.set(t.x, t.y, t.z);
      v.group.rotation.set(0, 0, r.yaw);
      // Show "climbed" for robots still on the floor (a robot on a ramp or platform already looks it).
      if (r.endgameDone && t.z < r.archetype.frame.height / 2 + 0.05) v.group.position.z += 0.35;

      const key = r.held.join(',');
      if (key !== v.heldKey) {
        v.heldKey = key;
        v.heldGroup.clear();
        r.held.forEach((type, i) => {
          const pt = match.def.pieces.find((p) => p.id === type)!;
          let geo = this.pieceGeo.get(type);
          if (!geo) {
            geo = pieceGeometry(pt.shape);
            this.pieceGeo.set(type, geo);
          }
          const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: pt.color }));
          mesh.scale.setScalar(0.8);
          mesh.position.set(-0.15 * i, 0, 0.12 + 0.02 * i);
          v.heldGroup.add(mesh);
        });
      }
      this.syncStatus(v, r, match.time);
      const act = r.action;
      v.progress.visible = act !== null;
      if (act) {
        const f = 1 - act.remaining / act.total;
        v.progress.scale.set(Math.max(0.01, f) * 0.9, 0.09, 1);
      }
      if (r.id === this.playerId)
        this.playerRing.position.set(t.x, t.y, t.z - r.archetype.frame.height / 2 + 0.01);
    }
    const stacked = new Map<string, number>();
    for (const p of match.pieces) {
      const m = this.pieceMesh(p);
      if (p.status === 'scored' && p.scoredIn) {
        const target = match.targets.get(p.scoredIn)?.target;
        const at = target?.display;
        m.visible = !!at;
        if (at && target) {
          const n = stacked.get(p.scoredIn) ?? 0;
          stacked.set(p.scoredIn, n + 1);
          const step = target.displayStep ?? { x: 0, y: 0, z: 2 * restHeight(p.type.shape) };
          m.position.set(at.x + n * step.x, at.y + n * step.y, at.z + n * step.z);
          if (target.displayRotation) {
            const q = eulerToQuat(target.displayRotation);
            m.quaternion.set(q.x, q.y, q.z, q.w);
          } else m.quaternion.identity();
        }
        continue;
      }
      m.visible = p.status === 'field';
      if (!m.visible) continue;
      const t = p.position;
      const q = match.physics.quat(p.body.rotation());
      m.position.set(t.x, t.y, t.z);
      m.quaternion.set(q.x, q.y, q.z, q.w);
    }
    for (const sp of this.stationPieces) sp.mesh.visible = (match.stationUsed.get(sp.key) ?? 0) < sp.supply;
    const pulse = match.isEndgame ? 0.6 + 0.4 * Math.sin(match.time * 6) : 0.35;
    for (const o of this.endgameZones) {
      const mat = (o as THREE.LineLoop).material as THREE.LineBasicMaterial;
      mat.transparent = true;
      mat.opacity = pulse;
    }
  }
}

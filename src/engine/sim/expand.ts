import {
  eulerToQuat,
  flipEuler,
  flipHeading,
  flipPoint,
  flipRegion,
  flipVec3,
  flipDir3,
  rotateVec,
  type FieldDims,
  type Symmetry,
} from './math.ts';
import type {
  Alliance,
  EndgameAction,
  FieldElement,
  GameDefinition,
  HumanPlayerStation,
  PieceShape,
  PositionAward,
  ScoringTarget,
  Side,
  StartPose,
  Vec3,
  ZoneDefinition,
} from './types.ts';

/** Every sided thing after expansion: `id` is `<baseId>.<alliance>` for sided things, `<baseId>` for neutral. */
interface Expanded {
  id: string;
  baseId: string;
  alliance: Alliance | null;
}

export type XElement = Omit<FieldElement, 'side' | 'id'> & Expanded;
export type XZone = Omit<ZoneDefinition, 'side' | 'id'> & Expanded;
export type XTarget = Omit<ScoringTarget, 'side' | 'id'> & Expanded;
export type XStation = Omit<HumanPlayerStation, 'side' | 'id'> & Expanded;
export type XEndgame = Omit<EndgameAction, 'side' | 'id'> & Expanded;
export type XAward = Omit<PositionAward, 'side' | 'id'> & Expanded;

export interface XStagedPiece {
  type: string;
  position: Vec3;
}

export interface ExpandedGame {
  def: GameDefinition;
  elements: XElement[];
  zones: XZone[];
  targets: XTarget[];
  stations: XStation[];
  endgame: XEndgame[];
  awards: XAward[];
  staged: XStagedPiece[];
  startPoses: Record<Alliance, StartPose[]>;
}

export function restHeight(shape: PieceShape): number {
  switch (shape.kind) {
    case 'sphere':
      return shape.radius;
    case 'cylinder':
    case 'torus':
    case 'cone':
      return shape.height / 2;
    case 'box':
      return shape.size.z / 2;
  }
}

function expandSided<T extends { id: string; side: Side }>(
  items: T[],
  flip: (item: T) => T,
): Array<Omit<T, 'side' | 'id'> & Expanded> {
  const out: Array<Omit<T, 'side' | 'id'> & Expanded> = [];
  for (const item of items) {
    const { side, id, ...rest } = item;
    if (side === 'neutral') {
      out.push({ ...rest, id, baseId: id, alliance: null });
    } else {
      out.push({ ...rest, id: `${id}.blue`, baseId: id, alliance: 'blue' });
      const { side: _s, id: _i, ...flipped } = flip(item);
      out.push({ ...flipped, id: `${id}.red`, baseId: id, alliance: 'red' });
    }
  }
  return out;
}

function flipElement(e: FieldElement, sym: Symmetry, f: FieldDims): FieldElement {
  if (e.shape.kind === 'hull') {
    const q = eulerToQuat(e.rotation);
    const world = e.shape.vertices.map((v) => {
      const r = rotateVec(q, v);
      return flipVec3({ x: e.position.x + r.x, y: e.position.y + r.y, z: e.position.z + r.z }, sym, f);
    });
    const pos = flipVec3(e.position, sym, f);
    return {
      ...e,
      position: pos,
      rotation: {},
      shape: {
        kind: 'hull',
        vertices: world.map((w) => ({ x: w.x - pos.x, y: w.y - pos.y, z: w.z - pos.z })),
      },
    };
  }
  return { ...e, position: flipVec3(e.position, sym, f), rotation: flipEuler(e.rotation, sym) };
}

function flipTarget(t: ScoringTarget, sym: Symmetry, f: FieldDims): ScoringTarget {
  const out: ScoringTarget = { ...t };
  if (t.place) {
    out.place = {
      ...t.place,
      zone: flipRegion(t.place.zone, sym, f),
      ...(t.place.facePoint ? { facePoint: flipPoint(t.place.facePoint, sym, f) } : {}),
    };
  }
  if (t.aperture) {
    out.aperture = {
      ...t.aperture,
      center: flipVec3(t.aperture.center, sym, f),
      yaw: flipEuler({ yaw: t.aperture.yaw ?? 0 }, sym).yaw ?? 0,
    };
  }
  if (t.aimPoint) out.aimPoint = flipVec3(t.aimPoint, sym, f);
  if (t.display) out.display = flipVec3(t.display, sym, f);
  if (t.afterScore?.kind === 'recycle') {
    out.afterScore = {
      ...t.afterScore,
      exits: t.afterScore.exits.map((p) => flipVec3(p, sym, f)),
      ...(t.afterScore.exitVelocity ? { exitVelocity: flipDir3(t.afterScore.exitVelocity, sym) } : {}),
    };
  }
  return out;
}

function flipStation(s: HumanPlayerStation, sym: Symmetry, f: FieldDims): HumanPlayerStation {
  return {
    ...s,
    zone: flipRegion(s.zone, sym, f),
    ...(s.dropPoint ? { dropPoint: flipVec3(s.dropPoint, sym, f) } : {}),
    ...(s.dropVelocity ? { dropVelocity: flipDir3(s.dropVelocity, sym) } : {}),
  };
}

/** Resolve the blue-half authoring form into concrete per-alliance objects. Pure function. */
export function expandDefinition(def: GameDefinition): ExpandedGame {
  const sym = def.field.symmetry;
  const f: FieldDims = def.field;
  const pieceTypes = new Map(def.pieces.map((p) => [p.id, p]));

  const staged: XStagedPiece[] = [];
  for (const s of def.staging) {
    const type = pieceTypes.get(s.type);
    const z0 = type ? restHeight(type.shape) : 0.1;
    for (const p of s.positions) {
      const pos = { x: p.x, y: p.y, z: p.z ?? z0 };
      staged.push({ type: s.type, position: pos });
      if (s.side === 'blue') staged.push({ type: s.type, position: flipVec3(pos, sym, f) });
    }
  }

  return {
    def,
    elements: expandSided(def.field.elements, (e) => flipElement(e, sym, f)),
    zones: expandSided(def.field.zones, (z) => ({ ...z, region: flipRegion(z.region, sym, f) })),
    targets: expandSided(def.targets, (t) => flipTarget(t, sym, f)),
    stations: expandSided(def.stations, (s) => flipStation(s, sym, f)),
    endgame: expandSided(def.endgame, (a) => ({ ...a, zones: a.zones.map((z) => flipRegion(z, sym, f)) })),
    awards: expandSided(def.awards, (a) => ({ ...a, zone: flipRegion(a.zone, sym, f) })),
    staged,
    startPoses: {
      blue: def.startPoses.map((p) => ({ ...p })),
      red: def.startPoses.map((p) => ({ ...flipPoint(p, sym, f), yaw: flipHeading(p.yaw, sym) })),
    },
  };
}

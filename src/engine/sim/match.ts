import RAPIER from '@dimforge/rapier3d-compat';
import { GRAVITY, solveShot, type ShotSolution } from './ballistics.ts';
import { expandDefinition, type ExpandedGame, type XEndgame, type XStation, type XTarget } from './expand.ts';
import { BREAKDOWN_RECOVER_SEC, MECH_RECOVER_SEC, STALL_SEC, faultRates } from './faults.ts';
import { ScoreLedger } from './ledger.ts';
import { bodyEpoch, stepWorld } from './bodyState.ts';
import { PhysicsFrame, handedness } from './frame.ts';
import { Referee } from './referee.ts';
import {
  clamp,
  eulerToQuat,
  rotateVec,
  footprint,
  gaussian,
  makeRng,
  pointInRegion,
  turnTo,
  wrapAngle,
  yawFromQuat,
} from './math.ts';
import { assertValid } from './validate.ts';
import type {
  Alliance,
  AllianceSummary,
  GameDefinition,
  MatchPhase,
  PieceType,
  RobotArchetype,
  RobotInfo,
  RulesContext,
  ScoreCategory,
  Vec3,
} from './types.ts';

export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;

/** Per-tick control input. Drive values are field-relative fractions of max speed, -1..1. */
export interface RobotCommand {
  vx: number;
  vy: number;
  omega: number;
  intake: boolean;
  score: boolean;
  endgame: boolean;
  eject: boolean;
  /** Restrict `score` to this expanded target id / `endgame` to this action id. */
  targetId?: string;
}

export const IDLE: RobotCommand = Object.freeze({
  vx: 0,
  vy: 0,
  omega: 0,
  intake: false,
  score: false,
  endgame: false,
  eject: false,
});

export interface RobotController {
  command(match: Match, robot: Robot, dt: number): RobotCommand;
}

/** A vector as Rapier's (x, y, z) arguments. */
const xyz = (v: Vec3): [number, number, number] => [v.x, v.y, v.z];

/** How far (m) a ramp's floor edges continue below the floor in physics. */
const RAMP_SINK = 0.03;

/**
 * A ramp hull (`nav: 'ramp'`) for physics: each vertex on the floor moves down `RAMP_SINK` along the
 * line from its nearest raised vertex, so the slope continues just below the floor. Robots are flat
 * boxes that can't pitch; driving into a slope that stops exactly at floor level, their bottom edge
 * hits the ramp's edge like a wall and they only get on with a run-up. With the slope continued,
 * they meet the sloped face and drive up at any speed. Nothing above the floor changes.
 * `verts` are offsets from the element's position (already rotated); `baseZ` is its height.
 */
export function sinkRampBase(verts: readonly Vec3[], baseZ: number): Vec3[] {
  const onFloor = (v: Vec3) => baseZ + v.z <= 1e-6;
  const raised = verts.filter((v) => !onFloor(v));
  if (!raised.length) return [...verts];
  return verts.map((v) => {
    if (!onFloor(v)) return v;
    let top = raised[0]!;
    let best = Infinity;
    for (const r of raised) {
      const d = Math.hypot(r.x - v.x, r.y - v.y, r.z - v.z);
      if (d < best) {
        best = d;
        top = r;
      }
    }
    // Continue the line top -> v down to RAMP_SINK below the floor.
    const k = (baseZ + v.z + RAMP_SINK) / (top.z - v.z);
    return { x: v.x + (v.x - top.x) * k, y: v.y + (v.y - top.y) * k, z: v.z - (top.z - v.z) * k };
  });
}

export type RobotAction =
  | { kind: 'place'; targetId: string; pieceType: string; remaining: number; total: number }
  | { kind: 'endgame'; actionId: string; zoneIndex: number; remaining: number; total: number };

/** Breakdowns and mechanism failures a robot actually suffered (match times, null = didn't happen). */
export interface RobotFaults {
  brokeDownAt: number | null;
  /** Came back online after breaking down. */
  recoveredAt: number | null;
  mechFailedAt: number | null;
  /** Mechanisms working again after failing. */
  mechFixedAt: number | null;
}

export interface RobotStats {
  piecesScored: number;
  shotsTaken: number;
  intakes: number;
}

export class Robot {
  readonly held: string[] = [];
  action: RobotAction | null = null;
  endgameDone: { actionId: string; zoneIndex: number } | null = null;
  /** Seconds spent intaking at a station with a `handoffSec`. */
  stationDwell = 0;
  /** `endgameDone` happened during auto; the robot is released when teleop starts. */
  endgameInAuto = false;
  command: RobotCommand = IDLE;
  controller: RobotController | null = null;
  intakeCooldown = 0;
  shootCooldown = 0;
  /** Desired heading set by the shooter auto-align assist this tick. */
  aimYaw: number | null = null;
  readonly leftZones = new Set<string>();
  readonly stats: RobotStats = { piecesScored: 0, shotsTaken: 0, intakes: 0 };
  /** Scheduled breakdown time (match time), if any: no driving, no mechanisms. */
  breakdownAt: number | null = null;
  /** When a scheduled breakdown clears (the crew resets it), or null: dead for the rest of the match. */
  breakdownRecoverAt: number | null = null;
  /** Broken down right now: dead (can still be pushed) until `breakdownRecoverAt`, if any. */
  brokenDown = false;
  /** Scheduled mechanism failure time, if any: the robot still drives but can't intake, place or shoot. */
  mechFailAt: number | null = null;
  /** When a scheduled mechanism failure clears (a jam frees, a reset works), or null: never. */
  mechRecoverAt: number | null = null;
  /** Mechanisms down right now (driving still works, and so do endgame actions). */
  mechDown = false;
  /** What actually happened this match, for the results. */
  readonly faults: RobotFaults = {
    brokeDownAt: null,
    recoveredAt: null,
    mechFailedAt: null,
    mechFixedAt: null,
  };
  /** Scheduled short outages, sorted by start time. */
  readonly outages: Array<{ at: number; sec: number }> = [];
  /** Match time until which the robot is without power / comms. */
  stalledUntil = 0;
  stallCount = 0;

  constructor(
    readonly id: number,
    readonly alliance: Alliance,
    readonly station: number,
    readonly archetype: RobotArchetype,
    readonly body: RAPIER.RigidBody,
    /** Where Rapier's world sits on the field (`Match.physics`). */
    private readonly frame = new PhysicsFrame({ x: 0, y: 0 }),
  ) {}

  // Pose and velocity as Rapier reports them (moved to field coordinates), cached until the physics
  // state can have changed (`bodyEpoch`, see bodyState.ts). The bots read these thousands of times
  // per step.
  private poseAt = -1;
  private px = 0;
  private py = 0;
  private pz = 0;
  private yawAt = -1;
  private pyaw = 0;
  private velAt = -1;
  private pvx = 0;
  private pvy = 0;

  private readPose(): void {
    const t = this.body.translation();
    this.px = this.frame.fieldX(t.x);
    this.py = this.frame.fieldY(t.y);
    this.pz = t.z;
    this.poseAt = bodyEpoch;
  }

  /** Put the robot at a field position (tests and tools). Velocity and heading are unchanged. */
  setPosition(p: Vec3): void {
    this.body.setTranslation(this.frame.toPhysics(p), true);
  }
  /** Set the robot's field velocity (tests and tools). */
  setVelocity(v: Vec3): void {
    this.body.setLinvel(this.frame.vector(v), true);
  }
  private readVel(): void {
    const v = this.frame.vector(this.body.linvel());
    this.pvx = v.x;
    this.pvy = v.y;
    this.velAt = bodyEpoch;
  }

  get x(): number {
    if (this.poseAt !== bodyEpoch) this.readPose();
    return this.px;
  }

  /** Broken down or in a short outage at match time `t`: no driving, no mechanisms. */
  isOut(t: number): boolean {
    return this.brokenDown || t < this.stalledUntil;
  }

  /** Can intake, place and shoot at match time `t` (not out, mechanisms working). */
  canHandlePieces(t: number): boolean {
    return !this.mechDown && !this.isOut(t);
  }
  get y(): number {
    if (this.poseAt !== bodyEpoch) this.readPose();
    return this.py;
  }
  get z(): number {
    if (this.poseAt !== bodyEpoch) this.readPose();
    return this.pz;
  }
  get yaw(): number {
    if (this.yawAt !== bodyEpoch) {
      this.pyaw = this.frame.yaw(yawFromQuat(this.body.rotation()));
      this.yawAt = bodyEpoch;
    }
    return this.pyaw;
  }
  get vx(): number {
    if (this.velAt !== bodyEpoch) this.readVel();
    return this.pvx;
  }
  get vy(): number {
    if (this.velAt !== bodyEpoch) this.readVel();
    return this.pvy;
  }
  get speed(): number {
    if (this.velAt !== bodyEpoch) this.readVel();
    return Math.hypot(this.pvx, this.pvy);
  }
  private bodyMass: number | undefined;
  /** Rapier's mass for the chassis (constant: it comes from the one collider's density). */
  get mass(): number {
    return (this.bodyMass ??= this.body.mass());
  }
  private totalCap: number | undefined;
  get totalCapacity(): number {
    return (this.totalCap ??=
      this.archetype.totalCapacity ?? Object.values(this.archetype.capacity).reduce((a, b) => a + b, 0));
  }
  canHold(type: string): boolean {
    const cap = this.archetype.capacity[type] ?? 0;
    let n = 0;
    for (const h of this.held) if (h === type) n++;
    return n < cap && this.held.length < this.totalCapacity;
  }
  /** Seconds to place at `target`, or null if this robot can't place there. */
  placeTime(target: XTarget): number | null {
    const place = this.archetype.place;
    if (!place || !target.place) return null;
    for (const key of [target.baseId, ...(target.tags ?? [])]) {
      const t = place[key];
      if (t !== undefined) return t;
    }
    return null;
  }
}

export type PieceStatus = 'field' | 'held' | 'scored' | 'queued';

type Shooter = NonNullable<RobotArchetype['shooter']>;

/** An aperture target a robot could shoot at from where it is (`Match.shotOptions`). */
export interface ShotOption {
  target: XTarget;
  pieceType: string;
  /** Horizontal distance to the aim point, m. */
  distance: number;
}

/** Whether a robot's intake reaches a station's handoff height (shelf). */
export function canReachHandoff(r: Robot, st: { handoffHeight?: number }): boolean {
  return st.handoffHeight === undefined || (r.archetype.intake?.maxHeight ?? 0.3) >= st.handoffHeight;
}

export class Piece {
  status: PieceStatus = 'field';
  heldBy: number | null = null;
  scoredIn: string | null = null;
  lastTouch: number | null = null;
  lastTouchAlliance: Alliance | null = null;
  releaseAt = 0;
  releaseExit = 0;
  grounded = true;
  constructor(
    readonly id: number,
    readonly type: PieceType,
    readonly body: RAPIER.RigidBody,
    readonly radius: number,
    /** Where Rapier's world sits on the field (`Match.physics`). */
    private readonly frame = new PhysicsFrame({ x: 0, y: 0 }),
  ) {}
  // Cached like Robot's pose (see bodyState.ts).
  private poseAt = -1;
  private px = 0;
  private py = 0;
  private pz = 0;
  /** Field position. A fresh object each call (callers may keep or change it). */
  get position(): Vec3 {
    if (this.poseAt !== bodyEpoch) {
      const t = this.body.translation();
      this.px = this.frame.fieldX(t.x);
      this.py = this.frame.fieldY(t.y);
      this.pz = t.z;
      this.poseAt = bodyEpoch;
    }
    return { x: this.px, y: this.py, z: this.pz };
  }

  /** Put the piece at a field position (tests and tools). */
  setPosition(p: Vec3): void {
    this.body.setTranslation(this.frame.toPhysics(p), true);
  }
  /** Set the piece's field velocity. */
  setVelocity(v: Vec3): void {
    this.body.setLinvel(this.frame.vector(v), true);
  }
}

export interface TargetState {
  target: XTarget;
  count: number;
  countByPhase: { auto: number; teleop: number };
  enabled: boolean;
  multiplier: number;
  recycleCursor: number;
}

export interface Announcement {
  time: number;
  text: string;
  alliance?: Alliance;
}

export interface RobotSlot {
  alliance: Alliance;
  station: number;
  archetype?: string;
}

export interface MatchOptions {
  seed?: number;
  /**
   * Lay Rapier's world out from the red end (the field's mirror / rotation image), see
   * `PhysicsFrame`. Default: on even seeds, so consecutive seeds alternate ends and Rapier's
   * handedness favors neither alliance over a run (ADR 0007).
   */
  flipPhysics?: boolean;
  /** Override archetypes per robot id (0-2 blue stations 1-3, 3-5 red stations 1-3). */
  archetypes?: Partial<Record<number, string>>;
  /**
   * Robots can break down (dead, may come back online), suffer a mechanism failure (drives but can't
   * score, may come back) or lose power / comms for a few seconds, all more often for low
   * `reliability` archetypes, which also recover less often. Default off (deterministic engine tests).
   */
  breakdowns?: boolean;
  /** Robot ids that never break down even with `breakdowns` on (e.g. the student's robot). */
  breakdownExempt?: number[];
}

export { DEFAULT_RELIABILITY } from './faults.ts';

export interface AllianceResult extends AllianceSummary {
  rp: number;
  rpBreakdown: Record<string, number>;
  won: boolean;
  tied: boolean;
}

export interface MatchResult {
  blue: AllianceResult;
  red: AllianceResult;
  robots: Array<
    {
      id: number;
      alliance: Alliance;
      archetype: string;
      points: number;
      /** Match time (s since auto start) the robot broke down, or null. */
      brokeDownAt: number | null;
      /** Match time it came back online after breaking down, or null (stayed dead or never broke). */
      recoveredAt: number | null;
      /** Match time its mechanisms failed (could still drive), or null. */
      mechFailedAt: number | null;
      /** Match time its mechanisms worked again, or null. */
      mechFixedAt: number | null;
      /** Short power / comms losses it suffered. */
      stalls: number;
    } & RobotStats
  >;
}

let rapierReady: Promise<void> | null = null;
/** Must be awaited once before constructing a Match (browser and Node). */
export function initPhysics(): Promise<void> {
  rapierReady ??= RAPIER.init();
  return rapierReady;
}

const ROBOT_IDS: Array<{ alliance: Alliance; station: number }> = [
  { alliance: 'blue', station: 0 },
  { alliance: 'blue', station: 1 },
  { alliance: 'blue', station: 2 },
  { alliance: 'red', station: 0 },
  { alliance: 'red', station: 1 },
  { alliance: 'red', station: 2 },
];

const other = (a: Alliance): Alliance => (a === 'blue' ? 'red' : 'blue');

/** Every category but fouls. */
const SCORING_CATEGORIES: readonly ScoreCategory[] = ['auto', 'teleop', 'endgame'];

/** A ledger source without its alliance suffix: 'dock.blue' -> 'dock'; rules sources stay as they are. */
export function sourceBase(source: string): string {
  return source.endsWith('.blue') || source.endsWith('.red')
    ? source.slice(0, source.lastIndexOf('.'))
    : source;
}

/**
 * One FRC match: Rapier world, 6 robots, pieces, scoring, clock. Headless: no rendering or DOM.
 * Drive it with `step()` (fixed 60 Hz) or `advance(realDt)`; attach controllers to robots.
 */
export class Match {
  readonly game: ExpandedGame;
  readonly def: GameDefinition;
  readonly world: RAPIER.World;
  readonly robots: Robot[] = [];
  readonly pieces: Piece[] = [];
  readonly targets = new Map<string, TargetState>();
  readonly ledger = new ScoreLedger();
  readonly announcements: Announcement[] = [];
  readonly indicators = new Map<string, string | number>();
  readonly fouls: Record<Alliance, { minor: number; major: number }> = {
    blue: { minor: 0, major: 0 },
    red: { minor: 0, major: 0 },
  };
  readonly random: () => number;
  /**
   * Where Rapier's world sits on the field: centered, and in every other match flipped
   * (`PhysicsFrame`, ADR 0007). `Robot` / `Piece` poses, velocities and setters are in field
   * coordinates; only raw `body` calls see physics coordinates.
   */
  readonly physics: PhysicsFrame;
  /** Seconds since auto started. */
  time = 0;
  phase: MatchPhase = 'pre';
  /** Pieces handed out by human player stations so far, per station id. */
  readonly stationUsed = new Map<string, number>();
  private readonly stationCooldown = new Map<string, number>();
  private readonly recycleQueue: Array<{ piece: Piece; target: XTarget }> = [];
  /** cos / sin of each aperture's -yaw (constant), for the per-step scoring check. */
  private readonly apertureTrig = new Map<object, [number, number]>();
  /** Targets with an aperture, in `targets` order (static, collected on first use). */
  private apertureTargets: TargetState[] | null = null;
  /** Per robot id: center-to-piece distance (plus the piece's radius) that counts as a touch. */
  private touchReach: number[] | null = null;
  private readonly vars: Record<string, unknown> = {};
  private readonly rulesCtx: RulesContext;
  /** Calls the fouls the game declares (`fouls.contact`, `fouls.pinning`), if any. */
  private readonly referee: Referee | null;
  private accumulator = 0;
  private result: MatchResult | null = null;
  private nextPieceId = 0;

  constructor(def: GameDefinition, opts: MatchOptions = {}) {
    assertValid(def);
    this.def = def;
    this.game = expandDefinition(def);
    this.random = makeRng(opts.seed ?? 1);
    this.world = new RAPIER.World({ x: 0, y: 0, z: -GRAVITY });
    this.world.timestep = SIM_DT;
    this.physics = new PhysicsFrame(
      { x: def.field.length / 2, y: def.field.width / 2 },
      opts.flipPhysics ?? ((opts.seed ?? 1) >>> 0) % 2 === 0,
      def.field.symmetry,
    );
    this.buildField();
    for (const t of this.game.targets) {
      this.targets.set(t.id, {
        target: t,
        count: 0,
        countByPhase: { auto: 0, teleop: 0 },
        enabled: true,
        multiplier: 1,
        recycleCursor: 0,
      });
    }
    ROBOT_IDS.forEach((slot, id) => {
      const archId = opts.archetypes?.[id] ?? def.defaultArchetype;
      const arch = def.archetypes.find((a) => a.id === archId);
      if (!arch) throw new Error(`Unknown archetype '${archId}'`);
      this.robots.push(this.createRobot(id, slot.alliance, slot.station, arch));
    });
    for (const s of this.game.staged) this.spawnPiece(s.type, s.position);
    for (const r of this.robots) {
      for (const [type, n] of Object.entries(def.preload)) {
        for (let i = 0; i < n && r.canHold(type); i++) {
          const p = this.spawnPiece(type, { x: r.x, y: r.y, z: 1 });
          this.holdPiece(r, p);
        }
      }
    }
    if (opts.breakdowns) this.scheduleBreakdowns(opts.breakdownExempt ?? []);
    const referee = new Referee(this);
    this.referee = referee.active ? referee : null;
    this.rulesCtx = this.makeRulesContext();
    def.rules?.onInit?.(this.rulesCtx);
  }

  /**
   * Roll each robot's breakdown, mechanism failure and outage times from its archetype's reliability
   * (seeded). Less reliable robots fail more often and recover less often.
   */
  private scheduleBreakdowns(exempt: readonly number[]): void {
    const end = this.def.timing.autoSec + this.def.timing.transitionSec + this.def.timing.teleopSec;
    const between = ([lo, hi]: [number, number]) => lo + this.random() * (hi - lo);
    /** Recovery time for a fault at `at`, or null if it never clears (or not before the end). */
    const recovery = (at: number, chance: number, sec: [number, number]) => {
      const recovers = this.random() < chance;
      const t = at + between(sec);
      return recovers && t < end ? t : null;
    };
    for (const r of this.robots) {
      if (exempt.includes(r.id)) continue;
      const f = faultRates(r.archetype);
      if (this.random() < f.breakdownChance) {
        r.breakdownAt = this.random() * end;
        r.breakdownRecoverAt = recovery(r.breakdownAt, f.breakdownRecoverChance, BREAKDOWN_RECOVER_SEC);
      }
      // Poisson number of outages.
      const limit = Math.exp(-f.stallsPerMatch);
      let p = this.random();
      while (p > limit) {
        r.outages.push({ at: this.random() * end, sec: between(STALL_SEC) });
        p *= this.random();
      }
      r.outages.sort((a, b) => a.at - b.at);
      if (this.random() < f.mechFailChance) {
        r.mechFailAt = this.random() * end;
        r.mechRecoverAt = recovery(r.mechFailAt, f.mechRecoverChance, MECH_RECOVER_SEC);
      }
    }
  }

  private updateBreakdowns(): void {
    for (const r of this.robots) {
      if (r.endgameDone) continue;
      const name = `${r.alliance === 'blue' ? 'Blue' : 'Red'} ${r.station + 1}`;
      if (r.brokenDown) {
        if (r.breakdownRecoverAt !== null && this.time >= r.breakdownRecoverAt) {
          r.brokenDown = false;
          r.faults.recoveredAt = this.time;
          this.announce(`${name} is back online!`, r.alliance);
        } else {
          // Power blips while already dead don't count.
          while (r.outages.length && r.outages[0]!.at <= this.time) r.outages.shift();
          continue;
        }
      } else if (r.breakdownAt !== null && r.faults.brokeDownAt === null && this.time >= r.breakdownAt) {
        r.brokenDown = true;
        r.faults.brokeDownAt = this.time;
        r.action = null;
        this.announce(`${name} (${r.archetype.name}) broke down!`, r.alliance);
        continue;
      }
      if (r.mechDown) {
        if (r.mechRecoverAt !== null && this.time >= r.mechRecoverAt) {
          r.mechDown = false;
          r.faults.mechFixedAt = this.time;
          this.announce(`${name}'s mechanism is working again`, r.alliance);
        }
      } else if (r.mechFailAt !== null && r.faults.mechFailedAt === null && this.time >= r.mechFailAt) {
        r.mechDown = true;
        r.faults.mechFailedAt = this.time;
        if (r.action?.kind === 'place') r.action = null;
        this.announce(`${name} (${r.archetype.name}) mechanism failure: it can still drive`, r.alliance);
      }
      while (r.outages.length && r.outages[0]!.at <= this.time) {
        const o = r.outages.shift()!;
        if (this.time >= r.stalledUntil) {
          r.stallCount++;
          r.action = null;
          this.announce(`${name} lost power for ${Math.round(o.sec)} s`, r.alliance);
        }
        r.stalledUntil = Math.max(r.stalledUntil, this.time + o.sec);
      }
    }
  }

  // ------------------------------------------------------------------ construction

  private buildField(): void {
    const { length: L, width: W, wallHeight: H } = this.def.field;
    /** A fixed body at a field position, with an orientation already in physics axes. */
    const fixed = (x: number, y: number, z: number, physicsQ = eulerToQuat(undefined)) =>
      this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(...xyz(this.physics.toPhysics({ x, y, z })))
          .setRotation(physicsQ),
      );
    // floor + perimeter (axis-aligned boxes: the same in either frame)
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(L, W, 0.5).setFriction(0.8),
      fixed(L / 2, W / 2, -0.5),
    );
    const t = 0.1;
    const walls: Array<[number, number, number, number]> = [
      [L / 2, -t, L / 2 + t, t],
      [L / 2, W + t, L / 2 + t, t],
      [-t, W / 2, t, W / 2 + t],
      [L + t, W / 2, t, W / 2 + t],
    ];
    for (const [x, y, hx, hy] of walls)
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, hy, H / 2).setFriction(0.3),
        fixed(x, y, H / 2),
      );

    for (const e of this.game.elements) {
      if (e.solid === false) continue;
      const q = eulerToQuat(e.rotation);
      let desc: RAPIER.ColliderDesc | null;
      switch (e.shape.kind) {
        case 'box':
          desc = RAPIER.ColliderDesc.cuboid(e.shape.size.x / 2, e.shape.size.y / 2, e.shape.size.z / 2);
          break;
        case 'cylinder':
          desc = RAPIER.ColliderDesc.cylinder(e.shape.height / 2, e.shape.radius).setRotation(
            eulerToQuat({ roll: Math.PI / 2 }),
          );
          break;
        case 'hull': {
          // Vertices in physics axes (with the element's rotation applied), so the body isn't rotated.
          const verts = e.shape.vertices.map((v) => rotateVec(q, v));
          const shape = e.nav === 'ramp' ? sinkRampBase(verts, e.position.z) : verts;
          desc = RAPIER.ColliderDesc.convexHull(
            new Float32Array(shape.flatMap((v) => xyz(this.physics.vector(v)))),
          );
          break;
        }
      }
      if (!desc) throw new Error(`Element '${e.id}' produced no collider (degenerate hull?)`);
      desc.setFriction(e.friction ?? 0.5).setRestitution(e.restitution ?? 0.2);
      const rot = e.shape.kind === 'hull' ? undefined : this.physics.quat(q);
      this.world.createCollider(desc, fixed(e.position.x, e.position.y, e.position.z, rot));
    }
  }

  private createRobot(id: number, alliance: Alliance, station: number, arch: RobotArchetype): Robot {
    const pose = this.game.startPoses[alliance][station]!;
    const { length, width, height } = arch.frame;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(...xyz(this.physics.toPhysics({ x: pose.x, y: pose.y, z: height / 2 + 0.005 })))
        .setRotation(eulerToQuat({ yaw: this.physics.yaw(pose.yaw) }))
        .enabledRotations(false, false, true)
        .setLinearDamping(0.05)
        .setAngularDamping(0.5),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(length / 2, width / 2, height / 2)
        .setDensity(arch.mass / (length * width * height))
        // Traction is modeled in drive(); the chassis itself slides freely on carpet and walls.
        .setFriction(0)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
        .setRestitution(0.1),
      body,
    );
    return new Robot(id, alliance, station, arch, body, this.physics);
  }

  spawnPiece(typeId: string, pos: Vec3, vel?: Vec3): Piece {
    const type = this.def.pieces.find((p) => p.id === typeId);
    if (!type) throw new Error(`Unknown piece type '${typeId}'`);
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(...xyz(this.physics.toPhysics(pos)))
        .setRotation(this.physics.quat(eulerToQuat(undefined)))
        .setLinearDamping(0.6)
        .setAngularDamping(0.6)
        .setCcdEnabled(true),
    );
    if (vel) body.setLinvel(this.physics.vector(vel), true);
    const s = type.shape;
    let desc: RAPIER.ColliderDesc;
    let radius: number;
    let volume: number;
    switch (s.kind) {
      case 'sphere':
        desc = RAPIER.ColliderDesc.ball(s.radius);
        radius = s.radius;
        volume = (4 / 3) * Math.PI * s.radius ** 3;
        break;
      case 'cylinder':
        desc = RAPIER.ColliderDesc.cylinder(s.height / 2, s.radius).setRotation(
          eulerToQuat({ roll: Math.PI / 2 }),
        );
        radius = s.radius;
        volume = Math.PI * s.radius ** 2 * s.height;
        break;
      case 'torus':
        desc = RAPIER.ColliderDesc.cylinder(s.height / 2, s.outerRadius).setRotation(
          eulerToQuat({ roll: Math.PI / 2 }),
        );
        radius = s.outerRadius;
        volume = Math.PI * s.outerRadius ** 2 * s.height;
        break;
      case 'cone': {
        const cr = s.radius * 0.8;
        desc = RAPIER.ColliderDesc.cylinder(s.height / 2, cr).setRotation(eulerToQuat({ roll: Math.PI / 2 }));
        radius = cr;
        volume = Math.PI * cr ** 2 * s.height;
        break;
      }
      case 'box':
        desc = RAPIER.ColliderDesc.cuboid(s.size.x / 2, s.size.y / 2, s.size.z / 2);
        radius = Math.max(s.size.x, s.size.y) / 2;
        volume = s.size.x * s.size.y * s.size.z;
        break;
    }
    desc
      .setDensity(type.mass / volume)
      .setFriction(type.friction ?? 0.6)
      .setRestitution(type.restitution ?? 0.3);
    this.world.createCollider(desc, body);
    const piece = new Piece(this.nextPieceId++, type, body, radius, this.physics);
    this.pieces.push(piece);
    return piece;
  }

  // ------------------------------------------------------------------ clock

  get autoEnd(): number {
    return this.def.timing.autoSec;
  }
  get teleopStart(): number {
    return this.def.timing.autoSec + this.def.timing.transitionSec;
  }
  get matchEnd(): number {
    return this.teleopStart + this.def.timing.teleopSec;
  }
  /** Seconds left in the current period (auto or teleop). */
  get remaining(): number {
    switch (this.phase) {
      case 'pre':
        return this.def.timing.autoSec;
      case 'auto':
        return Math.max(0, this.autoEnd - this.time);
      case 'transition':
        return Math.max(0, this.teleopStart - this.time);
      case 'teleop':
        return Math.max(0, this.matchEnd - this.time);
      case 'post':
        return 0;
    }
  }
  get isEndgame(): boolean {
    return this.phase === 'teleop' && this.remaining <= this.def.timing.endgameSec;
  }
  get isOver(): boolean {
    return this.phase === 'post';
  }
  private get scoringPeriod(): 'auto' | 'teleop' {
    return this.phase === 'auto' || this.phase === 'transition' ? 'auto' : 'teleop';
  }

  start(): void {
    if (this.phase === 'pre') this.setPhase('auto');
  }

  private setPhase(p: MatchPhase): void {
    if (this.phase === p) return;
    const prev = this.phase;
    this.phase = p;
    if (prev === 'auto') this.awardLeave();
    if (p === 'post') this.finish();
    this.def.rules?.onPhaseChange?.(this.rulesCtx, p);
    if (p === 'teleop') this.releaseAutoActions();
  }

  /** Robots that finished an endgame action in auto (e.g. an auto dock) play on in teleop. */
  private releaseAutoActions(): void {
    for (const r of this.robots) {
      if (!r.endgameDone || !r.endgameInAuto) continue;
      r.endgameDone = null;
      r.endgameInAuto = false;
      r.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    }
  }

  // ------------------------------------------------------------------ stepping

  /** Advance by real elapsed seconds using fixed sub-steps. Returns number of steps taken. */
  advance(realDt: number): number {
    this.accumulator += Math.min(realDt, 0.25);
    let n = 0;
    while (this.accumulator >= SIM_DT) {
      this.step();
      this.accumulator -= SIM_DT;
      n++;
    }
    return n;
  }

  /** Run the rest of the match as fast as possible (headless). */
  runToEnd(): MatchResult {
    this.start();
    while (!this.isOver) this.step();
    return this.getResult();
  }

  step(): void {
    const dt = SIM_DT;
    if (this.phase === 'pre' || this.phase === 'post') {
      stepWorld(this.world);
      return;
    }
    this.time += dt;
    if (this.phase === 'auto' && this.time >= this.autoEnd) this.setPhase('transition');
    if (this.phase === 'transition' && this.time >= this.teleopStart) this.setPhase('teleop');
    if (this.phase === 'teleop' && this.time >= this.matchEnd) {
      this.setPhase('post');
      return;
    }
    const enabled = this.phase === 'auto' || this.phase === 'teleop';
    if (enabled) this.updateBreakdowns();

    for (const r of this.robots) {
      r.aimYaw = null;
      // A robot that's out still gets its controller called (bots notice and release their claims).
      const cmd = enabled && r.controller ? r.controller.command(this, r, dt) : IDLE;
      r.command = r.isOut(this.time) ? IDLE : cmd;
      r.intakeCooldown = Math.max(0, r.intakeCooldown - dt);
      r.shootCooldown = Math.max(0, r.shootCooldown - dt);
    }
    for (const [k, v] of this.stationCooldown) this.stationCooldown.set(k, Math.max(0, v - dt));

    if (enabled) {
      for (const r of this.robots) this.updateMechanisms(r, dt);
      for (const r of this.robots) this.trackLeave(r);
    }
    for (const r of this.robots) this.drive(r, dt, enabled);

    stepWorld(this.world);

    this.updatePieceDamping();
    this.trackTouches();
    this.checkApertures();
    this.processRecycle();
    this.referee?.tick(dt);
    this.def.rules?.onTick?.(this.rulesCtx, dt);
  }

  // ------------------------------------------------------------------ drive

  private drive(r: Robot, dt: number, enabled: boolean): void {
    if (r.endgameDone) return;
    const a = r.archetype;
    const locked = !enabled || r.action !== null || r.isOut(this.time);
    const cmd = r.command;
    let tx = 0;
    let ty = 0;
    if (!locked) {
      const mag = Math.hypot(cmd.vx, cmd.vy);
      const s = mag > 1 ? 1 / mag : 1;
      tx = cmd.vx * s * a.drive.maxSpeed;
      ty = cmd.vy * s * a.drive.maxSpeed;
    }
    const v = this.physics.vector(r.body.linvel());
    let dvx = tx - v.x;
    let dvy = ty - v.y;
    const maxDv = Math.min(a.drive.maxAccel, (a.drive.traction ?? 1.1) * GRAVITY) * dt;
    const dv = Math.hypot(dvx, dvy);
    if (dv > maxDv) {
      dvx *= maxDv / dv;
      dvy *= maxDv / dv;
    }
    const m = r.mass;
    r.body.applyImpulse(this.physics.vector({ x: m * dvx, y: m * dvy, z: 0 }), true);

    let targetOmega = locked ? 0 : clamp(cmd.omega, -1, 1) * a.drive.maxOmega;
    if (!locked && r.aimYaw !== null) {
      const turn = turnTo(r.yaw, r.aimYaw, handedness(r.alliance, this.def.field.symmetry));
      targetOmega = clamp(turn * 8, -a.drive.maxOmega, a.drive.maxOmega);
    }
    const w = this.physics.omega(r.body.angvel().z);
    const maxDw = a.drive.maxOmega * 8 * dt;
    const omega = w + clamp(targetOmega - w, -maxDw, maxDw);
    r.body.setAngvel({ x: 0, y: 0, z: this.physics.omega(omega) }, true);
  }

  // ------------------------------------------------------------------ mechanisms

  private updateMechanisms(r: Robot, dt: number): void {
    if (r.endgameDone || r.isOut(this.time)) return;
    if (r.action) {
      this.continueAction(r, dt);
      return;
    }
    const cmd = r.command;
    if (cmd.endgame && this.tryStartEndgame(r)) return;
    // Mechanism failure: the climber / parking still work, the game-piece mechanisms don't.
    if (r.mechDown) {
      r.stationDwell = 0;
      return;
    }
    if (cmd.intake) {
      this.tryIntake(r);
      this.tryStation(r, dt);
    } else r.stationDwell = 0;
    if (cmd.score) {
      if (!this.tryStartPlace(r)) this.tryShoot(r);
    }
    if (cmd.eject && r.held.length > 0) this.eject(r);
  }

  private continueAction(r: Robot, dt: number): void {
    const act = r.action!;
    if (act.kind === 'place') {
      const ts = this.targets.get(act.targetId)!;
      const place = ts.target.place!;
      if (!pointInRegion(r, place.zone)) {
        r.action = null; // pushed out: placement fails, robot keeps the piece
        return;
      }
      act.remaining -= dt;
      if (act.remaining <= 0) {
        r.action = null;
        const idx = r.held.indexOf(act.pieceType);
        const piece = this.pieces.find(
          (p) => p.status === 'held' && p.heldBy === r.id && p.type.id === act.pieceType,
        );
        if (idx < 0 || !piece) return;
        if (ts.target.capacity !== undefined && ts.count >= ts.target.capacity) return;
        r.held.splice(idx, 1);
        piece.heldBy = null;
        piece.lastTouch = r.id;
        piece.lastTouchAlliance = r.alliance;
        this.scorePiece(piece, ts, r.id);
      }
    } else {
      const ga = this.game.endgame.find((e) => e.id === act.actionId)!;
      if (!pointInRegion(r, ga.zones[act.zoneIndex]!)) {
        r.action = null; // pushed off the climb / dock spot: the attempt fails
        return;
      }
      act.remaining -= dt;
      if (act.remaining <= 0) {
        r.action = null;
        const done = this.endgameOutcome(r, ga);
        if (!done) return;
        r.endgameDone = { actionId: done.id, zoneIndex: act.zoneIndex };
        r.endgameInAuto = this.scoringPeriod === 'auto';
        r.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        r.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        r.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
        const inAuto = this.scoringPeriod === 'auto';
        const pts = inAuto ? (done.autoPoints ?? done.points) : done.points;
        this.ledger.add({
          time: this.time,
          alliance: r.alliance,
          category: inAuto ? 'auto' : 'endgame',
          points: pts,
          source: done.id,
          robotId: r.id,
        });
      }
    }
  }

  /**
   * What a finished endgame attempt counts as: the action itself, or, when it fails
   * (`RobotArchetype.endgameSuccess`), its fallback or nothing. Rolls only when success isn't certain.
   */
  private endgameOutcome(r: Robot, ga: XEndgame): XEndgame | null {
    const chance = r.archetype.endgameSuccess?.[ga.baseId] ?? 1;
    if (chance >= 1 || this.random() < chance) return ga;
    const fallback = ga.fallback
      ? this.game.endgame.find((e) => e.baseId === ga.fallback && e.alliance === ga.alliance)
      : undefined;
    const name = `${r.alliance === 'blue' ? 'Blue' : 'Red'} ${r.station + 1}`;
    this.announce(`${name}: ${ga.name} failed${fallback ? ` (${fallback.name})` : ''}`, r.alliance);
    return fallback ?? null;
  }

  /** Endgame actions this robot could start right now, best first. */
  availableEndgame(r: Robot): Array<{ action: XEndgame; zoneIndex: number }> {
    const out: Array<{ action: XEndgame; zoneIndex: number }> = [];
    if (r.endgameDone || r.action) return out;
    for (const ga of this.game.endgame) {
      if (ga.alliance && ga.alliance !== r.alliance) continue;
      if (r.archetype.endgame?.[ga.baseId] === undefined) continue;
      const inAuto = this.phase === 'auto';
      if (inAuto && !ga.allowInAuto) continue;
      if (!inAuto) {
        if (this.phase !== 'teleop') continue;
        if (this.remaining > (ga.availableAtRemainingSec ?? this.def.timing.endgameSec)) continue;
      }
      if (ga.oneAtATime && this.teammateMidSequentialAction(r)) continue;
      ga.zones.forEach((z, zoneIndex) => {
        if (!pointInRegion(r, z)) return;
        const occupants = this.robots.filter(
          (o) =>
            o !== r &&
            ((o.endgameDone?.actionId === ga.id && o.endgameDone.zoneIndex === zoneIndex) ||
              (o.action?.kind === 'endgame' &&
                o.action.actionId === ga.id &&
                o.action.zoneIndex === zoneIndex)),
        ).length;
        if (occupants < (ga.maxRobotsPerZone ?? Infinity)) out.push({ action: ga, zoneIndex });
      });
    }
    return out.sort((a, b) => b.action.points - a.action.points);
  }

  /** A teammate is in the middle of a `oneAtATime` endgame action. */
  teammateMidSequentialAction(r: Robot): boolean {
    return this.robots.some((o) => {
      if (o === r || o.alliance !== r.alliance || o.action?.kind !== 'endgame') return false;
      const id = o.action.actionId;
      return !!this.game.endgame.find((e) => e.id === id)?.oneAtATime;
    });
  }

  private tryStartEndgame(r: Robot): boolean {
    let opts = this.availableEndgame(r);
    if (r.command.targetId) opts = opts.filter((o) => o.action.id === r.command.targetId);
    const best = opts[0];
    if (!best) return false;
    const dur = r.archetype.endgame![best.action.baseId]!;
    r.action = {
      kind: 'endgame',
      actionId: best.action.id,
      zoneIndex: best.zoneIndex,
      remaining: dur,
      total: dur,
    };
    return true;
  }

  private holdPiece(r: Robot, p: Piece): void {
    p.status = 'held';
    p.heldBy = r.id;
    p.lastTouch = r.id;
    p.lastTouchAlliance = r.alliance;
    p.body.setEnabled(false);
    r.held.push(p.type.id);
  }

  private tryIntake(r: Robot): void {
    const intake = r.archetype.intake;
    if (!intake || r.intakeCooldown > 0) return;
    const { length, width } = r.archetype.frame;
    const reach = intake.reach ?? 0.15;
    const maxH = intake.maxHeight ?? 0.3;
    const c = Math.cos(r.yaw);
    const s = Math.sin(r.yaw);
    let best: Piece | null = null;
    let bestD = Infinity;
    for (const p of this.pieces) {
      if (p.status !== 'field' || !intake.pieceTypes.includes(p.type.id) || !r.canHold(p.type.id)) continue;
      const pos = p.position;
      if (pos.z > maxH) continue;
      const dx = pos.x - r.x;
      const dy = pos.y - r.y;
      const lx = dx * c + dy * s;
      const ly = -dx * s + dy * c;
      if (lx < length / 2 - 0.05 || lx > length / 2 + reach + p.radius || Math.abs(ly) > width / 2) continue;
      if (lx < bestD) {
        bestD = lx;
        best = p;
      }
    }
    if (best) {
      this.holdPiece(r, best);
      r.intakeCooldown = intake.timeSec;
      r.stats.intakes++;
    }
  }

  /** Stations whose zone the robot is in and that could feed it a piece. */
  stationsFor(r: Robot): XStation[] {
    if (r.mechDown) return [];
    return this.game.stations.filter(
      (st) =>
        (!st.alliance || st.alliance === r.alliance) &&
        canReachHandoff(r, st) &&
        pointInRegion(r, st.zone) &&
        st.pieceTypes.some((t) => r.canHold(t)),
    );
  }

  private tryStation(r: Robot, dt: number): void {
    const here = this.stationsFor(r);
    if (here.length === 0) r.stationDwell = 0;
    for (const st of here) {
      const key = `${st.id}:${r.alliance}`;
      if ((this.stationCooldown.get(key) ?? 0) > 0) continue;
      const used = this.stationUsed.get(key) ?? 0;
      if (st.supply !== undefined && used >= st.supply) continue;
      const type = st.pieceTypes.find((t) => r.canHold(t))!;
      if (st.mode === 'direct') {
        if (r.intakeCooldown > 0 || !r.archetype.intake) continue;
        if (st.handoffSec) {
          r.stationDwell += dt; // lining up on the handoff before the piece is in the robot
          if (r.stationDwell < st.handoffSec) return;
          r.stationDwell = 0;
        }
        const p = this.spawnPiece(type, { x: r.x, y: r.y, z: 1 });
        this.holdPiece(r, p);
        r.intakeCooldown = r.archetype.intake.timeSec;
        r.stats.intakes++;
      } else {
        this.spawnPiece(type, st.dropPoint!, st.dropVelocity);
      }
      this.stationUsed.set(key, used + 1);
      this.stationCooldown.set(key, st.feedIntervalSec);
      return;
    }
  }

  private canUseTarget(r: Robot, ts: TargetState): boolean {
    const t = ts.target;
    if (!ts.enabled) return false;
    if (t.alliance && (t.creditTo ?? 'owner') === 'owner' && t.alliance !== r.alliance) return false;
    if (t.capacity !== undefined && ts.count >= t.capacity) return false;
    return true;
  }

  /** Place targets this robot can start placing on right now, best first. */
  placeOptions(r: Robot): Array<{ target: XTarget; time: number; pieceType: string }> {
    const out: Array<{ target: XTarget; time: number; pieceType: string }> = [];
    if (r.mechDown) return out;
    for (const ts of this.targets.values()) {
      const t = ts.target;
      if (!t.place || !this.canUseTarget(r, ts)) continue;
      const time = r.placeTime(t);
      if (time === null) continue;
      const pieceType = r.held.find((h) => t.accepts.includes(h));
      if (!pieceType) continue;
      if (!pointInRegion(r, t.place.zone)) continue;
      if (t.place.facePoint) {
        const want = Math.atan2(t.place.facePoint.y - r.y, t.place.facePoint.x - r.x);
        if (Math.abs(wrapAngle(want - r.yaw)) > (t.place.faceToleranceRad ?? Math.PI / 4)) continue;
      }
      out.push({ target: t, time, pieceType });
    }
    const per = this.scoringPeriod;
    return out.sort((a, b) => b.target.points[per] - a.target.points[per]);
  }

  private tryStartPlace(r: Robot): boolean {
    let opts = this.placeOptions(r);
    if (r.command.targetId) opts = opts.filter((o) => o.target.id === r.command.targetId);
    const best = opts[0];
    if (!best) return false;
    r.action = {
      kind: 'place',
      targetId: best.target.id,
      pieceType: best.pieceType,
      remaining: best.time,
      total: best.time,
    };
    return true;
  }

  /** Aperture targets this robot could shoot at from here, best first (ignores heading). */
  shotOptions(r: Robot): ShotOption[] {
    const sh = r.archetype.shooter;
    if (!sh || r.mechDown) return [];
    const out: ShotOption[] = [];
    for (const ts of this.targets.values()) {
      const o = this.shotOption(r, sh, ts);
      if (o) out.push(o);
    }
    const per = this.scoringPeriod;
    return out.sort((a, b) => b.target.points[per] - a.target.points[per] || a.distance - b.distance);
  }

  /** Whether this robot could shoot at one target from here (`shotOptions`, for one target). */
  canShootAt(r: Robot, targetId: string): boolean {
    const sh = r.archetype.shooter;
    const ts = this.targets.get(targetId);
    return !!sh && !r.mechDown && !!ts && this.shotOption(r, sh, ts) !== null;
  }

  private shotOption(r: Robot, sh: Shooter, ts: TargetState): ShotOption | null {
    const t = ts.target;
    if (!t.aperture || !this.canUseTarget(r, ts)) return null;
    if (sh.tags && !sh.tags.some((tag) => t.tags?.includes(tag) || t.baseId === tag)) return null;
    const pieceType = r.held.find((h) => sh.pieceTypes.includes(h) && t.accepts.includes(h));
    if (!pieceType) return null;
    const aim = t.aimPoint ?? t.aperture.center;
    const d = Math.hypot(aim.x - r.x, aim.y - r.y);
    if (d > sh.maxRange) return null;
    if (this.shotPitch(r, t, d, aim.z - sh.height) === null) return null;
    return { target: t, pieceType, distance: d };
  }

  private shotPitch(r: Robot, t: XTarget, d: number, h: number): ShotSolution | null {
    const sh = r.archetype.shooter!;
    const down = t.aperture?.entry === 'down';
    return solveShot(sh.exitSpeed, d, h, t.arc ?? (down ? 'high' : 'low'), sh.pitchRangeDeg, down);
  }

  private tryShoot(r: Robot): void {
    const sh = r.archetype.shooter;
    if (!sh || r.shootCooldown > 0) return;
    let opts = this.shotOptions(r);
    if (r.command.targetId) opts = opts.filter((o) => o.target.id === r.command.targetId);
    const best = opts[0];
    if (!best) return;
    const t = best.target;
    const aim = t.aimPoint ?? t.aperture!.center;
    const heading = Math.atan2(aim.y - r.y, aim.x - r.x);
    if (!sh.turret) {
      r.aimYaw = heading;
      if (Math.abs(wrapAngle(heading - r.yaw)) > (3 * Math.PI) / 180) return;
    }
    const piece = this.pieces.find(
      (p) => p.status === 'held' && p.heldBy === r.id && p.type.id === best.pieceType,
    )!;
    // Launch from above the robot's own frame so the piece never spawns inside it or a field element.
    const ox = r.x;
    const oy = r.y;
    const oz = Math.max(sh.height, r.archetype.frame.height + piece.radius + 0.02);
    const d = Math.hypot(aim.x - ox, aim.y - oy);
    const sol = this.shotPitch(r, t, d, aim.z - oz);
    if (sol === null) return;
    const spread = (sh.spreadDeg * Math.PI) / 180;
    const yaw = Math.atan2(aim.y - oy, aim.x - ox) + gaussian(this.random) * spread;
    const pitch = sol.pitch + gaussian(this.random) * spread;
    let vx = sol.speed * Math.cos(pitch) * Math.cos(yaw);
    let vy = sol.speed * Math.cos(pitch) * Math.sin(yaw);
    const vz = sol.speed * Math.sin(pitch);
    if (!sh.shootOnMove) {
      vx += r.vx;
      vy += r.vy;
    }
    r.held.splice(r.held.indexOf(best.pieceType), 1);
    this.release(piece, { x: ox, y: oy, z: oz }, { x: vx, y: vy, z: vz });
    r.shootCooldown = sh.reloadSec;
    r.stats.shotsTaken++;
  }

  private release(p: Piece, pos: Vec3, vel: Vec3): void {
    p.status = 'field';
    p.heldBy = null;
    p.body.setEnabled(true);
    p.setPosition(pos);
    p.setVelocity(vel);
    p.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  private eject(r: Robot): void {
    const type = r.held.shift()!;
    const piece = this.pieces.find((p) => p.status === 'held' && p.heldBy === r.id && p.type.id === type)!;
    const off = r.archetype.frame.length / 2 + piece.radius + 0.05;
    const c = Math.cos(r.yaw);
    const s = Math.sin(r.yaw);
    this.release(
      piece,
      { x: r.x + c * off, y: r.y + s * off, z: piece.radius + 0.02 },
      { x: r.vx + c * 1.5, y: r.vy + s * 1.5, z: 0 },
    );
    r.intakeCooldown = 0.5;
  }

  // ------------------------------------------------------------------ scoring

  /** No drag in flight (so shots follow the ballistic solution); rolling resistance on the ground. */
  private updatePieceDamping(): void {
    for (const p of this.pieces) {
      if (p.status !== 'field') continue;
      const grounded = p.position.z < p.radius + 0.05;
      if (grounded !== p.grounded) {
        p.grounded = grounded;
        p.body.setLinearDamping(grounded ? 0.6 : 0);
      }
    }
  }

  private trackTouches(): void {
    // Piece by piece (each position read once); robots in id order, so the last robot touching a
    // piece still gets the touch, as when the loops were the other way around.
    const reach = (this.touchReach ??= this.robots.map(
      (r) => Math.hypot(r.archetype.frame.length, r.archetype.frame.width) / 2 + 0.05,
    ));
    for (const p of this.pieces) {
      if (p.status !== 'field') continue;
      const pos = p.position;
      for (const r of this.robots) {
        const lim = reach[r.id]! + p.radius;
        const dx = pos.x - r.x;
        const dy = pos.y - r.y;
        // Math.hypot is never below the larger leg, so this only skips pairs the test below rejects.
        if (Math.abs(dx) >= lim || Math.abs(dy) >= lim) continue;
        if (Math.hypot(dx, dy) < lim && pos.z < r.archetype.frame.height + 0.3) {
          p.lastTouch = r.id;
          p.lastTouchAlliance = r.alliance;
        }
      }
    }
  }

  private checkApertures(): void {
    // Only targets with an aperture, in the same order as `targets` (none in a place-only game).
    const targets = (this.apertureTargets ??= [...this.targets.values()].filter((ts) => ts.target.aperture));
    if (!targets.length) return;
    for (const p of this.pieces) {
      if (p.status !== 'field') continue;
      const pos = p.position;
      for (const ts of targets) {
        const ap = ts.target.aperture!;
        if (!ts.enabled || !ts.target.accepts.includes(p.type.id)) continue;
        const dx = pos.x - ap.center.x;
        const dy = pos.y - ap.center.y;
        let trig = this.apertureTrig.get(ap);
        if (!trig) this.apertureTrig.set(ap, (trig = [Math.cos(-(ap.yaw ?? 0)), Math.sin(-(ap.yaw ?? 0))]));
        const [c, s] = trig;
        const lx = dx * c - dy * s;
        const ly = dx * s + dy * c;
        if (
          Math.abs(lx) > ap.size.x / 2 ||
          Math.abs(ly) > ap.size.y / 2 ||
          Math.abs(pos.z - ap.center.z) > ap.size.z / 2
        )
          continue;
        if (ap.entry === 'down' && p.body.linvel().z > 0) continue;
        if (ts.target.capacity !== undefined && ts.count >= ts.target.capacity) continue;
        this.scorePiece(p, ts, p.lastTouch);
        break;
      }
    }
  }

  private scorePiece(p: Piece, ts: TargetState, robotId: number | null): void {
    const t = ts.target;
    const alliance =
      (t.creditTo ?? (t.alliance ? 'owner' : 'scorer')) === 'owner' ? t.alliance : p.lastTouchAlliance;
    p.status = 'scored';
    p.scoredIn = t.id;
    p.body.setEnabled(false);
    ts.count++;
    const per = this.scoringPeriod;
    ts.countByPhase[per]++;
    if (t.afterScore?.kind === 'recycle') {
      p.status = 'queued';
      p.releaseAt = this.time + t.afterScore.delaySec;
      p.releaseExit = ts.recycleCursor++ % t.afterScore.exits.length;
      this.recycleQueue.push({ piece: p, target: t });
    }
    if (!alliance) return;
    let points = t.points[per] * ts.multiplier;
    const override = this.def.rules?.onScore?.(this.rulesCtx, {
      time: this.time,
      phase: this.phase,
      alliance,
      targetId: t.id,
      pieceType: p.type.id,
      robotId,
      points,
    });
    if (typeof override === 'number') points = override;
    if (robotId !== null) this.robots[robotId]!.stats.piecesScored++;
    this.ledger.add({ time: this.time, alliance, category: per, points, source: t.id, robotId });
  }

  private processRecycle(): void {
    for (let i = this.recycleQueue.length - 1; i >= 0; i--) {
      const { piece, target } = this.recycleQueue[i]!;
      if (this.time < piece.releaseAt || target.afterScore?.kind !== 'recycle') continue;
      this.recycleQueue.splice(i, 1);
      const exit = target.afterScore.exits[piece.releaseExit]!;
      this.release(piece, exit, target.afterScore.exitVelocity ?? { x: 0, y: 0, z: 0 });
      piece.scoredIn = null;
      piece.lastTouch = null;
      piece.lastTouchAlliance = null;
    }
  }

  private trackLeave(r: Robot): void {
    if (this.phase !== 'auto') return;
    for (const aw of this.game.awards) {
      if (
        aw.kind !== 'leaveZoneInAuto' ||
        (aw.alliance && aw.alliance !== r.alliance) ||
        r.leftZones.has(aw.id)
      )
        continue;
      const corners = footprint(r.x, r.y, r.yaw, r.archetype.frame.length, r.archetype.frame.width);
      if (corners.every((c) => !pointInRegion(c, aw.zone))) r.leftZones.add(aw.id);
    }
  }

  private awardLeave(): void {
    for (const r of this.robots) {
      for (const aw of this.game.awards) {
        if (aw.kind === 'leaveZoneInAuto' && r.leftZones.has(aw.id)) {
          this.ledger.add({
            time: this.time,
            alliance: r.alliance,
            category: 'auto',
            points: aw.points,
            source: aw.id,
            robotId: r.id,
          });
        }
      }
    }
  }

  private finish(): void {
    for (const r of this.robots) {
      if (r.endgameDone) continue;
      for (const aw of this.game.awards) {
        if (aw.kind !== 'inZoneAtEnd' || (aw.alliance && aw.alliance !== r.alliance)) continue;
        if (pointInRegion(r, aw.zone)) {
          this.ledger.add({
            time: this.time,
            alliance: r.alliance,
            category: 'endgame',
            points: aw.points,
            source: aw.id,
            robotId: r.id,
          });
          break;
        }
      }
    }
    this.def.rules?.onMatchEnd?.(this.rulesCtx);
  }

  addFoul(against: Alliance, severity: 'minor' | 'major', reason: string): void {
    this.fouls[against][severity]++;
    this.ledger.add({
      time: this.time,
      alliance: other(against),
      category: 'penalty',
      points: this.def.fouls[severity],
      source: `foul:${reason}`,
      robotId: null,
    });
    this.announce(`${severity.toUpperCase()} FOUL on ${against}: ${reason}`, against);
  }

  announce(text: string, alliance?: Alliance): void {
    this.announcements.push({ time: this.time, text, ...(alliance ? { alliance } : {}) });
  }

  // ------------------------------------------------------------------ results

  summary(alliance: Alliance): AllianceSummary {
    const targetCounts: Record<string, { auto: number; teleop: number }> = {};
    for (const [id, ts] of this.targets) {
      const t = ts.target;
      const credited = (t.creditTo ?? (t.alliance ? 'owner' : 'scorer')) === 'owner' ? t.alliance : null;
      if (credited === alliance || credited === null) targetCounts[id] = { ...ts.countByPhase };
    }
    const endgame: Record<string, number> = {};
    for (const r of this.robots) {
      if (r.alliance === alliance && r.endgameDone) {
        const base = this.game.endgame.find((e) => e.id === r.endgameDone!.actionId)!.baseId;
        endgame[base] = (endgame[base] ?? 0) + 1;
      }
    }
    return {
      alliance,
      score: this.ledger.total(alliance),
      breakdown: this.ledger.breakdown(alliance),
      targetCounts,
      endgame,
      sources: this.ledger.bySource(alliance),
      fouls: { ...this.fouls[alliance] },
    };
  }

  /** Piece count in targets matching a piecesAtLeast rule, attributed to this alliance. */
  private piecesFor(alliance: Alliance, tags?: string[], ids?: string[]): number {
    let n = 0;
    for (const e of this.ledger.entries) {
      if (e.alliance !== alliance || (e.category !== 'auto' && e.category !== 'teleop')) continue;
      const ts = this.targets.get(e.source);
      if (!ts) continue;
      const t = ts.target;
      const tagOk = tags?.some((tag) => t.tags?.includes(tag)) ?? false;
      const idOk = ids?.includes(t.baseId) ?? false;
      if ((!tags && !ids) || tagOk || idOk) n++;
    }
    return n;
  }

  /** Points an alliance got from these ledger sources (base ids) and categories (no fouls by default). */
  private pointsFor(
    alliance: Alliance,
    sources?: readonly string[],
    categories?: readonly ScoreCategory[],
  ): number {
    const cats = categories ?? SCORING_CATEGORIES;
    let n = 0;
    for (const e of this.ledger.entries) {
      if (e.alliance !== alliance || !cats.includes(e.category)) continue;
      if (sources && !sources.includes(sourceBase(e.source))) continue;
      n += e.points;
    }
    return n;
  }

  getResult(): MatchResult {
    if (this.result) return this.result;
    const blue = this.summary('blue');
    const red = this.summary('red');
    const rp = (own: AllianceSummary, opp: AllianceSummary): AllianceResult => {
      const rules = this.def.rankingPoints;
      const won = own.score > opp.score;
      const tied = own.score === opp.score;
      const rpBreakdown: Record<string, number> = {};
      if (won) rpBreakdown.win = rules.win;
      if (tied) rpBreakdown.tie = rules.tie;
      for (const b of rules.bonuses) {
        let ok = false;
        switch (b.kind) {
          case 'scoreAtLeast':
            ok = own.score >= b.points;
            break;
          case 'piecesAtLeast':
            ok = this.piecesFor(own.alliance, b.tags, b.targetIds) >= b.count;
            break;
          case 'endgamePointsAtLeast':
            ok = own.breakdown.endgame >= b.points;
            break;
          case 'pointsAtLeast':
            ok = this.pointsFor(own.alliance, b.sources, b.categories) >= b.points;
            break;
          case 'custom':
            ok = b.check(own, opp);
            break;
        }
        if (ok) rpBreakdown[b.id] = b.rp;
      }
      return { ...own, rp: Object.values(rpBreakdown).reduce((a, c) => a + c, 0), rpBreakdown, won, tied };
    };
    const result: MatchResult = {
      blue: rp(blue, red),
      red: rp(red, blue),
      robots: this.robots.map((r) => ({
        id: r.id,
        alliance: r.alliance,
        archetype: r.archetype.id,
        points: this.ledger.byRobot(r.id),
        ...r.faults,
        stalls: r.stallCount,
        ...r.stats,
      })),
    };
    if (this.isOver) this.result = result;
    return result;
  }

  robotInfo(r: Robot): RobotInfo {
    return {
      id: r.id,
      alliance: r.alliance,
      x: r.x,
      y: r.y,
      yaw: r.yaw,
      held: [...r.held],
      endgameAction: r.endgameDone?.actionId ?? null,
      vx: r.vx,
      vy: r.vy,
      cmdX: r.command.vx,
      cmdY: r.command.vy,
    };
  }

  private makeRulesContext(): RulesContext {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const m = this;
    return {
      get time() {
        return m.time;
      },
      get phase() {
        return m.phase;
      },
      get remaining() {
        return m.remaining;
      },
      get endgame() {
        return m.isEndgame;
      },
      vars: m.vars,
      addPoints(alliance: Alliance, category: ScoreCategory, points: number, source: string) {
        m.ledger.add({ time: m.time, alliance, category, points, source, robotId: null });
      },
      foul: (against, severity, reason) => m.addFoul(against, severity, reason),
      targetCount: (id) => m.targets.get(id)?.count ?? 0,
      setTargetEnabled: (id, enabled) => {
        const ts = m.targets.get(id);
        if (ts) ts.enabled = enabled;
      },
      setTargetMultiplier: (id, multiplier) => {
        const ts = m.targets.get(id);
        if (ts) ts.multiplier = multiplier;
      },
      robots: () => m.robots.map((r) => m.robotInfo(r)),
      spawnPiece: (type, pos, vel) => void m.spawnPiece(type, pos, vel),
      announce: (text, alliance) => m.announce(text, alliance),
      setIndicator: (key, value) => {
        if (value === null) m.indicators.delete(key);
        else m.indicators.set(key, value);
      },
      random: () => m.random(),
    };
  }
}

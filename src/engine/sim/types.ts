/**
 * GameDefinition schema: the contract between a season's generated module and the engine.
 *
 * Coordinates are WPILib field coordinates: meters, radians, Z-up, origin at the corner of the blue
 * alliance wall, +X toward the red alliance wall, +Y to the left as seen from the blue driver stations.
 *
 * Authoring convention: describe the BLUE half of the field. Anything with `side: 'blue'` is copied
 * to the red side by `expandDefinition` using `field.symmetry`. Anything with `side: 'neutral'` exists once
 * (list both copies yourself if a neutral thing is duplicated).
 */

export type Alliance = 'blue' | 'red';
export type Side = 'blue' | 'neutral';

export interface Vec2 {
  x: number;
  y: number;
}
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Intrinsic Z-Y-X Euler angles in radians. */
export interface Euler {
  yaw?: number;
  pitch?: number;
  roll?: number;
}

/** A floor region. Rect is axis-aligned; poly is a simple polygon (counter-clockwise or clockwise). */
export type Region2D =
  | { kind: 'rect'; min: Vec2; max: Vec2 }
  | { kind: 'circle'; center: Vec2; radius: number }
  | { kind: 'poly'; points: Vec2[] };

/** Where every number came from. Free text, e.g. "Manual 6.4.2, Table 6-2" or "video 01:32". */
export type Citation = string;

// ---------------------------------------------------------------- timing

export interface MatchTiming {
  /** Autonomous length, seconds (FRC usually 15). */
  autoSec: number;
  /** Pause between auto and teleop during which robots are disabled (FRC usually ~3). */
  transitionSec: number;
  /** Teleop length, seconds (FRC usually 135). */
  teleopSec: number;
  /** The final N seconds of teleop are "endgame" (enables endgame actions by default). */
  endgameSec: number;
  source?: Citation;
}

// ---------------------------------------------------------------- field

export type ElementShape =
  | { kind: 'box'; size: Vec3 }
  | { kind: 'cylinder'; radius: number; height: number }
  /** Convex hull of world-space-relative vertices (relative to `position`, before rotation). */
  | { kind: 'hull'; vertices: Vec3[] };

export interface FieldElement {
  id: string;
  name?: string;
  side: Side;
  shape: ElementShape;
  /** Center of the shape (box/cylinder) or origin of hull vertices. */
  position: Vec3;
  rotation?: Euler;
  /** Collides with robots and pieces. Non-solid elements are visual only. Default true. */
  solid?: boolean;
  /** CSS color, or 'alliance' to use the owning alliance color (blue/red), 'neutral' for gray. */
  color?: string;
  opacity?: number;
  friction?: number;
  restitution?: number;
  source?: Citation;
}

export interface ZoneDefinition {
  id: string;
  name?: string;
  side: Side;
  region: Region2D;
  /** Draw a floor outline for this zone. Default true. */
  visible?: boolean;
  source?: Citation;
}

export interface FieldDefinition {
  /** Length along X (alliance wall to alliance wall), meters. */
  length: number;
  /** Width along Y, meters. */
  width: number;
  /** Perimeter wall height, meters. */
  wallHeight: number;
  /**
   * How the blue half maps to the red half.
   * - 'rotational': 180 deg rotation about the field center (x,y) -> (L-x, W-y).
   * - 'mirror': reflection across the center line x = L/2, (x,y) -> (L-x, y).
   */
  symmetry: 'rotational' | 'mirror';
  elements: FieldElement[];
  zones: ZoneDefinition[];
  carpetColor?: string;
  source?: Citation;
}

// ---------------------------------------------------------------- game pieces

export type PieceShape =
  | { kind: 'sphere'; radius: number }
  | { kind: 'cylinder'; radius: number; height: number }
  /** Rendered as a ring; physics uses a cylinder of the outer radius. */
  | { kind: 'torus'; outerRadius: number; innerRadius: number; height: number }
  | { kind: 'box'; size: Vec3 };

export interface PieceType {
  id: string;
  name: string;
  shape: PieceShape;
  mass: number;
  color: string;
  friction?: number;
  restitution?: number;
  source?: Citation;
}

export interface PieceStaging {
  type: string;
  side: Side;
  /** Positions of individual pieces (resting height is computed from the shape if z is omitted). */
  positions: Array<Vec2 & { z?: number }>;
  source?: Citation;
}

// ---------------------------------------------------------------- scoring

export interface PhasePoints {
  auto: number;
  teleop: number;
}

/** Robot center must be inside `zone` (and optionally face `facePoint`) to place. */
export interface PlaceSpec {
  zone: Region2D;
  /** If set, the robot's front must point within `faceToleranceRad` of this point. */
  facePoint?: Vec2;
  faceToleranceRad?: number;
}

/** A 3D sensor volume; any piece whose center enters it is scored. */
export interface ApertureSpec {
  center: Vec3;
  size: Vec3;
  yaw?: number;
  /** 'down' only counts pieces moving downward (top-entry goals). Default 'any'. */
  entry?: 'any' | 'down';
}

export type AfterScore =
  | { kind: 'consume' }
  /** Piece re-enters play after `delaySec` at one of `exits` (cycled) with velocity `exitVelocity`. */
  | { kind: 'recycle'; delaySec: number; exits: Vec3[]; exitVelocity?: Vec3 };

export interface ScoringTarget {
  id: string;
  name: string;
  side: Side;
  /** 'owner': the alliance owning the target gets points. 'scorer': the alliance that last touched the piece. */
  creditTo?: 'owner' | 'scorer';
  accepts: string[];
  points: PhasePoints;
  /** Capability tags (e.g. 'L4', 'high', 'amp'); robots must list a tag to place here. */
  tags?: string[];
  capacity?: number;
  place?: PlaceSpec;
  aperture?: ApertureSpec;
  /** Point shooters aim at; defaults to aperture center. */
  aimPoint?: Vec3;
  /** Preferred trajectory for shooters. Default 'high' for entry 'down', else 'low'. */
  arc?: 'high' | 'low';
  afterScore?: AfterScore;
  source?: Citation;
}

// ---------------------------------------------------------------- human player

export interface HumanPlayerStation {
  id: string;
  name: string;
  side: Side;
  /** Robot center must be inside this zone to receive pieces. */
  zone: Region2D;
  pieceTypes: string[];
  /**
   * 'direct': piece goes straight into a robot in the zone that is intaking.
   * 'drop': a physical piece is spawned at `dropPoint` with `dropVelocity`.
   */
  mode: 'direct' | 'drop';
  feedIntervalSec: number;
  dropPoint?: Vec3;
  dropVelocity?: Vec3;
  /** Pieces available per alliance for the whole match at this station (omit = unlimited). */
  supply?: number;
  source?: Citation;
}

// ---------------------------------------------------------------- endgame & awards

export interface EndgameAction {
  id: string;
  name: string;
  side: Side;
  /** Any of these zones; each zone accepts at most `maxRobotsPerZone` robots. */
  zones: Region2D[];
  maxRobotsPerZone?: number;
  points: number;
  /** Seconds the robot is locked in place performing the action. */
  durationSec?: number;
  /** Available in teleop when remaining teleop time <= this. Default: timing.endgameSec. */
  availableAtRemainingSec?: number;
  /** Also allowed during autonomous (awarded `autoPoints`, default `points`). */
  allowInAuto?: boolean;
  autoPoints?: number;
  source?: Citation;
}

export interface PositionAward {
  id: string;
  name: string;
  side: Side;
  /**
   * 'leaveZoneInAuto': robot footprint fully left `zone` at any time during auto.
   * 'inZoneAtEnd': robot center inside `zone` when the match ends and not credited an endgame action.
   */
  kind: 'leaveZoneInAuto' | 'inZoneAtEnd';
  zone: Region2D;
  points: number;
  source?: Citation;
}

// ---------------------------------------------------------------- ranking points

/** Read-only view handed to custom RP checks and rules. */
export interface AllianceSummary {
  alliance: Alliance;
  score: number;
  breakdown: Record<ScoreCategory, number>;
  /** Pieces scored per expanded target id (e.g. 'speaker.blue'), split by phase. */
  targetCounts: Record<string, { auto: number; teleop: number }>;
  endgame: Record<string, number>;
  fouls: { minor: number; major: number };
}

export type RankingPointRule =
  | { id: string; name: string; rp: number; kind: 'scoreAtLeast'; points: number; source?: Citation }
  | {
      id: string;
      name: string;
      rp: number;
      kind: 'piecesAtLeast';
      count: number;
      /** Count pieces in targets carrying any of these tags (or with these base ids). */
      tags?: string[];
      targetIds?: string[];
      source?: Citation;
    }
  | {
      id: string;
      name: string;
      rp: number;
      kind: 'endgamePointsAtLeast';
      points: number;
      source?: Citation;
    }
  | {
      id: string;
      name: string;
      rp: number;
      kind: 'custom';
      check: (own: AllianceSummary, opp: AllianceSummary) => boolean;
      source?: Citation;
    };

// ---------------------------------------------------------------- robots

export interface RobotArchetype {
  id: string;
  name: string;
  description: string;
  /** Bumper-to-bumper footprint and height, meters. */
  frame: { length: number; width: number; height: number };
  mass: number;
  drive: {
    maxSpeed: number;
    maxAccel: number;
    maxOmega: number;
    /** Coefficient of friction against carpet, caps pushing force. Default 1.1. */
    traction?: number;
  };
  /** Max pieces held, per piece type. */
  capacity: Record<string, number>;
  /** Max total pieces regardless of type. Default: sum of capacity. */
  totalCapacity?: number;
  intake?: {
    pieceTypes: string[];
    /** Seconds per piece. */
    timeSec: number;
    /** Depth of the intake region in front of the bumper, meters. Default 0.15. */
    reach?: number;
    /** Highest piece-center height the intake can grab, meters. Default 0.3. */
    maxHeight?: number;
  };
  /** Target tag -> seconds to place one piece. */
  place?: Record<string, number>;
  shooter?: {
    pieceTypes: string[];
    exitSpeed: number;
    /** 1-sigma aim error, degrees (applied to yaw and pitch). */
    spreadDeg: number;
    reloadSec: number;
    maxRange: number;
    /** Launch height above floor. */
    height: number;
    /** Target tags this shooter may aim at; omit = any aperture target. */
    tags?: string[];
    /** Turret: no need to face the target. Otherwise robot auto-aligns first. */
    turret?: boolean;
    /** Compensates for robot velocity when shooting on the move. */
    shootOnMove?: boolean;
  };
  /** Endgame action id -> seconds to perform. Missing = cannot do it. */
  endgame?: Record<string, number>;
  source?: Citation;
}

export interface StartPose {
  x: number;
  y: number;
  yaw: number;
}

// ---------------------------------------------------------------- rules hooks

export type MatchPhase = 'pre' | 'auto' | 'transition' | 'teleop' | 'post';
export type ScoreCategory = 'auto' | 'teleop' | 'endgame' | 'penalty';

export interface ScoreEvent {
  time: number;
  phase: MatchPhase;
  alliance: Alliance;
  /** Expanded target id, e.g. 'speaker.red'. */
  targetId: string;
  pieceType: string;
  robotId: number | null;
  points: number;
}

export interface RobotInfo {
  id: number;
  alliance: Alliance;
  x: number;
  y: number;
  yaw: number;
  held: readonly string[];
  endgameAction: string | null;
}

export interface RulesContext {
  readonly time: number;
  readonly phase: MatchPhase;
  readonly remaining: number;
  readonly endgame: boolean;
  /** Per-match scratch state owned by the game's rules. */
  readonly vars: Record<string, unknown>;
  addPoints(alliance: Alliance, category: ScoreCategory, points: number, source: string): void;
  foul(against: Alliance, severity: 'minor' | 'major', reason: string): void;
  targetCount(expandedTargetId: string): number;
  setTargetEnabled(expandedTargetId: string, enabled: boolean): void;
  setTargetMultiplier(expandedTargetId: string, multiplier: number): void;
  robots(): readonly RobotInfo[];
  spawnPiece(type: string, position: Vec3, velocity?: Vec3): void;
  /** Short message shown on the HUD. */
  announce(text: string, alliance?: Alliance): void;
  /** Named HUD indicator (e.g. 'blue hub' -> 'ACTIVE'). */
  setIndicator(key: string, value: string | number | null): void;
  random(): number;
}

export interface GameRules {
  onInit?(ctx: RulesContext): void;
  onTick?(ctx: RulesContext, dt: number): void;
  /** Return a number to override the points awarded (e.g. a multiplier mechanic). */
  onScore?(ctx: RulesContext, event: ScoreEvent): number | void;
  onPhaseChange?(ctx: RulesContext, phase: MatchPhase): void;
  onMatchEnd?(ctx: RulesContext): void;
}

/** Optional strategy hints for the generic bot AI. */
export interface BotHints {
  /** Relative preference per base target id (default 1). 0 = never. */
  targetWeights?: Record<string, number>;
  /** Seconds before match end to head for endgame. Default: endgame duration + travel estimate. */
  endgameLeadSec?: number;
  /** Endgame action ids in preference order. */
  endgamePreference?: string[];
  /** Fraction of opposing bots that play defense in teleop (0..1). Default 0. */
  defenseShare?: number;
}

// ---------------------------------------------------------------- the definition

export interface GameDefinition {
  /** Stable id, e.g. '2027-example'. Must match the folder name. */
  id: string;
  year: number;
  name: string;
  /** One-paragraph game summary shown in the menu. */
  summary: string;
  timing: MatchTiming;
  field: FieldDefinition;
  pieces: PieceType[];
  staging: PieceStaging[];
  /** Pieces each robot starts holding (must fit its archetype). */
  preload: Record<string, number>;
  /** Blue start poses (mirrored for red), one per driver station 1..3. */
  startPoses: [StartPose, StartPose, StartPose];
  targets: ScoringTarget[];
  stations: HumanPlayerStation[];
  endgame: EndgameAction[];
  awards: PositionAward[];
  rankingPoints: { win: number; tie: number; bonuses: RankingPointRule[] };
  fouls: { minor: number; major: number; source?: Citation };
  archetypes: RobotArchetype[];
  defaultArchetype: string;
  rules?: GameRules;
  botHints?: BotHints;
}

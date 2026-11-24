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
  /**
   * How the bots' navigation treats a solid element:
   * - 'auto' (default): by height. Robot-height parts at least 0.2 m tall are walls; anything
   *   0.05-0.2 m tall is a ramp; lower is flat floor.
   * - 'wall': always drive around it (a guard rail or low curb robots can't cross).
   * - 'ramp': drivable but slow (a ramp or platform robots climb, whatever its height).
   * - 'none': ignore it (bumps, or a structure robots fit under).
   */
  nav?: 'auto' | 'wall' | 'ramp' | 'none';
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
  /** Rendered as a cone (base radius, apex up); physics uses a cylinder of `radius * 0.8`. */
  | { kind: 'cone'; radius: number; height: number }
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
  /**
   * Visual only: where scored pieces are drawn (piece center). Pieces stack upward by their height
   * if the target holds several. Omit to hide scored pieces.
   */
  display?: Vec3;
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
   * The robot (its driver signalling the human player) picks which of `pieceTypes` it gets, with
   * `RobotCommand.pieceType`. Default: the station hands out the first type the robot can hold.
   */
  choice?: boolean;
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
  /**
   * Height (m) at which pieces are handed over (e.g. a shelf). Only robots whose
   * `intake.maxHeight` reaches it can use the station. Omit for floor-level / any robot.
   */
  handoffHeight?: number;
  /**
   * 'direct' mode: seconds a robot must stay in the zone intaking before the piece is in it (lining
   * up on a shelf, grabbing). Default 0 (instant).
   */
  handoffSec?: number;
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
  /**
   * Robots of one alliance perform `oneAtATime` actions one after another (e.g. driving onto a
   * tilting platform): a robot can't start one while a teammate is mid-way through any of them.
   */
  oneAtATime?: boolean;
  /** Available in teleop when remaining teleop time <= this. Default: timing.endgameSec. */
  availableAtRemainingSec?: number;
  /**
   * Also allowed during autonomous (awarded `autoPoints`, default `points`). A robot that completes
   * it in auto is released again when teleop starts. Set `availableAtRemainingSec: -1` for an
   * auto-only action.
   */
  allowInAuto?: boolean;
  autoPoints?: number;
  /**
   * Action id credited instead when an attempt fails (`RobotArchetype.endgameSuccess`): e.g. a
   * balance that doesn't settle still leaves the robot docked. Without one, a failed attempt earns
   * nothing and the robot is free to try again.
   */
  fallback?: string;
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
  /** Points per ledger source (expanded target / action / award id, or a rules source string). */
  sources: Record<string, number>;
  /** Fouls called on this alliance. */
  fouls: { minor: number; major: number };
  /** Fouls called on this alliance, by reason (rule id and what it was for, e.g. 'G202 pinning'). */
  foulCalls: Record<string, number>;
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
      /** Points from some sources at least `points` (e.g. "26 Charge Station points", auto included). */
      kind: 'pointsAtLeast';
      points: number;
      /**
       * Ledger sources to count: target, endgame action and award base ids, and the source names a
       * game's `rules.ts` passes to `addPoints`. Omit to count every source.
       */
      sources?: string[];
      /** Categories to count. Default auto, teleop and endgame (no foul points). */
      categories?: ScoreCategory[];
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

// ---------------------------------------------------------------- fouls

/**
 * A protected-zone contact rule the engine enforces (e.g. 2023 G207). While the right robot is in
 * one of an alliance's `zones`, an opponent touching (bumper to bumper) one of that alliance's
 * robots draws a foul on the opponent. Bots treat these zones as off limits for defense unless
 * `botHints` says otherwise.
 */
export interface ContactFoulRule {
  /** Rule number, shown in the foul reason (e.g. 'G207'). */
  id: string;
  /** What the foul is for, e.g. "contact in the opponent's loading zone". */
  name: string;
  /** Zone base ids of sided zones. Each alliance's copy protects that alliance's robots. */
  zones: string[];
  /**
   * Whose position decides:
   * - 'intruder': the opponent is in the zone (2023 G207: "a ROBOT with any part of itself in
   *   their opponent's LOADING ZONE or COMMUNITY may not contact an opponent ROBOT").
   * - 'protected': the protected robot is in the zone (contact with a robot that is loading or
   *   climbing in its own zone).
   */
  inside: 'intruder' | 'protected';
  /** That robot must be entirely in the zone. Default: any part of it counts. */
  fully?: boolean;
  severity: 'minor' | 'major';
  /** Only during the endgame (e.g. a climbing area that is protected then). */
  endgameOnly?: boolean;
  /** Seconds before the same pair of robots can draw this foul again ("per instance"). Default 3. */
  repeatSec?: number;
  /**
   * Don't call it when the protected robot drove into the opponent harder than the opponent drove
   * into it (a G201-style violation forced by the other alliance). Manuals usually call these
   * fouls "regardless of who initiates contact" and excuse only deliberate forcing, so this is a
   * lenient approximation. Default false.
   */
  forgiveForced?: boolean;
  source?: Citation;
}

/**
 * Pinning (e.g. 2023 G202): pressing an opponent that is trying to move but can't. The count runs
 * while the pin lasts and pauses while it doesn't; every `countSec` of it draws a foul (the first
 * `severity`, then `repeatSeverity`). The pin ends once the robots are `releaseGap` apart, either
 * robot has moved `releaseGap` from where it started, or the pinning robot gets pinned itself
 * (the usual FRC wording). Pinning the same robot again within `repinSec` resumes the count.
 */
export interface PinningRule {
  id: string;
  /** Default 5. */
  countSec?: number;
  /** The first call. Default 'minor'. */
  severity?: 'minor' | 'major';
  /** Each further call. Default 'major'. */
  repeatSeverity?: 'minor' | 'major';
  /**
   * Bumper-to-bumper gap (m) that ends a pin, and how far (m) either robot moves from where the pin
   * started to end it. Default 1.83 (6 ft, the usual FRC wording).
   */
  releaseGap?: number;
  /** Seconds after a pin ends within which pinning the same robot again resumes its count. Default 3. */
  repinSec?: number;
  source?: Citation;
}

export interface FoulRules {
  /** Points the other alliance gets per foul. */
  minor: number;
  major: number;
  /** Protected-zone contact rules the engine enforces. */
  contact?: ContactFoulRule[];
  /** Pinning rule the engine enforces. */
  pinning?: PinningRule;
  source?: Citation;
}

// ---------------------------------------------------------------- robots

/** Per-match fault rates for a robot with breakdowns on. Chances are 0..1. */
export interface FaultRates {
  /** Chance to break down (no driving, no mechanisms) at a random time in the match. */
  breakdownChance: number;
  /** Chance a breakdown clears 10-35 s later. */
  breakdownRecoverChance: number;
  /** Chance the game-piece mechanisms fail (the robot still drives and can do endgame actions). */
  mechFailChance: number;
  /** Chance a mechanism failure clears 5-25 s later. */
  mechRecoverChance: number;
  /** Expected short (2-6 s) power / comms losses per match. */
  stallsPerMatch: number;
}

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
    /** Maximum exit speed, m/s. The engine picks speed and hood angle per shot. */
    exitSpeed: number;
    /** 1-sigma aim error, degrees (applied to yaw and pitch). */
    spreadDeg: number;
    reloadSec: number;
    maxRange: number;
    /** Launch height above floor. */
    height: number;
    /** Hood angle range [min, max] in degrees above horizontal. Default [10, 80]. */
    pitchRangeDeg?: [number, number];
    /** Target tags this shooter may aim at; omit = any aperture target. */
    tags?: string[];
    /** Turret: no need to face the target. Otherwise robot auto-aligns first. */
    turret?: boolean;
    /** Compensates for robot velocity when shooting on the move. */
    shootOnMove?: boolean;
  };
  /** Endgame action id -> seconds to perform. Missing = cannot do it. */
  endgame?: Record<string, number>;
  /**
   * Endgame action id -> chance (0..1) that a finished attempt counts. Default 1. A failed attempt
   * earns the action's `fallback` instead, if it has one, else nothing (the robot may try again).
   */
  endgameSuccess?: Record<string, number>;
  /**
   * How dependable the robot (and, for bots, its drive team) is, 0..1. Default 0.95. When a match
   * runs with breakdowns on, lower values mean a higher chance to break down (about 0.6 x (1 -
   * reliability)), a higher chance of a mechanism failure that stops scoring but not driving (about
   * 1.5 x (1 - reliability)), a lower chance of either clearing later in the match, more short
   * power / comms losses (about 5 x (1 - reliability) per match, 2-6 s each), and, for bots, more
   * lapses where they ignore teammates.
   */
  reliability?: number;
  /** Explicit per-match fault rates, overriding the ones derived from `reliability` (menu tuning). */
  faults?: Partial<FaultRates>;
  /** What a bot driving this robot does by default: score, or play defense all teleop. */
  defaultRole?: RobotRole;
  source?: Citation;
}

export type RobotRole = 'score' | 'defense';

/**
 * How an alliance's bots play the match (any game):
 * - 'balanced': score, then the endgame on the usual schedule, defend only when it clearly pays.
 * - 'max-cycles': keep cycling as late as possible, never stop to defend.
 * - 'early-endgame': head for the endgame ~15 s early to make sure of it.
 * - 'aggressive': defend opportunistically about three times as readily.
 */
export type AllianceStrategy = 'balanced' | 'max-cycles' | 'early-endgame' | 'aggressive';

/** A suggested alliance composition shown in the menu. */
export interface AllianceLineup {
  id: string;
  name: string;
  description: string;
  robots: [LineupSlot, LineupSlot, LineupSlot];
  strategy?: AllianceStrategy;
}

export interface LineupSlot {
  archetype: string;
  /** Default: the archetype's `defaultRole`, else 'score'. */
  role?: RobotRole;
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
  /** Field velocity, m/s (who drove into whom, for contact rules). */
  vx: number;
  vy: number;
  /**
   * Where the driver (or bot) is trying to go: the commanded field-relative drive, -1..1 per axis.
   * With velocity it tells a pinned robot (wants to move, can't) from one that is parked.
   */
  cmdX: number;
  cmdY: number;
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
  /**
   * Boarding order for `oneAtATime` actions, by action id: a bot doing a later action waits until
   * teammates doing earlier ones are done (e.g. dock-only robots first, the balancer last), unless
   * time is running out.
   */
  endgameOrder?: string[];
  /** Fraction of opposing bots that play defense in teleop (0..1). Default 0. */
  defenseShare?: number;
  /**
   * How readily scoring bots stop to block a nearby opponent carrying a piece (0 = never). The bot
   * weighs the points the delay costs the opponent against its own cycle. Default 1.
   */
  defenseOpportunism?: number;
  /**
   * Zone base ids where an alliance's own robots are protected from contact (e.g. a loading zone).
   * Defending bots never chase an opponent into, or wait inside, that opponent's protected zones,
   * and bots don't go after loose pieces lying in the opponent's protected zones. Default: the
   * zones of `fouls.contact` rules that aren't `endgameOnly`.
   */
  protectedZones?: string[];
  /**
   * Zone base ids where an alliance's robots are protected only during the endgame (e.g. a
   * charge station or climbing area): defenders leave opponents near them alone then. Default:
   * the zones of `endgameOnly` `fouls.contact` rules.
   */
  endgameProtectedZones?: string[];
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
  /**
   * Pieces each robot starts holding, handed out in listed order while the robot has room. With a
   * total capacity of 1, `{ cone: 1, cube: 1 }` means "a cone, or a cube for cube-only robots".
   */
  preload: Record<string, number>;
  /** Blue start poses (mirrored for red), one per driver station 1..3. */
  startPoses: [StartPose, StartPose, StartPose];
  targets: ScoringTarget[];
  stations: HumanPlayerStation[];
  endgame: EndgameAction[];
  awards: PositionAward[];
  rankingPoints: { win: number; tie: number; bonuses: RankingPointRule[] };
  fouls: FoulRules;
  archetypes: RobotArchetype[];
  defaultArchetype: string;
  /** Suggested alliance compositions (specialist mixes and strategies) offered in the menu. */
  lineups?: AllianceLineup[];
  rules?: GameRules;
  botHints?: BotHints;
}

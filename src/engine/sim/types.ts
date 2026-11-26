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
  /**
   * For a structure robots drive under (`nav: 'none'`): the height, m, below which a robot fits.
   * Robots whose frame is taller treat it as a wall (their nav grid), as physics already does.
   */
  clearance?: number;
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
  /**
   * Preferred trajectory for shooters. Default 'high' for entry 'down', else 'low'. 'rising': the
   * fastest shot the shooter makes (lowest hood angle), still rising at the aim point, for a mouth
   * that opens downward under a hood (2024 SPEAKER), where a falling piece would hit the hood.
   */
  arc?: 'high' | 'low' | 'rising';
  afterScore?: AfterScore;
  /**
   * Visual only: where scored pieces are drawn (piece center). Pieces stack upward by their height
   * if the target holds several. Omit to hide scored pieces.
   */
  display?: Vec3;
  /**
   * Visual only: offset from one displayed piece to the next when the target holds several (pieces
   * laid side by side in a trough). Default: stacked straight up by the piece's height.
   */
  displayStep?: Vec3;
  /** Visual only: orientation of the displayed pieces (a tube on an angled branch). Default upright. */
  displayRotation?: Euler;
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
   * 'direct' mode: seconds a robot must stay in the zone intaking before the human player's piece
   * reaches its intake (lining up on a shelf, the hand-over). Default 0 (instant). The robot then
   * takes its own `intake.timeSec` to grab it.
   */
  handoffSec?: number;
  /**
   * Bots also use this station during AUTO: a piece lying on a field structure (2025 REEF ALGAE), or
   * a HUMAN PLAYER the rules let feed in AUTO (2025 G402). Default false: human players feed in TELEOP.
   * The engine itself never blocks a station by phase.
   */
  auto?: boolean;
  /**
   * Visual only: where a piece of the station's first type is drawn while the station still has
   * supply for that alliance (a piece resting on a field structure until a robot takes it).
   */
  display?: Vec3;
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
   * - 'either': either robot is in the zone (2024 G423: "if any part of either ROBOT'S BUMPERS
   *   are in the opponent's SOURCE ZONE or AMP ZONE"). One contact draws one call.
   */
  inside: 'intruder' | 'protected' | 'either';
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
 * Pinning (e.g. 2023 G202): pressing an opponent that is trying to move but can't, against a wall,
 * a field element or another robot beyond it (two robots shoving head-on in the open aren't
 * pinning each other). The count runs while the pin lasts and pauses while it doesn't; every `countSec` of it draws a foul (the first
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
    /**
     * Seconds the robot stops to get a piece into the robot once it's in reach: on the floor, or
     * after lining up at a station's hand-off (`HumanPlayerStation.handoffSec`). Also the least time
     * between two pieces.
     */
    timeSec: number;
    /** Depth of the intake region in front of the bumper, meters. Default 0.15. */
    reach?: number;
    /** Highest piece-center height the intake can grab, meters. Default 0.3. */
    maxHeight?: number;
    /**
     * Can pick pieces up off the floor. Default true; false for a robot that only takes pieces
     * from human player stations (2024's KitBot loaded through its shooter at the SOURCE).
     */
    floor?: boolean;
  };
  /** Target tag -> seconds to place one piece (the mechanism; see `alignSec` for the drive team). */
  place?: Record<string, number>;
  /**
   * Bots only: seconds this robot's typical drive team spends lining up each teleop pickup and
   * placement before the mechanism starts (fine adjustments, misses and retries). The bot waits at
   * the piece, station or target, and can still break off (e.g. for the endgame). A programmed auto
   * routine doesn't need it, and a player drives their own robot. Default 0.
   */
  alignSec?: number;
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
    /**
     * Can lob a held piece to a teammate up to this far, m (`GameDefinition.passing`, `RobotCommand.pass`).
     * Omit: the robot doesn't pass.
     */
    passRange?: number;
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
  /** What its autonomous routine does when a bot runs it. Omit for the planner's best effort. */
  auto?: AutoRoutine;
  /** What a bot driving this robot does by default: score, or play defense all teleop. */
  defaultRole?: RobotRole;
  /**
   * How often the menu's random preset deals this type, relative to the others (default 1; 0 =
   * never dealt, menu and lineups only). Set it to the real season's share of such robots.
   */
  dealWeight?: number;
  source?: Citation;
}

/**
 * A robot's autonomous routine, as a bot runs it (and the player's "auto routine" option). Real autos
 * do far less than the planner's best effort: many robots score only their preload, some only drive
 * out of the starting zone, some do nothing.
 */
export interface AutoRoutine {
  /** Most game pieces the routine scores, preload included. Omit for no limit. */
  pieces?: number;
  /**
   * Once its pieces are scored, drive out of the starting zone (the game's `leaveZoneInAuto` awards)
   * if it hasn't already. Default true. Fetching a piece can take it out anyway.
   */
  leave?: boolean;
  /**
   * Chance (0..1) the routine runs in a match. Otherwise the robot sits still until teleop (a dead or
   * missing auto). Default 1. The player's own auto routine always runs.
   */
  success?: number;
}

/**
 * What a bot does all match: 'score' (the planner's best points per second), 'defense' (marks
 * opposing scorers in teleop), or the id of one of the game's specialist `roles` (a scorer that
 * keeps to some targets in teleop).
 */
export type RobotRole = 'score' | 'defense' | (string & {});

/**
 * A specialist job a game offers for bots (`GameDefinition.roles`), chosen per slot like 'score' or
 * 'defense': a scoring bot that weighs its targets differently in teleop, e.g. one that only feeds
 * an AMP. Auto routines are unchanged. It changes what the bot chooses, never the robot.
 */
export interface SpecialistRole {
  id: string;
  name: string;
  description: string;
  /**
   * Teleop weight per base target id, multiplying `botHints.targetWeights` (default 1, 0 = never).
   * Weights bias the bot's points-per-second planner, so a weight above 1 also makes it accept a
   * longer trip for that target.
   */
  targetWeights: Record<string, number>;
  /**
   * A feeder: in teleop it fetches pieces far from its goal and passes them toward its teammates
   * (`GameDefinition.passing`) instead of carrying them, unless it's already within the passing
   * `minDistance`. Needs a shooter with a `passRange`.
   */
  feeds?: boolean;
  /**
   * A defender (like the built-in 'defense' role) that waits at a different post: 'goal' in front of
   * where the opponents score (ADR 0010, the default), 'source' just outside the opponents' loading
   * area, holding up robots on their way in as well as carriers on their way out.
   */
  defense?: 'goal' | 'source';
  source?: Citation;
}

/**
 * How an alliance's bots play the match (any game):
 * - 'balanced': score, then the endgame on the usual schedule, defend only when it clearly pays.
 * - 'max-cycles': keep cycling as late as possible, never stop to defend.
 * - 'early-endgame': head for the endgame ~15 s early to make sure of it.
 * - 'aggressive': defend opportunistically about three times as readily.
 * - 'close-out': balanced, but once the lead is safe (the opponents can't catch up at twice the
 *   rate they have scored so far), head for the endgame ~15 s early like 'early-endgame'.
 */
export type AllianceStrategy = 'balanced' | 'max-cycles' | 'early-endgame' | 'aggressive' | 'close-out';

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
  /** Pieces a station (expanded id) has handed to an alliance's robots so far (its `supply` used). */
  stationUsed(expandedStationId: string, alliance: Alliance): number;
  setTargetEnabled(expandedTargetId: string, enabled: boolean): void;
  setTargetMultiplier(expandedTargetId: string, multiplier: number): void;
  robots(): readonly RobotInfo[];
  spawnPiece(type: string, position: Vec3, velocity?: Vec3): void;
  /** Short message shown on the HUD. */
  announce(text: string, alliance?: Alliance): void;
  /**
   * Named HUD indicator (e.g. 'blue hub' -> 'ACTIVE'). A key starting with 'blue' or 'red' is shown
   * on that alliance's side. `style` marks a live window or bonus and can draw a countdown bar.
   */
  setIndicator(key: string, value: string | number | null, style?: IndicatorStyle): void;
  random(): number;
}

/** How the HUD draws an indicator. */
export interface IndicatorStyle {
  /** A window, multiplier or bonus is live now: the chip is highlighted. */
  active?: boolean;
  /** The window ends at this match time (s): the chip drains a bar toward it... */
  until?: number;
  /** ...over a window this long (s). */
  span?: number;
}

export interface GameRules {
  onInit?(ctx: RulesContext): void;
  onTick?(ctx: RulesContext, dt: number): void;
  /** Return a number to override the points awarded (e.g. a multiplier mechanic). */
  onScore?(ctx: RulesContext, event: ScoreEvent): number | void;
  onPhaseChange?(ctx: RulesContext, phase: MatchPhase): void;
  onMatchEnd?(ctx: RulesContext): void;
  /**
   * Extra points the bots should count for scoring a piece in `targetId` (expanded id) for
   * `alliance` now, such as a bonus that piece would complete (2023: a LINK). Bots only: it never
   * changes the score. Called often while bots plan, so keep it cheap.
   */
  botValue?(ctx: RulesContext, alliance: Alliance, targetId: string): number;
  /**
   * Bots only: true while a bot that is ready to score in `targetId` should hold the piece instead,
   * because it is about to be worth more (2024: a full AMP bank, the HUMAN PLAYER about to AMPLIFY).
   * A bot holds at most `HOLD_LIMIT_SEC` per arrival, then scores anyway.
   */
  botHold?(ctx: RulesContext, alliance: Alliance, targetId: string): boolean;
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
  /**
   * Opponent zone base ids bots keep their paths out of (if they can) only from 5 s before the
   * endgame, where `protectedZones` apply all match: places that are legal and useful to drive
   * through until then (2024: the opponent's STAGE ZONE, G424 B). Default none.
   */
  endgamePathZones?: string[];
  /**
   * A "one robot at a time on the opponent's side" rule (2025 G421): x, in blue's frame (red's is
   * `field.length - x`), past which at most one of an alliance's robots may be. Bots don't go past it
   * for a loose piece, or to defend, while a teammate is already there. Default: no such rule.
   */
  oneAcrossLine?: number;
}

/**
 * Passing: a robot with a shooter lobs a piece to a spot on the floor for a teammate to pick up
 * (2024: feeders shooting NOTES from the SOURCE side into their WING). Engine-checked: teleop only, a
 * shooter `passRange`, and not from the opponent's zones listed in `notFromOpponent`.
 */
export interface PassingRules {
  /** Where passes land, in blue's frame (mirrored or rotated for red): spots near the alliance's goal. */
  landing: Vec2[];
  /** The opponent's zone base ids a robot may not pass from (2024 G414: the opponent's WING). */
  notFromOpponent?: string[];
  /** Bots don't pass from closer than this to the landing spot, m: they carry it. Default 6. */
  minDistance?: number;
  source?: Citation;
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
  /** Specialist jobs bots can be given besides 'score' and 'defense' (lineup slot roles). */
  roles?: SpecialistRole[];
  /** Robots may lob pieces to teammates (shooters with a `passRange`). Omit: nobody passes. */
  passing?: PassingRules;
  rules?: GameRules;
  botHints?: BotHints;
}

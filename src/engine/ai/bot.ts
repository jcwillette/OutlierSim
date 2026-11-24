import { solveShot } from '../sim/ballistics.ts';
import type { XEndgame, XTarget } from '../sim/expand.ts';
import {
  canReachHandoff,
  DEFAULT_RELIABILITY,
  IDLE,
  type Match,
  type Robot,
  type RobotCommand,
  type RobotController,
} from '../sim/match.ts';
import { handedness as frameHandedness } from '../sim/frame.ts';
import { DEFAULT_PIN_RELEASE_GAP } from '../sim/referee.ts';
import { clamp, distToRegion, pointInRegion, regionCenter, turnTo, wrapAngle } from '../sim/math.ts';
import type {
  Alliance,
  AllianceStrategy,
  GameDefinition,
  Region2D,
  RobotArchetype,
  RobotRole,
  Vec2,
} from '../sim/types.ts';
import { AllianceNav, type DynamicObstacle } from './navgrid.ts';
import { PointIndex } from './spatial.ts';

/**
 * Generic bot AI that plays any GameDefinition. Utility-based cycle planner:
 *   acquire (field piece or HP station) -> score (place or shoot from a precomputed spot) -> repeat,
 *   head to endgame in time, optional defense role. Bots only use the same RobotCommand interface
 *   (and Match query helpers) as the human player: no cheating mechanics.
 */

export type Difficulty = 'easy' | 'normal' | 'hard';

interface Skill {
  /** Fraction of max speed used. */
  speed: number;
  /** Seconds between re-decisions. */
  think: number;
  /** Random utility noise (0 = always optimal). */
  noise: number;
  /** Pause before pressing score after arriving. */
  dwell: number;
  /**
   * Base fraction of the time the drive team has tunnel vision: it ignores teammates' calls and
   * right of way, so robots get in each other's way. Low robot reliability adds to it.
   */
  lapse: number;
}

export const SKILL: Record<Difficulty, Skill> = {
  easy: { speed: 0.65, think: 0.9, noise: 0.6, dwell: 0.7, lapse: 0.2 },
  normal: { speed: 0.85, think: 0.4, noise: 0.25, dwell: 0.25, lapse: 0.08 },
  hard: { speed: 1, think: 0.15, noise: 0.05, dwell: 0.05, lapse: 0.02 },
};

type Plan =
  | { kind: 'acquire'; pieceId: number; point: Vec2; approachYaw: number }
  /** `pieceType`: what to ask for at a station that offers a `choice`. */
  | { kind: 'station'; stationId: string; point: Vec2; pieceType?: string }
  | { kind: 'place'; targetId: string; point: Vec2; face?: Vec2 }
  | { kind: 'shoot'; targetId: string; point: Vec2; aim: Vec2 }
  | { kind: 'endgame'; actionId: string; zoneIndex: number; point: Vec2 }
  | { kind: 'park'; point: Vec2 }
  /** `until`: opportunistic blocking is time-boxed (match time); the defense role has no limit. */
  | { kind: 'defend'; opponentId: number; point: Vec2; until?: number }
  | { kind: 'idle' };

interface Option {
  plan: Plan;
  utility: number;
  claim?: string;
}

// ------------------------------------------------------------------ shared per-match state

interface MatchAI {
  claims: Record<Alliance, Map<string, number>>;
  /** Where each bot is headed to stand (score / load / endgame spot), shared within its alliance. */
  intents: Record<Alliance, Map<number, Vec2>>;
  /**
   * Each alliance's protected zones (`botHints.protectedZones`), and the same plus its endgame-only
   * ones (`endgameProtectedZones`): static, so collected once per match.
   */
  protected: Record<Alliance, { always: Region2D[]; endgame: Region2D[] }>;
  /** Path penalty for each alliance's robots: the opponent's protected zones. */
  penalty: Record<Alliance, { key: string; regions: Region2D[] } | undefined>;
}
const matchAI = new WeakMap<Match, MatchAI>();

function aiFor(m: Match): MatchAI {
  let s = matchAI.get(m);
  if (!s) {
    const hints = m.def.botHints;
    // By default, the zones the game's contact fouls protect (`fouls.contact`).
    const rules = m.def.fouls.contact ?? [];
    const always = hints?.protectedZones ?? rules.filter((c) => !c.endgameOnly).flatMap((c) => c.zones);
    const endgame = [
      ...always,
      ...(hints?.endgameProtectedZones ?? rules.filter((c) => c.endgameOnly).flatMap((c) => c.zones)),
    ];
    const regions = (a: Alliance, ids: readonly string[]) =>
      m.game.zones
        .filter((z) => (z.alliance === a || z.alliance === null) && ids.includes(z.baseId))
        .map((z) => z.region);
    const penalty = (a: Alliance) => {
      if (!always.length) return undefined;
      const opp = other(a);
      const zones = m.game.zones.filter((z) => z.alliance === opp && always.includes(z.baseId));
      return { key: `protected:${opp}`, regions: zones.map((z) => z.region) };
    };
    s = {
      claims: { blue: new Map(), red: new Map() },
      intents: { blue: new Map(), red: new Map() },
      protected: {
        blue: { always: regions('blue', always), endgame: regions('blue', endgame) },
        red: { always: regions('red', always), endgame: regions('red', endgame) },
      },
      penalty: { blue: penalty('blue'), red: penalty('red') },
    };
    matchAI.set(m, s);
  }
  return s;
}

const other = (a: Alliance): Alliance => (a === 'blue' ? 'red' : 'blue');

/**
 * Nav grids per game definition, alliance and robot size. Each alliance plans on a grid laid out
 * from its own wall (`AllianceNav`), so neither half of the field is easier to drive. A grid depends
 * only on the field geometry, so every match of the same definition (e.g. a Monte Carlo run) shares
 * one instead of rebuilding it.
 */
const navGrids = new WeakMap<GameDefinition, Map<string, AllianceNav>>();
/** Each robot's grid (a robot's alliance, size and game never change), looked up once. */
const robotGrids = new WeakMap<Robot, AllianceNav>();

/** Nav grid inflation for a robot frame: half its larger side plus a margin, in 5 cm steps. */
export function navInflation(frame: { length: number; width: number }): number {
  return Math.round((Math.max(frame.length, frame.width) / 2 + 0.08) * 20) / 20;
}

function gridFor(m: Match, r: Robot): AllianceNav {
  let g = robotGrids.get(r);
  if (g) return g;
  const inflate = navInflation(r.archetype.frame);
  let grids = navGrids.get(m.def);
  if (!grids) navGrids.set(m.def, (grids = new Map()));
  const key = `${r.alliance}:${inflate}`;
  g = grids.get(key);
  if (!g) {
    g = new AllianceNav(m.game, inflate, r.alliance);
    grids.set(key, g);
  }
  robotGrids.set(r, g);
  return g;
}

/** This robot's handedness (`frame.ts`): fixed turn and side preferences are multiplied by it. */
function handedness(m: Match, r: Robot): 1 | -1 {
  return frameHandedness(r.alliance, m.def.field.symmetry);
}

/** Shot spots per game definition, by `archetype id|target id` (static geometry, like nav grids). */
const shotSpotSets = new WeakMap<GameDefinition, Map<string, PointIndex>>();

/** Spots from which this robot's shooter can reach `target` (static geometry only). */
function shotSpots(m: Match, r: Robot, t: XTarget): PointIndex {
  let sets = shotSpotSets.get(m.def);
  if (!sets) shotSpotSets.set(m.def, (sets = new Map()));
  const key = `${r.archetype.id}|${t.id}`;
  const cached = sets.get(key);
  if (cached) return cached;
  const set = new PointIndex(findShotSpots(gridFor(m, r), r.archetype, t));
  sets.set(key, set);
  return set;
}

/**
 * Open floor spots (on `grid`) from which robot type `a` can make a shot into target `t`: rings
 * around the aim point, 1.2 m out to 90 % of the shooter's range, where `solveShot` finds a hood
 * angle and speed. Empty if `a` has no shooter or `t` no aperture.
 */
export function findShotSpots(grid: AllianceNav, a: RobotArchetype, t: XTarget): Vec2[] {
  const spots: Vec2[] = [];
  const sh = a.shooter;
  if (!sh || !t.aperture) return spots;
  const aim = t.aimPoint ?? t.aperture.center;
  const launchZ = Math.max(sh.height, a.frame.height + 0.12);
  const down = t.aperture.entry === 'down';
  for (let d = 1.2; d <= sh.maxRange * 0.9; d += 0.4) {
    for (let k = 0; k < 32; k++) {
      const ang = (k / 32) * 2 * Math.PI;
      const p = { x: aim.x + d * Math.cos(ang), y: aim.y + d * Math.sin(ang) };
      if (!grid.isFree(p)) continue;
      if (
        !solveShot(sh.exitSpeed, d, aim.z - launchZ, t.arc ?? (down ? 'high' : 'low'), sh.pitchRangeDeg, down)
      )
        continue;
      spots.push(p);
    }
  }
  return spots;
}

/**
 * A heading from which a robot of `length` can drive its intake onto a piece at `pos` (its center
 * must fit just behind the piece), trying the heading from `from` first, then turning further and
 * further away from it (left first, times `hand`). Null if the piece can't be reached (e.g. it is
 * against a wall).
 */
export function approachHeading(
  grid: AllianceNav,
  length: number,
  from: Vec2,
  pos: Vec2,
  hand: 1 | -1,
): number | null {
  const back = length / 2 + 0.25;
  const direct = Math.atan2(pos.y - from.y, pos.x - from.x);
  for (const off of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.3, -2.3, Math.PI]) {
    const yaw = direct + hand * off;
    const stand = { x: pos.x - Math.cos(yaw) * back, y: pos.y - Math.sin(yaw) * back };
    if (grid.isFree(stand)) return yaw;
  }
  return null;
}

// ------------------------------------------------------------------ brain

export interface BotOptions {
  difficulty?: Difficulty;
  role?: RobotRole;
  strategy?: AllianceStrategy;
}

/** Seconds a tunnel-vision lapse lasts (uniform in this range). */
const LAPSE_SEC: [number, number] = [2, 4];
/** Each point of robot unreliability (1 - reliability) adds this much lapse fraction. */
const LAPSE_PER_UNRELIABILITY = 1.5;

export class BotBrain implements RobotController {
  private plan: Plan = { kind: 'idle' };
  private claim: string | null = null;
  private path: Vec2[] = [];
  private pathGoal: Vec2 | null = null;
  private pathAge = 0;
  private thinkTimer = 0;
  private arrivedFor = 0;
  private stuckTimer = 0;
  private stuckFrom: Vec2 = { x: 0, y: 0 };
  private detour: Vec2 | null = null;
  private readonly skill: Skill;
  /** Piece id -> match time until which this bot ignores it (it got stuck going for it). */
  private readonly blacklist = new Map<number, number>();
  /** Target / station ids this bot recently got stuck going to, until a match time. */
  private readonly spotBlacklist = new Map<string, number>();
  private readonly refillCache = new Map<string, number>();
  /** Opponent id -> match time before which this bot won't defend it again. */
  private readonly harassCooldown = new Map<number, number>();
  /** Seconds pressed against a stopped opponent (pin count). */
  private pinTime = 0;
  readonly role: RobotRole;
  readonly strategy: AllianceStrategy;
  /** Match time until which this bot has tunnel vision (ignores teammates). */
  private lapseUntil = 0;
  private now = 0;
  private wasOut = false;
  private wasMechDown = false;

  constructor(opts: BotOptions = {}) {
    this.skill = SKILL[opts.difficulty ?? 'normal'];
    this.role = opts.role ?? 'score';
    this.strategy = opts.strategy ?? 'balanced';
  }

  /** In a tunnel-vision lapse right now (ignoring teammates' calls and right of way). */
  get lapsing(): boolean {
    return this.now < this.lapseUntil;
  }

  private updateLapse(m: Match, r: Robot, dt: number): void {
    this.now = m.time;
    if (this.lapsing) return;
    const unreliability = 1 - (r.archetype.reliability ?? DEFAULT_RELIABILITY);
    const f = Math.min(0.6, this.skill.lapse + unreliability * LAPSE_PER_UNRELIABILITY);
    const mean = (LAPSE_SEC[0] + LAPSE_SEC[1]) / 2;
    // Start rate so that lapses cover about fraction f of the match.
    if (m.random() < (f / (mean * (1 - f))) * dt)
      this.lapseUntil = m.time + LAPSE_SEC[0] + m.random() * (LAPSE_SEC[1] - LAPSE_SEC[0]);
  }

  get currentPlan(): Plan {
    return this.plan;
  }

  command(m: Match, r: Robot, dt: number): RobotCommand {
    if (r.endgameDone) return IDLE;
    if (r.isOut(m.time)) {
      // Broken down or without power: let teammates have our spots and pieces.
      if (!this.wasOut) {
        this.wasOut = true;
        this.plan = { kind: 'idle' };
        this.setClaim(m, r, null);
        this.setIntent(m, r, this.plan);
      }
      return IDLE;
    }
    this.wasOut = false;
    if (r.mechDown !== this.wasMechDown) {
      // Mechanism failed (piece plans are now invalid) or works again: re-plan right away.
      this.wasMechDown = r.mechDown;
      this.thinkTimer = 0;
    }
    this.updateLapse(m, r, dt);
    this.thinkTimer -= dt;
    this.pathAge += dt;
    if (!r.action && (this.thinkTimer <= 0 || !this.planValid(m, r))) {
      this.decide(m, r);
      this.thinkTimer = this.skill.think * (0.75 + 0.5 * m.random());
    }
    this.checkStuck(m, r, dt);
    return this.execute(m, r, dt);
  }

  // ---------------------------------------------------------------- decision

  private setClaim(m: Match, r: Robot, key: string | null): void {
    const claims = aiFor(m).claims[r.alliance];
    if (this.claim && claims.get(this.claim) === r.id) claims.delete(this.claim);
    this.claim = key;
    if (key) claims.set(key, r.id);
  }

  private claimedByOther(m: Match, r: Robot, key: string): boolean {
    if (this.lapsing) return false; // didn't hear the call
    const owner = aiFor(m).claims[r.alliance].get(key);
    return owner !== undefined && owner !== r.id;
  }

  /** Publish where this bot is headed to stand, so teammates pick other spots (alliance "radio"). */
  private setIntent(m: Match, r: Robot, plan: Plan): void {
    const intents = aiFor(m).intents[r.alliance];
    const stands =
      plan.kind === 'place' ||
      plan.kind === 'station' ||
      plan.kind === 'endgame' ||
      plan.kind === 'park' ||
      plan.kind === 'shoot';
    if (stands) intents.set(r.id, plan.point);
    else intents.delete(r.id);
  }

  /** A teammate has announced it is headed to (or standing at) a spot overlapping `p`. */
  private teammateHeadedTo(m: Match, r: Robot, p: Vec2): boolean {
    if (this.lapsing) return false;
    const mine = halfSize(r);
    for (const [id, q] of aiFor(m).intents[r.alliance]) {
      if (id === r.id) continue;
      const o = m.robots[id]!;
      if (Math.hypot(q.x - p.x, q.y - p.y) < (mine + halfSize(o)) * 0.85) return true;
    }
    return false;
  }

  private planValid(m: Match, r: Robot): boolean {
    const p = this.plan;
    if (
      r.mechDown &&
      (p.kind === 'acquire' || p.kind === 'station' || p.kind === 'place' || p.kind === 'shoot')
    )
      return false;
    switch (p.kind) {
      case 'idle':
        return false;
      case 'acquire': {
        const piece = m.pieces[p.pieceId];
        return !!piece && piece.status === 'field' && r.canHold(piece.type.id);
      }
      case 'station':
        return r.held.length < r.totalCapacity && (p.pieceType === undefined || r.canHold(p.pieceType));
      case 'place':
      case 'shoot': {
        const ts = m.targets.get(p.targetId);
        return !!ts && ts.enabled && r.held.some((h) => ts.target.accepts.includes(h));
      }
      case 'defend': {
        const o = m.robots[p.opponentId]!;
        if ((this.harassCooldown.get(o.id) ?? 0) > m.time) return false; // broke off (pin count)
        if (!this.worthDefending(m, r, o)) return false;
        if (p.until !== undefined && (m.time > p.until || o.held.length === 0)) {
          this.harassCooldown.set(o.id, m.time + 6);
          return false;
        }
        return true;
      }
      default:
        return true;
    }
  }

  /** Estimated seconds to drive from where the robot is to `p` (path overhead and settling included). */
  private travelTime(_m: Match, r: Robot, p: Vec2): number {
    return this.travelBetween(r, r, p);
  }

  private period(m: Match): 'auto' | 'teleop' {
    return m.phase === 'auto' ? 'auto' : 'teleop';
  }

  private weight(m: Match, t: XTarget): number {
    return m.def.botHints?.targetWeights?.[t.baseId] ?? 1;
  }

  /** The robot could score in `t` now (open, not full, its alliance's) and the game wants it to. */
  private usableTarget(m: Match, r: Robot, t: XTarget): boolean {
    return m.canUseTarget(r, m.targets.get(t.id)!) && this.weight(m, t) > 0;
  }

  /**
   * Heading from which the robot can drive its intake onto a piece at `pos` (robot center must be able
   * to stand just behind it), preferring the heading straight from the robot. Null if unreachable.
   */
  private approachYaw(m: Match, r: Robot, pos: Vec2): number | null {
    // Left turns first, in this alliance's frame (red's mirror image of blue's choice).
    return approachHeading(gridFor(m, r), r.archetype.frame.length, r, pos, handedness(m, r));
  }

  /** Estimated seconds for this robot to drive from `a` to `b`. */
  private travelBetween(r: Robot, a: Vec2, b: Vec2): number {
    return (Math.hypot(b.x - a.x, b.y - a.y) * 1.25) / (r.archetype.drive.maxSpeed * this.skill.speed) + 0.3;
  }

  /** Best-rate way to score one piece of `type` starting from `from`: points and time (travel + action). */
  private scoreTrip(m: Match, r: Robot, from: Vec2, type: string): { pts: number; time: number } | null {
    const per = this.period(m);
    let best: { pts: number; time: number } | null = null;
    let bestRate = 0;
    const consider = (pts: number, time: number) => {
      if (pts > 0 && pts / time > bestRate) {
        bestRate = pts / time;
        best = { pts, time };
      }
    };
    for (const t of m.game.targets) {
      if (!t.accepts.includes(type) || !this.usableTarget(m, r, t)) continue;
      const pts = t.points[per] * this.weight(m, t);
      const placeTime = t.place ? r.placeTime(t) : null;
      if (t.place && placeTime !== null)
        consider(pts, this.travelBetween(r, from, regionCenter(t.place.zone)) + placeTime);
      const sh = r.archetype.shooter;
      if (t.aperture && sh?.pieceTypes.includes(type)) {
        const spot = shotSpots(m, r, t).nearest(from);
        if (spot) consider(pts, this.travelBetween(r, from, spot) + sh.reloadSec + 0.4);
      }
    }
    return best;
  }

  /** Utility of fetching a piece of `type` at `at`: points per second over the whole resulting cycle. */
  private fetchUtility(m: Match, r: Robot, at: Vec2, type: string, fetchTime: number): number {
    const trip = this.scoreTrip(m, r, at, type);
    if (!trip) return 0;
    let pts = trip.pts;
    let time = this.travelTime(m, r, at) + fetchTime + trip.time;
    // Pieces already held get scored on the same trip (roughly one extra action each).
    for (const h of r.held) {
      const ht = this.scoreTrip(m, r, at, h);
      if (ht) {
        pts += ht.pts;
        time += 0.6;
      }
    }
    return pts / time;
  }

  private noise(m: Match): number {
    return 1 + (m.random() * 2 - 1) * this.skill.noise;
  }

  /**
   * Time from `from` to the nearest place this robot could get its next piece. Scoring options are
   * judged over the whole cycle, so a slow high-value score beats a quick low one when the next
   * piece is far away (and vice versa).
   */
  private refillTime(m: Match, r: Robot, from: Vec2): number {
    // Only when full: then scoring options compete with each other, not with "grab another first".
    if (r.held.length < r.totalCapacity) return 0;
    const key = `${from.x.toFixed(1)},${from.y.toFixed(1)}`;
    const cached = this.refillCache.get(key);
    if (cached !== undefined) return cached;
    const intake = r.archetype.intake;
    let best = Infinity;
    if (intake) {
      for (const p of m.pieces) {
        if (p.status !== 'field' || !intake.pieceTypes.includes(p.type.id)) continue;
        if (p.position.z > (intake.maxHeight ?? 0.3) + 0.2) continue;
        if (this.claimedByOther(m, r, `piece:${p.id}`)) continue;
        best = Math.min(best, this.travelBetween(r, from, p.position) + intake.timeSec + 0.8);
      }
      if (m.phase !== 'auto')
        for (const st of m.game.stations) {
          if ((st.alliance && st.alliance !== r.alliance) || !canReachHandoff(r, st)) continue;
          if (!st.pieceTypes.some((t) => intake.pieceTypes.includes(t))) continue;
          const used = m.stationUsed.get(`${st.id}:${r.alliance}`) ?? 0;
          if (st.supply !== undefined && used >= st.supply) continue;
          const c = regionCenter(st.zone);
          best = Math.min(
            best,
            this.travelBetween(r, from, c) + st.feedIntervalSec * 0.5 + (st.handoffSec ?? 0) + 0.8,
          );
        }
    }
    const t = Number.isFinite(best) ? best : 0;
    this.refillCache.set(key, t);
    return t;
  }

  /** Another robot is parked (nearly stopped) where this robot would need to stand. */
  private spotTaken(m: Match, r: Robot, p: Vec2): boolean {
    const mine = Math.max(r.archetype.frame.length, r.archetype.frame.width) / 2;
    return m.robots.some((o) => {
      if (o === r || o.speed > 0.3) return false;
      const theirs = Math.max(o.archetype.frame.length, o.archetype.frame.width) / 2;
      return Math.hypot(o.x - p.x, o.y - p.y) < (mine + theirs) * 0.8;
    });
  }

  private scoreOptions(m: Match, r: Robot): Option[] {
    this.refillCache.clear();
    const out: Option[] = [];
    const per = this.period(m);
    for (const t of m.game.targets) {
      if (!this.usableTarget(m, r, t)) continue;
      const pts = t.points[per] * this.weight(m, t);
      if (pts <= 0) continue;
      if ((this.spotBlacklist.get(t.id) ?? 0) > m.time) continue;
      if (t.place && r.held.some((h) => t.accepts.includes(h))) {
        const time = r.placeTime(t);
        if (time !== null) {
          const point = gridFor(m, r).nearestFree(regionCenter(t.place.zone));
          if (pointInRegion(point, t.place.zone) && !this.spotTaken(m, r, point)) {
            // Soft claim: a teammate already headed here (or next door, which blocks us) means
            // waiting for them.
            const claim = `place:${t.id}`;
            const wait =
              (this.claimedByOther(m, r, claim) ? time + 2 : 0) +
              (this.teammateHeadedTo(m, r, point) ? 3 : 0);
            out.push({
              plan: {
                kind: 'place',
                targetId: t.id,
                point,
                ...(t.place.facePoint ? { face: t.place.facePoint } : {}),
              },
              utility:
                (pts / (this.travelTime(m, r, point) + time + wait + this.refillTime(m, r, point))) *
                this.noise(m),
              claim,
            });
          }
        }
      }
      const sh = r.archetype.shooter;
      if (t.aperture && sh && r.held.some((h) => sh.pieceTypes.includes(h) && t.accepts.includes(h))) {
        const best = shotSpots(m, r, t).nearest(r);
        if (best) {
          const aim = t.aimPoint ?? t.aperture.center;
          const nShots = r.held.filter((h) => sh.pieceTypes.includes(h) && t.accepts.includes(h)).length;
          out.push({
            plan: { kind: 'shoot', targetId: t.id, point: best, aim },
            utility:
              ((pts * nShots) /
                (this.travelTime(m, r, best) + sh.reloadSec * nShots + 0.4 + this.refillTime(m, r, best))) *
              this.noise(m),
          });
        }
      }
    }
    return out;
  }

  private acquireOptions(m: Match, r: Robot): Option[] {
    return this.rawAcquireOptions(m, r).filter((o) => o.utility > 0);
  }

  private rawAcquireOptions(m: Match, r: Robot): Option[] {
    const out: Option[] = [];
    const intake = r.archetype.intake;
    if (!intake) return out;
    const grid = gridFor(m, r);
    for (const p of m.pieces) {
      if (p.status !== 'field' || !intake.pieceTypes.includes(p.type.id) || !r.canHold(p.type.id)) continue;
      const pos = p.position;
      if (pos.z > (intake.maxHeight ?? 0.3) + 0.2) continue; // in flight
      const claim = `piece:${p.id}`;
      if (this.claimedByOther(m, r, claim)) continue;
      // Loose pieces in (or so close to) the opponent's protected zones that the robot would be in
      // them to pick the piece up aren't worth the contact fouls.
      if (nearProtectedZone(m, pos, other(r.alliance), halfSize(r), false)) continue;
      if (this.blacklist.has(p.id) && (this.blacklist.get(p.id) ?? 0) > m.time) continue;
      const approachYaw = this.approachYaw(m, r, pos);
      if (approachYaw === null) continue; // no way to get an intake on it (e.g. against a wall)
      const point = { x: pos.x, y: pos.y };
      // Don't chase pieces deep in the opponent's half in auto.
      if (m.phase === 'auto') {
        const L = m.def.field.length;
        const ownHalf = r.alliance === 'blue' ? pos.x < L / 2 + 1 : pos.x > L / 2 - 1;
        if (!ownHalf) continue;
      }
      out.push({
        plan: { kind: 'acquire', pieceId: p.id, point, approachYaw },
        utility: this.fetchUtility(m, r, point, p.type.id, intake.timeSec + 0.8) * this.noise(m),
        claim,
      });
    }
    for (const st of m.game.stations) {
      if (m.phase === 'auto') break; // human players feed in teleop
      if (st.alliance && st.alliance !== r.alliance) continue;
      if (!canReachHandoff(r, st)) continue;
      if ((this.spotBlacklist.get(st.id) ?? 0) > m.time) continue;
      const types = st.pieceTypes.filter((t) => r.canHold(t) && intake.pieceTypes.includes(t));
      if (!types.length) continue;
      const used = m.stationUsed.get(`${st.id}:${r.alliance}`) ?? 0;
      if (st.supply !== undefined && used >= st.supply) continue;
      const point = grid.nearestFree(regionCenter(st.zone));
      if (!pointInRegion(point, st.zone)) continue;
      const claim = `station:${st.id}`;
      const wait =
        (this.claimedByOther(m, r, claim) ? st.feedIntervalSec * 2 : 0) +
        (this.teammateHeadedTo(m, r, point) ? 3 : 0);
      // A station that lets the robot choose: weigh each piece it could ask for. Otherwise it hands
      // out the first type the robot can hold.
      for (const type of st.choice ? types : types.slice(0, 1)) {
        out.push({
          plan: { kind: 'station', stationId: st.id, point, ...(st.choice ? { pieceType: type } : {}) },
          utility:
            this.fetchUtility(
              m,
              r,
              point,
              type,
              st.feedIntervalSec * 0.5 + (st.handoffSec ?? 0) + 0.8 + wait,
            ) * this.noise(m),
          claim,
        });
      }
    }
    return out;
  }

  /** `force`: ignore timing (an idle robot pre-positions and waits for the action to open). */
  private endgameOption(m: Match, r: Robot, force = false): Option | null {
    if (!r.archetype.endgame) return null;
    const auto = m.phase === 'auto';
    if (!auto && m.phase !== 'teleop') return null;
    const pref = m.def.botHints?.endgamePreference;
    const baseLead = m.def.botHints?.endgameLeadSec ?? 3;
    const lead = auto
      ? 0.5
      : this.strategy === 'max-cycles'
        ? 0.5
        : this.strategy === 'early-endgame'
          ? baseLead + 15
          : baseLead;
    let best: Option | null = null;
    for (const a of m.game.endgame) {
      if (a.alliance && a.alliance !== r.alliance) continue;
      if (auto ? !a.allowInAuto : (a.availableAtRemainingSec ?? 0) < 0) continue;
      const dur = r.archetype.endgame[a.baseId];
      if (dur === undefined) continue;
      const rank = pref ? pref.indexOf(a.baseId) : -1;
      if (pref && rank < 0) continue;
      // One-at-a-time actions: also wait for teammates already headed for (or doing) one.
      const queue = a.oneAtATime && !auto ? this.endgameQueue(m, r) * dur : 0;
      const spots = endgameSpots(a);
      for (let zoneIndex = 0; zoneIndex < spots.length; zoneIndex++) {
        const spot = spots[zoneIndex]!;
        const point = spotPoint(gridFor(m, r), spot);
        // Timing first (everything here is a pure test, so the order doesn't change the answer).
        const need = this.travelTime(m, r, point) * 1.4 + dur + lead + queue + this.skill.think;
        if (m.remaining > need && !force) continue;
        // Too late to finish: in auto there's no time to spare, so keep scoring instead.
        if (auto && m.remaining < this.travelTime(m, r, point) + dur) continue;
        // Claims and occupancy are per physical spot, so two different actions that share a zone
        // (e.g. dock vs. engage on the same platform slot) don't send two robots to one place.
        if (this.claimedByOther(m, r, spot.claim)) continue;
        if ((a.maxRobotsPerZone ?? Infinity) <= 1 && spotOccupied(m, r, spot.zone)) continue;
        const pts = expectedEndgamePoints(m, r, a, auto);
        const utility = pts / (rank >= 0 ? rank + 1 : 1) - this.travelTime(m, r, point);
        if (!best || utility > best.utility)
          best = { plan: { kind: 'endgame', actionId: a.id, zoneIndex, point }, utility, claim: spot.claim };
      }
    }
    return best;
  }

  /**
   * `botHints.endgameOrder`: hold off starting `actionId` while a teammate bot is still headed for an
   * action earlier in the order (e.g. let dock-only robots board before the balancer), unless the
   * clock says go now.
   */
  private waitForBoardingOrder(m: Match, r: Robot, actionId: string): boolean {
    const order = m.def.botHints?.endgameOrder;
    const mine = order?.indexOf(actionId) ?? -1;
    if (!order || mine <= 0 || m.phase !== 'teleop') return false;
    const dur = r.archetype.endgame?.[actionId] ?? 0;
    if (m.remaining < dur + 1.5) return false;
    return m.robots.some((o) => {
      if (o === r || o.alliance !== r.alliance || o.endgameDone || o.isOut(m.time)) return false;
      const plan = o.controller instanceof BotBrain ? o.controller.currentPlan : null;
      if (plan?.kind !== 'endgame') return false;
      const theirs = m.game.endgame.find((e) => e.id === plan.actionId)?.baseId ?? '';
      const k = order.indexOf(theirs);
      return k >= 0 && k < mine;
    });
  }

  /** Teammates that can still do an endgame action (they may need the same platform first). */
  private endgameQueue(m: Match, r: Robot): number {
    return m.robots.filter(
      (o) =>
        o !== r &&
        o.alliance === r.alliance &&
        !o.endgameDone &&
        Object.keys(o.archetype.endgame ?? {}).length,
    ).length;
  }

  private parkOption(m: Match, r: Robot): Option | null {
    if (m.phase !== 'teleop') return null;
    for (const aw of m.game.awards) {
      if (aw.kind !== 'inZoneAtEnd' || (aw.alliance && aw.alliance !== r.alliance)) continue;
      const point = gridFor(m, r).nearestFree(regionCenter(aw.zone));
      if (m.remaining <= this.travelTime(m, r, point) * 1.5 + 2)
        return { plan: { kind: 'park', point }, utility: aw.points };
    }
    return null;
  }

  /** `force`: defend even without the defense role (a robot that can't score). */
  private defenseOption(m: Match, r: Robot, force = false): Option | null {
    if ((this.role !== 'defense' && !force) || m.phase !== 'teleop') return null;
    const opps = m.robots.filter((o) => this.worthDefending(m, r, o));
    if (!opps.length) return null; // nobody worth marking (all defending, broken, protected): score instead
    // Mark the opponent carrying the most pieces, nearest first.
    opps.sort(
      (a, b) =>
        b.held.length - a.held.length || Math.hypot(a.x - r.x, a.y - r.y) - Math.hypot(b.x - r.x, b.y - r.y),
    );
    const o = opps[0]!;
    return { plan: { kind: 'defend', opponentId: o.id, point: blockPoint(m, o) }, utility: 1 };
  }

  private decide(m: Match, r: Robot): void {
    if (r.mechDown) {
      // Can drive but not score: endgame if it's time, else play defense, else wait in endgame position.
      this.adopt(
        m,
        r,
        this.endgameOption(m, r) ??
          (r.archetype.endgame ? null : this.parkOption(m, r)) ??
          this.defenseOption(m, r, true) ??
          this.endgameOption(m, r, true),
      );
      return;
    }
    const priority =
      this.endgameOption(m, r) ??
      (r.archetype.endgame ? null : this.parkOption(m, r)) ??
      this.defenseOption(m, r);
    let choice: Option | null = priority;
    if (!choice) {
      const opts = this.cycleOptions(m, r).sort((a, b) => b.utility - a.utility);
      choice = opts[0] ?? null;
      // Hysteresis: stick with the current plan unless something is clearly better.
      const current = opts.find((o) => samePlan(this.plan, o.plan));
      if (current && choice && choice.utility < current.utility * 1.3) choice = current;
      // Nothing to score or fetch (e.g. every reachable target is full): get into endgame position.
      if (!choice) choice = this.endgameOption(m, r, true);
    }
    this.adopt(m, r, choice);
  }

  private adopt(m: Match, r: Robot, choice: Option | null): void {
    const plan = choice?.plan ?? { kind: 'idle' };
    if (choice && samePlan(this.plan, plan)) return;
    this.plan = plan;
    this.setClaim(m, r, choice?.claim ?? null);
    this.setIntent(m, r, plan);
    this.arrivedFor = 0;
    this.path = [];
    this.pathGoal = null;
  }

  private cycleOptions(m: Match, r: Robot): Option[] {
    const room = r.held.length < r.totalCapacity;
    const harass = this.harassOption(m, r);
    return [
      ...this.scoreOptions(m, r),
      ...(room ? this.acquireOptions(m, r) : []),
      ...(harass ? [harass] : []),
    ];
  }

  /**
   * Opportunistic defense: an empty-handed bot near an opponent that is carrying a piece home may
   * get in its way for a few seconds, when the points that delay costs the opponent beat what the
   * bot would earn by cycling. Never inside the opponent's protected zones (`botHints.protectedZones`).
   */
  private harassOption(m: Match, r: Robot): Option | null {
    const strategyWeight = { balanced: 1, 'max-cycles': 0, 'early-endgame': 1, aggressive: 3 }[this.strategy];
    const weight = (m.def.botHints?.defenseOpportunism ?? 1) * strategyWeight;
    if (weight <= 0 || m.phase !== 'teleop' || r.held.length > 0 || this.role === 'defense') return null;
    let best: Option | null = null;
    for (const o of m.robots) {
      if (o.action || o.held.length === 0 || !this.worthDefending(m, r, o)) continue;
      const d = Math.hypot(o.x - r.x, o.y - r.y);
      if (d > 3.5) continue;
      const point = blockPoint(m, o);
      // Only worth it if they're actually heading home with it.
      const home = { x: o.alliance === 'blue' ? 0 : m.def.field.length, y: o.y };
      if ((home.x - o.x) * o.vx < 0) continue;
      const pts = opponentPieceValue(m, o);
      if (pts <= 0) continue;
      // ~2 s of delay out of a ~12 s cycle, spread over the engagement.
      const engage = this.travelTime(m, r, point) + 3;
      const utility = ((weight * (pts / 12) * 2) / engage) * this.noise(m);
      if (!best || utility > best.utility)
        best = {
          plan: { kind: 'defend', opponentId: o.id, point, until: m.time + 4 },
          utility,
        };
    }
    return best;
  }

  /**
   * Clean defense: whether `o` is a fair, useful target right now. Not a defender itself (blocking a
   * blocker scores nothing), not done/broken, not in the pin cool-down, and far enough from its
   * protected zones that contact can't happen inside them (G207-style), including endgame-only zones
   * (G209-style). Our own spot must be clear of those zones too.
   */
  private worthDefending(m: Match, r: Robot, o: Robot): boolean {
    if (o.alliance === r.alliance || o.endgameDone || o.brokenDown || o.mechDown) return false;
    if (isDefending(o)) return false;
    if ((this.harassCooldown.get(o.id) ?? 0) > m.time) return false;
    const point = blockPoint(m, o);
    const endgame = m.isEndgame;
    return (
      !nearProtectedZone(m, o, o.alliance, DEFENSE_ZONE_MARGIN, endgame) &&
      !nearProtectedZone(m, point, o.alliance, DEFENSE_ZONE_MARGIN, endgame) &&
      // ...and no part of us is in them (contact rules usually count any part of the robot).
      !nearProtectedZone(m, r, o.alliance, halfSize(r), endgame)
    );
  }

  /**
   * Pin 5-count (G202-style): pressed against a stopped opponent for PIN_BREAK_SEC, back off and
   * leave that robot alone for PIN_COOLDOWN_SEC.
   */
  private watchPin(m: Match, r: Robot, o: Robot, dt: number): boolean {
    const touching = Math.hypot(o.x - r.x, o.y - r.y) < halfSize(o) + halfSize(r) + 0.1;
    this.pinTime = touching && o.speed < 0.25 ? this.pinTime + dt : Math.max(0, this.pinTime - dt * 2);
    if (this.pinTime < PIN_BREAK_SEC) return false;
    this.pinTime = 0;
    this.harassCooldown.set(o.id, m.time + PIN_COOLDOWN_SEC);
    return true;
  }

  // ---------------------------------------------------------------- execution

  private checkStuck(m: Match, r: Robot, dt: number): void {
    if (r.action || this.plan.kind === 'idle' || this.arrivedFor > 0) {
      this.stuckTimer = 0;
      this.stuckFrom = { x: r.x, y: r.y };
      return;
    }
    this.stuckTimer += dt;
    if (this.stuckTimer > 1.5) {
      const moved = Math.hypot(r.x - this.stuckFrom.x, r.y - this.stuckFrom.y);
      if (moved < 0.2) {
        // Back off in a random direction, then re-plan (and give up this claim).
        const a = m.random() * 2 * Math.PI;
        this.detour = gridFor(m, r).nearestFree({ x: r.x + Math.cos(a) * 1.2, y: r.y + Math.sin(a) * 1.2 });
        if (this.plan.kind === 'acquire') this.blacklist.set(this.plan.pieceId, m.time + 6);
        if (this.plan.kind === 'place' || this.plan.kind === 'shoot')
          this.spotBlacklist.set(this.plan.targetId, m.time + 5);
        if (this.plan.kind === 'station') this.spotBlacklist.set(this.plan.stationId, m.time + 5);
        this.setClaim(m, r, null);
        this.plan = { kind: 'idle' };
        this.setIntent(m, r, this.plan);
      }
      this.stuckTimer = 0;
      this.stuckFrom = { x: r.x, y: r.y };
    }
  }

  private steer(
    m: Match,
    r: Robot,
    goal: Vec2,
    finalApproach: boolean,
  ): { vx: number; vy: number; dist: number } {
    const grid = gridFor(m, r);
    if (
      !this.pathGoal ||
      Math.hypot(goal.x - this.pathGoal.x, goal.y - this.pathGoal.y) > 0.3 ||
      this.pathAge > 1
    ) {
      const zones = aiFor(m).penalty[r.alliance];
      this.path = finalApproach ? [goal] : grid.findPath(r, goal, this.parkedRobots(m, r), zones);
      // Parked robots can wall off the only way around (e.g. a barrier end): then path through them.
      if (!this.path.length && !finalApproach) this.path = grid.findPath(r, goal, [], zones);
      if (!this.path.length) this.path = [goal];
      this.pathGoal = goal;
      this.pathAge = 0;
    }
    while (this.path.length > 1 && Math.hypot(this.path[0]!.x - r.x, this.path[0]!.y - r.y) < 0.35)
      this.path.shift();
    const wp = this.path[0] ?? goal;
    const dist = Math.hypot(goal.x - r.x, goal.y - r.y);
    let dx = wp.x - r.x;
    let dy = wp.y - r.y;
    const d = Math.hypot(dx, dy) || 1;
    let speed = this.skill.speed * clamp(dist / 1.2 + 0.1, 0, 1);
    // Take ramps and platforms slowly (don't launch off the far side).
    if (grid.isSlow(r)) speed = Math.min(speed, RAMP_SPEED / r.archetype.drive.maxSpeed);
    dx = (dx / d) * speed;
    dy = (dy / d) * speed;
    // Simple avoidance of other robots (not the one we're defending).
    const ignore = this.plan.kind === 'defend' ? this.plan.opponentId : -1;
    const sp = Math.hypot(dx, dy);
    const ux = sp > 1e-3 ? dx / sp : 0;
    const uy = sp > 1e-3 ? dy / sp : 0;
    let yieldTo = false;
    let sideX = 0;
    let sideY = 0;
    // Partly inside an opponent's protected zone, touching an opponent is a foul: give them room.
    const exposed = nearProtectedZone(m, r, other(r.alliance), halfSize(r), m.isEndgame);
    for (const o of m.robots) {
      if (o === r || o.id === ignore) continue;
      const ox = r.x - o.x;
      const oy = r.y - o.y;
      const od = Math.hypot(ox, oy);
      const wary = exposed && o.alliance !== r.alliance;
      const range = wary ? WARY_RANGE : 1.4;
      if (od < range && od > 1e-3) {
        const push = ((range - od) / range) * (wary ? WARY_PUSH : 0.6);
        dx += (ox / od) * push;
        dy += (oy / od) * push;
      }
      // Teammates talk: in a lane conflict the lower-priority robot steps aside and slows down
      // instead of shoving. (Ahead of us = negative projection of r - o on our direction.)
      if (o.alliance === r.alliance && od < 1.8 && sp > 1e-3 && !o.endgameDone && !this.lapsing) {
        const ahead = -(ox * ux + oy * uy);
        const lateral = ux * -oy - uy * -ox; // > 0: teammate is to our left
        if (ahead > 0 && Math.abs(lateral) < 1.0 && yieldPriority(m, r, o) < yieldPriority(m, o, r)) {
          yieldTo = true;
          // Step to the side away from them (dead ahead: to our left, in this alliance's frame).
          const s = lateral > 0 ? -1 : lateral < 0 ? 1 : handedness(m, r);
          sideX += -uy * s;
          sideY += ux * s;
        }
      }
    }
    if (yieldTo) {
      const n = Math.hypot(sideX, sideY) || 1;
      dx = dx * 0.35 + (sideX / n) * 0.6 * this.skill.speed;
      dy = dy * 0.35 + (sideY / n) * 0.6 * this.skill.speed;
    }
    const room = this.makeRoom(m, r);
    if (room) {
      dx = dx * 0.35 + room.x * 0.8 * this.skill.speed;
      dy = dy * 0.35 + room.y * 0.8 * this.skill.speed;
    }
    return { vx: dx, vy: dy, dist };
  }

  /**
   * Standing on the spot a higher-priority teammate announced it's headed for (an endgame zone, a
   * scoring spot): step out of its approach lane, to the open side, so the two don't each block the
   * other's goal. A unit direction, or null.
   */
  private makeRoom(m: Match, r: Robot): Vec2 | null {
    if (this.lapsing) return null;
    for (const [id, q] of aiFor(m).intents[r.alliance]) {
      if (id === r.id) continue;
      const o = m.robots[id]!;
      if (o.endgameDone || Math.hypot(q.x - r.x, q.y - r.y) > halfSize(r) + halfSize(o) * 0.5) continue;
      if (yieldPriority(m, r, o) >= yieldPriority(m, o, r)) continue;
      const ax = q.x - o.x;
      const ay = q.y - o.y;
      const an = Math.hypot(ax, ay);
      if (an < 0.3) continue; // it's there already
      const ux = ax / an;
      const uy = ay / an;
      // Our side of its approach line first (dead on it: left, in this alliance's frame), then the
      // other side, whichever has open floor.
      const lat = ux * (r.y - o.y) - uy * (r.x - o.x);
      const first = lat > 0 ? 1 : lat < 0 ? -1 : handedness(m, r);
      const grid = gridFor(m, r);
      for (const side of [first, -first]) {
        const dir = { x: -uy * side, y: ux * side };
        if (grid.isFree({ x: r.x + dir.x * 0.9, y: r.y + dir.y * 0.9 })) return dir;
      }
    }
    return null;
  }

  /** Robots stopped on the field (placing, loading, docked): plan paths around them. */
  private parkedRobots(m: Match, r: Robot): DynamicObstacle[] {
    const ignore = this.plan.kind === 'defend' ? this.plan.opponentId : -1;
    return m.robots
      .filter((o) => o !== r && o.id !== ignore && o.speed < 0.3)
      .map((o) => ({ x: o.x, y: o.y, radius: halfSize(o) * 0.9 }));
  }

  private faceCmd(m: Match, r: Robot, yaw: number): number {
    const turn = turnTo(r.yaw, yaw, handedness(m, r));
    return clamp(turn * 2.5, -1, 1) * Math.max(0.5, this.skill.speed);
  }

  private execute(m: Match, r: Robot, dt: number): RobotCommand {
    if (r.action) return IDLE;
    const cmd: RobotCommand = { ...IDLE, intake: r.held.length < r.totalCapacity };
    if (this.detour) {
      const s = this.steer(m, r, this.detour, true);
      if (s.dist < 0.3) this.detour = null;
      return { ...cmd, vx: s.vx, vy: s.vy };
    }
    const p = this.plan;
    switch (p.kind) {
      case 'idle':
        return cmd;
      case 'acquire': {
        const piece = m.pieces[p.pieceId]!;
        const pos = piece.position;
        const d = Math.hypot(pos.x - r.x, pos.y - r.y);
        // Line up behind the piece on the approach heading, then drive through it.
        const back = r.archetype.frame.length / 2 + 0.25;
        const stand = {
          x: pos.x - Math.cos(p.approachYaw) * back,
          y: pos.y - Math.sin(p.approachYaw) * back,
        };
        const lined = Math.abs(wrapAngle(Math.atan2(pos.y - r.y, pos.x - r.x) - p.approachYaw)) < 0.35;
        const goal = d < back + 0.6 && lined ? { x: pos.x, y: pos.y } : stand;
        const s = this.steer(m, r, goal, d < 2);
        const yaw = d < 2.5 ? Math.atan2(pos.y - r.y, pos.x - r.x) : Math.atan2(s.vy, s.vx);
        const aligned = Math.abs(wrapAngle(yaw - r.yaw)) < 0.5;
        const k = d < 1.5 && !aligned ? 0.3 : 1;
        return { ...cmd, vx: s.vx * k, vy: s.vy * k, omega: this.faceCmd(m, r, yaw), intake: true };
      }
      case 'station': {
        const s = this.steer(m, r, p.point, false);
        const st = m.game.stations.find((x) => x.id === p.stationId)!;
        const inside = pointInRegion(r, st.zone);
        return {
          ...cmd,
          vx: inside ? 0 : s.vx,
          vy: inside ? 0 : s.vy,
          intake: true,
          ...(p.pieceType ? { pieceType: p.pieceType } : {}),
        };
      }
      case 'place': {
        const s = this.steer(m, r, p.point, false);
        const ts = m.targets.get(p.targetId)!;
        const inside = pointInRegion(r, ts.target.place!.zone);
        const yaw = p.face ? Math.atan2(p.face.y - r.y, p.face.x - r.x) : r.yaw;
        const omega = s.dist < 2 && p.face ? this.faceCmd(m, r, yaw) : this.travelFace(m, r, s);
        if (inside && s.dist < 0.35) this.arrivedFor += dt;
        const ready = this.arrivedFor >= this.skill.dwell;
        return { ...cmd, vx: s.vx, vy: s.vy, omega, score: ready, targetId: p.targetId };
      }
      case 'shoot': {
        const s = this.steer(m, r, p.point, false);
        const sh = r.archetype.shooter!;
        const yaw = Math.atan2(p.aim.y - r.y, p.aim.x - r.x);
        const near = s.dist < 0.4;
        if (near) this.arrivedFor += dt;
        const canNow = m.canShootAt(r, p.targetId);
        const settled = near && r.speed < 0.25 && this.arrivedFor >= this.skill.dwell;
        const fire = canNow && (settled || (sh.shootOnMove ?? false));
        const omega = s.dist < 2.5 && !sh.turret ? this.faceCmd(m, r, yaw) : this.travelFace(m, r, s);
        return { ...cmd, vx: near ? 0 : s.vx, vy: near ? 0 : s.vy, omega, score: fire, targetId: p.targetId };
      }
      case 'endgame': {
        const s = this.steer(m, r, p.point, false);
        const a = m.game.endgame.find((e) => e.id === p.actionId)!;
        const inside = pointInRegion(r, a.zones[p.zoneIndex]!);
        return {
          ...cmd,
          vx: inside && s.dist < 0.25 ? 0 : s.vx,
          vy: inside && s.dist < 0.25 ? 0 : s.vy,
          intake: false,
          endgame: inside && !this.waitForBoardingOrder(m, r, a.baseId),
          targetId: p.actionId,
        };
      }
      case 'park': {
        const s = this.steer(m, r, p.point, false);
        return { ...cmd, vx: s.vx, vy: s.vy };
      }
      case 'defend': {
        const o = m.robots[p.opponentId]!;
        if (this.watchPin(m, r, o, dt)) {
          // Release the pin: back straight away from them (far enough to end it), then re-plan.
          const d = Math.hypot(r.x - o.x, r.y - o.y) || 1;
          const back = pinBackOff(m);
          this.detour = gridFor(m, r).nearestFree({
            x: r.x + ((r.x - o.x) / d) * back,
            y: r.y + ((r.y - o.y) / d) * back,
          });
          this.plan = { kind: 'idle' };
          this.setIntent(m, r, this.plan);
          return cmd;
        }
        const s = this.steer(m, r, blockPoint(m, o), Math.hypot(o.x - r.x, o.y - r.y) < 3);
        return { ...cmd, vx: s.vx, vy: s.vy, omega: this.faceCmd(m, r, Math.atan2(o.y - r.y, o.x - r.x)) };
      }
    }
  }

  private travelFace(m: Match, r: Robot, s: { vx: number; vy: number }): number {
    if (Math.hypot(s.vx, s.vy) < 0.2) return 0;
    return this.faceCmd(m, r, Math.atan2(s.vy, s.vx)) * 0.6;
  }
}

function samePlan(a: Plan, b: Plan): boolean {
  switch (a.kind) {
    case 'acquire':
      return b.kind === 'acquire' && a.pieceId === b.pieceId;
    case 'station':
      return b.kind === 'station' && a.stationId === b.stationId && a.pieceType === b.pieceType;
    case 'place':
      return b.kind === 'place' && a.targetId === b.targetId;
    case 'shoot':
      return (
        b.kind === 'shoot' &&
        a.targetId === b.targetId &&
        Math.hypot(a.point.x - b.point.x, a.point.y - b.point.y) < 0.8
      );
    case 'endgame':
      return b.kind === 'endgame' && a.actionId === b.actionId && a.zoneIndex === b.zoneIndex;
    case 'defend':
      return b.kind === 'defend' && a.opponentId === b.opponentId;
    default:
      return a.kind === b.kind;
  }
}

/** Defenders keep this far (m) from an opponent's protected zones, so contact can't happen inside. */
const DEFENSE_ZONE_MARGIN = 0.6;
/** Break off after this long pressed against a stopped opponent (manual pin counts are 5 s). */
const PIN_BREAK_SEC = 3;
/** ...and leave that robot alone this long (manuals require 3 s before re-pinning). */
const PIN_COOLDOWN_SEC = 4;

/**
 * How far (m) a defender backs off to break a pin: past the game's pin release gap (`fouls.pinning`,
 * usually 6 ft) so the referee's count ends, else 1.5 m.
 */
function pinBackOff(m: Match): number {
  const pin = m.def.fouls.pinning;
  return pin ? Math.max(1.5, (pin.releaseGap ?? DEFAULT_PIN_RELEASE_GAP) + 0.3) : 1.5;
}

/** Within an opponent's protected zone, bots steer away from opponents this close (m)... */
const WARY_RANGE = 1.8;
/** ...this hard (vs 0.6 for ordinary traffic). */
const WARY_PUSH = 1.5;

/** Bots drive no faster than this (m/s) on ramps and platforms. */
const RAMP_SPEED = 1.5;

// ------------------------------------------------------------------ coordination helpers

/** Half the larger frame dimension (a robot's "radius" for spacing). */
function halfSize(r: Robot): number {
  return Math.max(r.archetype.frame.length, r.archetype.frame.width) / 2;
}

/**
 * Who keeps going when two teammates meet: a robot docking / climbing, then one carrying a piece to
 * score, then the lower robot id. Every teammate computes the same answer, so exactly one yields.
 */
function yieldPriority(m: Match, r: Robot, other: Robot): number {
  const brain = r.controller instanceof BotBrain ? r.controller : null;
  const endgame = brain?.currentPlan.kind === 'endgame' ? 4 : 0;
  return endgame + (r.held.length > 0 ? 2 : 0) + (r.id < other.id ? 1 : 0);
}

interface EndgameSpot {
  zone: Region2D;
  center: Vec2;
  /** Claim key of the physical spot, shared by every action using the same zone. */
  claim: string;
  /** The spot's nearest free point per nav grid. */
  points: Map<AllianceNav, Vec2>;
}
const egSpots = new WeakMap<XEndgame, EndgameSpot[]>();

/** An endgame action's zones with their static data (centers, claim keys), computed once. */
function endgameSpots(a: XEndgame): EndgameSpot[] {
  let spots = egSpots.get(a);
  if (!spots) {
    spots = a.zones.map((zone) => {
      const center = regionCenter(zone);
      const claim = `eg:${a.alliance ?? 'n'}:${center.x.toFixed(2)},${center.y.toFixed(2)}`;
      return { zone, center, claim, points: new Map() };
    });
    egSpots.set(a, spots);
  }
  return spots;
}

/** Where a robot on `grid` stands for `spot` (static geometry, so looked up once per grid). */
function spotPoint(grid: AllianceNav, spot: EndgameSpot): Vec2 {
  let p = spot.points.get(grid);
  if (!p) spot.points.set(grid, (p = grid.nearestFree(spot.center)));
  return p;
}

/** Another robot has finished an endgame action on a spot whose center lies in `zone`. */
function spotOccupied(m: Match, r: Robot, zone: Region2D): boolean {
  return m.robots.some((o) => {
    if (o === r || !o.endgameDone) return false;
    const oa = m.game.endgame.find((e) => e.id === o.endgameDone!.actionId);
    const spot = oa && endgameSpots(oa)[o.endgameDone.zoneIndex];
    return !!spot && pointInRegion(spot.center, zone);
  });
}

/**
 * Points this robot can expect from an endgame action: its points, or with an uncertain attempt
 * (`endgameSuccess`) the chance-weighted mix with its fallback's points.
 */
function expectedEndgamePoints(m: Match, r: Robot, a: XEndgame, auto: boolean): number {
  const value = (x: XEndgame) => (auto ? (x.autoPoints ?? x.points) : x.points);
  const chance = r.archetype.endgameSuccess?.[a.baseId] ?? 1;
  if (chance >= 1) return value(a);
  const fallback = a.fallback
    ? m.game.endgame.find((e) => e.baseId === a.fallback && e.alliance === a.alliance)
    : undefined;
  return chance * value(a) + (1 - chance) * (fallback ? value(fallback) : 0);
}

/** Where a defender stands to block `o`: just in front of it, toward its own alliance wall. */
function blockPoint(m: Match, o: Robot): Vec2 {
  const home = o.alliance === 'blue' ? 0 : m.def.field.length;
  const dir = Math.sign(home - o.x) || 1;
  return { x: o.x + dir * 0.9, y: o.y };
}

/**
 * `p` is inside, or within `margin` m of, one of `alliance`'s protected zones (plus its
 * endgame-only protected zones when `endgame`).
 */
function nearProtectedZone(m: Match, p: Vec2, alliance: Alliance, margin: number, endgame: boolean): boolean {
  const zones = aiFor(m).protected[alliance];
  for (const region of endgame ? zones.endgame : zones.always)
    if (pointInRegion(p, region) || (margin > 0 && distToRegion(p, region) < margin)) return true;
  return false;
}

/** A bot that is defending (role or current plan): not worth defending against. */
function isDefending(o: Robot): boolean {
  const b = o.controller instanceof BotBrain ? o.controller : null;
  return !!b && (b.role === 'defense' || b.currentPlan.kind === 'defend');
}

/** Best points the opponent could get for a piece it is carrying (its open targets, this period). */
function opponentPieceValue(m: Match, o: Robot): number {
  let best = 0;
  for (const ts of m.targets.values()) {
    const t = ts.target;
    if (!ts.enabled || (t.alliance && t.alliance !== o.alliance)) continue;
    if (t.capacity !== undefined && ts.count >= t.capacity) continue;
    if (!o.held.some((h) => t.accepts.includes(h))) continue;
    best = Math.max(best, t.points.teleop);
  }
  return best;
}

// ------------------------------------------------------------------ setup helpers

export interface TeamSetup {
  partners: Difficulty;
  opponents: Difficulty;
  /** Player robot id, or null for all-bot matches. */
  playerId: number | null;
  /** Role per robot id. Default: the archetype's `defaultRole`, else from `botHints.defenseShare`. */
  roles?: Partial<Record<number, RobotRole>>;
  /** How each alliance's bots play (default 'balanced'). */
  strategies?: Partial<Record<Alliance, AllianceStrategy>>;
}

/**
 * Attach bots to every non-player robot. Roles come from `setup.roles`, then the archetype's
 * `defaultRole`, then `botHints.defenseShare` (the least capable robots defend).
 */
export function attachBots(m: Match, setup: TeamSetup): Map<number, BotBrain> {
  const out = new Map<number, BotBrain>();
  const share = m.def.botHints?.defenseShare ?? 0;
  for (const alliance of ['blue', 'red'] as const) {
    const bots = m.robots.filter((r) => r.alliance === alliance && r.id !== setup.playerId);
    const nDefense = Math.round(share * bots.length);
    // Prefer robots that can't score much as defenders.
    const ranked = [...bots].sort((a, b) => capability(a) - capability(b));
    const defenders = new Set(ranked.slice(0, nDefense).map((r) => r.id));
    const playerAlliance = setup.playerId !== null ? m.robots[setup.playerId]!.alliance : 'blue';
    for (const r of bots) {
      const role =
        setup.roles?.[r.id] ?? r.archetype.defaultRole ?? (defenders.has(r.id) ? 'defense' : 'score');
      const brain = new BotBrain({
        difficulty: alliance === playerAlliance ? setup.partners : setup.opponents,
        role,
        strategy: setup.strategies?.[alliance] ?? 'balanced',
      });
      r.controller = brain;
      out.set(r.id, brain);
    }
  }
  return out;
}

function capability(r: Robot): number {
  const a = r.archetype;
  return (a.shooter ? 2 : 0) + Object.keys(a.place ?? {}).length + (a.intake ? 1 : 0) + r.totalCapacity * 0.5;
}

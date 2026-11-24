import type { Match, Robot } from './match.ts';
import { footprint, footprintInside, footprintOverlaps } from './math.ts';
import type { Alliance, ContactFoulRule, PinningRule, Region2D, Vec2 } from './types.ts';

/**
 * The fouls a game declares in `GameDefinition.fouls` (protected-zone contact, pinning), called by
 * the engine every tick of auto and teleop. Contact is bumper to bumper: robots are touching when
 * the gap between their bumper boxes is under `CONTACT_GAP`.
 */

/** Robots whose bumper boxes are closer than this (m) are touching (bumpers compress a little). */
export const CONTACT_GAP = 0.03;
/** A robot pushing at least this hard (commanded drive, 0..1) toward an opponent is pressing it. */
const PUSH_CMD = 0.3;
/** A pinned robot is commanding at least this much drive... */
const TRYING_CMD = 0.3;
/** ...and moving slower than this (m/s)... */
const STUCK_SPEED = 0.25;
/**
 * ...while pressed against something beyond it: a contact whose normal is at most this steep
 * (|z|, so a wall or a robot's side, not the floor or a ramp under it)...
 */
const SIDE_NORMAL_Z = 0.7;
/** ...and points at least this much away from the pinning robot (cosine). */
const BEYOND_COS = 0.3;
const DEFAULT_REPEAT_SEC = 3;
export const DEFAULT_PIN_SEC = 5;
/** 6 ft: "PINNED until the ROBOTS have separated by at least 6 ft." */
export const DEFAULT_PIN_RELEASE_GAP = 1.83;
/** "The PINNING ROBOT(S) must then wait for at least 3 seconds before attempting to PIN ... again." */
export const DEFAULT_REPIN_SEC = 3;

/**
 * Gap between two robots' bumper boxes on the floor, m (0 or less: overlapping). A separating-axis
 * test over both boxes' sides: exact when the closest features are a side and a corner, slightly
 * under the true gap corner to corner (so it errs toward contact).
 */
export function robotGap(a: Robot, b: Robot): number {
  return gapWith(a, b, Math.cos(a.yaw), Math.sin(a.yaw), Math.cos(b.yaw), Math.sin(b.yaw));
}

/** `robotGap` with each robot's heading cosine and sine already worked out. */
function gapWith(a: Robot, b: Robot, ca: number, sa: number, cb: number, sb: number): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const al = a.archetype.frame.length / 2;
  const aw = a.archetype.frame.width / 2;
  const bl = b.archetype.frame.length / 2;
  const bw = b.archetype.frame.width / 2;
  let gap = -Infinity;
  for (const [nx, ny] of [
    [ca, sa],
    [-sa, ca],
    [cb, sb],
    [-sb, cb],
  ] as const) {
    const ra = al * Math.abs(ca * nx + sa * ny) + aw * Math.abs(-sa * nx + ca * ny);
    const rb = bl * Math.abs(cb * nx + sb * ny) + bw * Math.abs(-sb * nx + cb * ny);
    gap = Math.max(gap, Math.abs(dx * nx + dy * ny) - ra - rb);
  }
  return gap;
}

/** Whether a robot is in a zone: any part of its bumper footprint, or (`fully`) all of it. */
export function robotInZone(r: Robot, zone: Region2D, fully = false): boolean {
  const corners = footprint(r.x, r.y, r.yaw, r.archetype.frame.length, r.archetype.frame.width);
  return fully ? footprintInside(corners, zone) : footprintOverlaps(corners, zone);
}

/** One robot pinning another (`Referee.pins`). */
interface Pin {
  attacker: Robot;
  victim: Robot;
  /** Seconds of pinning counted so far. */
  count: number;
  /** Fouls called for it so far (one per `countSec`). */
  called: number;
  /** Where each robot was when the pin started (or resumed). */
  attackerFrom: Vec2;
  victimFrom: Vec2;
  /** Match time the pin ended, or null while it's on. */
  endedAt: number | null;
}

interface ContactCheck {
  rule: ContactFoulRule;
  /** Each alliance's protected regions under this rule. */
  zones: Record<Alliance, Region2D[]>;
  /** The same zones with their names, for warnings. */
  named: Record<Alliance, Array<{ region: Region2D; name: string }>>;
}

/** A contact rule that would call a foul if a robot touched an opponent now (`Match.contactWarnings`). */
export interface ContactWarning {
  rule: ContactFoulRule;
  /** The zone that makes it a foul. */
  zone: string;
  /** For `inside: 'protected'` rules: the opponent that is protected (in its own zone). */
  opponent?: Robot;
}

/** A pin in progress (`Match.pinCounts`): the referee's count so far. */
export interface PinCount {
  attacker: Robot;
  victim: Robot;
  /** Seconds counted. */
  seconds: number;
  /** The rule's count (a foul every this many seconds). */
  countSec: number;
  /** Distance (m) that ends the pin. */
  releaseGap: number;
}

/** Opponents this close (m, center to center) count for `contactWarnings`. */
const WARN_RANGE = 2.5;

export class Referee {
  private readonly contact: ContactCheck[];
  private readonly pinning: PinningRule | undefined;
  /** Last match time each (rule, offender, protected robot) drew a contact foul. */
  private readonly lastCall = new Map<string, number>();
  /** Pins per (pinning robot, pinned robot): on, or ended less than `repinSec` ago. */
  private readonly pins = new Map<string, Pin>();
  /** Per blue-red pair this tick (blue-major order): the gap, and who is pinning whom. */
  private readonly gaps: number[] = [];
  private readonly bluePins: boolean[] = [];
  private readonly redPins: boolean[] = [];
  /** Who is pinning each robot this tick: a bit per pinning robot's id, by pinned robot id. */
  private readonly pinnedBy: number[];
  /** Rapier handles of the robots' bodies (to tell robots from pieces in contacts). */
  private readonly robotBodies: Set<number>;
  /** Each robot's heading cosine and sine this tick, by robot id. */
  private readonly cos: number[] = [];
  private readonly sin: number[] = [];
  /** Each robot's half diagonal (constant), by robot id. */
  private readonly halfDiag: number[];
  /** No gap at or beyond this matters: contact and pin release are both closer. */
  private readonly farGap: number;

  constructor(private readonly m: Match) {
    this.contact = (m.def.fouls.contact ?? []).map((rule) => {
      const named = (a: Alliance) =>
        m.game.zones
          .filter((z) => z.alliance === a && rule.zones.includes(z.baseId))
          .map((z) => ({ region: z.region, name: z.name ?? z.baseId }));
      const blue = named('blue');
      const red = named('red');
      return {
        rule,
        zones: { blue: blue.map((z) => z.region), red: red.map((z) => z.region) },
        named: { blue, red },
      };
    });
    this.pinning = m.def.fouls.pinning;
    this.halfDiag = m.robots.map((r) => Math.hypot(r.archetype.frame.length, r.archetype.frame.width) / 2);
    this.pinnedBy = m.robots.map(() => 0);
    this.robotBodies = new Set(m.robots.map((r) => r.body.handle));
    this.farGap = Math.max(
      CONTACT_GAP,
      this.pinning ? (this.pinning.releaseGap ?? DEFAULT_PIN_RELEASE_GAP) : 0,
    );
  }

  /** Whether the game declares anything for the referee to call. */
  get active(): boolean {
    return this.contact.length > 0 || this.pinning !== undefined;
  }

  /** Call fouls for this tick (after the physics step). */
  tick(dt: number): void {
    const m = this.m;
    if (m.phase !== 'auto' && m.phase !== 'teleop') return;
    for (const r of m.robots) {
      const yaw = r.yaw;
      this.cos[r.id] = Math.cos(yaw);
      this.sin[r.id] = Math.sin(yaw);
    }
    const { cos, sin, halfDiag, gaps, bluePins, redPins, pinnedBy } = this;
    pinnedBy.fill(0);
    // Contact fouls, and who is pinning whom (a pin ends when the pinning robot gets pinned, so
    // every pair is looked at before any pin count moves).
    let k = 0;
    for (const a of m.robots) {
      if (a.alliance !== 'blue') continue;
      for (const b of m.robots) {
        if (b.alliance !== 'red') continue;
        // One of each box's side normals is within 45 deg of the line between the centers, so the
        // separating-axis gap is at least 0.7 x center distance - both half diagonals. Clearly
        // beyond every distance that matters, skip the box test (the answers would be the same).
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        const gap =
          0.7 * d - halfDiag[a.id]! - halfDiag[b.id]! > this.farGap + 1e-6
            ? Infinity
            : gapWith(a, b, cos[a.id]!, sin[a.id]!, cos[b.id]!, sin[b.id]!);
        gaps[k] = gap;
        const touching = gap < CONTACT_GAP;
        if (touching) this.contactFouls(a, b);
        bluePins[k] = !!this.pinning && touching && this.pinningNow(a, b);
        redPins[k] = !!this.pinning && touching && this.pinningNow(b, a);
        if (bluePins[k]) pinnedBy[b.id]! |= 1 << a.id;
        if (redPins[k]) pinnedBy[a.id]! |= 1 << b.id;
        k++;
      }
    }
    if (!this.pinning) return;
    k = 0;
    for (const a of m.robots) {
      if (a.alliance !== 'blue') continue;
      for (const b of m.robots) {
        if (b.alliance !== 'red') continue;
        this.pin(this.pinning, a, b, gaps[k]!, bluePins[k]!, dt);
        this.pin(this.pinning, b, a, gaps[k]!, redPins[k]!, dt);
        k++;
      }
    }
  }

  /**
   * The contact rules that would call a foul on `r` if it touched an opponent now: `r` is in an
   * opponent's zone (`inside: 'intruder'`), or an opponent within a couple of meters is in its own
   * (`inside: 'protected'`), or either (`'either'`). For the HUD, so students learn where contact
   * costs points.
   */
  contactWarnings(r: Robot): ContactWarning[] {
    const m = this.m;
    const out: ContactWarning[] = [];
    if (m.phase !== 'auto' && m.phase !== 'teleop') return out;
    const opp: Alliance = r.alliance === 'blue' ? 'red' : 'blue';
    for (const { rule, named } of this.contact) {
      if (rule.endgameOnly && !m.isEndgame) continue;
      if (rule.inside !== 'protected') {
        const z = named[opp].find((x) => robotInZone(r, x.region, rule.fully));
        if (z) out.push({ rule, zone: z.name });
        if (z || rule.inside === 'intruder') continue;
      }
      for (const o of m.robots) {
        if (o.alliance !== opp || Math.hypot(o.x - r.x, o.y - r.y) > WARN_RANGE) continue;
        const z = named[opp].find((x) => robotInZone(o, x.region, rule.fully));
        if (z) out.push({ rule, zone: z.name, opponent: o });
      }
    }
    return out;
  }

  /** Pins in progress (not yet ended) that `r` is part of, pinning or pinned, with their counts. */
  pinCounts(r: Robot): PinCount[] {
    const rule = this.pinning;
    const out: PinCount[] = [];
    if (!rule) return out;
    for (const p of this.pins.values())
      if (p.endedAt === null && (p.attacker === r || p.victim === r))
        out.push({
          attacker: p.attacker,
          victim: p.victim,
          seconds: p.count,
          countSec: rule.countSec ?? DEFAULT_PIN_SEC,
          releaseGap: rule.releaseGap ?? DEFAULT_PIN_RELEASE_GAP,
        });
    return out;
  }

  private contactFouls(a: Robot, b: Robot): void {
    const m = this.m;
    for (const { rule, zones } of this.contact) {
      if (rule.endgameOnly && !m.isEndgame) continue;
      for (const [offender, owner] of [
        [a, b],
        [b, a],
      ] as const) {
        const inZone = (who: Robot) => zones[owner.alliance].some((z) => robotInZone(who, z, rule.fully));
        const called =
          rule.inside === 'either'
            ? inZone(offender) || inZone(owner)
            : inZone(rule.inside === 'intruder' ? offender : owner);
        if (!called) continue;
        if (rule.forgiveForced && forcedBy(owner, offender)) continue;
        const key = `${rule.id}:${offender.id}>${owner.id}`;
        if (m.time - (this.lastCall.get(key) ?? -Infinity) < (rule.repeatSec ?? DEFAULT_REPEAT_SEC)) continue;
        this.lastCall.set(key, m.time);
        m.addFoul(offender.alliance, rule.severity, `${rule.id} ${rule.name}`);
      }
    }
  }

  /**
   * `attacker` is pinning `victim`: pressing it (`pressing`) against something beyond it, a wall, a
   * field element or another robot, so it can't get away. Two robots pushing head-on in the open
   * are a shoving match, not a pin. Reads Rapier's contacts from the last step (it only looks).
   */
  private pinningNow(attacker: Robot, victim: Robot): boolean {
    if (!pressing(attacker, victim)) return false;
    const world = this.m.world;
    const own = victim.body.collider(0);
    // Away from the attacker, in physics axes (contact normals are in Rapier's world).
    const a = attacker.body.translation();
    const v = victim.body.translation();
    const d = Math.hypot(v.x - a.x, v.y - a.y) || 1;
    const ux = (v.x - a.x) / d;
    const uy = (v.y - a.y) / d;
    let blocked = false;
    world.contactPairsWith(own, (other) => {
      const body = other.parent();
      if (blocked || !body || body.handle === attacker.body.handle) return;
      // Walls, elements and robots block; game pieces get pushed aside.
      if (!body.isFixed() && !this.robotBodies.has(body.handle)) return;
      world.contactPair(own, other, (manifold, flipped) => {
        if (blocked || manifold.numContacts() === 0) return;
        const n = manifold.normal();
        const s = flipped ? -1 : 1; // from the victim toward the other collider
        if (Math.abs(n.z) <= SIDE_NORMAL_Z && s * (n.x * ux + n.y * uy) >= BEYOND_COS) blocked = true;
      });
    });
    return blocked;
  }

  /**
   * One robot's pin on another this tick. The count runs while `attacker` is pinning `victim` and
   * pauses while it isn't. The pin ends once the robots are `releaseGap` apart, either robot has
   * moved `releaseGap` from where the pin started, or the pinning robot is pinned itself. Pinning
   * the same robot again within `repinSec` of the end resumes the count; later, it starts over.
   */
  private pin(
    rule: PinningRule,
    attacker: Robot,
    victim: Robot,
    gap: number,
    now: boolean,
    dt: number,
  ): void {
    const key = `${attacker.id}>${victim.id}`;
    let p = this.pins.get(key);
    const t = this.m.time;
    const release = rule.releaseGap ?? DEFAULT_PIN_RELEASE_GAP;
    // Pinned itself by a third robot (its own victim pushing back doesn't count).
    const pinnedItself = (this.pinnedBy[attacker.id]! & ~(1 << victim.id)) !== 0;
    if (
      p &&
      p.endedAt === null &&
      (gap >= release ||
        pinnedItself ||
        Math.hypot(attacker.x - p.attackerFrom.x, attacker.y - p.attackerFrom.y) >= release ||
        Math.hypot(victim.x - p.victimFrom.x, victim.y - p.victimFrom.y) >= release)
    )
      p.endedAt = t;
    const repin = rule.repinSec ?? DEFAULT_REPIN_SEC;
    if (!now || pinnedItself) {
      // Forget a pin once it can no longer resume.
      if (p && p.endedAt !== null && t - p.endedAt >= repin) this.pins.delete(key);
      return;
    }
    const from = () => ({
      attackerFrom: { x: attacker.x, y: attacker.y },
      victimFrom: { x: victim.x, y: victim.y },
    });
    if (!p || (p.endedAt !== null && t - p.endedAt >= repin))
      this.pins.set(key, (p = { attacker, victim, count: 0, called: 0, ...from(), endedAt: null }));
    else if (p.endedAt !== null) Object.assign(p, from(), { endedAt: null });
    p.count += dt;
    const count = rule.countSec ?? DEFAULT_PIN_SEC;
    const periods = Math.floor(p.count / count);
    if (periods > p.called) {
      p.called = periods;
      const severity = periods === 1 ? (rule.severity ?? 'minor') : (rule.repeatSeverity ?? 'major');
      this.m.addFoul(attacker.alliance, severity, `${rule.id} pinning`, `${periods * count} s`);
    }
  }
}

/**
 * `attacker` is pressing `victim`, which is trying to move but can't and isn't locked in an
 * endgame action. Which way the victim wants to go doesn't matter (as the manuals say).
 */
function pressing(attacker: Robot, victim: Robot): boolean {
  if (victim.endgameDone || victim.speed >= STUCK_SPEED) return false;
  if (Math.hypot(victim.command.vx, victim.command.vy) <= TRYING_CMD) return false;
  const dx = victim.x - attacker.x;
  const dy = victim.y - attacker.y;
  const d = Math.hypot(dx, dy) || 1;
  return (attacker.command.vx * dx + attacker.command.vy * dy) / d > PUSH_CMD;
}

/** `owner` drove into `offender` harder than `offender` drove into it (a forced contact). */
function forcedBy(owner: Robot, offender: Robot): boolean {
  const dx = owner.x - offender.x;
  const dy = owner.y - offender.y;
  const d = Math.hypot(dx, dy) || 1;
  const offenderClosing = (offender.vx * dx + offender.vy * dy) / d;
  const ownerClosing = -(owner.vx * dx + owner.vy * dy) / d;
  return ownerClosing > offenderClosing;
}

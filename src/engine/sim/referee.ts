import type { Match, Robot } from './match.ts';
import { footprint, footprintInside, footprintOverlaps } from './math.ts';
import type { Alliance, ContactFoulRule, PinningRule, Region2D } from './types.ts';

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
/** ...and moving slower than this (m/s). */
const STUCK_SPEED = 0.25;
const DEFAULT_REPEAT_SEC = 3;
const DEFAULT_PIN_SEC = 5;
/** 6 ft: "PINNED until the ROBOTS have separated by at least 6 ft." */
export const DEFAULT_PIN_RELEASE_GAP = 1.83;

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

interface ContactCheck {
  rule: ContactFoulRule;
  /** Each alliance's protected regions under this rule. */
  zones: Record<Alliance, Region2D[]>;
}

export class Referee {
  private readonly contact: ContactCheck[];
  private readonly pinning: PinningRule | undefined;
  /** Last match time each (rule, offender, protected robot) drew a contact foul. */
  private readonly lastCall = new Map<string, number>();
  /** Pins in progress per (pinning robot, pinned robot). */
  private readonly pins = new Map<string, { t: number; called: number }>();
  /** Each robot's heading cosine and sine this tick, by robot id. */
  private readonly cos: number[] = [];
  private readonly sin: number[] = [];
  /** Each robot's half diagonal (constant), by robot id. */
  private readonly halfDiag: number[];
  /** No gap at or beyond this matters: contact and pin release are both closer. */
  private readonly farGap: number;

  constructor(private readonly m: Match) {
    this.contact = (m.def.fouls.contact ?? []).map((rule) => {
      const zones = (a: Alliance) =>
        m.game.zones.filter((z) => z.alliance === a && rule.zones.includes(z.baseId)).map((z) => z.region);
      return { rule, zones: { blue: zones('blue'), red: zones('red') } };
    });
    this.pinning = m.def.fouls.pinning;
    this.halfDiag = m.robots.map((r) => Math.hypot(r.archetype.frame.length, r.archetype.frame.width) / 2);
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
    const { cos, sin, halfDiag } = this;
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
        if (gap < CONTACT_GAP) this.contactFouls(a, b);
        if (this.pinning) {
          this.pin(this.pinning, a, b, gap, dt);
          this.pin(this.pinning, b, a, gap, dt);
        }
      }
    }
  }

  private contactFouls(a: Robot, b: Robot): void {
    const m = this.m;
    for (const { rule, zones } of this.contact) {
      if (rule.endgameOnly && !m.isEndgame) continue;
      for (const [offender, owner] of [
        [a, b],
        [b, a],
      ] as const) {
        const who = rule.inside === 'intruder' ? offender : owner;
        if (!zones[owner.alliance].some((z) => robotInZone(who, z, rule.fully))) continue;
        if (rule.forgiveForced && forcedBy(owner, offender)) continue;
        const key = `${rule.id}:${offender.id}>${owner.id}`;
        if (m.time - (this.lastCall.get(key) ?? -Infinity) < (rule.repeatSec ?? DEFAULT_REPEAT_SEC)) continue;
        this.lastCall.set(key, m.time);
        m.addFoul(offender.alliance, rule.severity, `${rule.id} ${rule.name}`);
      }
    }
  }

  private pin(rule: PinningRule, attacker: Robot, victim: Robot, gap: number, dt: number): void {
    const key = `${attacker.id}>${victim.id}`;
    if (gap < CONTACT_GAP && pinning(attacker, victim)) {
      let p = this.pins.get(key);
      if (!p) this.pins.set(key, (p = { t: 0, called: 0 }));
      p.t += dt;
      const count = rule.countSec ?? DEFAULT_PIN_SEC;
      const periods = Math.floor(p.t / count);
      if (periods > p.called) {
        p.called = periods;
        const severity = periods === 1 ? (rule.severity ?? 'minor') : (rule.repeatSeverity ?? 'major');
        this.m.addFoul(attacker.alliance, severity, `${rule.id} pinning`, `${periods * count} s`);
      }
    } else if (gap >= (rule.releaseGap ?? DEFAULT_PIN_RELEASE_GAP)) this.pins.delete(key);
  }
}

/**
 * `attacker` is pressing `victim`, which is trying to move but can't (against a wall, an element or
 * another robot) and isn't locked in an endgame action.
 */
function pinning(attacker: Robot, victim: Robot): boolean {
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

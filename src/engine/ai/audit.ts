import { expandDefinition, restHeight } from '../sim/expand.ts';
import { footprint, pointInRegion, regionCenter } from '../sim/math.ts';
import type { GameDefinition, Region2D, RobotArchetype, Vec2 } from '../sim/types.ts';
import { approachHeading, findShotSpots, navInflation } from './bot.ts';
import { AllianceNav, obstacleFootprints } from './navgrid.ts';

/**
 * Static checks that the bots can actually play a definition, using their own navigation: every
 * scoring target, station, endgame zone and staged piece has to be usable by at least one robot
 * type that has the mechanism for it, from the starting area. `validateDefinition` checks the data;
 * this checks the geometry, which is where a kickoff build usually goes wrong (a place zone smaller
 * than the robot, a shot no hood can make, a piece against a wall, a zone walled off).
 *
 * Errors mean bots will never use something they should; warnings are probably mistakes. Blue's half
 * is checked; red plays the mirror image (ADR 0007).
 */
export interface AuditIssue {
  level: 'error' | 'warning';
  /** What the issue is about, e.g. 'target mid-3' or 'station feeder'. */
  subject: string;
  message: string;
}

interface Nav {
  arch: RobotArchetype;
  grid: AllianceNav;
  /** Grid cell centers reachable from the start poses (by path search, memoized per spot). */
  reach: (p: Vec2) => boolean;
}

export function auditDefinition(def: GameDefinition): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const err = (subject: string, message: string) => issues.push({ level: 'error', subject, message });
  const warn = (subject: string, message: string) => issues.push({ level: 'warning', subject, message });
  const game = expandDefinition(def);
  const starts = game.startPoses.blue;

  // One nav grid per robot size, shared by the archetypes of that size.
  const grids = new Map<number, AllianceNav>();
  const navs: Nav[] = def.archetypes.map((arch) => {
    const inflate = navInflation(arch.frame);
    let grid = grids.get(inflate);
    if (!grid) grids.set(inflate, (grid = new AllianceNav(game, inflate, 'blue')));
    const memo = new Map<string, boolean>();
    const g = grid;
    const reach = (p: Vec2) => {
      const key = `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      let ok = memo.get(key);
      if (ok === undefined) {
        ok = starts.some((s) => Math.hypot(s.x - p.x, s.y - p.y) < 0.2 || g.findPath(s, p).length > 0);
        memo.set(key, ok);
      }
      return ok;
    };
    return { arch, grid, reach };
  });

  /** Where a bot of this type stands to use `zone` (as the bots pick it), if it is inside the zone. */
  const standIn = (n: Nav, zone: Region2D): Vec2 | null => {
    const p = n.grid.nearestFree(regionCenter(zone));
    return pointInRegion(p, zone) ? p : null;
  };
  const names = (ns: Nav[]) => ns.map((n) => n.arch.id).join(', ');
  const canGet = (a: RobotArchetype, types: readonly string[]) =>
    types.some((t) => (a.capacity[t] ?? 0) > 0 && (a.intake?.pieceTypes.includes(t) || def.preload[t]));

  // Start poses: robots must not spawn inside a field element.
  const solid = obstacleFootprints(game, 10);
  starts.forEach((s, i) => {
    for (const n of navs) {
      const corners = footprint(s.x, s.y, s.yaw, n.arch.frame.length, n.arch.frame.width);
      if (solid.some((o) => corners.some((c) => pointInRegion(c, o)) || pointInRegion(s, o))) {
        err(`start pose ${i + 1}`, `a ${n.arch.id} robot there overlaps a field element`);
        break;
      }
    }
  });

  // Scoring targets.
  for (const t of game.targets.filter((x) => x.alliance !== 'red')) {
    const subject = `target ${t.baseId}`;
    if (def.botHints?.targetWeights?.[t.baseId] === 0) continue;
    if (t.place) {
      const able = navs.filter(
        (n) =>
          canGet(n.arch, t.accepts) &&
          [t.baseId, ...(t.tags ?? [])].some((k) => n.arch.place?.[k] !== undefined),
      );
      if (!able.length && !t.aperture) warn(subject, 'no robot type can place here');
      const ok = able.filter((n) => {
        const p = standIn(n, t.place!.zone);
        return p !== null && n.reach(p);
      });
      if (able.length && !ok.length)
        err(
          subject,
          `bots can't place here: no open spot for their robots inside the place zone, or it can't be reached (${names(able)})`,
        );
      else if (ok.length < able.length)
        warn(subject, `too small or walled off for ${names(able.filter((n) => !ok.includes(n)))}`);
    }
    if (t.aperture) {
      const able = navs.filter((n) => {
        const sh = n.arch.shooter;
        return (
          !!sh &&
          sh.pieceTypes.some((p) => t.accepts.includes(p)) &&
          canGet(n.arch, sh.pieceTypes) &&
          (!sh.tags || sh.tags.some((tag) => t.tags?.includes(tag) || t.baseId === tag))
        );
      });
      if (!able.length && !t.place) warn(subject, 'no robot type can shoot here');
      const ok = able.filter((n) => findShotSpots(n.grid, n.arch, t).some((p) => n.reach(p)));
      if (able.length && !ok.length)
        err(
          subject,
          `no reachable spot from which ${names(able)} can make the shot (range, speed, hood angle)`,
        );
    }
  }

  // Human player stations.
  for (const st of game.stations.filter((x) => x.alliance !== 'red')) {
    const subject = `station ${st.baseId}`;
    const able = navs.filter(
      (n) =>
        n.arch.intake?.pieceTypes.some((p) => st.pieceTypes.includes(p) && (n.arch.capacity[p] ?? 0) > 0) &&
        (st.handoffHeight === undefined || (n.arch.intake.maxHeight ?? 0.3) >= st.handoffHeight),
    );
    if (!able.length) {
      warn(subject, 'no robot type can take pieces here (intake types, or handoff height)');
      continue;
    }
    const ok = able.filter((n) => {
      const p = standIn(n, st.zone);
      return p !== null && n.reach(p);
    });
    if (!ok.length) err(subject, `bots can't get into the station zone (${names(able)})`);
  }

  // Endgame actions: at least one zone each robot type that can do it can stand in and reach.
  for (const a of game.endgame.filter((x) => x.alliance !== 'red')) {
    const subject = `endgame ${a.baseId}`;
    const able = navs.filter((n) => n.arch.endgame?.[a.baseId] !== undefined);
    if (!able.length) {
      warn(subject, 'no robot type can do it');
      continue;
    }
    const bad = able.filter(
      (n) =>
        !a.zones.some((z) => {
          const p = standIn(n, z);
          return p !== null && n.reach(p);
        }),
    );
    if (bad.length) err(subject, `no reachable zone that ${names(bad)} fits in`);
  }

  // Staged pieces (as authored: blue's half and neutral ones): someone who intakes that type can get
  // an intake on each one.
  for (const group of def.staging) {
    const type = def.pieces.find((p) => p.id === group.type);
    const able = navs.filter(
      (n) =>
        n.arch.intake?.pieceTypes.includes(group.type) &&
        (n.arch.intake.maxHeight ?? 0.3) + 0.2 >= (type ? restHeight(type.shape) : 0),
    );
    group.positions.forEach((pos) => {
      const subject = `staged ${group.type} at (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`;
      if (!able.length) {
        warn(subject, 'no robot type can pick it up');
        return;
      }
      const from = starts[1] ?? starts[0]!;
      const ok = able.some((n) => {
        const yaw = approachHeading(n.grid, n.arch.frame.length, from, pos, 1);
        if (yaw === null) return false;
        const back = n.arch.frame.length / 2 + 0.25;
        return n.reach({ x: pos.x - Math.cos(yaw) * back, y: pos.y - Math.sin(yaw) * back });
      });
      if (!ok) err(subject, 'no robot can line its intake up on it (against a wall or element?)');
    });
  }

  // Park awards: somewhere in the zone to stand.
  for (const aw of game.awards.filter((x) => x.alliance !== 'red' && x.kind === 'inZoneAtEnd')) {
    if (
      !navs.some((n) => {
        const p = standIn(n, aw.zone);
        return p !== null && n.reach(p);
      })
    )
      err(`award ${aw.baseId}`, 'no robot can reach a spot inside the zone');
  }
  return issues;
}

import { expandDefinition } from './expand.ts';
import { regionOutline } from './math.ts';
import type { GameDefinition, Region2D, Vec2 } from './types.ts';

export interface ValidationIssue {
  level: 'error' | 'warning';
  path: string;
  message: string;
}

/**
 * Structural and semantic checks for a GameDefinition. Errors make the game unplayable;
 * warnings flag things that are probably extraction mistakes (missing citations, odd values).
 */
export function validateDefinition(def: GameDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (path: string, message: string) => issues.push({ level: 'error', path, message });
  const warn = (path: string, message: string) => issues.push({ level: 'warning', path, message });

  const L = def.field.length;
  const W = def.field.width;
  const inField = (p: Vec2, slack = 0.01) =>
    p.x >= -slack && p.x <= L + slack && p.y >= -slack && p.y <= W + slack;
  const checkRegion = (path: string, r: Region2D) => {
    if (r.kind === 'rect' && (r.min.x > r.max.x || r.min.y > r.max.y)) err(path, 'rect min must be <= max');
    if (r.kind === 'poly' && r.points.length < 3) err(path, 'polygon needs >= 3 points');
    if (r.kind === 'circle' && r.radius <= 0) err(path, 'circle radius must be > 0');
    for (const p of regionOutline(r)) {
      if (!inField(p, 0.5)) {
        warn(path, `region extends outside the field (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
        break;
      }
    }
  };
  const unique = (path: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) err(path, `duplicate id '${id}'`);
      seen.add(id);
    }
  };

  // timing
  const t = def.timing;
  if (t.autoSec <= 0 || t.teleopSec <= 0) err('timing', 'auto and teleop must be > 0');
  if (t.endgameSec < 0 || t.endgameSec > t.teleopSec) err('timing.endgameSec', 'must be within teleop');
  if (!t.source) warn('timing', 'no source citation');

  // field
  if (L <= 0 || W <= 0) err('field', 'length and width must be > 0');
  if (L < 10 || L > 20 || W < 5 || W > 10)
    warn('field', `unusual FRC field size ${L} x ${W} m (typical ~16.5 x 8.1)`);
  unique(
    'field.elements',
    def.field.elements.map((e) => e.id),
  );
  unique(
    'field.zones',
    def.field.zones.map((z) => z.id),
  );
  def.field.elements.forEach((e, i) => {
    const path = `field.elements[${i}] ${e.id}`;
    if (!inField(e.position, 1)) warn(path, 'position outside field');
    if (e.shape.kind === 'box' && (e.shape.size.x <= 0 || e.shape.size.y <= 0 || e.shape.size.z <= 0))
      err(path, 'box size must be > 0');
    if (e.shape.kind === 'hull' && e.shape.vertices.length < 4) err(path, 'hull needs >= 4 vertices');
    if (e.nav !== undefined && !['auto', 'wall', 'ramp', 'none'].includes(e.nav))
      err(path, "nav must be 'auto', 'wall', 'ramp' or 'none'");
    if (e.nav !== undefined && e.nav !== 'auto' && e.solid === false)
      warn(path, 'nav only applies to solid elements (bots ignore non-solid ones)');
    if (e.nav === 'ramp' && e.shape.kind !== 'hull')
      warn(
        path,
        "a 'ramp' with vertical sides is a step robots only get over with a run-up: use a hull with sloped sides",
      );
  });
  def.field.zones.forEach((z, i) => checkRegion(`field.zones[${i}] ${z.id}`, z.region));

  // pieces
  const pieceIds = new Set(def.pieces.map((p) => p.id));
  unique(
    'pieces',
    def.pieces.map((p) => p.id),
  );
  def.pieces.forEach((p, i) => {
    if (p.mass <= 0) err(`pieces[${i}] ${p.id}`, 'mass must be > 0');
    if (!p.source) warn(`pieces[${i}] ${p.id}`, 'no source citation');
  });
  def.staging.forEach((s, i) => {
    if (!pieceIds.has(s.type)) err(`staging[${i}]`, `unknown piece type '${s.type}'`);
    s.positions.forEach((p, j) => {
      if (!inField(p)) err(`staging[${i}].positions[${j}]`, 'outside field');
    });
  });
  for (const type of Object.keys(def.preload))
    if (!pieceIds.has(type)) err('preload', `unknown piece type '${type}'`);

  // targets
  unique(
    'targets',
    def.targets.map((x) => x.id),
  );
  const allTags = new Set<string>();
  def.targets.forEach((tg, i) => {
    const path = `targets[${i}] ${tg.id}`;
    for (const a of tg.accepts) if (!pieceIds.has(a)) err(path, `accepts unknown piece type '${a}'`);
    if (!tg.place && !tg.aperture) err(path, 'needs place and/or aperture');
    if (tg.place) checkRegion(`${path}.place.zone`, tg.place.zone);
    if (tg.aperture && tg.aperture.center.z <= 0) warn(path, 'aperture center at/below floor');
    if (tg.side === 'neutral' && (tg.creditTo ?? 'scorer') === 'owner')
      err(path, "neutral targets can't credit 'owner'");
    if (tg.afterScore?.kind === 'recycle' && tg.afterScore.exits.length === 0)
      err(path, 'recycle needs at least one exit');
    if (!tg.source) warn(path, 'no source citation');
    for (const tag of tg.tags ?? []) allTags.add(tag);
  });

  // stations
  unique(
    'stations',
    def.stations.map((s) => s.id),
  );
  def.stations.forEach((s, i) => {
    const path = `stations[${i}] ${s.id}`;
    for (const a of s.pieceTypes) if (!pieceIds.has(a)) err(path, `unknown piece type '${a}'`);
    if (s.mode === 'drop' && !s.dropPoint) err(path, "mode 'drop' needs dropPoint");
    if (s.feedIntervalSec <= 0) err(path, 'feedIntervalSec must be > 0');
    checkRegion(`${path}.zone`, s.zone);
  });

  // endgame & awards
  unique(
    'endgame',
    def.endgame.map((e) => e.id),
  );
  const endgameIds = new Set(def.endgame.map((e) => e.id));
  def.endgame.forEach((a, i) => {
    if (a.zones.length === 0) err(`endgame[${i}] ${a.id}`, 'needs at least one zone');
    a.zones.forEach((z, j) => checkRegion(`endgame[${i}].zones[${j}]`, z));
  });
  unique(
    'awards',
    def.awards.map((a) => a.id),
  );
  def.awards.forEach((a, i) => checkRegion(`awards[${i}] ${a.id}`, a.zone));

  // ranking points
  unique(
    'rankingPoints.bonuses',
    def.rankingPoints.bonuses.map((b) => b.id),
  );
  const sourceIds = new Set([
    ...def.targets.map((x) => x.id),
    ...def.endgame.map((x) => x.id),
    ...def.awards.map((x) => x.id),
  ]);
  def.rankingPoints.bonuses.forEach((b, i) => {
    const path = `rankingPoints.bonuses[${i}] ${b.id}`;
    if (b.id === 'win' || b.id === 'tie') err(path, "'win' and 'tie' are reserved ids");
    if (b.kind === 'pointsAtLeast') {
      for (const c of b.categories ?? [])
        if (!['auto', 'teleop', 'endgame', 'penalty'].includes(c)) err(path, `unknown category '${c}'`);
      // Sources may also be names a game's rules.ts passes to addPoints, so unknown ones only warn.
      const unknown = (b.sources ?? []).filter((s) => !sourceIds.has(s));
      if (unknown.length && !def.rules)
        err(path, `unknown sources (no rules.ts adds points): ${unknown.join(', ')}`);
    }
    if (b.kind === 'piecesAtLeast') {
      for (const id of b.targetIds ?? [])
        if (!def.targets.some((t) => t.id === id)) err(path, `unknown target '${id}'`);
      for (const tag of b.tags ?? []) if (!allTags.has(tag)) err(path, `no target has tag '${tag}'`);
    }
  });

  // fouls the engine calls
  const sidedZones = new Set(def.field.zones.filter((z) => z.side !== 'neutral').map((z) => z.id));
  const severities = new Set(['minor', 'major']);
  unique(
    'fouls.contact',
    (def.fouls.contact ?? []).map((c) => c.id),
  );
  (def.fouls.contact ?? []).forEach((c, i) => {
    const path = `fouls.contact[${i}] ${c.id}`;
    if (!c.zones.length) err(path, 'needs at least one zone');
    for (const z of c.zones)
      if (!sidedZones.has(z)) err(path, `zone '${z}' is not a sided (blue-authored) zone`);
    if (!severities.has(c.severity)) err(path, "severity must be 'minor' or 'major'");
    if (c.inside !== 'intruder' && c.inside !== 'protected')
      err(path, "inside must be 'intruder' or 'protected'");
    if (c.repeatSec !== undefined && !(c.repeatSec > 0)) err(path, 'repeatSec must be > 0');
    if (!c.source) warn(path, 'no source citation');
  });
  const pin = def.fouls.pinning;
  if (pin) {
    if (pin.countSec !== undefined && !(pin.countSec > 0)) err('fouls.pinning', 'countSec must be > 0');
    if (pin.releaseGap !== undefined && !(pin.releaseGap >= 0))
      err('fouls.pinning', 'releaseGap must be >= 0');
    for (const s of [pin.severity, pin.repeatSeverity])
      if (s !== undefined && !severities.has(s)) err('fouls.pinning', "severity must be 'minor' or 'major'");
    if (!pin.source) warn('fouls.pinning', 'no source citation');
  }
  for (const [key, ids] of [
    ['protectedZones', def.botHints?.protectedZones],
    ['endgameProtectedZones', def.botHints?.endgameProtectedZones],
  ] as const)
    for (const z of ids ?? [])
      if (!def.field.zones.some((x) => x.id === z)) err(`botHints.${key}`, `unknown zone '${z}'`);

  // start poses
  def.startPoses.forEach((p, i) => {
    if (!inField(p)) err(`startPoses[${i}]`, 'outside field');
  });

  // archetypes
  unique(
    'archetypes',
    def.archetypes.map((a) => a.id),
  );
  if (!def.archetypes.some((a) => a.id === def.defaultArchetype))
    err('defaultArchetype', `'${def.defaultArchetype}' is not an archetype`);
  def.archetypes.forEach((a, i) => {
    const path = `archetypes[${i}] ${a.id}`;
    if (a.drive.maxSpeed <= 0 || a.drive.maxAccel <= 0 || a.drive.maxOmega <= 0)
      err(path, 'drive limits must be > 0');
    if (a.drive.maxSpeed > 7)
      warn(path, `maxSpeed ${a.drive.maxSpeed} m/s is faster than any real FRC robot`);
    if (a.frame.length > 1.4 || a.frame.width > 1.4) warn(path, 'frame larger than typical FRC limits');
    for (const type of Object.keys(a.capacity))
      if (!pieceIds.has(type)) err(path, `capacity for unknown piece '${type}'`);
    for (const type of a.intake?.pieceTypes ?? [])
      if (!pieceIds.has(type)) err(path, `intake of unknown piece '${type}'`);
    for (const tag of Object.keys(a.place ?? {}))
      if (!allTags.has(tag)) err(path, `place tag '${tag}' matches no target`);
    for (const id of Object.keys(a.endgame ?? {}))
      if (!endgameIds.has(id)) err(path, `endgame '${id}' is not an endgame action`);
    // Preload is handed out in listed order while the robot has room, so a robot only needs to be
    // able to hold one of the listed types (e.g. "1 cone or 1 cube").
    const preload = Object.entries(def.preload);
    if (preload.length && !preload.some(([type, n]) => (a.capacity[type] ?? 0) >= Math.min(n, 1)))
      warn(path, `cannot hold any preload piece (${preload.map(([t]) => t).join(', ')})`);
    if (!a.intake && !a.place && !a.shooter) warn(path, 'robot cannot interact with pieces');
    if (a.reliability !== undefined && (a.reliability < 0 || a.reliability > 1))
      err(path, 'reliability must be between 0 and 1');
    for (const [k, v] of Object.entries(a.faults ?? {})) {
      const max = k === 'stallsPerMatch' ? 20 : 1;
      if (typeof v !== 'number' || !(v >= 0 && v <= max))
        err(path, `faults.${k} must be between 0 and ${max}`);
    }
  });
  const archIds = new Set(def.archetypes.map((a) => a.id));
  unique(
    'lineups',
    (def.lineups ?? []).map((l) => l.id),
  );
  (def.lineups ?? []).forEach((l, i) => {
    l.robots.forEach((slot, j) => {
      if (!archIds.has(slot.archetype))
        err(`lineups[${i}] ${l.id}.robots[${j}]`, `unknown archetype '${slot.archetype}'`);
    });
  });

  // expansion must not throw and must produce unique ids
  try {
    const x = expandDefinition(def);
    unique(
      'expanded.targets',
      x.targets.map((tg) => tg.id),
    );
  } catch (e) {
    err('expand', String(e));
  }
  return issues;
}

export function assertValid(def: GameDefinition): void {
  const errors = validateDefinition(def).filter((i) => i.level === 'error');
  if (errors.length) {
    throw new Error(
      `Invalid game definition '${def.id}':\n` + errors.map((e) => `  ${e.path}: ${e.message}`).join('\n'),
    );
  }
}

import { faultRates } from '../engine/sim/faults.ts';
import type { FaultRates, GameDefinition, HumanPlayerStation, RobotArchetype } from '../engine/sim/types.ts';

/**
 * Menu tuning: per robot type and per human player station overrides, entered in the units a drive
 * team uses (ft, lb, s, %). DOM-free so it can be unit-tested and used by `npm run sim --tuning`.
 * Values are stored by field key in display units; anything missing keeps the game's default.
 */

/** Overrides by field key, in display units. */
export type Overrides = Record<string, number>;

export interface GameTuning {
  /** Archetype id -> overrides. Applies to every robot of that type (yours and bots). */
  robots: Record<string, Overrides>;
  /** Station id (as in the definition, both alliances' copies) -> overrides. */
  stations: Record<string, Overrides>;
}

export interface TuningField<T> {
  key: string;
  label: string;
  unit: string;
  group: string;
  min: number;
  max: number;
  step: number;
  /** Current value in display units. */
  get(x: T): number;
  /** Write a display-unit value into a (cloned) object. */
  set(x: T, v: number): void;
}

const FT = 0.3048;
const LB = 0.45359237;
const DEG = Math.PI / 180;

export const emptyTuning = (): GameTuning => ({ robots: {}, stations: {} });

const fault = (
  key: keyof FaultRates,
  label: string,
  max: number,
  pct = true,
): TuningField<RobotArchetype> => ({
  key,
  label,
  unit: pct ? '%' : '/match',
  group: 'Failures (with breakdowns on)',
  min: 0,
  max,
  step: pct ? 1 : 0.1,
  get: (a) => faultRates(a)[key] * (pct ? 100 : 1),
  set: (a, v) => (a.faults = { ...a.faults, [key]: pct ? v / 100 : v }),
});

/** The tunable parameters of one robot type (only the mechanisms it has). */
export function robotFields(def: GameDefinition, a: RobotArchetype): Array<TuningField<RobotArchetype>> {
  const out: Array<TuningField<RobotArchetype>> = [
    {
      key: 'maxSpeed',
      label: 'Max speed',
      unit: 'ft/s',
      group: 'Drive',
      min: 3,
      max: 22,
      step: 0.1,
      get: (x) => x.drive.maxSpeed / FT,
      set: (x, v) => (x.drive.maxSpeed = v * FT),
    },
    {
      key: 'maxAccel',
      label: 'Max acceleration',
      unit: 'ft/s²',
      group: 'Drive',
      min: 3,
      max: 60,
      step: 0.5,
      get: (x) => x.drive.maxAccel / FT,
      set: (x, v) => (x.drive.maxAccel = v * FT),
    },
    {
      key: 'maxOmega',
      label: 'Max turn rate',
      unit: '°/s',
      group: 'Drive',
      min: 60,
      max: 1080,
      step: 10,
      get: (x) => x.drive.maxOmega / DEG,
      set: (x, v) => (x.drive.maxOmega = v * DEG),
    },
    {
      key: 'traction',
      label: 'Wheel grip (μ, caps pushing)',
      unit: '',
      group: 'Drive',
      min: 0.5,
      max: 2,
      step: 0.05,
      get: (x) => x.drive.traction ?? 1.1,
      set: (x, v) => (x.drive.traction = v),
    },
    {
      key: 'mass',
      label: 'Weight incl. bumpers & battery',
      unit: 'lb',
      group: 'Drive',
      min: 40,
      max: 200,
      step: 1,
      get: (x) => x.mass / LB,
      set: (x, v) => (x.mass = v * LB),
    },
  ];
  if (a.intake)
    out.push({
      key: 'intakeSec',
      label: 'Pickup time per piece',
      unit: 's',
      group: 'Game pieces',
      min: 0.05,
      max: 10,
      step: 0.05,
      get: (x) => x.intake!.timeSec,
      set: (x, v) => (x.intake!.timeSec = v),
    });
  for (const tag of Object.keys(a.place ?? {})) {
    const names = def.targets.filter((t) => t.id === tag || t.tags?.includes(tag)).map((t) => t.name);
    out.push({
      key: `place:${tag}`,
      label: `Place time: ${names.length === 1 ? names[0] : tag}`,
      unit: 's',
      group: 'Game pieces',
      min: 0.05,
      max: 30,
      step: 0.1,
      get: (x) => x.place![tag]!,
      set: (x, v) => (x.place![tag] = v),
    });
  }
  if (a.shooter)
    out.push(
      {
        key: 'reloadSec',
        label: 'Time between shots',
        unit: 's',
        group: 'Game pieces',
        min: 0.05,
        max: 10,
        step: 0.05,
        get: (x) => x.shooter!.reloadSec,
        set: (x, v) => (x.shooter!.reloadSec = v),
      },
      {
        key: 'spreadDeg',
        label: 'Shot spread (1σ)',
        unit: '°',
        group: 'Game pieces',
        min: 0,
        max: 20,
        step: 0.1,
        get: (x) => x.shooter!.spreadDeg,
        set: (x, v) => (x.shooter!.spreadDeg = v),
      },
      {
        key: 'maxRange',
        label: 'Max shot range',
        unit: 'ft',
        group: 'Game pieces',
        min: 1,
        max: 60,
        step: 0.5,
        get: (x) => x.shooter!.maxRange / FT,
        set: (x, v) => (x.shooter!.maxRange = v * FT),
      },
    );
  for (const id of Object.keys(a.endgame ?? {})) {
    const name = def.endgame.find((e) => e.id === id)?.name ?? id;
    out.push({
      key: `endgame:${id}`,
      label: name,
      unit: 's',
      group: 'Endgame',
      min: 0.1,
      max: 30,
      step: 0.1,
      get: (x) => x.endgame![id]!,
      set: (x, v) => (x.endgame![id] = v),
    });
    out.push({
      key: `endgameSuccess:${id}`,
      label: `${name}: success chance`,
      unit: '%',
      group: 'Endgame',
      min: 0,
      max: 100,
      step: 1,
      get: (x) => (x.endgameSuccess?.[id] ?? 1) * 100,
      set: (x, v) => (x.endgameSuccess = { ...x.endgameSuccess, [id]: v / 100 }),
    });
  }
  out.push(
    fault('breakdownChance', 'Breakdown (dead) chance', 90),
    fault('breakdownRecoverChance', 'Breakdown: chance it comes back', 100),
    fault('mechFailChance', 'Mechanism failure (still drives) chance', 90),
    fault('mechRecoverChance', 'Mechanism failure: chance it’s fixed', 100),
    fault('stallsPerMatch', 'Short power losses', 10, false),
  );
  return out;
}

/** The tunable parameters of one human player station. */
export function stationFields(st: HumanPlayerStation): Array<TuningField<HumanPlayerStation>> {
  const out: Array<TuningField<HumanPlayerStation>> = [];
  if (st.mode === 'direct')
    out.push({
      key: 'handoffSec',
      label: 'Hand-off time (robot lined up to piece in robot)',
      unit: 's',
      group: st.name,
      min: 0,
      max: 15,
      step: 0.1,
      get: (x) => x.handoffSec ?? 0,
      set: (x, v) => (x.handoffSec = v),
    });
  out.push({
    key: 'feedIntervalSec',
    label: st.mode === 'direct' ? 'Human player reload between pieces' : 'Time between deposits',
    unit: 's',
    group: st.name,
    min: 0.1,
    max: 30,
    step: 0.1,
    get: (x) => x.feedIntervalSec,
    set: (x, v) => (x.feedIntervalSec = v),
  });
  if (st.supply !== undefined)
    out.push({
      key: 'supply',
      label: 'Pieces per alliance',
      unit: '',
      group: st.name,
      min: 0,
      max: 200,
      step: 1,
      get: (x) => x.supply ?? 0,
      set: (x, v) => (x.supply = Math.round(v)),
    });
  return out;
}

/** Round to the field's step, for display and storage. */
export function roundTo(v: number, step: number): number {
  const d = Math.max(0, -Math.floor(Math.log10(step)));
  return +(Math.round(v / step) * step).toFixed(d);
}

function cleanOverrides<T>(fields: Array<TuningField<T>>, raw: unknown): Overrides {
  const out: Overrides = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const f of fields) {
    const v = (raw as Record<string, unknown>)[f.key];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    out[f.key] = Math.min(f.max, Math.max(f.min, v));
  }
  return out;
}

/** Keep only known fields with finite values, clamped to their ranges (e.g. from localStorage). */
export function sanitizeTuning(def: GameDefinition, raw: unknown): GameTuning {
  const t = emptyTuning();
  const r = (raw ?? {}) as Partial<Record<keyof GameTuning, Record<string, unknown>>>;
  for (const a of def.archetypes) {
    const o = cleanOverrides(robotFields(def, a), r.robots?.[a.id]);
    if (Object.keys(o).length) t.robots[a.id] = o;
  }
  for (const st of def.stations) {
    const o = cleanOverrides(stationFields(st), r.stations?.[st.id]);
    if (Object.keys(o).length) t.stations[st.id] = o;
  }
  return t;
}

export function isTuned(t: GameTuning): boolean {
  return Object.keys(t.robots).length > 0 || Object.keys(t.stations).length > 0;
}

/** A copy of the definition with the overrides applied (the original is untouched). */
export function applyTuning(def: GameDefinition, raw: unknown): GameDefinition {
  const t = sanitizeTuning(def, raw);
  if (!isTuned(t)) return def;
  const archetypes = def.archetypes.map((a) => {
    const o = t.robots[a.id];
    if (!o) return a;
    const copy = structuredClone(a);
    for (const f of robotFields(def, a)) if (o[f.key] !== undefined) f.set(copy, o[f.key]!);
    return copy;
  });
  const stations = def.stations.map((st) => {
    const o = t.stations[st.id];
    if (!o) return st;
    const copy = structuredClone(st);
    for (const f of stationFields(st)) if (o[f.key] !== undefined) f.set(copy, o[f.key]!);
    return copy;
  });
  return { ...def, archetypes, stations };
}

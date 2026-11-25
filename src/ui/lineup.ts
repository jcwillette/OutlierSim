import type { Alliance, AllianceStrategy, GameDefinition, RobotRole } from '../engine/sim/types.ts';

/**
 * Alliance composition chosen in the menu: a robot type and role per slot, plus a strategy, per
 * alliance. DOM-free so it can be unit-tested. Robot ids: 0-2 blue stations 1-3, 3-5 red 1-3.
 */

export interface SlotChoice {
  /** Archetype id, or 'random'. */
  archetype: string;
  /** 'auto': the archetype's default role (defenders defend, everyone else scores). */
  role: RobotRole | 'auto';
}

export interface AllianceChoice {
  /** The preset last applied: 'random', 'custom' (edited by hand) or a `GameDefinition.lineups` id. */
  preset: string;
  strategy: AllianceStrategy;
  slots: [SlotChoice, SlotChoice, SlotChoice];
}

export type LineupChoice = Record<Alliance, AllianceChoice>;

export const STRATEGIES: ReadonlyArray<readonly [AllianceStrategy, string, string]> = [
  [
    'balanced',
    'Balanced',
    'Score, then the endgame on the usual schedule; defend only when it clearly pays.',
  ],
  ['max-cycles', 'Max cycles', 'Keep scoring as late as possible and never stop to defend.'],
  ['early-endgame', 'Early endgame', 'Head for the endgame about 15 s early to make sure of it.'],
  ['aggressive', 'Aggressive', 'Get in the way of opponents carrying pieces about three times as readily.'],
  [
    'close-out',
    'Close out',
    'Balanced, but once the lead is safe, head for the endgame about 15 s early to make sure of it.',
  ],
];

const randomSlots = (): AllianceChoice['slots'] => [
  { archetype: 'random', role: 'auto' },
  { archetype: 'random', role: 'auto' },
  { archetype: 'random', role: 'auto' },
];

export function defaultLineup(): LineupChoice {
  return {
    blue: { preset: 'random', strategy: 'balanced', slots: randomSlots() },
    red: { preset: 'random', strategy: 'balanced', slots: randomSlots() },
  };
}

/** The alliance setup for a preset id ('random' or one of the game's lineups). */
export function applyPreset(def: GameDefinition, presetId: string): AllianceChoice {
  const lineup = def.lineups?.find((l) => l.id === presetId);
  if (!lineup) return { preset: 'random', strategy: 'balanced', slots: randomSlots() };
  return {
    preset: lineup.id,
    strategy: lineup.strategy ?? 'balanced',
    slots: lineup.robots.map((s) => ({
      archetype: s.archetype,
      role: s.role ?? 'auto',
    })) as AllianceChoice['slots'],
  };
}

/** Drop anything that doesn't exist in this game (saved settings from another game or version). */
export function sanitizeLineup(def: GameDefinition, saved: unknown): LineupChoice {
  const out = defaultLineup();
  const ids = new Set(def.archetypes.map((a) => a.id));
  const strategies = new Set(STRATEGIES.map(([s]) => s));
  const presets = new Set(['random', 'custom', ...(def.lineups ?? []).map((l) => l.id)]);
  const roles = new Set(['score', 'defense', ...(def.roles ?? []).map((r) => r.id)]);
  const src = (saved ?? {}) as Partial<Record<Alliance, Partial<AllianceChoice>>>;
  for (const a of ['blue', 'red'] as const) {
    const s = src[a];
    if (!s) continue;
    if (typeof s.preset === 'string' && presets.has(s.preset)) out[a].preset = s.preset;
    if (s.strategy && strategies.has(s.strategy)) out[a].strategy = s.strategy;
    s.slots?.slice(0, 3).forEach((slot, i) => {
      if (slot && (slot.archetype === 'random' || ids.has(slot.archetype)))
        out[a].slots[i] = {
          archetype: slot.archetype,
          role: typeof slot.role === 'string' && roles.has(slot.role) ? slot.role : 'auto',
        };
    });
  }
  return out;
}

/**
 * Concrete archetypes, roles and strategies for a match. 'random' slots deal out the game's robot
 * types so an alliance tends to get a variety. The player's slot is skipped (`playerId`).
 */
export function resolveLineup(
  def: GameDefinition,
  choice: LineupChoice,
  playerId: number | null,
  random: () => number = Math.random,
): {
  archetypes: Record<number, string>;
  roles: Partial<Record<number, RobotRole>>;
  strategies: Record<Alliance, AllianceStrategy>;
} {
  const archetypes: Record<number, string> = {};
  const roles: Partial<Record<number, RobotRole>> = {};
  const all = def.archetypes.map((a) => a.id);
  (['blue', 'red'] as const).forEach((a, side) => {
    // Shuffled deck per alliance, so random slots on one alliance differ from each other.
    const deck = [...all];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [deck[i], deck[j]] = [deck[j]!, deck[i]!];
    }
    let k = 0;
    choice[a].slots.forEach((slot, station) => {
      const id = side * 3 + station;
      if (id === playerId) return;
      archetypes[id] = slot.archetype === 'random' ? deck[k++ % deck.length]! : slot.archetype;
      if (slot.role !== 'auto') roles[id] = slot.role;
    });
  });
  return { archetypes, roles, strategies: { blue: choice.blue.strategy, red: choice.red.strategy } };
}

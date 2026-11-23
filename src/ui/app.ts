import * as THREE from 'three';
import { CameraRig, SPECTATOR_CAMERA_MODES } from '../engine/render/cameras.ts';
import { ALLIANCE_COLOR, FieldView } from '../engine/render/fieldView.ts';
import {
  InputManager,
  KEY_HELP,
  PAD_HELP,
  PlayerController,
  SPECTATOR_KEY_HELP,
  SPECTATOR_PAD_HELP,
  type ButtonEvent,
} from '../engine/input/input.ts';
import { Match, initPhysics, type MatchResult, type Robot } from '../engine/sim/match.ts';
import type { Alliance, GameDefinition } from '../engine/sim/types.ts';
import { GAMES } from '../games/index.ts';
import {
  applyTuning,
  emptyTuning,
  isTuned,
  robotFields,
  roundTo,
  sanitizeTuning,
  stationFields,
  type GameTuning,
  type Overrides,
  type TuningField,
} from './tuning.ts';
import { BotBrain, attachBots, type Difficulty } from '../engine/ai/bot.ts';
import {
  applyPreset,
  resolveLineup,
  sanitizeLineup,
  STRATEGIES,
  type AllianceChoice,
  type LineupChoice,
} from './lineup.ts';

const DIFFICULTIES: ReadonlyArray<readonly [Difficulty, string]> = [
  ['easy', 'Easy'],
  ['normal', 'Normal'],
  ['hard', 'Hard'],
];

// ------------------------------------------------------------------ tiny DOM helper

type Child = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'style' || k.includes('-')) el.setAttribute(k, String(v));
    else (el as unknown as Record<string, unknown>)[k] = v;
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

const fmtTime = (s: number) => {
  const t = Math.ceil(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/** Results-table note on a robot's breakdowns, mechanism failures and power losses ('' if none). */
export function troubleText(r: MatchResult['robots'][number]): string {
  const parts: string[] = [];
  if (r.brokeDownAt !== null)
    parts.push(
      `broke down at ${fmtTime(r.brokeDownAt)}` +
        (r.recoveredAt !== null ? `, back at ${fmtTime(r.recoveredAt)}` : ''),
    );
  if (r.mechFailedAt !== null)
    parts.push(
      `mechanism failed at ${fmtTime(r.mechFailedAt)}` +
        (r.mechFixedAt !== null ? `, fixed at ${fmtTime(r.mechFixedAt)}` : ''),
    );
  if (r.stalls) parts.push(`lost power ×${r.stalls}`);
  return parts.join('; ');
}

// ------------------------------------------------------------------ settings

export interface Setup {
  gameId: string;
  /** 'play': drive one robot. 'watch': spectate a match between six bots. */
  mode: 'play' | 'watch';
  alliance: Alliance;
  station: number;
  archetype: string;
  autoIntake: boolean;
  partners: Difficulty;
  opponents: Difficulty;
  /** Your robot runs the bot AI during autonomous (like a programmed auto routine). */
  autoPilot: boolean;
  /** Alliance compositions, per game id (archetype ids differ between games). */
  lineups: Record<string, LineupChoice>;
  /** Robots can break down / lose power: never, bots only, or every robot including yours. */
  breakdowns: 'off' | 'bots' | 'all';
  /** Robot-type and human-player-station overrides, per game id. */
  tuning: Record<string, GameTuning>;
}

const STORE_KEY = 'outliersim.setup.v1';
function loadSetup(): Partial<Setup> {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Partial<Setup>;
  } catch {
    return {};
  }
}
function saveSetup(s: Setup): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: settings just won't persist */
  }
}

// ------------------------------------------------------------------ app

export class App {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly input = new InputManager();
  private readonly root: HTMLElement;
  private readonly uiLayer: HTMLElement;
  private session: Session | null = null;
  private setup: Setup;
  private readonly dev = new URLSearchParams(location.search).has('dev');
  /** Menu state: robot type shown in the tuning section, and whether that section is expanded. */
  private tuneArch: string | null = null;
  private tuneOpen = false;

  constructor(root: HTMLElement) {
    this.root = root;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'view';
    root.append(this.renderer.domElement);
    this.uiLayer = h('div', { class: 'ui' });
    root.append(this.uiLayer);

    const games = this.games();
    const saved = loadSetup();
    // ?game=<id> preselects a game (shareable link for students).
    const params = new URLSearchParams(location.search);
    const linked = params.get('game');
    const def = games.find((g) => g.id === linked) ?? games.find((g) => g.id === saved.gameId) ?? games[0]!;
    this.setup = {
      gameId: def.id,
      // ?watch=1 opens straight into spectator mode.
      mode: params.has('watch') ? 'watch' : (saved.mode ?? 'play'),
      alliance: saved.alliance ?? 'blue',
      station: saved.station ?? 0,
      archetype: def.archetypes.some((a) => a.id === saved.archetype)
        ? saved.archetype!
        : def.defaultArchetype,
      autoIntake: saved.autoIntake ?? true,
      partners: saved.partners ?? 'normal',
      opponents: saved.opponents ?? 'normal',
      autoPilot: saved.autoPilot ?? true,
      lineups: saved.lineups ?? {},
      tuning: saved.tuning ?? {},
      breakdowns: saved.breakdowns ?? 'bots',
    };

    this.input.on((e) => this.session?.onButton(e));
    window.addEventListener('resize', () => this.resize());
    this.resize();
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.session?.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private games(): GameDefinition[] {
    return GAMES.filter((g) => this.dev || !g.hidden).map((g) => g.definition);
  }

  private resize(): void {
    const w = this.root.clientWidth;
    const hgt = this.root.clientHeight;
    this.renderer.setSize(w, hgt, false);
    this.session?.rig.resize(w, hgt);
  }

  setOverlay(content: HTMLElement | null): void {
    this.uiLayer.replaceChildren(...(content ? [content] : []));
  }

  // ---------------------------------------------------------------- menu

  showMenu(): void {
    this.session?.dispose();
    this.session = null;
    const games = this.games();
    const def = games.find((g) => g.id === this.setup.gameId) ?? games[0]!;
    const arch = def.archetypes.find((a) => a.id === this.setup.archetype) ?? def.archetypes[0]!;

    const gameSel = h(
      'select',
      {
        onchange: (e: Event) => {
          const id = (e.target as HTMLSelectElement).value;
          const g = games.find((x) => x.id === id)!;
          this.setup = { ...this.setup, gameId: id, archetype: g.defaultArchetype };
          this.showMenu();
        },
        'aria-label': 'Game',
      },
      ...games.map((g) =>
        h('option', { value: g.id, selected: g.id === def.id }, `${g.year > 0 ? g.year + ' ' : ''}${g.name}`),
      ),
    );
    const stations = h(
      'div',
      { class: 'stations' },
      ...(['blue', 'red'] as const).flatMap((a) =>
        [0, 1, 2].map((s) =>
          h(
            'button',
            {
              class: `${a} ${this.setup.alliance === a && this.setup.station === s ? 'sel' : ''}`,
              onclick: () => {
                this.setup = { ...this.setup, alliance: a, station: s };
                this.showMenu();
              },
            },
            `${a === 'blue' ? 'Blue' : 'Red'} ${s + 1}`,
          ),
        ),
      ),
    );
    const archSel = h(
      'select',
      {
        'aria-label': 'Robot',
        onchange: (e: Event) => {
          this.setup = { ...this.setup, archetype: (e.target as HTMLSelectElement).value };
          this.showMenu();
        },
      },
      ...def.archetypes.map((a) => h('option', { value: a.id, selected: a.id === arch.id }, a.name)),
    );
    const keyRows = (rows: Array<[string, string]>) =>
      h('div', { class: 'keys' }, ...rows.flatMap(([k, d]) => [h('kbd', {}, k), h('span', {}, d)]));
    const watching = this.setup.mode === 'watch';
    const modeToggle = h(
      'div',
      { class: 'stations modes', role: 'radiogroup', 'aria-label': 'Mode' },
      ...(
        [
          ['play', 'Drive a robot'],
          ['watch', 'Watch 6 bots'],
        ] as const
      ).map(([m, label]) =>
        h(
          'button',
          {
            class: this.setup.mode === m ? 'sel' : '',
            role: 'radio',
            'aria-checked': String(this.setup.mode === m),
            onclick: () => {
              this.setup = { ...this.setup, mode: m };
              this.showMenu();
            },
          },
          label,
        ),
      ),
    );
    const breakdowns = this.selectField(
      'Breakdowns',
      this.setup.breakdowns,
      watching
        ? [
            ['bots', 'On'],
            ['off', 'Off'],
          ]
        : [
            ['bots', 'Bots only'],
            ['all', 'Everyone, incl. you'],
            ['off', 'Off'],
          ],
      (v) => (this.setup.breakdowns = v),
    );
    const alliances = this.alliancesSection(def, watching);
    const tuning = this.tuningSection(def, watching);
    const playSections: Child[] = [
      h('h2', {}, 'Your driver station'),
      stations,
      h('h2', {}, 'Your robot'),
      archSel,
      h('p', { class: 'summary' }, arch.description),
      h(
        'label',
        { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: this.setup.autoIntake,
          onchange: (e: Event) =>
            (this.setup = { ...this.setup, autoIntake: (e.target as HTMLInputElement).checked }),
        }),
        'Auto-intake (intake runs whenever you have room)',
      ),
      h(
        'label',
        { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: this.setup.autoPilot,
          onchange: (e: Event) =>
            (this.setup = { ...this.setup, autoPilot: (e.target as HTMLInputElement).checked }),
        }),
        'Run an auto routine for me in autonomous (uncheck to drive auto yourself)',
      ),
      h('h2', {}, 'Other robots'),
      h(
        'div',
        { class: 'row' },
        this.selectField('Partners', this.setup.partners, DIFFICULTIES, (v) => (this.setup.partners = v)),
        this.selectField('Opponents', this.setup.opponents, DIFFICULTIES, (v) => (this.setup.opponents = v)),
        breakdowns,
      ),
      alliances,
      tuning,
      h('h2', {}, 'Controls'),
      h(
        'div',
        { class: 'row', style: 'align-items:flex-start;gap:28px' },
        keyRows(KEY_HELP),
        keyRows(PAD_HELP),
      ),
    ];
    const watchSections: Child[] = [
      h('h2', {}, 'Bots'),
      h(
        'div',
        { class: 'row' },
        this.selectField(
          'Blue alliance',
          this.setup.partners,
          DIFFICULTIES,
          (v) => (this.setup.partners = v),
        ),
        this.selectField(
          'Red alliance',
          this.setup.opponents,
          DIFFICULTIES,
          (v) => (this.setup.opponents = v),
        ),
        breakdowns,
      ),
      alliances,
      tuning,
      h('h2', {}, 'Spectator controls'),
      h(
        'div',
        { class: 'row', style: 'align-items:flex-start;gap:28px' },
        keyRows(SPECTATOR_KEY_HELP),
        keyRows(SPECTATOR_PAD_HELP),
      ),
    ];

    const card = h(
      'div',
      { class: 'card' },
      h('h1', {}, 'OutlierSim'),
      h(
        'p',
        { class: 'sub' },
        watching
          ? 'Watch six bots play a full 3v3 match. Follow any robot and see what it is doing.'
          : 'Drive one robot in a 3v3 match and get a feel for the game before you build.',
      ),
      h('h2', {}, 'Game'),
      gameSel,
      h('p', { class: 'summary' }, def.summary),
      h('h2', {}, 'Mode'),
      modeToggle,
      ...(watching ? watchSections : playSections),
      h(
        'div',
        { class: 'row end' },
        h(
          'button',
          { class: 'primary', onclick: () => void this.start() },
          watching ? 'Watch match' : 'Start match',
        ),
      ),
      h(
        'p',
        { class: 'disclaimer' },
        'Unofficial fan-made simulation for team practice. Not affiliated with or endorsed by FIRST®. ' +
          'Field geometry and rules are simplified approximations generated from the public game manual.',
      ),
    );
    this.setOverlay(h('div', { class: 'overlay' }, card));
    (card.querySelector('button.primary') as HTMLButtonElement | null)?.focus({ preventScroll: true });
  }

  /**
   * Robot & field tuning: edit any robot type's drive, mechanism, endgame and failure numbers, and the
   * human player stations. Inputs commit on change without re-rendering the menu (keeps focus).
   */
  private tuningSection(def: GameDefinition, watching: boolean): HTMLElement {
    const tuning = sanitizeTuning(def, this.setup.tuning[def.id]);
    this.setup.tuning[def.id] = tuning;
    const arch =
      def.archetypes.find((a) => a.id === this.tuneArch) ??
      (watching ? undefined : def.archetypes.find((a) => a.id === this.setup.archetype)) ??
      def.archetypes[0]!;
    const archId = arch.id;
    const badge = h('span', { class: 'tuned' }, isTuned(tuning) ? 'modified' : '');
    const refreshBadge = () => (badge.textContent = isTuned(tuning) ? 'modified' : '');

    const input = <T>(f: TuningField<T>, base: T, store: () => Overrides, drop: () => void) => {
      const o = store();
      const dflt = roundTo(f.get(base), f.step);
      const el = h('input', {
        type: 'number',
        min: f.min,
        max: f.max,
        step: f.step,
        placeholder: String(dflt),
        value: o[f.key] !== undefined ? String(o[f.key]) : '',
        class: o[f.key] !== undefined ? 'set' : '',
        'aria-label': `${f.label}${f.unit ? ` (${f.unit})` : ''}`,
        title: `Default ${dflt}${f.unit ? ` ${f.unit}` : ''}, range ${f.min}-${f.max}. Clear to use the default.`,
        onchange: (e: Event) => {
          const t = e.target as HTMLInputElement;
          const v = t.value.trim() === '' ? NaN : Number(t.value);
          const s = store();
          if (!Number.isFinite(v)) delete s[f.key];
          else s[f.key] = roundTo(Math.min(f.max, Math.max(f.min, v)), f.step);
          t.value = s[f.key] !== undefined ? String(s[f.key]) : '';
          t.classList.toggle('set', s[f.key] !== undefined);
          drop();
          refreshBadge();
        },
      });
      return h(
        'label',
        { class: 'tune' },
        h('span', {}, f.label, f.unit ? h('em', {}, ` ${f.unit}`) : null),
        el,
      );
    };
    const groups = <T>(fields: Array<TuningField<T>>, base: T, store: () => Overrides, drop: () => void) => {
      const byGroup = new Map<string, Array<TuningField<T>>>();
      for (const f of fields) byGroup.set(f.group, [...(byGroup.get(f.group) ?? []), f]);
      return [...byGroup].map(([g, fs]) =>
        h(
          'fieldset',
          { class: 'tune-group' },
          h('legend', {}, g),
          ...fs.map((f) => input(f, base, store, drop)),
        ),
      );
    };

    const robotStore = () => (tuning.robots[archId] ??= {});
    const robotDrop = () => {
      if (!Object.keys(tuning.robots[archId] ?? {}).length) delete tuning.robots[archId];
    };
    const archSel = h(
      'select',
      {
        'aria-label': 'Robot type to tune',
        onchange: (e: Event) => {
          this.tuneArch = (e.target as HTMLSelectElement).value;
          this.showMenu();
        },
      },
      ...def.archetypes.map((a) =>
        h(
          'option',
          { value: a.id, selected: a.id === archId },
          `${a.name}${!watching && a.id === this.setup.archetype ? ' (your robot)' : ''}${tuning.robots[a.id] ? ' *' : ''}`,
        ),
      ),
    );
    const stationBlocks = def.stations.flatMap((st) =>
      groups(
        stationFields(st),
        st,
        () => (tuning.stations[st.id] ??= {}),
        () => {
          if (!Object.keys(tuning.stations[st.id] ?? {}).length) delete tuning.stations[st.id];
        },
      ),
    );
    const details = h(
      'details',
      {
        class: 'tuning',
        open: this.tuneOpen,
        ontoggle: (e: Event) => (this.tuneOpen = (e.target as HTMLDetailsElement).open),
      },
      h('summary', {}, 'Robot & field tuning ', badge),
      h(
        'p',
        { class: 'summary small' },
        'Blank boxes use the game’s defaults (shown in gray). A robot type’s numbers apply to every robot ' +
          'of that type in the match, yours and the bots’. Failure chances only matter with Breakdowns on.',
      ),
      h(
        'div',
        { class: 'row' },
        h('label', { class: 'field' }, h('span', {}, 'Robot type'), archSel),
        h(
          'button',
          {
            onclick: () => {
              delete tuning.robots[archId];
              this.showMenu();
            },
          },
          'Reset this robot',
        ),
      ),
      ...groups(robotFields(def, arch), arch, robotStore, robotDrop),
      stationBlocks.length ? h('h3', {}, 'Human player stations') : null,
      ...stationBlocks,
      h(
        'div',
        { class: 'row end' },
        h(
          'button',
          {
            onclick: () => {
              this.setup.tuning[def.id] = emptyTuning();
              this.showMenu();
            },
          },
          'Reset all tuning',
        ),
      ),
    );
    return details;
  }

  private lineupFor(def: GameDefinition): LineupChoice {
    const l = sanitizeLineup(def, this.setup.lineups[def.id]);
    this.setup.lineups[def.id] = l;
    return l;
  }

  /** Per-alliance composition: preset, strategy, and robot type + role for each driver station. */
  private alliancesSection(def: GameDefinition, watching: boolean): HTMLElement {
    const lineup = this.lineupFor(def);
    const playerId = watching ? null : (this.setup.alliance === 'blue' ? 0 : 3) + this.setup.station;
    const archName = (id: string) => def.archetypes.find((a) => a.id === id)?.name ?? id;
    const update = (a: 'blue' | 'red', next: AllianceChoice) => {
      this.setup.lineups[def.id] = { ...lineup, [a]: next };
      this.showMenu();
    };
    const column = (a: 'blue' | 'red', side: number) => {
      const c = lineup[a];
      const preset = def.lineups?.find((l) => l.id === c.preset);
      const presetSel = h(
        'select',
        {
          'aria-label': `${a} alliance preset`,
          onchange: (e: Event) => {
            const id = (e.target as HTMLSelectElement).value;
            if (id !== 'custom') update(a, applyPreset(def, id));
          },
        },
        h('option', { value: 'random', selected: c.preset === 'random' }, 'Random mix'),
        ...(def.lineups ?? []).map((l) => h('option', { value: l.id, selected: c.preset === l.id }, l.name)),
        h('option', { value: 'custom', selected: c.preset === 'custom' }, 'Custom'),
      );
      const strategySel = h(
        'select',
        {
          'aria-label': `${a} alliance strategy`,
          onchange: (e: Event) =>
            update(a, {
              ...c,
              preset: 'custom',
              strategy: (e.target as HTMLSelectElement).value as AllianceChoice['strategy'],
            }),
        },
        ...STRATEGIES.map(([v, label, tip]) =>
          h('option', { value: v, selected: v === c.strategy, title: tip }, label),
        ),
      );
      const rows = c.slots.map((slot, station) => {
        const id = side * 3 + station;
        const label = h(
          'span',
          { class: `slotname ${a}` },
          `${a === 'blue' ? 'Blue' : 'Red'} ${station + 1}`,
        );
        if (id === playerId)
          return h(
            'div',
            { class: 'slot you' },
            label,
            h('span', { class: 'you' }, `You · ${archName(this.setup.archetype)}`),
          );
        const setSlot = (next: Partial<typeof slot>) => {
          const slots = [...c.slots] as AllianceChoice['slots'];
          slots[station] = { ...slot, ...next };
          update(a, { ...c, preset: 'custom', slots });
        };
        return h(
          'div',
          { class: 'slot' },
          label,
          h(
            'select',
            {
              'aria-label': `${a} ${station + 1} robot`,
              onchange: (e: Event) => setSlot({ archetype: (e.target as HTMLSelectElement).value }),
            },
            h('option', { value: 'random', selected: slot.archetype === 'random' }, 'Random'),
            ...def.archetypes.map((t) =>
              h('option', { value: t.id, selected: slot.archetype === t.id, title: t.description }, t.name),
            ),
          ),
          h(
            'select',
            {
              'aria-label': `${a} ${station + 1} role`,
              onchange: (e: Event) =>
                setSlot({ role: (e.target as HTMLSelectElement).value as typeof slot.role }),
            },
            h(
              'option',
              {
                value: 'auto',
                selected: slot.role === 'auto',
                title: 'Defenders defend, everyone else scores',
              },
              'Auto',
            ),
            h('option', { value: 'score', selected: slot.role === 'score' }, 'Score'),
            h('option', { value: 'defense', selected: slot.role === 'defense' }, 'Defend'),
          ),
        );
      });
      const tip = preset?.description ?? STRATEGIES.find(([v]) => v === c.strategy)?.[2] ?? '';
      return h(
        'div',
        { class: `alliance ${a}` },
        h(
          'div',
          { class: 'alliance-head' },
          h('b', {}, a === 'blue' ? 'Blue alliance' : 'Red alliance'),
          presetSel,
        ),
        h('label', { class: 'field' }, h('span', {}, 'Strategy'), strategySel),
        ...rows,
        h('p', { class: 'summary small' }, tip),
      );
    };
    return h(
      'div',
      {},
      h('h2', {}, 'Alliances'),
      h('div', { class: 'alliances' }, column('blue', 0), column('red', 1)),
    );
  }

  private selectField<T extends string>(
    label: string,
    value: T,
    options: ReadonlyArray<readonly [T, string]>,
    onChange: (v: T) => void,
  ): HTMLElement {
    return h(
      'label',
      { class: 'field' },
      h('span', {}, label),
      h(
        'select',
        { onchange: (e: Event) => onChange((e.target as HTMLSelectElement).value as T) },
        ...options.map(([v, text]) => h('option', { value: v, selected: v === value }, text)),
      ),
    );
  }

  async start(): Promise<void> {
    saveSetup(this.setup);
    await initPhysics();
    const base = this.games().find((g) => g.id === this.setup.gameId)!;
    const def = applyTuning(base, this.setup.tuning[base.id]);
    this.session?.dispose();
    this.input.autoIntake = this.setup.autoIntake;
    this.session = new Session(this, def, this.setup, this.input, this.renderer);
    this.resize();
  }

  showResults(def: GameDefinition, result: MatchResult, playerId: number | null): void {
    const row = (label: string, b: number | string, r: number | string) =>
      h(
        'tr',
        {},
        h('td', {}, label),
        h('td', { class: 'blue' }, String(b)),
        h('td', { class: 'red' }, String(r)),
      );
    const cats = ['auto', 'teleop', 'endgame', 'penalty'] as const;
    const winner = result.blue.won ? 'Blue wins' : result.red.won ? 'Red wins' : 'Tie';
    const rpKeys = [
      ...new Set([...Object.keys(result.blue.rpBreakdown), ...Object.keys(result.red.rpBreakdown)]),
    ];
    const rpName = (k: string) =>
      k === 'win'
        ? 'Win'
        : k === 'tie'
          ? 'Tie'
          : (def.rankingPoints.bonuses.find((b) => b.id === k)?.name ?? k);
    const card = h(
      'div',
      { class: 'card' },
      h('h1', {}, 'Match complete'),
      h(
        'div',
        {
          class: 'winner',
          style: `color:${result.blue.won ? '#7fb3ff' : result.red.won ? '#ff8a8a' : '#fff'}`,
        },
        winner,
      ),
      h(
        'table',
        { class: 'results' },
        h('tr', {}, h('th', {}, ''), h('th', { class: 'blue' }, 'Blue'), h('th', { class: 'red' }, 'Red')),
        ...cats.map((c) =>
          row(c[0]!.toUpperCase() + c.slice(1), result.blue.breakdown[c], result.red.breakdown[c]),
        ),
        row('Total', result.blue.score, result.red.score),
        ...rpKeys.map((k) =>
          row(`RP: ${rpName(k)}`, result.blue.rpBreakdown[k] ?? 0, result.red.rpBreakdown[k] ?? 0),
        ),
        row('Ranking points', result.blue.rp, result.red.rp),
      ),
      h('h2', {}, 'Robots'),
      h(
        'table',
        { class: 'results' },
        h('tr', {}, h('th', {}, 'Robot'), h('th', {}, 'Points'), h('th', {}, 'Scored'), h('th', {}, 'Shots')),
        ...result.robots.map((r) =>
          h(
            'tr',
            {},
            h(
              'td',
              { class: r.alliance },
              `${r.alliance === 'blue' ? 'Blue' : 'Red'} ${(r.id % 3) + 1}${r.id === playerId ? ' (you)' : ''}: ${
                def.archetypes.find((a) => a.id === r.archetype)?.name ?? r.archetype
              }`,
              troubleText(r) ? h('span', { class: 'trouble' }, ` ${troubleText(r)}`) : null,
            ),
            h('td', {}, String(r.points)),
            h('td', {}, String(r.piecesScored)),
            h('td', {}, String(r.shotsTaken)),
          ),
        ),
      ),
      h(
        'div',
        { class: 'row end' },
        h('button', { onclick: () => this.showMenu() }, 'Change setup'),
        h(
          'button',
          { class: 'primary', onclick: () => void this.start() },
          playerId === null ? 'Watch another' : 'Play again',
        ),
      ),
    );
    this.setOverlay(h('div', { class: 'overlay' }, card));
  }
}

// ------------------------------------------------------------------ session

const SPEEDS = [0.25, 0.5, 1, 2, 4] as const;
const robotName = (r: Robot) => `${r.alliance === 'blue' ? 'Blue' : 'Red'} ${r.station + 1}`;

/**
 * One match on screen. With `setup.mode === 'play'` the student drives one robot; with 'watch' all
 * six robots are bots and the camera follows whichever robot the spectator picks.
 */
class Session {
  readonly match: Match;
  readonly view: FieldView;
  readonly rig: CameraRig;
  /** The student's robot, or null when spectating. */
  readonly player: Robot | null;
  readonly brains: Map<number, BotBrain>;
  private readonly controller: PlayerController | null;
  private state: 'countdown' | 'running' | 'paused' | 'done' = 'countdown';
  /** Wall-clock time the countdown ends (not frame-dt based, so slow frames don't stretch it). */
  private readonly countdownEnd = performance.now() + 3000;
  private readonly hud: Hud;
  /** Robot the camera follows (the player's robot when playing). */
  private followId: number;
  /** Playback speed index into SPEEDS (spectator only). */
  private speedIndex = SPEEDS.indexOf(1);

  constructor(
    private readonly app: App,
    readonly def: GameDefinition,
    setup: Setup,
    private readonly input: InputManager,
    private readonly renderer: THREE.WebGLRenderer,
  ) {
    const watching = setup.mode === 'watch';
    const playerId = watching ? null : (setup.alliance === 'blue' ? 0 : 3) + setup.station;
    const lineup = resolveLineup(def, sanitizeLineup(def, setup.lineups[def.id]), playerId);
    const archetypes =
      playerId === null ? lineup.archetypes : { ...lineup.archetypes, [playerId]: setup.archetype };
    this.match = new Match(def, {
      seed: (Math.random() * 2 ** 31) | 0,
      archetypes,
      breakdowns: setup.breakdowns !== 'off',
      ...(setup.breakdowns === 'bots' && playerId !== null ? { breakdownExempt: [playerId] } : {}),
    });
    this.player = playerId === null ? null : this.match.robots[playerId]!;
    this.followId = playerId ?? 0;
    this.view = new FieldView(this.match.game, this.followId);
    this.rig = watching
      ? new CameraRig(this.match, 'blue', 1, SPECTATOR_CAMERA_MODES)
      : new CameraRig(this.match, setup.alliance, setup.station);
    this.brains = attachBots(this.match, {
      partners: setup.partners,
      opponents: setup.opponents,
      playerId,
      roles: lineup.roles,
      strategies: lineup.strategies,
    });
    if (this.player) {
      const controller = new PlayerController(input, () => this.rig.driveYaw);
      this.controller = controller;
      const autoBrain = new BotBrain({ difficulty: 'hard' });
      // During auto the player's robot optionally runs the bot AI as its "auto routine".
      this.player.controller = setup.autoPilot
        ? { command: (m, r, dt) => (m.phase === 'auto' ? autoBrain : controller).command(m, r, dt) }
        : controller;
      this.hud = new Hud(this.match, { kind: 'play', player: this.player, autoPilot: setup.autoPilot });
    } else {
      this.controller = null;
      this.hud = new Hud(this.match, { kind: 'watch', brains: this.brains });
      this.hud.setFollow(this.followed);
      this.hud.setSpeed(this.speed);
    }
    this.hud.setCamera(this.rig.mode);
    app.setOverlay(this.hud.root);
  }

  private get followed(): Robot {
    return this.match.robots[this.followId]!;
  }

  private get speed(): number {
    return SPEEDS[this.speedIndex]!;
  }

  dispose(): void {
    this.state = 'done';
  }

  onButton(e: ButtonEvent): void {
    if (e === 'camera') this.hud.setCamera(this.rig.cycle());
    if (e === 'pause' && (this.state === 'running' || this.state === 'paused')) {
      this.state = this.state === 'running' ? 'paused' : 'running';
      this.hud.setPaused(this.state === 'paused', () => this.app.showMenu());
    }
    if (this.player) return; // the rest are spectator controls
    const n = this.match.robots.length;
    if (e === 'next') this.follow((this.followId + 1) % n);
    if (e === 'prev') this.follow((this.followId + n - 1) % n);
    if (e.startsWith('follow')) this.follow(Number(e.slice(6)));
    if (e === 'faster' || e === 'slower') {
      this.speedIndex = Math.max(0, Math.min(SPEEDS.length - 1, this.speedIndex + (e === 'faster' ? 1 : -1)));
      this.hud.setSpeed(this.speed);
    }
  }

  private follow(id: number): void {
    if (!this.match.robots[id]) return;
    this.followId = id;
    this.view.highlight(id);
    this.hud.setFollow(this.followed);
  }

  frame(dt: number): void {
    if (this.state === 'done') return;
    const input = this.input.poll(); // also delivers gamepad button events
    if (this.controller) this.controller.latest = input;
    if (this.state === 'countdown') {
      const left = (this.countdownEnd - performance.now()) / 1000;
      this.hud.setCountdown(left > 0 ? String(Math.ceil(left)) : null);
      if (left <= 0) {
        this.state = 'running';
        this.match.start();
      }
    } else if (this.state === 'running') {
      // Match.advance caps one call at 0.25 s of sim time, so split fast-forward into chunks.
      let left = dt * (this.player ? 1 : this.speed);
      while (left > 1e-6 && !this.match.isOver) {
        const chunk = Math.min(left, 0.2);
        this.match.advance(chunk);
        left -= chunk;
      }
    }
    this.view.sync(this.match);
    this.rig.update(this.player ?? this.followed, dt);
    this.renderer.render(this.view.scene, this.rig.camera);
    this.hud.update();
    if (this.match.isOver && this.state === 'running') {
      this.state = 'done';
      const id = this.player?.id ?? null;
      setTimeout(() => this.app.showResults(this.def, this.match.getResult(), id), 1200);
    }
  }
}

// ------------------------------------------------------------------ HUD

type HudMode =
  { kind: 'play'; player: Robot; autoPilot: boolean } | { kind: 'watch'; brains: Map<number, BotBrain> };

/** Plain-language summary of what a bot is doing right now (spectator commentary). */
export function describeBot(m: Match, r: Robot, brain: BotBrain | undefined): string {
  if (r.brokenDown) return 'Broken down: the crew hopes it reboots';
  if (r.isOut(m.time)) return 'Lost power, coming back…';
  if (r.mechDown && !r.endgameDone && brain?.currentPlan.kind === 'defend')
    return `Mechanism broken: defending ${robotName(m.robots[brain.currentPlan.opponentId]!)}`;
  if (r.mechDown && !r.endgameDone && !r.action) return 'Mechanism broken: can drive, can’t score';
  if (r.endgameDone) {
    const a = m.game.endgame.find((e) => e.id === r.endgameDone!.actionId);
    return `${a?.name ?? 'Endgame'} done`;
  }
  const act = r.action;
  if (act) {
    const pct = Math.round((1 - act.remaining / act.total) * 100);
    if (act.kind === 'place')
      return `Placing on ${m.targets.get(act.targetId)?.target.name ?? 'target'}… ${pct}%`;
    const a = m.game.endgame.find((e) => e.id === act.actionId);
    return `${a?.name ?? 'Endgame'}… ${pct}%`;
  }
  if (m.phase === 'pre') return 'Waiting for the match to start';
  if (m.phase === 'transition') return 'Disabled until teleop';
  if (m.phase === 'post') return 'Match over';
  const p = brain?.currentPlan;
  if (!p) return 'Idle';
  const role = brain?.role === 'defense' ? ' (defender)' : '';
  const lapse = brain?.lapsing ? ' · not watching teammates' : '';
  return describePlan(m, p) + role + lapse;
}

function describePlan(m: Match, p: BotBrain['currentPlan']): string {
  switch (p.kind) {
    case 'acquire': {
      const piece = m.pieces[p.pieceId];
      return `Going for a ${piece?.type.name.toLowerCase() ?? 'game piece'}`;
    }
    case 'station':
      return `Loading at ${m.game.stations.find((s) => s.id === p.stationId)?.name ?? 'the human player station'}`;
    case 'place':
      return `Taking it to ${m.targets.get(p.targetId)?.target.name ?? 'a target'}`;
    case 'shoot':
      return `Lining up a shot at ${m.targets.get(p.targetId)?.target.name ?? 'a target'}`;
    case 'endgame':
      return `Heading for ${m.game.endgame.find((e) => e.id === p.actionId)?.name ?? 'the endgame'}`;
    case 'park':
      return 'Parking for the endgame';
    case 'defend': {
      const o = m.robots[p.opponentId];
      return o ? `Defending ${robotName(o)}` : 'Playing defense';
    }
    case 'idle':
      return 'Idle';
  }
}

class Hud {
  readonly root: HTMLElement;
  private readonly blue = h('div', { class: 'score blue' }, '0');
  private readonly red = h('div', { class: 'score red' }, '0');
  private readonly time = h('div', { class: 'time' }, '0:15');
  private readonly phase = h('div', { class: 'phase' }, 'pre-match');
  private readonly clock = h('div', { class: 'clock' }, this.time, this.phase);
  private readonly indicators = h('div', { class: 'indicators' });
  private readonly toasts = h('div', { class: 'toasts' });
  private readonly name = h('div', { class: 'name' });
  private readonly held = h('div', { class: 'held' });
  private readonly hint = h('div', { class: 'hint' });
  private readonly cam = h('div', { class: 'camlabel' });
  private readonly countdown = h('div', { class: 'countdown' });
  private pauseCard: HTMLElement | null = null;
  private lastIndicatorKey = '';
  private lastToastKey = '';
  /** Robot shown in the status panel: the player, or the followed robot when spectating. */
  private robot: Robot;
  private speed = 1;
  private camMode = 'driver';

  constructor(
    private readonly match: Match,
    private readonly mode: HudMode,
  ) {
    this.robot = mode.kind === 'play' ? mode.player : match.robots[0]!;
    this.root = h(
      'div',
      { class: `hud ${mode.kind === 'watch' ? 'spectating' : ''}` },
      h('div', { class: 'scorebar' }, this.blue, this.clock, this.red),
      this.indicators,
      this.toasts,
      h('div', { class: 'status' }, this.name, this.held, this.hint),
      this.cam,
      this.countdown,
    );
    this.renderName();
  }

  private renderName(): void {
    const r = this.robot;
    const color = `#${ALLIANCE_COLOR[r.alliance].toString(16).padStart(6, '0')}`;
    this.name.setAttribute('style', `color:${color}`);
    this.name.textContent =
      this.mode.kind === 'play'
        ? `You: ${robotName(r)} · ${r.archetype.name}`
        : `Following ${robotName(r)} · ${r.archetype.name}`;
  }

  setFollow(r: Robot): void {
    this.robot = r;
    this.renderName();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    this.renderCam();
  }

  setCamera(mode: string): void {
    this.camMode = mode;
    this.renderCam();
  }

  private renderCam(): void {
    const names: Record<string, string> = {
      driver: 'driver station',
      chase: 'chase',
      overhead: 'overhead',
      sideline: 'sideline',
    };
    const cam = `Camera: ${names[this.camMode] ?? this.camMode} (C)`;
    this.cam.textContent =
      this.mode.kind === 'watch' ? `${cam} · Speed ${this.speed}× ([ ]) · Follow: 1-6 / Tab` : cam;
  }

  setCountdown(text: string | null): void {
    this.countdown.textContent = text ?? '';
  }

  setPaused(paused: boolean, toMenu: () => void): void {
    this.pauseCard?.remove();
    this.pauseCard = null;
    if (!paused) return;
    this.pauseCard = h(
      'div',
      { class: 'overlay', style: 'pointer-events:auto' },
      h(
        'div',
        { class: 'card', style: 'width:min(360px,100%);text-align:center' },
        h('h1', {}, 'Paused'),
        h('p', { class: 'sub' }, 'Press Esc or P to resume.'),
        h(
          'div',
          { class: 'row', style: 'justify-content:center' },
          h('button', { onclick: toMenu }, 'Quit to menu'),
        ),
      ),
    );
    this.root.append(this.pauseCard);
  }

  update(): void {
    const m = this.match;
    this.blue.textContent = String(m.ledger.total('blue'));
    this.red.textContent = String(m.ledger.total('red'));
    const phaseName: Record<string, string> = {
      pre: 'pre-match',
      auto: 'autonomous',
      transition: 'teleop in…',
      teleop: m.isEndgame ? 'endgame' : 'teleop',
      post: 'final',
    };
    this.time.textContent = fmtTime(m.remaining);
    this.phase.textContent = phaseName[m.phase] ?? m.phase;
    this.clock.classList.toggle('endgame', m.isEndgame);

    const ind = [...m.indicators.entries()];
    const indKey = ind.map(([k, v]) => `${k}=${v}`).join('|');
    if (indKey !== this.lastIndicatorKey) {
      this.lastIndicatorKey = indKey;
      this.indicators.replaceChildren(
        ...ind.map(([k, v]) =>
          h(
            'span',
            { class: `chip ${k.startsWith('blue') ? 'blue' : k.startsWith('red') ? 'red' : ''}` },
            `${k}: ${v}`,
          ),
        ),
      );
    }
    const recent = m.announcements.filter((a) => m.time - a.time < 4).slice(-3);
    const toastKey = recent.map((a) => `${a.time}${a.text}`).join('|');
    if (toastKey !== this.lastToastKey) {
      this.lastToastKey = toastKey;
      this.toasts.replaceChildren(
        ...recent.map((a) => h('div', { class: `toast ${a.alliance ?? ''}` }, a.text)),
      );
    }

    const r = this.robot;
    const cap = r.totalCapacity;
    const colors = new Map(m.def.pieces.map((p) => [p.id, p.color]));
    this.held.replaceChildren(
      ...Array.from({ length: cap }, (_, i) => {
        const t = r.held[i];
        return t
          ? h('span', { style: `background:${colors.get(t)}`, title: t })
          : h('span', { class: 'empty' });
      }),
    );
    if (this.mode.kind === 'watch') {
      this.hint.textContent = `${describeBot(m, r, this.mode.brains.get(r.id))} · ${m.ledger.byRobot(r.id)} pts`;
    } else this.hint.innerHTML = this.hintHtml(this.mode.autoPilot);
  }

  private hintHtml(autoPilot: boolean): string {
    const m = this.match;
    const r = this.robot;
    if (m.phase === 'pre') return 'Get ready…';
    if (m.phase === 'transition') return 'Robots disabled: teleop starts soon';
    if (m.phase === 'post') return 'Match over';
    if (r.brokenDown) return '<b>Your robot broke down.</b> It may come back online if a reset works.';
    if (r.isOut(m.time)) return '<b>Lost power!</b> Your robot is back in a few seconds.';
    if (r.mechDown && !r.endgameDone && !r.action)
      return '<b>Mechanism failure.</b> You can still drive: play defense or get ready for the endgame.';
    if (m.phase === 'auto' && autoPilot) return '<b>Auto routine running.</b> You take over in teleop.';
    if (r.endgameDone) {
      const a = m.game.endgame.find((e) => e.id === r.endgameDone!.actionId);
      return `<b>${a?.name ?? 'Endgame'}</b> complete. Robot locked.`;
    }
    const act = r.action;
    if (act) {
      const pct = Math.round((1 - act.remaining / act.total) * 100);
      if (act.kind === 'place') {
        const t = m.targets.get(act.targetId)?.target;
        return `Placing on <b>${t?.name ?? ''}</b>… ${pct}%`;
      }
      const a = m.game.endgame.find((e) => e.id === act.actionId);
      return `${a?.name ?? 'Endgame'}… ${pct}%`;
    }
    const lines: string[] = [];
    const eg = m.availableEndgame(r)[0];
    if (eg) lines.push(`<b>G</b>: ${eg.action.name} (+${eg.action.points})`);
    const place = m.placeOptions(r)[0];
    if (place) lines.push(`<b>Space</b>: place on ${place.target.name}`);
    else {
      const shot = m.shotOptions(r)[0];
      if (shot) lines.push(`<b>Space</b>: shoot at ${shot.target.name} (${shot.distance.toFixed(1)} m)`);
    }
    if (m.stationsFor(r).length) lines.push('At human player station: intake to receive');
    if (!lines.length) lines.push(r.held.length ? 'Drive to a scoring location' : 'Collect a game piece');
    return lines.join('<br>');
  }
}

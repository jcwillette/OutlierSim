import * as THREE from 'three';
import { CameraRig } from '../engine/render/cameras.ts';
import { ALLIANCE_COLOR, FieldView } from '../engine/render/fieldView.ts';
import { InputManager, KEY_HELP, PAD_HELP, PlayerController } from '../engine/input/input.ts';
import { Match, initPhysics, type MatchResult, type Robot } from '../engine/sim/match.ts';
import type { Alliance, GameDefinition } from '../engine/sim/types.ts';
import { GAMES } from '../games/index.ts';
import { BotBrain, attachBots, type Difficulty } from '../engine/ai/bot.ts';

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
    else if (k === 'style') el.setAttribute('style', String(v));
    else (el as unknown as Record<string, unknown>)[k] = v;
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

const fmtTime = (s: number) => {
  const t = Math.ceil(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

// ------------------------------------------------------------------ settings

export interface Setup {
  gameId: string;
  alliance: Alliance;
  station: number;
  archetype: string;
  autoIntake: boolean;
  partners: Difficulty;
  opponents: Difficulty;
  /** Your robot runs the bot AI during autonomous (like a programmed auto routine). */
  autoPilot: boolean;
  /** Other robots: all the game's default archetype, or a mix of every archetype. */
  botRobots: 'default' | 'mixed';
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
    const def = games.find((g) => g.id === saved.gameId) ?? games[0]!;
    this.setup = {
      gameId: def.id,
      alliance: saved.alliance ?? 'blue',
      station: saved.station ?? 0,
      archetype: def.archetypes.some((a) => a.id === saved.archetype)
        ? saved.archetype!
        : def.defaultArchetype,
      autoIntake: saved.autoIntake ?? true,
      partners: saved.partners ?? 'normal',
      opponents: saved.opponents ?? 'normal',
      autoPilot: saved.autoPilot ?? true,
      botRobots: saved.botRobots ?? 'mixed',
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

    const card = h(
      'div',
      { class: 'card' },
      h('h1', {}, 'OutlierSim'),
      h(
        'p',
        { class: 'sub' },
        'Drive one robot in a 3v3 match and get a feel for the game before you build.',
      ),
      h('h2', {}, 'Game'),
      gameSel,
      h('p', { class: 'summary' }, def.summary),
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
        this.selectField(
          'Robot types',
          this.setup.botRobots,
          [
            ['mixed', 'Mixed'],
            ['default', 'All default'],
          ],
          (v) => (this.setup.botRobots = v),
        ),
      ),
      h('h2', {}, 'Controls'),
      h(
        'div',
        { class: 'row', style: 'align-items:flex-start;gap:28px' },
        keyRows(KEY_HELP),
        keyRows(PAD_HELP),
      ),
      h(
        'div',
        { class: 'row end' },
        h('button', { class: 'primary', onclick: () => void this.start() }, 'Start match'),
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
    const def = this.games().find((g) => g.id === this.setup.gameId)!;
    this.session?.dispose();
    this.input.autoIntake = this.setup.autoIntake;
    this.session = new Session(this, def, this.setup, this.input, this.renderer);
    this.resize();
  }

  showResults(def: GameDefinition, result: MatchResult, playerId: number): void {
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
        h('button', { class: 'primary', onclick: () => void this.start() }, 'Play again'),
      ),
    );
    this.setOverlay(h('div', { class: 'overlay' }, card));
  }
}

// ------------------------------------------------------------------ session

class Session {
  readonly match: Match;
  readonly view: FieldView;
  readonly rig: CameraRig;
  readonly player: Robot;
  private readonly controller: PlayerController;
  private state: 'countdown' | 'running' | 'paused' | 'done' = 'countdown';
  private countdown = 3;
  private readonly hud: Hud;

  constructor(
    private readonly app: App,
    readonly def: GameDefinition,
    setup: Setup,
    private readonly input: InputManager,
    private readonly renderer: THREE.WebGLRenderer,
  ) {
    const playerId = (setup.alliance === 'blue' ? 0 : 3) + setup.station;
    const archetypes: Record<number, string> = { [playerId]: setup.archetype };
    if (setup.botRobots === 'mixed') {
      // Deal out every archetype so each alliance sees a variety of robots.
      let k = Math.floor(Math.random() * def.archetypes.length);
      for (let id = 0; id < 6; id++)
        if (id !== playerId) archetypes[id] = def.archetypes[k++ % def.archetypes.length]!.id;
    }
    this.match = new Match(def, { seed: (Math.random() * 2 ** 31) | 0, archetypes });
    this.player = this.match.robots[playerId]!;
    this.view = new FieldView(this.match.game, playerId);
    this.rig = new CameraRig(this.match, setup.alliance, setup.station);
    this.controller = new PlayerController(input, () => this.rig.driveYaw);
    attachBots(this.match, { partners: setup.partners, opponents: setup.opponents, playerId });
    const autoBrain = new BotBrain({ difficulty: 'hard' });
    const manual = this.controller;
    // During auto the player's robot optionally runs the bot AI as its "auto routine".
    this.player.controller = setup.autoPilot
      ? { command: (m, r, dt) => (m.phase === 'auto' ? autoBrain : manual).command(m, r, dt) }
      : manual;
    this.hud = new Hud(this.match, this.player, setup.autoPilot);
    app.setOverlay(this.hud.root);
  }

  dispose(): void {
    this.state = 'done';
  }

  onButton(e: 'camera' | 'pause' | 'help'): void {
    if (e === 'camera') this.hud.setCamera(this.rig.cycle());
    if (e === 'pause' && (this.state === 'running' || this.state === 'paused')) {
      this.state = this.state === 'running' ? 'paused' : 'running';
      this.hud.setPaused(this.state === 'paused', () => this.app.showMenu());
    }
  }

  frame(dt: number): void {
    if (this.state === 'done') return;
    this.controller.latest = this.input.poll();
    if (this.state === 'countdown') {
      this.countdown -= dt;
      this.hud.setCountdown(this.countdown > 0 ? String(Math.ceil(this.countdown)) : null);
      if (this.countdown <= 0) {
        this.state = 'running';
        this.match.start();
      }
    } else if (this.state === 'running') {
      this.match.advance(dt);
    }
    this.view.sync(this.match);
    this.rig.update(this.player, dt);
    this.renderer.render(this.view.scene, this.rig.camera);
    this.hud.update();
    if (this.match.isOver && this.state === 'running') {
      this.state = 'done';
      setTimeout(() => this.app.showResults(this.def, this.match.getResult(), this.player.id), 1200);
    }
  }
}

// ------------------------------------------------------------------ HUD

class Hud {
  readonly root: HTMLElement;
  private readonly blue = h('div', { class: 'score blue' }, '0');
  private readonly red = h('div', { class: 'score red' }, '0');
  private readonly time = h('div', { class: 'time' }, '0:15');
  private readonly phase = h('div', { class: 'phase' }, 'pre-match');
  private readonly clock = h('div', { class: 'clock' }, this.time, this.phase);
  private readonly indicators = h('div', { class: 'indicators' });
  private readonly toasts = h('div', { class: 'toasts' });
  private readonly held = h('div', { class: 'held' });
  private readonly hint = h('div', { class: 'hint' });
  private readonly cam = h('div', { class: 'camlabel' }, 'Camera: driver station (C)');
  private readonly countdown = h('div', { class: 'countdown' });
  private pauseCard: HTMLElement | null = null;
  private lastIndicatorKey = '';
  private lastToastKey = '';

  constructor(
    private readonly match: Match,
    private readonly player: Robot,
    private readonly autoPilot: boolean,
  ) {
    this.root = h(
      'div',
      { class: 'hud' },
      h('div', { class: 'scorebar' }, this.blue, this.clock, this.red),
      this.indicators,
      this.toasts,
      h(
        'div',
        { class: 'status' },
        h(
          'div',
          { class: 'name', style: `color:#${ALLIANCE_COLOR[player.alliance].toString(16).padStart(6, '0')}` },
          `You: ${player.alliance === 'blue' ? 'Blue' : 'Red'} ${player.station + 1} · ${player.archetype.name}`,
        ),
        this.held,
        this.hint,
      ),
      this.cam,
      this.countdown,
    );
  }

  setCamera(mode: string): void {
    const names: Record<string, string> = { driver: 'driver station', chase: 'chase', overhead: 'overhead' };
    this.cam.textContent = `Camera: ${names[mode] ?? mode} (C)`;
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

    const r = this.player;
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
    this.hint.innerHTML = this.hintHtml();
  }

  private hintHtml(): string {
    const m = this.match;
    const r = this.player;
    if (m.phase === 'pre') return 'Get ready…';
    if (m.phase === 'transition') return 'Robots disabled: teleop starts soon';
    if (m.phase === 'post') return 'Match over';
    if (m.phase === 'auto' && this.autoPilot) return '<b>Auto routine running.</b> You take over in teleop.';
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

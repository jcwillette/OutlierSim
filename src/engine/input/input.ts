import { IDLE, type Match, type Robot, type RobotCommand, type RobotController } from '../sim/match.ts';

/** Raw driver intent, independent of camera or field orientation. */
export interface DriverInput {
  /** Screen-relative translation: +x right, +y forward/away from driver. -1..1 */
  moveX: number;
  moveY: number;
  /** +1 = counter-clockwise (turn left). */
  turn: number;
  intake: boolean;
  score: boolean;
  endgame: boolean;
  eject: boolean;
  /** Lob the held piece to the nearest passing spot (games with `passing`). */
  pass: boolean;
}

export type ButtonEvent =
  | 'camera'
  | 'pause'
  | 'help'
  /** Switch the piece to ask for at a human player station that offers a choice. */
  | 'piece'
  /** Switch which target (level) Space places on when there are several here. */
  | 'level'
  /** Spectator: follow the next / previous robot, or robot 1-6 (blue 1-3, red 1-3). */
  | 'next'
  | 'prev'
  | `follow${0 | 1 | 2 | 3 | 4 | 5}`
  /** Spectator: playback speed up / down. */
  | 'faster'
  | 'slower';

export const KEY_HELP: Array<[string, string]> = [
  ['W A S D', 'drive (field-oriented)'],
  ['← → or Q E', 'rotate'],
  ['Space', 'score: place or shoot (auto-aims)'],
  ['Shift', 'intake (when auto-intake is off)'],
  ['G', 'endgame action (climb etc.)'],
  ['R', 'eject a piece'],
  ['T', 'pass: lob a piece to a teammate (games with passing)'],
  ['F', 'switch the piece to ask for (stations with a choice)'],
  ['V', 'switch the level / target Space places on (when there are several)'],
  ['C', 'cycle camera'],
  ['Esc / P', 'pause'],
];

export const SPECTATOR_KEY_HELP: Array<[string, string]> = [
  ['1-3 / 4-6', 'follow Blue 1-3 / Red 1-3'],
  ['Tab', 'follow the next robot'],
  ['C', 'cycle camera'],
  ['[ ]', 'slower / faster (0.25x-4x)'],
  ['Esc / P', 'pause'],
];

export const SPECTATOR_PAD_HELP: Array<[string, string]> = [
  ['LB / RB', 'previous / next robot'],
  ['Y', 'camera'],
  ['D-pad ↓ / ↑', 'slower / faster'],
  ['Start', 'pause'],
];

export const PAD_HELP: Array<[string, string]> = [
  ['Left stick', 'drive'],
  ['Right stick', 'rotate'],
  ['RT', 'score'],
  ['LT', 'intake'],
  ['A', 'endgame'],
  ['B', 'eject'],
  ['Left stick press', 'pass (games with passing)'],
  ['X', 'switch the piece to ask for'],
  ['D-pad ← →', 'switch the level to place on'],
  ['Y', 'camera'],
  ['Start', 'pause'],
];

const DEADBAND = 0.12;
const db = (v: number) => (Math.abs(v) < DEADBAND ? 0 : (v - Math.sign(v) * DEADBAND) / (1 - DEADBAND));

/** Keyboard + Gamepad API. Call `poll()` once per frame. */
export class InputManager {
  private readonly keys = new Set<string>();
  private readonly listeners: Array<(e: ButtonEvent) => void> = [];
  private prevPadButtons: boolean[] = [];
  autoIntake = true;

  constructor(private readonly target: Window = window) {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.onBlur);
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.onBlur);
  }

  on(fn: (e: ButtonEvent) => void): void {
    this.listeners.push(fn);
  }

  private emit(e: ButtonEvent): void {
    for (const l of this.listeners) l(e);
  }

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (
      (e.target as HTMLElement | null)?.tagName === 'INPUT' ||
      (e.target as HTMLElement | null)?.tagName === 'SELECT'
    )
      return;
    if (!e.repeat) {
      if (e.code === 'KeyC') this.emit('camera');
      if (e.code === 'KeyF') this.emit('piece');
      if (e.code === 'KeyV') this.emit('level');
      if (e.code === 'Escape' || e.code === 'KeyP') this.emit('pause');
      if (e.code === 'KeyH') this.emit('help');
      if (e.code === 'Tab') this.emit(e.shiftKey ? 'prev' : 'next');
      if (e.code === 'BracketRight' || e.code === 'Equal' || e.code === 'NumpadAdd') this.emit('faster');
      if (e.code === 'BracketLeft' || e.code === 'Minus' || e.code === 'NumpadSubtract') this.emit('slower');
      const digit = /^(?:Digit|Numpad)([1-6])$/.exec(e.code);
      if (digit) this.emit(`follow${(Number(digit[1]) - 1) as 0 | 1 | 2 | 3 | 4 | 5}`);
    }
    if (e.code === 'Tab') e.preventDefault();
    this.keys.add(e.code);
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  };
  private readonly onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private readonly onBlur = () => this.keys.clear();

  private down(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  poll(): DriverInput {
    let moveX = (this.down('KeyD') ? 1 : 0) - (this.down('KeyA') ? 1 : 0);
    let moveY = (this.down('KeyW') ? 1 : 0) - (this.down('KeyS') ? 1 : 0);
    let turn = (this.down('ArrowLeft', 'KeyQ') ? 1 : 0) - (this.down('ArrowRight', 'KeyE') ? 1 : 0);
    let intake = this.down('ShiftLeft', 'ShiftRight');
    let score = this.down('Space');
    let endgame = this.down('KeyG');
    let eject = this.down('KeyR');
    let pass = this.down('KeyT');

    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find((p) => p?.connected);
    if (pad) {
      const ax = (i: number) => db(pad.axes[i] ?? 0);
      const btn = (i: number) => {
        const b = pad.buttons[i];
        return !!b && (b.pressed || b.value > 0.4);
      };
      if (Math.abs(ax(0)) + Math.abs(ax(1)) > 0) {
        moveX = ax(0);
        moveY = -ax(1);
      }
      if (Math.abs(ax(2)) > 0) turn = -ax(2);
      intake ||= btn(6);
      score ||= btn(7);
      endgame ||= btn(0);
      eject ||= btn(1);
      pass ||= btn(10);
      const pressed = pad.buttons.map((_, i) => btn(i));
      const edge = (i: number) => pressed[i] && !this.prevPadButtons[i];
      if (edge(2)) this.emit('piece');
      if (edge(14) || edge(15)) this.emit('level');
      if (edge(3)) this.emit('camera');
      if (edge(4)) this.emit('prev');
      if (edge(5)) this.emit('next');
      if (edge(12)) this.emit('faster');
      if (edge(13)) this.emit('slower');
      if (edge(9)) this.emit('pause');
      this.prevPadButtons = pressed;
    }
    return { moveX, moveY, turn, intake, score, endgame, eject, pass };
  }
}

/**
 * Turns driver input into a field-relative RobotCommand. `driveYaw()` gives the field heading that
 * "forward" points to (from the active camera), which makes driving field-oriented from the driver's view.
 */
export class PlayerController implements RobotController {
  /** The piece to ask for at a station that offers a choice (switched with F / X). */
  pieceType: string | undefined;
  /**
   * Which of the targets the robot could place on here Space uses: 0 = the highest-value one, then
   * the next (switched with V / D-pad). Wraps around when there are fewer.
   */
  placeRank = 0;
  latest: DriverInput = {
    moveX: 0,
    moveY: 0,
    turn: 0,
    intake: false,
    score: false,
    endgame: false,
    eject: false,
    pass: false,
  };

  constructor(
    private readonly input: InputManager,
    private readonly driveYaw: () => number,
  ) {}

  /** The place option Space would use right now, if any (also shown on the HUD). */
  placeChoice(m: Match, r: Robot): ReturnType<Match['placeOptions']>[number] | undefined {
    const opts = m.placeOptions(r);
    return opts.length ? opts[this.placeRank % opts.length] : undefined;
  }

  command(m: Match, r: Robot): RobotCommand {
    const i = this.latest;
    const yaw = this.driveYaw();
    // forward = (cos yaw, sin yaw); right = (sin yaw, -cos yaw)
    const vx = i.moveY * Math.cos(yaw) + i.moveX * Math.sin(yaw);
    const vy = i.moveY * Math.sin(yaw) - i.moveX * Math.cos(yaw);
    const wantsIntake = i.intake || (this.input.autoIntake && r.held.length < r.totalCapacity);
    return {
      ...IDLE,
      vx,
      vy,
      omega: i.turn,
      intake: wantsIntake,
      score: i.score,
      endgame: i.endgame,
      eject: i.eject,
      ...(i.pass && !i.score ? passTo(m.passSpot(r)) : {}),
      ...(this.pieceType ? { pieceType: this.pieceType } : {}),
      // Place on the chosen level (only matters where several targets share a spot).
      ...(i.score && this.placeRank > 0 ? placeTarget(this.placeChoice(m, r)) : {}),
    };
  }
}

const passTo = (p: { x: number; y: number } | null): { pass?: { x: number; y: number } } =>
  p ? { pass: p } : {};

const placeTarget = (o: { target: { id: string } } | undefined): { targetId?: string } =>
  o ? { targetId: o.target.id } : {};

import type { Removable } from '../../lib/positions';

export type Side = 'white' | 'black' | 'random';

export interface Settings {
  /** Seconds the position stays visible, counted down on screen. */
  memoriseSeconds: number;
  /** Seconds to find the square once the piece is gone; then the square is revealed. */
  guessSeconds: number;
  /** How long the board is hidden between memorising and guessing. */
  maskMs: number;
  minPieces: number;
  maxPieces: number;
  removable: Removable;
  /** Which colour sits at the bottom of the board. */
  side: Side;
  coordinates: boolean;
  /** Wrong square guesses allowed before the square is revealed. */
  attempts: number;
  speedBonus: boolean;
  rounds: number;
}

export type PresetName = 'easy' | 'medium' | 'hard';

export const LIMITS = {
  memoriseSeconds: [3, 120],
  guessSeconds: [2, 30],
  maskMs: [0, 3000],
  pieces: [4, 32],
  attempts: [1, 5],
  rounds: [5, 50],
} as const;

export const PRESETS: Record<PresetName, Settings> = {
  easy: {
    memoriseSeconds: 10,
    guessSeconds: 5,
    maskMs: 1000,
    minPieces: 4,
    maxPieces: 10,
    removable: 'any',
    side: 'white',
    coordinates: true,
    attempts: 3,
    speedBonus: false,
    rounds: 10,
  },
  medium: {
    memoriseSeconds: 10,
    guessSeconds: 5,
    maskMs: 1000,
    minPieces: 10,
    maxPieces: 20,
    removable: 'any',
    side: 'random',
    coordinates: true,
    attempts: 2,
    speedBonus: false,
    rounds: 10,
  },
  hard: {
    memoriseSeconds: 10,
    guessSeconds: 5,
    maskMs: 1000,
    minPieces: 20,
    maxPieces: 32,
    removable: 'any',
    side: 'random',
    coordinates: false,
    attempts: 1,
    speedBonus: true,
    rounds: 10,
  },
};

const PRESET_NAMES: PresetName[] = ['easy', 'medium', 'hard'];
const KEYS = Object.keys(PRESETS.easy) as (keyof Settings)[];

/** The preset these settings equal, or "custom". */
export function matchPreset(s: Settings): PresetName | 'custom' {
  return PRESET_NAMES.find((name) => KEYS.every((k) => PRESETS[name][k] === s[k])) ?? 'custom';
}

function num(value: unknown, [min, max]: readonly [number, number], fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Turns anything (for example, stale saved settings) into valid settings. */
export function sanitize(raw: unknown): Settings {
  const d = PRESETS.easy;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ...d };
  const r = raw as Record<string, unknown>;
  const a = num(r.minPieces, LIMITS.pieces, d.minPieces);
  const b = num(r.maxPieces, LIMITS.pieces, d.maxPieces);
  return {
    memoriseSeconds: num(r.memoriseSeconds, LIMITS.memoriseSeconds, d.memoriseSeconds),
    guessSeconds: num(r.guessSeconds, LIMITS.guessSeconds, d.guessSeconds),
    maskMs: num(r.maskMs, LIMITS.maskMs, d.maskMs),
    minPieces: Math.min(a, b),
    maxPieces: Math.max(a, b),
    removable: oneOf(r.removable, ['any', 'pieces', 'pawns'], d.removable),
    side: oneOf(r.side, ['white', 'black', 'random'], d.side),
    coordinates: bool(r.coordinates, d.coordinates),
    attempts: num(r.attempts, LIMITS.attempts, d.attempts),
    speedBonus: bool(r.speedBonus, d.speedBonus),
    rounds: num(r.rounds, LIMITS.rounds, d.rounds),
  };
}

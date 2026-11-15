/** Which colour sits at the bottom: the side to move at the start, or a fixed or random colour. */
export type Side = 'toMove' | 'white' | 'black' | 'random';

export interface Settings {
  /** Moves each side makes in the sequence; the user replays twice this many. */
  movesPerSide: number;
  /** Seconds to look at the starting position before the moves play. */
  lookSeconds: number;
  /** Milliseconds between moves while they play. */
  moveMs: number;
  side: Side;
  coordinates: boolean;
  rounds: number;
  minPieces: number;
  maxPieces: number;
}

export type PresetName = 'easy' | 'medium' | 'hard';

export const LIMITS = {
  movesPerSide: [1, 9],
  lookSeconds: [0, 10],
  moveMs: [500, 3000],
  rounds: [5, 50],
  pieces: [4, 32],
} as const;
const MOVE_MS_STEP = 250;

const EASY: Settings = {
  movesPerSide: 3,
  lookSeconds: 3,
  moveMs: 1000,
  side: 'toMove',
  coordinates: true,
  rounds: 10,
  minPieces: 4,
  maxPieces: 32,
};

export const PRESETS: Record<PresetName, Settings> = {
  easy: EASY,
  medium: { ...EASY, movesPerSide: 6 },
  hard: { ...EASY, movesPerSide: 9, coordinates: false },
};

const PRESET_NAMES: PresetName[] = ['easy', 'medium', 'hard'];
const KEYS = Object.keys(EASY) as (keyof Settings)[];

/** The preset these settings equal, or "custom". */
export function matchPreset(s: Settings): PresetName | 'custom' {
  return PRESET_NAMES.find((name) => KEYS.every((k) => PRESETS[name][k] === s[k])) ?? 'custom';
}

function num(value: unknown, [min, max]: readonly [number, number], fallback: number, step = 1): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value / step) * step));
}

/** Turns anything (for example, stale saved settings) into valid settings. */
export function sanitize(raw: unknown): Settings {
  const d = EASY;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ...d };
  const r = raw as Record<string, unknown>;
  const a = num(r.minPieces, LIMITS.pieces, d.minPieces);
  const b = num(r.maxPieces, LIMITS.pieces, d.maxPieces);
  return {
    movesPerSide: num(r.movesPerSide, LIMITS.movesPerSide, d.movesPerSide),
    lookSeconds: num(r.lookSeconds, LIMITS.lookSeconds, d.lookSeconds),
    moveMs: num(r.moveMs, LIMITS.moveMs, d.moveMs, MOVE_MS_STEP),
    side: (['toMove', 'white', 'black', 'random'] as const).includes(r.side as Side) ? (r.side as Side) : d.side,
    coordinates: typeof r.coordinates === 'boolean' ? r.coordinates : d.coordinates,
    rounds: num(r.rounds, LIMITS.rounds, d.rounds),
    minPieces: Math.min(a, b),
    maxPieces: Math.max(a, b),
  };
}

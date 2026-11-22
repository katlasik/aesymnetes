/** Which colour sits at the bottom: the side to move, or a fixed or random colour. */
export type Side = 'toMove' | 'white' | 'black' | 'random';

export interface Settings {
  /** Seconds to find every hanging piece in a position. */
  seconds: number;
  minPieces: number;
  maxPieces: number;
  side: Side;
  coordinates: boolean;
  rounds: number;
}

export type PresetName = 'easy' | 'medium' | 'hard';

export const LIMITS = {
  seconds: [5, 60],
  pieces: [4, 32],
  rounds: [5, 50],
} as const;

const EASY: Settings = {
  seconds: 30,
  minPieces: 4,
  maxPieces: 14,
  side: 'toMove',
  coordinates: true,
  rounds: 10,
};

export const PRESETS: Record<PresetName, Settings> = {
  easy: EASY,
  medium: { ...EASY, seconds: 20, minPieces: 10, maxPieces: 24 },
  hard: { ...EASY, seconds: 15, minPieces: 18, maxPieces: 32, side: 'random', coordinates: false },
};

const PRESET_NAMES: PresetName[] = ['easy', 'medium', 'hard'];
const KEYS = Object.keys(EASY) as (keyof Settings)[];

/** The preset these settings equal, or "custom". */
export function matchPreset(s: Settings): PresetName | 'custom' {
  return PRESET_NAMES.find((name) => KEYS.every((k) => PRESETS[name][k] === s[k])) ?? 'custom';
}

function num(value: unknown, [min, max]: readonly [number, number], fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Turns anything (for example, stale saved settings) into valid settings. */
export function sanitize(raw: unknown): Settings {
  const d = EASY;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ...d };
  const r = raw as Record<string, unknown>;
  const a = num(r.minPieces, LIMITS.pieces, d.minPieces);
  const b = num(r.maxPieces, LIMITS.pieces, d.maxPieces);
  return {
    seconds: num(r.seconds, LIMITS.seconds, d.seconds),
    minPieces: Math.min(a, b),
    maxPieces: Math.max(a, b),
    side: (['toMove', 'white', 'black', 'random'] as const).includes(r.side as Side) ? (r.side as Side) : d.side,
    coordinates: typeof r.coordinates === 'boolean' ? r.coordinates : d.coordinates,
    rounds: num(r.rounds, LIMITS.rounds, d.rounds),
  };
}

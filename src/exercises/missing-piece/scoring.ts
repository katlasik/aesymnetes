import type { Color, Role, Target } from '../../lib/positions';

export interface PieceGuess {
  color: Color;
  role: Role;
}

export interface RoundScore {
  square: number;
  piece: number;
  bonus: number;
  total: number;
}

export const SQUARE_POINTS = 100;
export const PIECE_PART_POINTS = 25;
export const MAX_SPEED_BONUS = 50;
export const SPEED_BONUS_WINDOW_MS = 10_000;

/** 100 on the first try, falling in equal steps per wrong guess; 0 if the square had to be revealed. */
export function squarePoints(wrongGuesses: number, attempts: number, revealed: boolean): number {
  if (revealed) return 0;
  return Math.round((SQUARE_POINTS * (attempts - wrongGuesses)) / attempts);
}

/** 25 for the right colour plus 25 for the right type. */
export function piecePoints(guess: PieceGuess, target: Target): number {
  return (
    (guess.color === target.color ? PIECE_PART_POINTS : 0) +
    (guess.role === target.role ? PIECE_PART_POINTS : 0)
  );
}

/** Up to 50, falling linearly to 0 over ten seconds. */
export function speedBonus(elapsedMs: number): number {
  return Math.round(MAX_SPEED_BONUS * Math.max(0, 1 - elapsedMs / SPEED_BONUS_WINDOW_MS));
}

export function scoreRound(a: {
  wrongGuesses: number;
  attempts: number;
  revealed: boolean;
  guess: PieceGuess;
  target: Target;
  elapsedMs: number;
  speedBonusEnabled: boolean;
}): RoundScore {
  const square = squarePoints(a.wrongGuesses, a.attempts, a.revealed);
  const piece = piecePoints(a.guess, a.target);
  const earnsBonus = a.speedBonusEnabled && !a.revealed && piece === 2 * PIECE_PART_POINTS;
  const bonus = earnsBonus ? speedBonus(a.elapsedMs) : 0;
  return { square, piece, bonus, total: square + piece + bonus };
}

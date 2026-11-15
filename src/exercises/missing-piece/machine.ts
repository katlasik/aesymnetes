import type { Color, Position, Target } from '../../lib/positions';
import { scoreRound, type PieceGuess, type RoundScore } from './scoring';
import type { Settings } from './settings';

export type Phase =
  | 'idle'
  | 'memorise'
  | 'mask'
  | 'guessSquare'
  | 'guessPiece'
  | 'result'
  | 'summary';

export interface NewRound {
  position: Position;
  target: Target;
  /** Colour at the bottom of the board for this round. */
  orientation: Color;
}

export interface Round extends NewRound {
  wrongSquares: string[];
  /** True when attempts ran out and the square was shown. */
  revealed: boolean;
  guessStartedAt: number | null;
  guess: PieceGuess | null;
  score: RoundScore | null;
}

export interface State {
  phase: Phase;
  settings: Settings;
  round: Round | null;
  /** 0-based index of the current round. */
  roundIndex: number;
  /** Finished rounds of this session. */
  history: Round[];
  usedIds: string[];
}

export type Action =
  | { type: 'setSettings'; settings: Settings }
  | { type: 'start'; round: NewRound }
  | { type: 'ready'; now: number }
  | { type: 'maskDone'; now: number }
  | { type: 'clickSquare'; square: string }
  | { type: 'submitPiece'; guess: PieceGuess; now: number }
  | { type: 'next'; round: NewRound | null }
  | { type: 'quit' };

export function initialState(settings: Settings): State {
  return { phase: 'idle', settings, round: null, roundIndex: 0, history: [], usedIds: [] };
}

function freshRound(r: NewRound): Round {
  return { ...r, wrongSquares: [], revealed: false, guessStartedAt: null, guess: null, score: null };
}

/**
 * Pure transition function. The clock and all randomness arrive through actions.
 * An action that does not apply in the current phase returns the same state object.
 */
export function reduce(state: State, action: Action): State {
  const { phase, round, settings } = state;
  const betweenSessions = phase === 'idle' || phase === 'summary';

  switch (action.type) {
    case 'setSettings':
      return betweenSessions ? { ...state, settings: action.settings } : state;

    case 'start':
      if (!betweenSessions) return state;
      return {
        ...state,
        phase: 'memorise',
        round: freshRound(action.round),
        roundIndex: 0,
        history: [],
        usedIds: [action.round.position.id],
      };

    case 'ready':
      if (phase !== 'memorise' || !round) return state;
      return settings.maskMs > 0
        ? { ...state, phase: 'mask' }
        : { ...state, phase: 'guessSquare', round: { ...round, guessStartedAt: action.now } };

    case 'maskDone':
      if (phase !== 'mask' || !round) return state;
      return { ...state, phase: 'guessSquare', round: { ...round, guessStartedAt: action.now } };

    case 'clickSquare': {
      if (phase !== 'guessSquare' || !round) return state;
      if (action.square === round.target.square) return { ...state, phase: 'guessPiece' };
      if (round.wrongSquares.includes(action.square)) return state;
      const wrongSquares = [...round.wrongSquares, action.square];
      const revealed = wrongSquares.length >= settings.attempts;
      return {
        ...state,
        phase: revealed ? 'guessPiece' : 'guessSquare',
        round: { ...round, wrongSquares, revealed },
      };
    }

    case 'submitPiece': {
      if (phase !== 'guessPiece' || !round) return state;
      const score = scoreRound({
        wrongGuesses: round.wrongSquares.length,
        attempts: settings.attempts,
        revealed: round.revealed,
        guess: action.guess,
        target: round.target,
        elapsedMs: action.now - (round.guessStartedAt ?? action.now),
        speedBonusEnabled: settings.speedBonus,
      });
      return { ...state, phase: 'result', round: { ...round, guess: action.guess, score } };
    }

    case 'next': {
      if (phase !== 'result' || !round) return state;
      const history = [...state.history, round];
      if (state.roundIndex + 1 >= settings.rounds || action.round === null) {
        return { ...state, phase: 'summary', round: null, history };
      }
      return {
        ...state,
        phase: 'memorise',
        round: freshRound(action.round),
        roundIndex: state.roundIndex + 1,
        history,
        usedIds: [...state.usedIds, action.round.position.id],
      };
    }

    case 'quit':
      return initialState(settings);
  }
}

/** Points earned so far this session, including a scored round still on screen. */
export function sessionTotal(state: State): number {
  const finished = state.history.reduce((sum, r) => sum + (r.score?.total ?? 0), 0);
  return finished + (state.round?.score?.total ?? 0);
}

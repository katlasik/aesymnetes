import type { Position } from '../../lib/positions';
import type { Hanging } from './hanging';
import type { Settings } from './settings';

export type Phase = 'idle' | 'find' | 'result' | 'summary';

export interface NewRound {
  position: Position;
  orientation: 'white' | 'black';
  /** The hanging pieces: the answer. */
  hanging: Hanging[];
  /** Squares with a piece other than a king; only these can be picked. */
  pickable: ReadonlySet<string>;
}

export interface Round extends NewRound {
  /** Squares the user has picked, in the order picked. */
  picked: string[];
  /** The time ran out before the user said they were done. */
  timedOut: boolean;
}

export interface State {
  phase: Phase;
  settings: Settings;
  round: Round | null;
  roundIndex: number;
  history: Round[];
  usedIds: string[];
}

export type Action =
  | { type: 'setSettings'; settings: Settings }
  | { type: 'start'; round: NewRound }
  | { type: 'toggle'; square: string }
  | { type: 'submit' }
  | { type: 'timeUp' }
  | { type: 'next'; round: NewRound | null };

export function initialState(settings: Settings): State {
  return { phase: 'idle', settings, round: null, roundIndex: 0, history: [], usedIds: [] };
}

function freshRound(r: NewRound): Round {
  return { ...r, picked: [], timedOut: false };
}

/**
 * Pure transition function. The clock arrives through `timeUp`.
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
        phase: 'find',
        round: freshRound(action.round),
        roundIndex: 0,
        history: [],
        usedIds: [action.round.position.id],
      };

    case 'toggle': {
      if (phase !== 'find' || !round || !round.pickable.has(action.square)) return state;
      const picked = round.picked.includes(action.square)
        ? round.picked.filter((s) => s !== action.square)
        : [...round.picked, action.square];
      return { ...state, round: { ...round, picked } };
    }

    case 'submit':
      return phase === 'find' && round ? { ...state, phase: 'result' } : state;

    case 'timeUp':
      return phase === 'find' && round ? { ...state, phase: 'result', round: { ...round, timedOut: true } } : state;

    case 'next': {
      if (phase !== 'result' || !round) return state;
      const history = [...state.history, round];
      if (state.roundIndex + 1 >= settings.rounds || action.round === null) {
        return { ...state, phase: 'summary', round: null, history };
      }
      return {
        ...state,
        phase: 'find',
        round: freshRound(action.round),
        roundIndex: state.roundIndex + 1,
        history,
        usedIds: [...state.usedIds, action.round.position.id],
      };
    }
  }
}

/** How the picks compare with the answer. */
export function grade(round: Round) {
  const answer = new Set(round.hanging.map((h) => h.square));
  const found = round.picked.filter((s) => answer.has(s));
  const wrong = round.picked.filter((s) => !answer.has(s));
  const missed = [...answer].filter((s) => !round.picked.includes(s));
  return { found, wrong, missed };
}

/** Every hanging piece picked, and nothing else. */
export function isCorrect(round: Round): boolean {
  const { wrong, missed } = grade(round);
  return wrong.length === 0 && missed.length === 0;
}

/** Correct rounds so far this session, including a finished round still on screen. */
export function correctCount(state: State): number {
  const finished = state.history.filter(isCorrect).length;
  return finished + (state.phase === 'result' && state.round && isCorrect(state.round) ? 1 : 0);
}

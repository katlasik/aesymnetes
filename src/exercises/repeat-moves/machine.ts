import type { Sequence } from '../../lib/sequences';
import type { Settings } from './settings';

export type Phase = 'idle' | 'look' | 'watch' | 'replay' | 'result' | 'summary';

export interface NewRound {
  sequence: Sequence;
  /** Colour at the bottom of the board for this round. */
  orientation: 'white' | 'black';
}

export interface Round extends NewRound {
  /** Moves to watch and replay: 2 × movesPerSide. */
  plies: number;
  /** Moves shown so far while watching. */
  shown: number;
  /** Moves the user has replayed correctly so far. */
  played: string[];
  /** The user's wrong move, which ended the attempt. */
  wrongMove: string | null;
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
  | { type: 'lookDone' }
  | { type: 'watchStep' }
  | { type: 'watchDone' }
  | { type: 'move'; uci: string }
  | { type: 'next'; round: NewRound | null }
  | { type: 'quit' };

export function initialState(settings: Settings): State {
  return { phase: 'idle', settings, round: null, roundIndex: 0, history: [], usedIds: [] };
}

function freshRound(r: NewRound, settings: Settings): Round {
  const plies = Math.min(settings.movesPerSide * 2, r.sequence.moves.length);
  return { ...r, plies, shown: 0, played: [], wrongMove: null };
}

/** The move the user should replay next, or null once all are played. */
export function expectedMove(round: Round): string | null {
  return round.played.length < round.plies ? round.sequence.moves[round.played.length]! : null;
}

/** Same from and to squares; a promotion takes the expected piece, so the user never has to pick it. */
function sameMove(played: string, expected: string): boolean {
  return played.slice(0, 4) === expected.slice(0, 4);
}

/**
 * Pure transition function. The clock arrives through actions (lookDone, watchStep, watchDone).
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
        phase: 'look',
        round: freshRound(action.round, settings),
        roundIndex: 0,
        history: [],
        usedIds: [action.round.sequence.id],
      };

    case 'lookDone':
      return phase === 'look' && round ? { ...state, phase: 'watch' } : state;

    case 'watchStep':
      if (phase !== 'watch' || !round || round.shown >= round.plies) return state;
      return { ...state, round: { ...round, shown: round.shown + 1 } };

    case 'watchDone':
      if (phase !== 'watch' || !round || round.shown < round.plies) return state;
      return { ...state, phase: 'replay' };

    case 'move': {
      if (phase !== 'replay' || !round) return state;
      const expected = expectedMove(round);
      if (expected === null) return state;
      if (!sameMove(action.uci, expected)) {
        return { ...state, phase: 'result', round: { ...round, wrongMove: action.uci } };
      }
      const played = [...round.played, expected];
      return {
        ...state,
        phase: played.length === round.plies ? 'result' : 'replay',
        round: { ...round, played },
      };
    }

    case 'next': {
      if (phase !== 'result' || !round) return state;
      const history = [...state.history, round];
      if (state.roundIndex + 1 >= settings.rounds || action.round === null) {
        return { ...state, phase: 'summary', round: null, history };
      }
      return {
        ...state,
        phase: 'look',
        round: freshRound(action.round, settings),
        roundIndex: state.roundIndex + 1,
        history,
        usedIds: [...state.usedIds, action.round.sequence.id],
      };
    }

    case 'quit':
      return initialState(settings);
  }
}

/** Every move replayed without a mistake. */
export function isCorrect(round: Round): boolean {
  return round.wrongMove === null && round.played.length === round.plies;
}

/** Correct rounds so far this session, including a finished round still on screen. */
export function correctCount(state: State): number {
  const finished = state.history.filter(isCorrect).length;
  return finished + (state.phase === 'result' && state.round && isCorrect(state.round) ? 1 : 0);
}

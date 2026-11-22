export type Side = 'white' | 'black';

export const SQUARES: readonly string[] = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((rank) =>
  ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((file) => `${file}${rank}`),
);

/** A random square, never `avoid`, so the prompt always visibly changes. */
export function pickSquare(rng: () => number, avoid?: string): string {
  const pool = avoid ? SQUARES.filter((s) => s !== avoid) : SQUARES;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

export interface Feedback {
  clicked: string;
  answer: string;
  right: boolean;
}

export interface State {
  phase: 'idle' | 'run' | 'summary';
  /** Counts runs, so timers restart on each new one. */
  run: number;
  orientation: Side;
  target: string;
  correct: number;
  wrong: number;
  feedback: Feedback | null;
}

export type Action =
  | { type: 'start'; orientation: Side; target: string }
  | { type: 'click'; square: string; next: string }
  | { type: 'clearFeedback' }
  | { type: 'timeUp' };

export function initialState(): State {
  return { phase: 'idle', run: 0, orientation: 'white', target: 'e4', correct: 0, wrong: 0, feedback: null };
}

export function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'start':
      return {
        ...state,
        phase: 'run',
        run: state.run + 1,
        orientation: action.orientation,
        target: action.target,
        correct: 0,
        wrong: 0,
        feedback: null,
      };
    case 'click': {
      if (state.phase !== 'run') return state;
      const right = action.square === state.target;
      return {
        ...state,
        target: action.next,
        correct: state.correct + (right ? 1 : 0),
        wrong: state.wrong + (right ? 0 : 1),
        feedback: { clicked: action.square, answer: state.target, right },
      };
    }
    case 'clearFeedback':
      return state.feedback ? { ...state, feedback: null } : state;
    case 'timeUp':
      return state.phase === 'run' ? { ...state, phase: 'summary', feedback: null } : state;
  }
}

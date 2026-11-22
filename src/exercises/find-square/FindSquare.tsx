import { useEffect, useReducer, useRef, useState } from 'react';
import { Button } from '@mantine/core';
import Board, { type SquareMark } from '../../components/Board';
import ExerciseProvider from '../../components/exercise/ExerciseProvider';
import { useCountdown, wholeSeconds } from '../../components/exercise/useCountdown';
import type { DrillStep } from '../../components/exercise/drill';
import { useDrillStart } from '../../components/exercise/useDrillStart';
import { useT } from '../../i18n/react';
import { readJson, writeJson } from '../../lib/storage';
import { initialState, pickSquare, reduce } from './machine';
import './FindSquare.css';

const BEST_KEY = 'aesymnetes:find-square:best-correct';
export const RUN_SECONDS = 30;
const FEEDBACK_MS = 600;
const EMPTY_FEN = '8/8/8/8/8/8/8/8';

function loadBest(): number | undefined {
  const raw = readJson(BEST_KEY);
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
}

export function FindSquareExercise({ drill }: { drill?: DrillStep }) {
  const t = useT();
  const [state, dispatch] = useReducer(reduce, undefined, initialState);
  const [best, setBest] = useState<number | undefined>(loadBest);
  const bestAtStart = useRef(best);
  const { phase, feedback } = state;

  const begin = () => {
    bestAtStart.current = best;
    dispatch({ type: 'start', orientation: Math.random() < 0.5 ? 'white' : 'black', target: pickSquare(Math.random) });
  };
  useDrillStart(drill, begin);

  const remaining = useCountdown(
    phase === 'run' ? { key: `run-${state.run}`, seconds: RUN_SECONDS, onDone: () => dispatch({ type: 'timeUp' }) } : null,
  );

  // Each click's colours fade after a moment; a newer click replaces them.
  useEffect(() => {
    if (!feedback) return;
    const id = setTimeout(() => dispatch({ type: 'clearFeedback' }), FEEDBACK_MS);
    return () => clearTimeout(id);
  }, [feedback]);

  const newBest = phase === 'summary' && state.correct > (bestAtStart.current ?? 0);
  useEffect(() => {
    if (!newBest) return;
    setBest(state.correct);
    writeJson(BEST_KEY, state.correct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newBest]);

  const marks: Record<string, SquareMark> = {};
  if (feedback) {
    marks[feedback.answer] = 'answer';
    if (!feedback.right) marks[feedback.clicked] = 'wrong';
  }

  return (
    <div className="ex">
      <div className="ex-board">
        <Board
          fen={EMPTY_FEN}
          orientation={state.orientation}
          coordinates={false}
          marks={marks}
          onSquareClick={
            phase === 'run'
              ? (square) => dispatch({ type: 'click', square, next: pickSquare(Math.random, state.target) })
              : undefined
          }
        />
      </div>

      <div className="ex-panel">
        <h1 className="ex-title">{t.findSquare.title}</h1>

        {phase === 'idle' && (
          <>
            <p className="ex-prompt">{t.findSquare.intro(RUN_SECONDS)}</p>
            {!drill && (
              <Button className="ex-start" size="xl" fullWidth onClick={begin}>
                {t.common.start}
              </Button>
            )}
            {best !== undefined && <p className="ex-note">{t.findSquare.bestIs(best)}</p>}
          </>
        )}

        {phase === 'run' && (
          <>
            <div className="fs-target" aria-live="polite" aria-label={t.findSquare.squareToFind}>
              {state.target}
            </div>
            <p className="ex-prompt">
              {t.findSquare.youPlay(state.orientation)}{' '}
              <span className="is-right">{t.findSquare.right(state.correct)}</span>
              {state.wrong > 0 && (
                <>
                  {t.findSquare.countSeparator}
                  <span className="is-wrong">{t.findSquare.wrong(state.wrong)}</span>
                </>
              )}
            </p>
            <div className="ex-clock ex-clock-small" role="timer" aria-label={t.findSquare.secondsLeft}>
              {wholeSeconds(remaining ?? RUN_SECONDS * 1000)}
            </div>
          </>
        )}

        {phase === 'summary' && (
          <>
            <div className="ex-clock" aria-label={t.findSquare.squaresFound}>
              {state.correct}
            </div>
            <p className="ex-prompt">
              {t.findSquare.summary({ seconds: RUN_SECONDS, wrong: state.wrong, newBest, best })}
            </p>
            {drill ? (
              <Button
                className="ex-next"
                size="xl"
                fullWidth
                onClick={() => drill.onFinish(t.findSquare.drillResult(state.correct, state.wrong))}
              >
                {drill.isLast ? t.common.finishDrill : t.common.nextExercise}
              </Button>
            ) : (
              <div className="ex-actions">
                <Button size="md" onClick={begin}>
                  {t.common.playAgain}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function FindSquare() {
  return (
    <ExerciseProvider>
      <FindSquareExercise />
    </ExerciseProvider>
  );
}

import { useEffect, useReducer, useRef, useState } from 'react';
import { Alert, Anchor, Button, Modal, Table } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import Board, { type SquareMark } from '../../components/Board';
import ExerciseProvider from '../../components/exercise/ExerciseProvider';
import GearIcon from '../../components/exercise/GearIcon';
import NextButton from '../../components/exercise/NextButton';
import ProgressStatus from '../../components/exercise/ProgressStatus';
import SettingsDrawer from '../../components/exercise/SettingsDrawer';
import { useCountdown, wholeSeconds } from '../../components/exercise/useCountdown';
import type { DrillStep } from '../../components/exercise/drill';
import { useDrillStart } from '../../components/exercise/useDrillStart';
import type { Messages } from '../../i18n';
import { useT } from '../../i18n/react';
import { boardFenWithout, loadPositions, pickRound, type Color } from '../../lib/positions';
import { readJson, writeJson } from '../../lib/storage';
import { correctCount, initialState, isCorrect, reduce, type NewRound, type Round, type State } from './machine';
import PiecePicker, { PieceIcon } from './PiecePicker';
import SettingsPanel from './SettingsPanel';
import { matchPreset, sanitize, type PresetName, type Settings } from './settings';
import './MissingPiece.css';

const SETTINGS_KEY = 'aesymnetes:missing-piece:settings';
// Best number of correct positions per preset. (The old key held points.)
const BEST_KEY = 'aesymnetes:missing-piece:best-correct';
const NEXT_AFTER_SECONDS = 4;
const PIECE_SECONDS = 8;
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

type Best = Partial<Record<PresetName, number>>;
type Notice = 'load' | 'empty' | null;

function loadBest(): Best {
  const raw = readJson(BEST_KEY);
  const best: Best = {};
  if (typeof raw === 'object' && raw !== null) {
    for (const name of ['easy', 'medium', 'hard'] as const) {
      const v = (raw as Record<string, unknown>)[name];
      if (typeof v === 'number' && Number.isFinite(v)) best[name] = v;
    }
  }
  return best;
}

/** Draws the position for round `index`; positions get more pieces as the session goes on. */
async function drawRound(settings: Settings, usedIds: readonly string[], index: number): Promise<NewRound | null> {
  const pool = await loadPositions();
  const picked = pickRound(pool, settings, new Set(usedIds), Math.random, { index, total: settings.rounds });
  if (!picked) return null;
  const orientation: Color =
    settings.side === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : settings.side;
  return { ...picked, orientation };
}

function pieceQuestion(t: Messages, round: Round, settings: Settings): string {
  const sq = round.target.square;
  if (!round.revealed) return t.missingPiece.whichPiece(sq);
  const outOfTries = round.wrongSquares.length >= settings.attempts;
  return t.missingPiece.whichPieceRevealed(sq, outOfTries ? 'outOfTries' : 'timeUp');
}

function boardView(state: State, onSquare: (sq: string) => void) {
  const { phase, round, settings } = state;
  if (!round) {
    return { fen: START_FEN, orientation: 'white' as Color, coordinates: settings.coordinates };
  }
  const marks: Record<string, SquareMark> = {};
  for (const sq of round.wrongSquares) marks[sq] = 'wrong';
  if (phase === 'guessPiece' || phase === 'result') marks[round.target.square] = 'answer';
  const pieceGone = phase === 'guessSquare' || phase === 'guessPiece';
  return {
    fen: pieceGone ? boardFenWithout(round.position.fen, round.target.square) : round.position.fen,
    orientation: round.orientation,
    coordinates: settings.coordinates,
    hidden: phase === 'mask',
    marks,
    onSquareClick: phase === 'guessSquare' ? onSquare : undefined,
  };
}

/** What happened this round, in one sentence; the answer is always named. */
function verdict(t: Messages, round: Round): { right: boolean; text: string } {
  const answer = round.target;
  const v = t.missingPiece.verdict;
  if (isCorrect(round)) return { right: true, text: v.correct(answer) };
  if (!round.guess) return { right: false, text: v.timeUp(answer) };
  const guess = round.guess;
  const pieceRight = guess.color === answer.color && guess.role === answer.role;
  if (round.revealed && pieceRight) return { right: false, text: v.missedSquare(answer) };
  if (round.revealed) return { right: false, text: v.wrong(answer, guess) };
  return { right: false, text: v.wrongPiece(answer, guess) };
}

export function MissingPieceExercise({ drill }: { drill?: DrillStep }) {
  const t = useT();
  const [state, dispatch] = useReducer(reduce, undefined, () =>
    initialState(sanitize(readJson(SETTINGS_KEY))),
  );
  const [best, setBest] = useState<Best>(loadBest);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const { phase, round, settings, roundIndex } = state;
  const preset = matchPreset(settings);
  const correct = correctCount(state);

  const changeSettings = (next: Settings) => {
    setNotice(null);
    dispatch({ type: 'setSettings', settings: next });
    writeJson(SETTINGS_KEY, next);
  };

  const bestAtStart = useRef<Best>(best);
  const [settingsOpen, { open: openSettings, close: closeSettings }] = useDisclosure(false);

  const begin = async () => {
    bestAtStart.current = best;
    setBusy(true);
    setNotice(null);
    try {
      const next = await drawRound(settings, [], 0);
      if (next) dispatch({ type: 'start', round: next });
      else {
        setNotice('empty');
      }
    } catch {
      setNotice('load');
    } finally {
      setBusy(false);
    }
  };
  useDrillStart(drill, begin);

  const next = async () => {
    setBusy(true);
    try {
      dispatch({ type: 'next', round: await drawRound(settings, state.usedIds, roundIndex + 1) });
    } catch {
      dispatch({ type: 'next', round: null });
    } finally {
      setBusy(false);
    }
  };

  // Four countdowns: the time to memorise, to find the square, to choose the piece, and the pause
  // on the result before the next position.
  const remaining = useCountdown(
    phase === 'memorise'
      ? { key: `memorise-${roundIndex}`, seconds: settings.memoriseSeconds, onDone: () => dispatch({ type: 'ready', now: Date.now() }) }
      : phase === 'guessSquare'
        ? { key: `guess-${roundIndex}`, seconds: settings.guessSeconds, onDone: () => dispatch({ type: 'guessTimeout' }) }
        : phase === 'guessPiece'
          ? { key: `piece-${roundIndex}`, seconds: PIECE_SECONDS, onDone: () => dispatch({ type: 'pieceTimeout' }) }
          : phase === 'result'
            ? { key: `result-${roundIndex}`, seconds: NEXT_AFTER_SECONDS, onDone: () => void next() }
            : null,
  );

  useEffect(() => {
    if (phase !== 'mask') return;
    const id = setTimeout(() => dispatch({ type: 'maskDone', now: Date.now() }), settings.maskMs);
    return () => clearTimeout(id);
  }, [phase, settings.maskMs]);

  // The best result as it stood when the session began, so the summary can say "new best" at once.
  const newBest =
    phase === 'summary' && preset !== 'custom' && correct > (bestAtStart.current[preset] ?? 0);
  useEffect(() => {
    const current = matchPreset(settings);
    if (!newBest || current === 'custom') return;
    const updated = { ...best, [current]: correct };
    setBest(updated);
    writeJson(BEST_KEY, updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newBest]);

  const inSession = phase !== 'idle' && phase !== 'summary';
  const triesLeft = round ? settings.attempts - round.wrongSquares.length : 0;
  const isLastRound = roundIndex + 1 >= settings.rounds;
  // Positions finished so far; the one on screen counts once it has been answered.
  const positionsDone = state.history.length + (phase === 'result' ? 1 : 0);
  const noticeText = notice === 'load' ? t.common.loadFailed : t.missingPiece.noPositionFits;

  return (
    <div className="ex">
      <div className="ex-board">
        <Board {...boardView(state, (square) => dispatch({ type: 'clickSquare', square }))} />
      </div>

      <div className="ex-panel">
        <h1 className="ex-title">{t.missingPiece.title}</h1>

        {inSession && <ProgressStatus done={positionsDone} current={roundIndex + 1} total={settings.rounds} />}

        {phase === 'idle' && (
          <>
            {notice && (
              <Alert color={notice === 'load' ? 'red' : 'yellow'} role="alert">
                {noticeText}
              </Alert>
            )}
            {(!drill || notice) && (
              <Button className="ex-start" size="xl" fullWidth loading={busy} onClick={begin}>
                {notice === 'load' ? t.common.tryAgain : t.common.start}
              </Button>
            )}
            <Button variant="subtle" color="gray" leftSection={<GearIcon />} onClick={openSettings} disabled={busy}>
              {t.common.settingsWithPreset(preset)}
            </Button>
          </>
        )}

        {phase === 'memorise' && (
          <>
            <div className="ex-clock" role="timer" aria-label={t.missingPiece.secondsLeftToMemorise}>
              {wholeSeconds(remaining ?? settings.memoriseSeconds * 1000)}
            </div>
            <p className="ex-prompt">{t.missingPiece.memorise}</p>
          </>
        )}

        {phase === 'mask' && <p className="ex-prompt">{t.missingPiece.removing}</p>}

        {phase === 'guessSquare' && round && (
          <>
            <div className="ex-clock ex-clock-small" role="timer" aria-label={t.missingPiece.secondsLeftToFindSquare}>
              {wholeSeconds(remaining ?? settings.guessSeconds * 1000)}
            </div>
            <p className="ex-prompt">{t.missingPiece.findSquare}</p>
            <p className="ex-note" aria-live="polite">
              {round.wrongSquares.length > 0 && `${t.missingPiece.notThatSquare} `}
              {t.missingPiece.triesLeft(triesLeft)}
            </p>
          </>
        )}

        {phase === 'guessPiece' && round && <p className="ex-prompt">{pieceQuestion(t, round, settings)}</p>}

        {phase === 'result' && round && (
          <>
            <div className="mp-answer">
              <PieceIcon color={round.target.color} role={round.target.role} />
              <p className={`ex-verdict ${verdict(t, round).right ? 'is-right' : 'is-wrong'}`} role="status">
                {verdict(t, round).text}
              </p>
            </div>
            <NextButton
              label={isLastRound ? t.common.seeSummary : t.common.nextPosition}
              msLeft={remaining}
              seconds={NEXT_AFTER_SECONDS}
              busy={busy}
              onClick={next}
            />
            <Anchor
              className="ex-lichess"
              href={`https://lichess.org/training/${round.position.id}`}
              target="_blank"
              rel="noreferrer"
              size="xs"
              c="dimmed"
            >
              {t.common.viewOnLichess}
            </Anchor>
          </>
        )}

        {phase === 'summary' && (
          <>
            <div className="ex-clock" aria-label={t.common.correctPositions}>
              {correct}/{state.history.length}
            </div>
            <p className="ex-prompt">
              {t.common.sessionSummary({ preset, newBest, best: preset === 'custom' ? undefined : best[preset] })}
            </p>
            <Table className="ex-rounds" verticalSpacing={4} horizontalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>{t.missingPiece.missingPieceColumn}</Table.Th>
                  <Table.Th ta="right">{t.common.result}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {state.history.map((r, i) => (
                  <Table.Tr key={r.position.id}>
                    <Table.Td>{i + 1}</Table.Td>
                    <Table.Td>
                      <Anchor href={`https://lichess.org/training/${r.position.id}`} target="_blank" rel="noreferrer" size="sm">
                        {t.missingPiece.historyRow(r.target)}
                      </Anchor>
                    </Table.Td>
                    <Table.Td ta="right" className={isCorrect(r) ? 'is-right' : 'is-wrong'}>
                      {isCorrect(r) ? t.common.correct : t.common.wrong}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {notice && (
              <Alert color={notice === 'load' ? 'red' : 'yellow'} role="alert">
                {noticeText}
              </Alert>
            )}
            {drill ? (
              <Button
                className="ex-next"
                size="xl"
                fullWidth
                onClick={() => drill.onFinish(t.common.correctOf(correct, state.history.length))}
              >
                {drill.isLast ? t.common.finishDrill : t.common.nextExercise}
              </Button>
            ) : (
              <div className="ex-actions">
                <Button size="md" loading={busy} onClick={begin}>
                  {t.common.playAgain}
                </Button>
                <Button size="md" variant="default" leftSection={<GearIcon />} onClick={openSettings}>
                  {t.common.settings}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Answering is the only way out: no close button, no Escape, no click outside. */}
      <Modal
        opened={phase === 'guessPiece'}
        onClose={() => {}}
        withCloseButton={false}
        closeOnEscape={false}
        closeOnClickOutside={false}
        centered
        size="auto"
        overlayProps={{ backgroundOpacity: 0.35, blur: 0 }}
        title={round ? pieceQuestion(t, round, settings) : ''}
        classNames={{ title: 'mp-dialog-title' }}
      >
        <div className="mp-piece-clock" role="timer" aria-label={t.missingPiece.secondsLeftToChoosePiece}>
          {wholeSeconds(remaining ?? PIECE_SECONDS * 1000)}
        </div>
        <PiecePicker key={roundIndex} onSubmit={(guess) => dispatch({ type: 'submitPiece', guess, now: Date.now() })} />
      </Modal>

      <SettingsDrawer
        opened={settingsOpen}
        onClose={closeSettings}
        intro={t.missingPiece.intro}
        best={preset !== 'custom' && best[preset] !== undefined ? t.common.bestOn(preset, best[preset]) : undefined}
      >
        <SettingsPanel settings={settings} onChange={changeSettings} />
      </SettingsDrawer>
    </div>
  );
}

export default function MissingPiece() {
  return (
    <ExerciseProvider>
      <MissingPieceExercise />
    </ExerciseProvider>
  );
}

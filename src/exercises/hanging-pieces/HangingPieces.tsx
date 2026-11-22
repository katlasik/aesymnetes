import { useEffect, useReducer, useRef, useState } from 'react';
import { Alert, Anchor, Button, Table } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { parseFen } from 'chessops/fen';
import Board, { type BoardArrow, type BoardProps, type SquareMark } from '../../components/Board';
import ExerciseProvider from '../../components/exercise/ExerciseProvider';
import GearIcon from '../../components/exercise/GearIcon';
import NextButton from '../../components/exercise/NextButton';
import ProgressStatus from '../../components/exercise/ProgressStatus';
import SettingsDrawer from '../../components/exercise/SettingsDrawer';
import { useCountdown, wholeSeconds } from '../../components/exercise/useCountdown';
import type { DrillStep } from '../../components/exercise/drill';
import { useDrillStart } from '../../components/exercise/useDrillStart';
import { useT } from '../../i18n/react';
import { loadPositions, type Color } from '../../lib/positions';
import { readJson, writeJson } from '../../lib/storage';
import { hangingPieces, pickableSquares, pickPosition } from './hanging';
import { correctCount, grade, initialState, isCorrect, reduce, type NewRound, type Round, type State } from './machine';
import SettingsPanel from './SettingsPanel';
import { matchPreset, sanitize, type PresetName, type Settings } from './settings';

const SETTINGS_KEY = 'aesymnetes:hanging-pieces:settings';
const BEST_KEY = 'aesymnetes:hanging-pieces:best-correct';
const NEXT_AFTER_SECONDS = 6;
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

type Best = Partial<Record<PresetName, number>>;
type Notice = { kind: 'load' | 'empty' } | null;

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

function sideToMove(fen: string): Color {
  const setup = parseFen(fen);
  return setup.isOk ? setup.value.turn : 'white';
}

/** Draws the position for round `index`; positions get more pieces as the session goes on. */
async function drawRound(settings: Settings, usedIds: readonly string[], index: number): Promise<NewRound | null> {
  const pool = await loadPositions();
  const position = pickPosition(pool, settings, new Set(usedIds), Math.random, { index, total: settings.rounds });
  if (!position) return null;
  const orientation: Color =
    settings.side === 'toMove'
      ? sideToMove(position.fen)
      : settings.side === 'random'
        ? Math.random() < 0.5
          ? 'white'
          : 'black'
        : settings.side;
  return { position, orientation, hanging: hangingPieces(position.fen), pickable: pickableSquares(position.fen) };
}

function boardView(state: State, onSquare: (square: string) => void): BoardProps {
  const { phase, round, settings } = state;
  if (!round) return { fen: START_FEN, orientation: 'white', coordinates: settings.coordinates };
  const base = { fen: round.position.fen, orientation: round.orientation, coordinates: settings.coordinates };
  if (phase === 'find') {
    const marks: Record<string, SquareMark> = {};
    for (const sq of round.picked) marks[sq] = 'picked';
    return { ...base, marks, onSquareClick: onSquare };
  }
  const { found, wrong, missed } = grade(round);
  const marks: Record<string, SquareMark> = {};
  for (const sq of found) marks[sq] = 'answer';
  for (const sq of missed) marks[sq] = 'missed';
  for (const sq of wrong) marks[sq] = 'wrong';
  const arrows: BoardArrow[] = round.hanging.map((h) => ({ orig: h.attacker, dest: h.square, brush: 'red' }));
  return { ...base, marks, arrows };
}

const lichessUrl = (round: Round) => `https://lichess.org/training/${round.position.id}`;

export function HangingPiecesExercise({ drill }: { drill?: DrillStep }) {
  const t = useT();
  const [state, dispatch] = useReducer(reduce, undefined, () => initialState(sanitize(readJson(SETTINGS_KEY))));
  const [best, setBest] = useState<Best>(loadBest);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [settingsOpen, { open: openSettings, close: closeSettings }] = useDisclosure(false);
  const bestAtStart = useRef<Best>(best);

  const { phase, round, settings, roundIndex } = state;
  const preset = matchPreset(settings);
  const correct = correctCount(state);

  const changeSettings = (next: Settings) => {
    setNotice(null);
    dispatch({ type: 'setSettings', settings: next });
    writeJson(SETTINGS_KEY, next);
  };

  const begin = async () => {
    bestAtStart.current = best;
    setBusy(true);
    setNotice(null);
    try {
      const next = await drawRound(settings, [], 0);
      if (next) dispatch({ type: 'start', round: next });
      else setNotice({ kind: 'empty' });
    } catch {
      setNotice({ kind: 'load' });
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

  const remaining = useCountdown(
    phase === 'find'
      ? { key: `find-${roundIndex}`, seconds: settings.seconds, onDone: () => dispatch({ type: 'timeUp' }) }
      : phase === 'result'
        ? { key: `result-${roundIndex}`, seconds: NEXT_AFTER_SECONDS, onDone: () => void next() }
        : null,
  );

  const newBest = phase === 'summary' && preset !== 'custom' && correct > (bestAtStart.current[preset] ?? 0);
  useEffect(() => {
    const current = matchPreset(settings);
    if (!newBest || current === 'custom') return;
    const updated = { ...best, [current]: correct };
    setBest(updated);
    writeJson(BEST_KEY, updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newBest]);

  const inSession = phase !== 'idle' && phase !== 'summary';
  const isLastRound = roundIndex + 1 >= settings.rounds;
  const positionsDone = state.history.length + (phase === 'result' ? 1 : 0);
  const noticeText = notice?.kind === 'load' ? t.common.loadFailed : t.hangingPieces.noPositionFits;

  const verdict = (r: Round) => {
    const g = grade(r);
    if (isCorrect(r)) return { right: true, text: t.hangingPieces.verdict.correct(r.hanging.length) };
    return {
      right: false,
      text: t.hangingPieces.verdict.wrong({
        found: g.found.length,
        total: r.hanging.length,
        wrong: g.wrong.length,
        timedOut: r.timedOut,
      }),
    };
  };

  return (
    <div className="ex">
      <div className="ex-board">
        <Board {...boardView(state, (square) => dispatch({ type: 'toggle', square }))} />
      </div>

      <div className="ex-panel">
        <h1 className="ex-title">{t.hangingPieces.title}</h1>

        {inSession && <ProgressStatus done={positionsDone} current={roundIndex + 1} total={settings.rounds} />}

        {phase === 'idle' && (
          <>
            {notice && (
              <Alert color={notice.kind === 'load' ? 'red' : 'yellow'} role="alert">
                {noticeText}
              </Alert>
            )}
            {(!drill || notice) && (
              <Button className="ex-start" size="xl" fullWidth loading={busy} onClick={begin}>
                {notice?.kind === 'load' ? t.common.tryAgain : t.common.start}
              </Button>
            )}
            <Button variant="subtle" color="gray" leftSection={<GearIcon />} onClick={openSettings} disabled={busy}>
              {t.common.settingsWithPreset(preset)}
            </Button>
          </>
        )}

        {phase === 'find' && round && (
          <>
            <div className="ex-clock ex-clock-small" role="timer" aria-label={t.hangingPieces.secondsLeft}>
              {wholeSeconds(remaining ?? settings.seconds * 1000)}
            </div>
            <p className="ex-prompt">{t.hangingPieces.find(sideToMove(round.position.fen))}</p>
            <p className="ex-note" aria-live="polite">
              {t.hangingPieces.picked(round.picked.length)}
            </p>
            <Button className="ex-next" size="xl" fullWidth onClick={() => dispatch({ type: 'submit' })}>
              {t.hangingPieces.done}
            </Button>
          </>
        )}

        {phase === 'result' && round && (
          <>
            <p className={`ex-verdict ${verdict(round).right ? 'is-right' : 'is-wrong'}`} role="status">
              {verdict(round).text}
            </p>
            <p className="ex-note">{t.hangingPieces.legend}</p>
            <NextButton
              label={isLastRound ? t.common.seeSummary : t.common.nextPosition}
              msLeft={remaining}
              seconds={NEXT_AFTER_SECONDS}
              busy={busy}
              onClick={next}
            />
            <Anchor className="ex-lichess" href={lichessUrl(round)} target="_blank" rel="noreferrer" size="xs" c="dimmed">
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
              {t.common.sessionSummary({
                preset,
                newBest,
                best: preset !== 'custom' ? best[preset] : undefined,
              })}
            </p>
            <Table className="ex-rounds" verticalSpacing={4} horizontalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>{t.hangingPieces.hangingColumn}</Table.Th>
                  <Table.Th ta="right">{t.common.result}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {state.history.map((r, i) => (
                  <Table.Tr key={r.position.id}>
                    <Table.Td>{i + 1}</Table.Td>
                    <Table.Td>
                      <Anchor href={lichessUrl(r)} target="_blank" rel="noreferrer" size="sm">
                        {t.hangingPieces.historyRow(grade(r).found.length, r.hanging.length)}
                      </Anchor>
                    </Table.Td>
                    <Table.Td ta="right" className={isCorrect(r) ? 'is-right' : 'is-wrong'}>
                      {isCorrect(r) ? t.common.correct : t.common.wrong}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
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

      <SettingsDrawer
        opened={settingsOpen}
        onClose={closeSettings}
        intro={t.hangingPieces.intro}
        best={preset !== 'custom' && best[preset] !== undefined ? t.common.bestOn(preset, best[preset]) : undefined}
      >
        <SettingsPanel settings={settings} onChange={changeSettings} />
      </SettingsDrawer>
    </div>
  );
}

export default function HangingPieces() {
  return (
    <ExerciseProvider>
      <HangingPiecesExercise />
    </ExerciseProvider>
  );
}

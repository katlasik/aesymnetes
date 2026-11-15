import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Alert, Anchor, Button, Table } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Chess } from 'chessops/chess';
import { chessgroundDests } from 'chessops/compat';
import { makeFen, parseFen } from 'chessops/fen';
import { makeSan } from 'chessops/san';
import { parseUci } from 'chessops/util';
import Board, { type BoardArrow, type BoardProps } from '../../components/Board';
import ExerciseProvider from '../../components/exercise/ExerciseProvider';
import GearIcon from '../../components/exercise/GearIcon';
import NextButton from '../../components/exercise/NextButton';
import ProgressStatus from '../../components/exercise/ProgressStatus';
import SettingsDrawer from '../../components/exercise/SettingsDrawer';
import { useCountdown, wholeSeconds } from '../../components/exercise/useCountdown';
import { loadSequences, pickSequence, type Sequence } from '../../lib/sequences';
import { readJson, writeJson } from '../../lib/storage';
import { correctCount, expectedMove, initialState, isCorrect, reduce, type NewRound, type Round, type State } from './machine';
import SettingsPanel from './SettingsPanel';
import { matchPreset, sanitize, type PresetName, type Settings } from './settings';

const SETTINGS_KEY = 'aesymnetes:repeat-moves:settings';
const BEST_KEY = 'aesymnetes:repeat-moves:best-correct';
const NEXT_AFTER_SECONDS = 4;
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const PRESET_LABEL: Record<PresetName, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const INTRO =
  'Look at a position from a real game. A few moves play out, then the board goes back. Play the same moves again, for both sides.';

type Best = Partial<Record<PresetName, number>>;
type Notice = { kind: 'load' | 'empty'; text: string } | null;
type Pos = ReturnType<typeof Chess.default>;

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

function startPosition(seq: Sequence): Pos {
  return Chess.fromSetup(parseFen(seq.fen).unwrap()).unwrap();
}

/** The position after the first `n` moves of the sequence. */
function positionAfter(seq: Sequence, moves: readonly string[]): Pos {
  const pos = startPosition(seq);
  for (const uci of moves) pos.play(parseUci(uci)!);
  return pos;
}

function squares(uci: string): [string, string] {
  return [uci.slice(0, 2), uci.slice(2, 4)];
}

/** Draws the sequence for round `index`; sequences get more pieces as the session goes on. */
async function drawRound(settings: Settings, usedIds: readonly string[], index: number): Promise<NewRound | null> {
  const pool = await loadSequences();
  const sequence = pickSequence(pool, settings, new Set(usedIds), Math.random, { index, total: settings.rounds });
  if (!sequence) return null;
  const toMove = startPosition(sequence).turn;
  const orientation =
    settings.side === 'toMove' ? toMove : settings.side === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : settings.side;
  return { sequence, orientation };
}

/** The user's wrong move as a legal move in the position, if it is one (a promotion becomes a queen). */
function wrongMoveIn(pos: Pos, uci: string) {
  const plain = parseUci(uci);
  if (plain && pos.isLegal(plain)) return plain;
  const queen = parseUci(uci + 'q');
  return queen && pos.isLegal(queen) ? queen : null;
}

function verdict(round: Round): { right: boolean; text: string } {
  if (isCorrect(round)) return { right: true, text: `Correct: all ${round.plies} moves.` };
  const pos = positionAfter(round.sequence, round.played);
  const expected = expectedMove(round)!;
  const expectedSan = makeSan(pos, parseUci(expected)!);
  const wrong = round.wrongMove ? wrongMoveIn(pos, round.wrongMove) : null;
  const wrongSan = wrong ? makeSan(pos, wrong) : round.wrongMove;
  return {
    right: false,
    text: `Wrong at move ${round.played.length + 1} of ${round.plies}. The move was ${expectedSan}, not ${wrongSan}.`,
  };
}

function boardView(state: State, onMove: (orig: string, dest: string) => void): BoardProps {
  const { phase, round, settings } = state;
  const base = { orientation: round?.orientation ?? ('white' as const), coordinates: settings.coordinates };
  if (!round) return { ...base, fen: START_FEN };
  const seq = round.sequence;

  if (phase === 'look') return { ...base, fen: seq.fen };
  if (phase === 'watch') {
    const shown = seq.moves.slice(0, round.shown);
    return {
      ...base,
      fen: makeFen(positionAfter(seq, shown).toSetup()),
      lastMove: shown.length ? squares(shown.at(-1)!) : undefined,
      animate: true,
    };
  }
  const pos = positionAfter(seq, round.played);
  const last = round.played.at(-1);
  if (phase === 'replay') {
    return {
      ...base,
      fen: makeFen(pos.toSetup()),
      lastMove: last ? squares(last) : undefined,
      animate: true,
      movable: { color: pos.turn, dests: chessgroundDests(pos) },
      onMove,
    };
  }
  // result
  if (round.wrongMove) {
    const expected = expectedMove(round)!;
    const arrows: BoardArrow[] = [
      { orig: expected.slice(0, 2), dest: expected.slice(2, 4), brush: 'green' },
      { orig: round.wrongMove.slice(0, 2), dest: round.wrongMove.slice(2, 4), brush: 'red' },
    ];
    // Show the position before the wrong move, with both moves drawn on it.
    return { ...base, fen: makeFen(pos.toSetup()), lastMove: last ? squares(last) : undefined, arrows };
  }
  return { ...base, fen: makeFen(pos.toSetup()), lastMove: last ? squares(last) : undefined };
}

function Exercise() {
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
      else setNotice({ kind: 'empty', text: 'No position fits these settings. Widen the range of pieces on the board.' });
    } catch {
      setNotice({ kind: 'load', text: 'The positions did not load. Check your connection, then try again.' });
    } finally {
      setBusy(false);
    }
  };

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
    phase === 'look'
      ? { key: `look-${roundIndex}`, seconds: settings.lookSeconds, onDone: () => dispatch({ type: 'lookDone' }) }
      : phase === 'result'
        ? { key: `result-${roundIndex}`, seconds: NEXT_AFTER_SECONDS, onDone: () => void next() }
        : null,
  );

  // While watching: one move every `moveMs`, then one more pause before the board goes back.
  const shown = round?.shown ?? 0;
  useEffect(() => {
    if (phase !== 'watch' || !round) return;
    const id = setTimeout(
      () => dispatch(shown < round.plies ? { type: 'watchStep' } : { type: 'watchDone' }),
      settings.moveMs,
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, shown, roundIndex, settings.moveMs]);

  const newBest = phase === 'summary' && preset !== 'custom' && correct > (bestAtStart.current[preset] ?? 0);
  useEffect(() => {
    const current = matchPreset(settings);
    if (!newBest || current === 'custom') return;
    const updated = { ...best, [current]: correct };
    setBest(updated);
    writeJson(BEST_KEY, updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newBest]);

  const view = useMemo(
    () => boardView(state, (orig, dest) => dispatch({ type: 'move', uci: orig + dest })),
    [state],
  );

  const inSession = phase !== 'idle' && phase !== 'summary';
  const isLastRound = roundIndex + 1 >= settings.rounds;
  const positionsDone = state.history.length + (phase === 'result' ? 1 : 0);
  const toMove = round && phase === 'replay' ? positionAfter(round.sequence, round.played).turn : null;

  return (
    <div className="ex">
      <div className="ex-board">
        <Board {...view} />
      </div>

      <div className="ex-panel">
        <h1 className="ex-title">Repeat the moves</h1>

        {inSession && <ProgressStatus done={positionsDone} current={roundIndex + 1} total={settings.rounds} />}

        {phase === 'idle' && (
          <>
            {notice && (
              <Alert color={notice.kind === 'load' ? 'red' : 'yellow'} role="alert">
                {notice.text}
              </Alert>
            )}
            <Button className="ex-start" size="xl" fullWidth loading={busy} onClick={begin}>
              {notice?.kind === 'load' ? 'Try again' : 'Start'}
            </Button>
            <Button variant="subtle" color="gray" leftSection={<GearIcon />} onClick={openSettings} disabled={busy}>
              Settings: {preset === 'custom' ? 'Custom' : PRESET_LABEL[preset]}
            </Button>
          </>
        )}

        {phase === 'look' && round && (
          <>
            <div className="ex-clock" role="timer" aria-label="Seconds before the moves start">
              {wholeSeconds(remaining ?? settings.lookSeconds * 1000)}
            </div>
            <p className="ex-prompt">Look at the position. {round.plies} moves will follow.</p>
          </>
        )}

        {phase === 'watch' && round && (
          <>
            <div className="ex-clock ex-clock-small" aria-label="Moves shown">
              {round.shown}/{round.plies}
            </div>
            <p className="ex-prompt">Watch the moves.</p>
          </>
        )}

        {phase === 'replay' && round && (
          <>
            <div className="ex-clock ex-clock-small" aria-label="Move to play">
              {round.played.length + 1}/{round.plies}
            </div>
            <p className="ex-prompt">
              Play the moves again. {toMove === 'white' ? 'White' : 'Black'} to move.
            </p>
          </>
        )}

        {phase === 'result' && round && (
          <>
            <p className={`ex-verdict ${verdict(round).right ? 'is-right' : 'is-wrong'}`} role="status">
              {verdict(round).text}
            </p>
            <NextButton
              label={isLastRound ? 'See summary' : 'Next position'}
              msLeft={remaining}
              seconds={NEXT_AFTER_SECONDS}
              busy={busy}
              onClick={next}
            />
            <Anchor
              className="ex-lichess"
              href={`https://lichess.org/${round.sequence.gameId}#${round.sequence.ply}`}
              target="_blank"
              rel="noreferrer"
              size="xs"
              c="dimmed"
            >
              View on Lichess
            </Anchor>
          </>
        )}

        {phase === 'summary' && (
          <>
            <div className="ex-clock" aria-label="Correct positions">
              {correct}/{state.history.length}
            </div>
            <p className="ex-prompt">
              correct{preset !== 'custom' && ` on ${PRESET_LABEL[preset]}`}.
              {newBest && ' Your best so far.'}
              {!newBest && preset !== 'custom' && best[preset] !== undefined && ` Your best is ${best[preset]}.`}
            </p>
            <Table className="ex-rounds" verticalSpacing={4} horizontalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Game</Table.Th>
                  <Table.Th ta="right">Result</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {state.history.map((r, i) => (
                  <Table.Tr key={r.sequence.id}>
                    <Table.Td>{i + 1}</Table.Td>
                    <Table.Td>
                      <Anchor href={`https://lichess.org/${r.sequence.gameId}#${r.sequence.ply}`} target="_blank" rel="noreferrer" size="sm">
                        {r.plies} moves from move {Math.floor(r.sequence.ply / 2) + 1}
                      </Anchor>
                    </Table.Td>
                    <Table.Td ta="right" className={isCorrect(r) ? 'is-right' : 'is-wrong'}>
                      {isCorrect(r) ? 'Correct' : 'Wrong'}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {notice && (
              <Alert color={notice.kind === 'load' ? 'red' : 'yellow'} role="alert">
                {notice.text}
              </Alert>
            )}
            <div className="ex-actions">
              <Button size="md" loading={busy} onClick={begin}>
                Play again
              </Button>
              <Button size="md" variant="default" leftSection={<GearIcon />} onClick={openSettings}>
                Settings
              </Button>
            </div>
          </>
        )}
      </div>

      <SettingsDrawer
        opened={settingsOpen}
        onClose={closeSettings}
        intro={INTRO}
        best={preset !== 'custom' && best[preset] !== undefined ? `Best on ${PRESET_LABEL[preset]}: ${best[preset]}` : undefined}
      >
        <SettingsPanel settings={settings} onChange={changeSettings} />
      </SettingsDrawer>
    </div>
  );
}

export default function RepeatMoves() {
  return (
    <ExerciseProvider>
      <Exercise />
    </ExerciseProvider>
  );
}

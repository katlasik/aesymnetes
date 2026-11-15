import { useEffect, useReducer, useRef, useState } from 'react';
import { Alert, Anchor, Button, Drawer, MantineProvider, Modal, Progress, Table } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import '@mantine/core/styles.css';
import Board, { type SquareMark } from '../../components/Board';
import { boardFenWithout, loadPositions, pickRound, type Color } from '../../lib/positions';
import { readJson, writeJson } from '../../lib/storage';
import { correctCount, initialState, isCorrect, reduce, type NewRound, type Round, type State } from './machine';
import PiecePicker, { PieceIcon } from './PiecePicker';
import SettingsPanel from './SettingsPanel';
import { matchPreset, sanitize, type PresetName, type Settings } from './settings';
import { cssVariablesResolver, theme } from './theme';
import './MissingPiece.css';

const SETTINGS_KEY = 'aesymnetes:missing-piece:settings';
// Best number of correct positions per preset. (The old key held points.)
const BEST_KEY = 'aesymnetes:missing-piece:best-correct';
const NEXT_AFTER_SECONDS = 4;
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const PRESET_LABEL: Record<PresetName, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

type Best = Partial<Record<PresetName, number>>;
type Notice = { kind: 'load' | 'empty'; text: string } | null;

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

/** Whole seconds left, counting down to 0. */
function seconds(ms: number): string {
  return String(Math.max(0, Math.ceil(ms / 1000)));
}

function pieceQuestion(round: Round, settings: Settings): string {
  const sq = round.target.square;
  if (!round.revealed) return `Yes, ${sq}. Which piece was it?`;
  const outOfTries = round.wrongSquares.length >= settings.attempts;
  return `${outOfTries ? 'Out of tries' : "Time's up"}. The piece stood on ${sq}. Which piece was it?`;
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
function verdict(round: Round): { right: boolean; text: string } {
  const { color, role, square } = round.target;
  const answer = `the ${color} ${role} on ${square}`;
  if (isCorrect(round)) return { right: true, text: `Correct: ${answer}.` };
  const guess = round.guess!;
  const pieceRight = guess.color === color && guess.role === role;
  if (round.revealed && pieceRight) return { right: false, text: `Right piece, but you missed the square. It was ${answer}.` };
  if (round.revealed) return { right: false, text: `Wrong. It was ${answer}, not the ${guess.color} ${guess.role}.` };
  return { right: false, text: `Right square, wrong piece. It was ${answer}, not the ${guess.color} ${guess.role}.` };
}

function Exercise() {
  const [state, dispatch] = useReducer(reduce, undefined, () =>
    initialState(sanitize(readJson(SETTINGS_KEY))),
  );
  const [best, setBest] = useState<Best>(loadBest);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

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
  const isNarrow = useMediaQuery('(max-width: 899px)') ?? false;

  const begin = async () => {
    bestAtStart.current = best;
    setBusy(true);
    setNotice(null);
    try {
      const next = await drawRound(settings, [], 0);
      if (next) dispatch({ type: 'start', round: next });
      else {
        setNotice({
          kind: 'empty',
          text: 'No position fits these settings. Widen the range of pieces on the board, or allow more kinds of piece to go missing.',
        });
      }
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

  // Three countdowns: the time to memorise, the time to find the square, and the pause on the
  // result before the next position. One effect owns the timer, so it is cleared the moment the
  // phase changes and a click and a timeout cannot both act.
  const countdown =
    phase === 'memorise'
      ? { seconds: settings.memoriseSeconds, done: () => dispatch({ type: 'ready', now: Date.now() }) }
      : phase === 'guessSquare'
        ? { seconds: settings.guessSeconds, done: () => dispatch({ type: 'guessTimeout' }) }
        : phase === 'result'
          ? { seconds: NEXT_AFTER_SECONDS, done: () => void next() }
          : null;
  const countdownSeconds = countdown?.seconds ?? null;
  const countdownDone = useRef<() => void>(() => {});
  countdownDone.current = countdown?.done ?? (() => {});
  useEffect(() => {
    if (countdownSeconds === null) {
      setRemaining(null);
      return;
    }
    const deadline = Date.now() + countdownSeconds * 1000;
    setRemaining(deadline - Date.now());
    const id = setInterval(() => {
      const left = deadline - Date.now();
      setRemaining(left);
      if (left <= 0) {
        clearInterval(id);
        countdownDone.current();
      }
    }, 100);
    return () => clearInterval(id);
  }, [phase, roundIndex, countdownSeconds]);

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

  return (
    <div className="mp">
      <div className="mp-board">
        <Board {...boardView(state, (square) => dispatch({ type: 'clickSquare', square }))} />
      </div>

      <div className="mp-panel">
        <h1 className="mp-title">Missing piece</h1>

        {inSession && (
          <div className="mp-status">
            <Progress
              value={(100 * positionsDone) / settings.rounds}
              size="md"
              radius="xl"
              aria-label={`Position ${roundIndex + 1} of ${settings.rounds}`}
              className="mp-progress"
            />
            <span className="mp-progress-count">
              {roundIndex + 1}/{settings.rounds}
            </span>
          </div>
        )}

        {phase === 'idle' && (
          <>
            {notice && (
              <Alert color={notice.kind === 'load' ? 'red' : 'yellow'} role="alert">
                {notice.text}
              </Alert>
            )}
            <Button className="mp-start" size="xl" fullWidth loading={busy} onClick={begin}>
              {notice?.kind === 'load' ? 'Try again' : 'Start'}
            </Button>
            <Button
              variant="subtle"
              color="gray"
              leftSection={<GearIcon />}
              onClick={openSettings}
              disabled={busy}
            >
              Settings: {preset === 'custom' ? 'Custom' : PRESET_LABEL[preset]}
            </Button>
          </>
        )}

        {phase === 'memorise' && (
          <>
            <div className="mp-clock" role="timer" aria-label="Seconds left to memorise">
              {seconds(remaining ?? settings.memoriseSeconds * 1000)}
            </div>
            <p className="mp-prompt">Memorise the position.</p>
          </>
        )}

        {phase === 'mask' && <p className="mp-prompt">Removing one piece.</p>}

        {phase === 'guessSquare' && round && (
          <>
            <div className="mp-clock mp-clock-guess" role="timer" aria-label="Seconds left to find the square">
              {seconds(remaining ?? settings.guessSeconds * 1000)}
            </div>
            <p className="mp-prompt">One piece is gone. Click the square it stood on.</p>
            <p className="mp-note" aria-live="polite">
              {round.wrongSquares.length > 0 && 'Not that square. '}
              {triesLeft === 1 ? '1 try left.' : `${triesLeft} tries left.`}
            </p>
          </>
        )}

        {phase === 'guessPiece' && round && <p className="mp-prompt">{pieceQuestion(round, settings)}</p>}

        {phase === 'result' && round && round.guess && (
          <>
            <div className="mp-answer">
              <PieceIcon color={round.target.color} role={round.target.role} />
              <p className={`mp-verdict ${verdict(round).right ? 'is-right' : 'is-wrong'}`} role="status">
                {verdict(round).text}
              </p>
            </div>
            <Button className="mp-next" size="xl" fullWidth loading={busy} onClick={next}>
              {isLastRound ? 'See summary' : 'Next position'}
              <span className="mp-next-in" aria-hidden="true">
                {seconds(remaining ?? NEXT_AFTER_SECONDS * 1000)}
              </span>
            </Button>
            <Anchor
              className="mp-lichess"
              href={`https://lichess.org/training/${round.position.id}`}
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
            <div className="mp-clock" aria-label="Correct positions">
              {correct}/{state.history.length}
            </div>
            <p className="mp-prompt">
              correct{preset !== 'custom' && ` on ${PRESET_LABEL[preset]}`}.
              {newBest && ' Your best so far.'}
              {!newBest && preset !== 'custom' && best[preset] !== undefined && ` Your best is ${best[preset]}.`}
            </p>
            <Table className="mp-rounds" verticalSpacing={4} horizontalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Missing piece</Table.Th>
                  <Table.Th ta="right">Result</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {state.history.map((r, i) => (
                  <Table.Tr key={r.position.id}>
                    <Table.Td>{i + 1}</Table.Td>
                    <Table.Td>
                      <Anchor href={`https://lichess.org/training/${r.position.id}`} target="_blank" rel="noreferrer" size="sm">
                        {r.target.color} {r.target.role}, {r.target.square}
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
            <div className="mp-actions">
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
        title={round ? pieceQuestion(round, settings) : ''}
        classNames={{ title: 'mp-dialog-title' }}
      >
        <PiecePicker
          key={roundIndex}
          onSubmit={(guess) => dispatch({ type: 'submitPiece', guess, now: Date.now() })}
        />
      </Modal>

      <Drawer
        opened={settingsOpen}
        onClose={closeSettings}
        position={isNarrow ? 'bottom' : 'right'}
        size={isNarrow ? '90%' : 'md'}
        title="Settings"
        classNames={{ title: 'mp-drawer-title' }}
      >
        <div className="mp-drawer-body">
          <p className="mp-lead">
            Memorise the position. One piece will be removed. Click the square it stood on, then say
            which piece it was.
          </p>
          <SettingsPanel settings={settings} onChange={changeSettings} />
          {preset !== 'custom' && best[preset] !== undefined && (
            <p className="mp-best">
              Best on {PRESET_LABEL[preset]}: {best[preset]}
            </p>
          )}
          <Button fullWidth onClick={closeSettings}>
            Done
          </Button>
        </div>
      </Drawer>
    </div>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export default function MissingPiece() {
  return (
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme="auto">
      <Exercise />
    </MantineProvider>
  );
}

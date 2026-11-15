import { useEffect, useReducer, useRef, useState } from 'react';
import { Alert, Anchor, Button, Drawer, MantineProvider, Table } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import '@mantine/core/styles.css';
import Board, { type SquareMark } from '../../components/Board';
import { boardFenWithout, loadPositions, pickRound, type Color } from '../../lib/positions';
import { readJson, writeJson } from '../../lib/storage';
import { initialState, reduce, sessionTotal, type NewRound, type Round, type State } from './machine';
import PiecePicker, { PieceIcon } from './PiecePicker';
import SettingsPanel from './SettingsPanel';
import { matchPreset, sanitize, type PresetName, type Settings } from './settings';
import { cssVariablesResolver, theme } from './theme';
import './MissingPiece.css';

const SETTINGS_KEY = 'aesymnetes:missing-piece:settings';
const BEST_KEY = 'aesymnetes:missing-piece:best';
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

async function drawRound(settings: Settings, usedIds: readonly string[]): Promise<NewRound | null> {
  const pool = await loadPositions();
  const picked = pickRound(pool, settings, new Set(usedIds));
  if (!picked) return null;
  const orientation: Color =
    settings.side === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : settings.side;
  return { ...picked, orientation };
}

function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
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

function ScoreLines({ round }: { round: Round }) {
  const score = round.score!;
  const rows: [string, number][] = [
    ['Square', score.square],
    ['Piece', score.piece],
  ];
  if (score.bonus > 0) rows.push(['Speed bonus', score.bonus]);
  return (
    <dl className="mp-score-lines">
      {rows.map(([label, points]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{points}</dd>
        </div>
      ))}
      <div className="mp-score-total">
        <dt>This position</dt>
        <dd>{score.total}</dd>
      </div>
    </dl>
  );
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
  const total = sessionTotal(state);

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
      const next = await drawRound(settings, []);
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
      dispatch({ type: 'next', round: await drawRound(settings, state.usedIds) });
    } catch {
      dispatch({ type: 'next', round: null });
    } finally {
      setBusy(false);
    }
  };

  // Countdown while memorising. One effect owns the timer, so Ready and the timeout cannot both act.
  useEffect(() => {
    if (phase !== 'memorise' || settings.memoriseSeconds === null) {
      setRemaining(null);
      return;
    }
    const deadline = Date.now() + settings.memoriseSeconds * 1000;
    setRemaining(deadline - Date.now());
    const id = setInterval(() => {
      const left = deadline - Date.now();
      setRemaining(left);
      if (left <= 0) {
        clearInterval(id);
        dispatch({ type: 'ready', now: Date.now() });
      }
    }, 100);
    return () => clearInterval(id);
  }, [phase, roundIndex, settings.memoriseSeconds]);

  useEffect(() => {
    if (phase !== 'mask') return;
    const id = setTimeout(() => dispatch({ type: 'maskDone', now: Date.now() }), settings.maskMs);
    return () => clearTimeout(id);
  }, [phase, settings.maskMs]);

  // The best score as it stood when the session began, so the summary can say "new best" at once.
  const newBest =
    phase === 'summary' && preset !== 'custom' && total > (bestAtStart.current[preset] ?? 0);
  useEffect(() => {
    if (!newBest || preset === 'custom') return;
    const updated = { ...best, [preset]: total };
    setBest(updated);
    writeJson(BEST_KEY, updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newBest]);

  const inSession = phase !== 'idle' && phase !== 'summary';
  const triesLeft = round ? settings.attempts - round.wrongSquares.length : 0;
  const isLastRound = roundIndex + 1 >= settings.rounds;

  return (
    <div className="mp">
      <div className="mp-board">
        <Board {...boardView(state, (square) => dispatch({ type: 'clickSquare', square }))} />
      </div>

      <div className="mp-panel">
        <h1 className="mp-title">Missing piece</h1>

        {inSession && (
          <div className="mp-status">
            <span>
              Position {roundIndex + 1} of {settings.rounds}
            </span>
            <span>
              Score <strong>{total}</strong>
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
            {remaining !== null && (
              <div className="mp-clock" role="timer" aria-label="Time left to memorise">
                {clock(remaining)}
              </div>
            )}
            <p className="mp-prompt">Memorise the position.</p>
            <Button size="md" onClick={() => dispatch({ type: 'ready', now: Date.now() })}>
              I'm ready
            </Button>
          </>
        )}

        {phase === 'mask' && <p className="mp-prompt">Removing one piece.</p>}

        {phase === 'guessSquare' && round && (
          <>
            <p className="mp-prompt">One piece is gone. Click the square it stood on.</p>
            <p className="mp-note" aria-live="polite">
              {round.wrongSquares.length > 0 && 'Not that square. '}
              {triesLeft === 1 ? '1 try left.' : `${triesLeft} tries left.`}
            </p>
          </>
        )}

        {phase === 'guessPiece' && round && (
          <>
            <p className="mp-prompt">
              {round.revealed
                ? `Out of tries. The piece stood on ${round.target.square}. Which piece was it?`
                : `Yes, ${round.target.square}. Which piece was it?`}
            </p>
            <PiecePicker
              key={roundIndex}
              onSubmit={(guess) => dispatch({ type: 'submitPiece', guess, now: Date.now() })}
            />
          </>
        )}

        {phase === 'result' && round && round.guess && (
          <>
            <div className="mp-answer">
              <PieceIcon color={round.target.color} role={round.target.role} />
              <p className="mp-prompt">
                It was the {round.target.color} {round.target.role} on {round.target.square}.
              </p>
            </div>
            {(round.guess.color !== round.target.color || round.guess.role !== round.target.role) && (
              <p className="mp-note">
                You said {round.guess.color} {round.guess.role}.
              </p>
            )}
            <ScoreLines round={round} />
            <div className="mp-actions">
              <Button size="md" loading={busy} onClick={next}>
                {isLastRound ? 'See summary' : 'Next position'}
              </Button>
              <Anchor
                href={`https://lichess.org/training/${round.position.id}`}
                target="_blank"
                rel="noreferrer"
                size="sm"
              >
                View on Lichess
              </Anchor>
            </div>
          </>
        )}

        {phase === 'summary' && (
          <>
            <div className="mp-clock" aria-label="Session score">
              {total}
            </div>
            <p className="mp-prompt">
              {state.history.length} {state.history.length === 1 ? 'position' : 'positions'} played
              {preset !== 'custom' && ` on ${PRESET_LABEL[preset]}`}.
              {newBest && ' That is your best score on this preset.'}
              {!newBest && preset !== 'custom' && best[preset] !== undefined && ` Your best is ${best[preset]}.`}
            </p>
            <Table className="mp-rounds" verticalSpacing={4} horizontalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Missing piece</Table.Th>
                  <Table.Th ta="right">Square</Table.Th>
                  <Table.Th ta="right">Piece</Table.Th>
                  <Table.Th ta="right">Total</Table.Th>
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
                    <Table.Td ta="right">{r.score?.square ?? 0}</Table.Td>
                    <Table.Td ta="right">{r.score?.piece ?? 0}</Table.Td>
                    <Table.Td ta="right">{r.score?.total ?? 0}</Table.Td>
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

        {inSession && (
          <Button
            className="mp-quit"
            variant="subtle"
            color="gray"
            size="compact-sm"
            onClick={() => dispatch({ type: 'quit' })}
          >
            End session
          </Button>
        )}
      </div>

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

import type { Color, Role } from '../lib/positions';

/**
 * Every piece of text the site shows, in English.
 *
 * A message that depends on data is a function, so that each language builds whole sentences in
 * its own grammar. Components never join pieces of text together themselves.
 */

export type Preset = 'easy' | 'medium' | 'hard';
export interface Piece {
  color: Color;
  role: Role;
}
export interface PieceOn extends Piece {
  square: string;
}

const piece = (p: Piece) => `${p.color} ${p.role}`;
const pieceOn = (p: PieceOn) => `the ${piece(p)} on ${p.square}`;
const plural = (n: number, one: string, other: string) => (n === 1 ? one : other);
const number = (n: number, fractionDigits: [number, number] = [0, 0]) =>
  new Intl.NumberFormat('en', {
    minimumFractionDigits: fractionDigits[0],
    maximumFractionDigits: fractionDigits[1],
  }).format(n);
const presetName: Record<Preset, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/** The summary's sentence after the big score: "correct on Easy. Your best so far." */
const bestSuffix = (newBest: boolean, best: number | undefined) =>
  newBest ? ' Your best so far.' : best !== undefined ? ` Your best is ${best}.` : '';

export const en = {
  site: {
    name: 'Aesymnetes',
    homeTitle: 'Drill',
    homeLead: 'Four short chess exercises in a row: Missing piece, Repeat the moves, Find the square, Hanging pieces.',
    startDrill: 'Start drill',
  },

  common: {
    start: 'Start',
    tryAgain: 'Try again',
    settings: 'Settings',
    settingsWithPreset: (preset: Preset | 'custom') =>
      `Settings: ${preset === 'custom' ? 'Custom' : presetName[preset]}`,
    done: 'Done',
    preset: 'Preset',
    presets: { ...presetName, custom: 'Custom' },
    bestOn: (preset: Preset, best: number) => `Best on ${presetName[preset]}: ${best}`,
    positionOf: (current: number, total: number) => `Position ${current} of ${total}`,
    nextPosition: 'Next position',
    seeSummary: 'See summary',
    viewOnLichess: 'View on Lichess',
    playAgain: 'Play again',
    nextExercise: 'Next exercise',
    finishDrill: 'Finish drill',
    correct: 'Correct',
    wrong: 'Wrong',
    result: 'Result',
    correctPositions: 'Correct positions',
    /** Follows the big "7/10" on a summary. `best` is left out for custom settings. */
    sessionSummary: (p: { preset: Preset | 'custom'; newBest: boolean; best?: number }) =>
      `correct${p.preset !== 'custom' ? ` on ${presetName[p.preset]}` : ''}.${bestSuffix(p.newBest, p.best)}`,
    /** One line for the drill's results table. */
    correctOf: (correct: number, total: number) => `${correct}/${total} correct`,
    loadFailed: 'The positions did not load. Check your connection, then try again.',
    colors: { white: 'White', black: 'Black' } satisfies Record<Color, string>,
    random: 'Random',
    seconds: (n: number, fractionDigits?: [number, number]) => `${number(n, fractionDigits)} s`,
    range: (min: number, max: number) => (min === max ? `${min}` : `${min} to ${max}`),
    piecesOnBoard: 'Pieces on the board',
    sideAtBottom: 'Side at the bottom',
    positionsPerSession: 'Positions per session',
    showCoordinates: 'Show coordinates',
  },

  drill: {
    exerciseOf: (n: number, total: number) => `Exercise ${n} of ${total}`,
    complete: 'Drill complete',
    again: 'Drill again',
    home: 'Home',
    startNow: 'Start now',
    secondsUntilStart: 'Seconds until the exercise starts',
  },

  missingPiece: {
    title: 'Missing piece',
    intro:
      'Memorise the position. One piece will be removed. Click the square it stood on, then say which piece it was.',
    noPositionFits:
      'No position fits these settings. Widen the range of pieces on the board, or allow more kinds of piece to go missing.',
    secondsLeftToMemorise: 'Seconds left to memorise',
    memorise: 'Memorise the position.',
    removing: 'Removing one piece.',
    secondsLeftToFindSquare: 'Seconds left to find the square',
    findSquare: 'One piece is gone. Click the square it stood on.',
    notThatSquare: 'Not that square.',
    triesLeft: (n: number) => plural(n, '1 try left.', `${n} tries left.`),
    whichPiece: (square: string) => `Yes, ${square}. Which piece was it?`,
    whichPieceRevealed: (square: string, reason: 'outOfTries' | 'timeUp') =>
      `${reason === 'outOfTries' ? 'Out of tries' : "Time's up"}. The piece stood on ${square}. Which piece was it?`,
    secondsLeftToChoosePiece: 'Seconds left to choose the piece',
    verdict: {
      correct: (answer: PieceOn) => `Correct: ${pieceOn(answer)}.`,
      timeUp: (answer: PieceOn) => `Time's up. It was ${pieceOn(answer)}.`,
      missedSquare: (answer: PieceOn) => `Right piece, but you missed the square. It was ${pieceOn(answer)}.`,
      wrong: (answer: PieceOn, guess: Piece) => `Wrong. It was ${pieceOn(answer)}, not the ${piece(guess)}.`,
      wrongPiece: (answer: PieceOn, guess: Piece) =>
        `Right square, wrong piece. It was ${pieceOn(answer)}, not the ${piece(guess)}.`,
    },
    missingPieceColumn: 'Missing piece',
    historyRow: (target: PieceOn) => `${piece(target)}, ${target.square}`,
    picker: {
      color: 'Piece colour',
      type: 'Piece type',
      piece: (p: Piece) => piece(p),
      confirm: 'Confirm piece',
    },
    settings: {
      timeToMemorise: 'Time to memorise',
      secondsToMemorise: 'Seconds to memorise',
      timeToFindSquare: 'Time to find the square',
      secondsToFindSquare: 'Seconds to find the square',
      boardHidden: 'Board hidden before guessing',
      secondsHidden: 'Seconds the board is hidden',
      removable: 'Piece that can go missing',
      removableAny: 'Any',
      removableNoPawns: 'No pawns',
      removablePawnsOnly: 'Pawns only',
      triesAtSquare: 'Tries at the square',
    },
  },

  repeatMoves: {
    title: 'Repeat the moves',
    intro:
      'Look at a position from a real game. A few moves play out, then the board goes back. Play the same moves again, for both sides.',
    noPositionFits: 'No position fits these settings. Widen the range of pieces on the board.',
    secondsBeforeMoves: 'Seconds before the moves start',
    look: (plies: number) => `Look at the position. ${plural(plies, '1 move', `${plies} moves`)} will follow.`,
    movesShown: 'Moves shown',
    watch: 'Watch the moves.',
    moveToPlay: 'Move to play',
    replay: (toMove: Color) => `Play the moves again. ${toMove === 'white' ? 'White' : 'Black'} to move.`,
    verdict: {
      correct: (plies: number) => `Correct: all ${plies} moves.`,
      wrong: (p: { at: number; plies: number; expected: string; played: string }) =>
        `Wrong at move ${p.at} of ${p.plies}. The move was ${p.expected}, not ${p.played}.`,
    },
    gameColumn: 'Game',
    historyRow: (plies: number, fromMove: number) => `${plural(plies, '1 move', `${plies} moves`)} from move ${fromMove}`,
    settings: {
      movesPerSide: 'Moves per side',
      movesPerSideValue: (n: number) => `${n} (${n * 2} in total)`,
      timeToLook: 'Time to look before the moves',
      secondsToLook: 'Seconds to look before the moves',
      timeBetweenMoves: 'Time between moves',
      toMove: 'To move',
    },
  },

  findSquare: {
    title: 'Find the square',
    intro: (seconds: number) =>
      `A square name appears. Click that square on the board, as many as you can in ${seconds} seconds. No coordinates, and you may play from either side.`,
    bestIs: (best: number) => `Your best is ${best}.`,
    squareToFind: 'Square to find',
    youPlay: (color: Color) => `You play ${color === 'white' ? 'White' : 'Black'}.`,
    right: (n: number) => `${n} right`,
    wrong: (n: number) => `${n} wrong`,
    /** Between the "right" and "wrong" counts while playing. */
    countSeparator: ', ',
    secondsLeft: 'Seconds left',
    squaresFound: 'Squares found',
    summary: (p: { seconds: number; wrong: number; newBest: boolean; best?: number }) =>
      `squares found in ${p.seconds} seconds, ${p.wrong} wrong.${bestSuffix(p.newBest, p.best)}`,
    drillResult: (found: number, wrong: number) =>
      `${found} ${plural(found, 'square', 'squares')} found, ${wrong} wrong`,
  },

  hangingPieces: {
    title: 'Hanging pieces',
    intro:
      'Find every hanging piece, of both colours: a piece the other side attacks and nothing defends. Kings do not count. Click them on the board before the time runs out, then press Done.',
    noPositionFits: 'No position fits these settings. Widen the range of pieces on the board.',
    secondsLeft: 'Seconds left',
    find: (toMove: Color) =>
      `Click every hanging piece, of both colours. There is at least one. ${toMove === 'white' ? 'White' : 'Black'} to move.`,
    picked: (n: number) => plural(n, '1 piece picked.', `${n} pieces picked.`),
    done: 'Done',
    verdict: {
      correct: (n: number) => (n === 1 ? 'Correct: the one hanging piece.' : `Correct: all ${n} hanging pieces.`),
      wrong: (p: { found: number; total: number; wrong: number; timedOut: boolean }) =>
        `${p.timedOut ? "Time's up. " : ''}You found ${p.found} of ${p.total}${
          p.wrong > 0 ? `, and ${plural(p.wrong, '1 pick was', `${p.wrong} picks were`)} not hanging` : ''
        }.`,
    },
    legend: 'Green: found. Orange: missed. Red: not hanging. Arrows show an attacker.',
    hangingColumn: 'Hanging',
    historyRow: (found: number, total: number) => `${found} of ${total} found`,
    settings: {
      timePerPosition: 'Time per position',
      secondsPerPosition: 'Seconds per position',
      toMove: 'To move',
    },
  },
};

/** The shape every language must match. */
export type Messages = typeof en;

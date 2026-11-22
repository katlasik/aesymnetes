import { useEffect, useRef, type MouseEvent } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import './Board.css';

export type SquareMark = 'wrong' | 'answer' | 'picked' | 'missed';

export interface BoardArrow {
  orig: string;
  dest: string;
  brush: 'green' | 'red';
}

export interface BoardProps {
  /** Board FEN or full FEN. */
  fen: string;
  orientation: 'white' | 'black';
  coordinates: boolean;
  /** Shows an empty board, whatever the FEN. */
  hidden?: boolean;
  /** Squares to mark, keyed by square name. */
  marks?: Record<string, SquareMark>;
  /** Called with the square name on a click or tap. Clicks are ignored when absent. View-only boards only. */
  onSquareClick?: (square: string) => void;
  /** Lets the user move pieces of `color` to the given destinations. Absent: the board is view-only. */
  movable?: { color: 'white' | 'black'; dests: Map<string, string[]> };
  /** Called once per move the user makes. */
  onMove?: (orig: string, dest: string) => void;
  /** Highlights the squares of the last move. */
  lastMove?: [string, string];
  arrows?: BoardArrow[];
  /** Slide pieces when the position changes. Off by default: Missing piece must not animate. */
  animate?: boolean;
}

const EMPTY_FEN = '8/8/8/8/8/8/8/8';
const DRAG_TOLERANCE_PX = 10;

function boardConfig(p: BoardProps): Config {
  const marks = p.hidden ? {} : (p.marks ?? {});
  const shapes: DrawShape[] = p.hidden
    ? []
    : (p.arrows ?? []).map((a) => ({ orig: a.orig as Key, dest: a.dest as Key, brush: a.brush }));
  return {
    fen: p.hidden ? EMPTY_FEN : p.fen,
    orientation: p.orientation,
    lastMove: p.lastMove && !p.hidden ? (p.lastMove as Key[]) : undefined,
    turnColor: p.movable?.color,
    highlight: {
      lastMove: !!p.lastMove,
      check: false,
      custom: new Map(Object.entries(marks) as [Key, string][]),
    },
    animation: { enabled: !!p.animate, duration: 200 },
    movable: p.movable
      ? { free: false, color: p.movable.color, dests: p.movable.dests as Map<Key, Key[]>, showDests: true }
      : { free: false, color: undefined, dests: new Map() },
    drawable: { enabled: false, visible: true, autoShapes: shapes },
  };
}

/**
 * A chessground board. View-only by default, reporting square clicks; with `movable`,
 * the user can play legal moves.
 */
export default function Board(props: BoardProps) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const onClick = useRef(props.onSquareClick);
  onClick.current = props.onSquareClick;
  const onMove = useRef(props.onMove);
  onMove.current = props.onMove;
  const interactive = !!props.movable;

  // Rebuilt when coordinates toggle (chessground draws them once, at creation) and when switching
  // between view-only and move mode (chessground binds its pointer handlers only at creation).
  useEffect(() => {
    if (!el.current) return;
    const config = boardConfig(props);
    const cg = Chessground(el.current, {
      ...config,
      // `after` fires only for moves the user makes, not for positions set by the program.
      movable: { ...config.movable, events: { after: (orig, dest) => onMove.current?.(orig, dest) } },
      coordinates: props.coordinates,
      // View-only: chessground binds no pointer handlers of its own. Its handlers act on
      // touchstart, which would turn a scroll gesture into a guess and block page scrolling.
      viewOnly: !interactive,
      premovable: { enabled: false },
      draggable: { enabled: interactive, showGhost: true },
      selectable: { enabled: interactive },
    });
    api.current = cg;
    return () => {
      cg.destroy();
      api.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.coordinates, interactive]);

  const key = JSON.stringify([
    props.fen,
    props.orientation,
    props.hidden,
    props.marks ?? {},
    props.lastMove ?? null,
    props.arrows ?? [],
    props.movable ? [props.movable.color, [...props.movable.dests]] : null,
    props.animate,
  ]);
  useEffect(() => {
    api.current?.set(boardConfig(props));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const pressedAt = useRef<{ x: number; y: number } | null>(null);

  // A click is a real tap or press-and-release; scroll gestures never produce one.
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const cg = api.current;
    if (!cg || !onClick.current || interactive) return;
    // A mouse drag across the board still ends in a click; ignore it if the pointer travelled.
    const down = pressedAt.current;
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > DRAG_TOLERANCE_PX) return;
    // Chessground caches the board's screen position and only refreshes it on scroll or resize.
    // Content above the board can move it without either, so drop the cache before each lookup.
    cg.state.dom.bounds.clear();
    const square = cg.getKeyAtDomPos([e.clientX, e.clientY]);
    if (square) onClick.current(square);
  };

  return (
    <div
      className={`board-frame${props.onSquareClick || interactive ? ' is-clickable' : ''}`}
      onPointerDown={(e) => (pressedAt.current = { x: e.clientX, y: e.clientY })}
      // In move mode chessground maps presses itself; give it fresh bounds first, for the same reason.
      onPointerDownCapture={() => interactive && api.current?.state.dom.bounds.clear()}
      onClick={handleClick}
    >
      <div ref={el} className="board-surface" />
    </div>
  );
}

import { useEffect, useRef, type MouseEvent } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import type { Key } from 'chessground/types';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import './Board.css';

export type SquareMark = 'wrong' | 'answer';

export interface BoardProps {
  /** Board FEN or full FEN. */
  fen: string;
  orientation: 'white' | 'black';
  coordinates: boolean;
  /** Shows an empty board, whatever the FEN. */
  hidden?: boolean;
  /** Squares to mark, keyed by square name. */
  marks?: Record<string, SquareMark>;
  /** Called with the square name on a click or tap. Clicks are ignored when absent. */
  onSquareClick?: (square: string) => void;
}

const EMPTY_FEN = '8/8/8/8/8/8/8/8';
const DRAG_TOLERANCE_PX = 10;

function boardConfig(p: BoardProps): Config {
  const marks = p.hidden ? {} : (p.marks ?? {});
  return {
    fen: p.hidden ? EMPTY_FEN : p.fen,
    orientation: p.orientation,
    highlight: {
      lastMove: false,
      check: false,
      custom: new Map(Object.entries(marks) as [Key, string][]),
    },
  };
}

/** A display-only chessground board that reports square clicks. */
export default function Board(props: BoardProps) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const onClick = useRef(props.onSquareClick);
  onClick.current = props.onSquareClick;

  // The instance is rebuilt when coordinates toggle: chessground draws them once, at creation.
  useEffect(() => {
    if (!el.current) return;
    const cg = Chessground(el.current, {
      ...boardConfig(props),
      coordinates: props.coordinates,
      // A removed piece must not fade or slide away: that would give the answer.
      animation: { enabled: false },
      // View-only: chessground binds no pointer handlers of its own. Its handlers act on
      // touchstart, which would turn a scroll gesture into a guess and block page scrolling.
      viewOnly: true,
      drawable: { enabled: false },
    });
    api.current = cg;
    return () => {
      cg.destroy();
      api.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.coordinates]);

  const markKey = JSON.stringify(props.marks ?? {});
  useEffect(() => {
    api.current?.set(boardConfig(props));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.fen, props.orientation, props.hidden, markKey]);

  const pressedAt = useRef<{ x: number; y: number } | null>(null);

  // A click is a real tap or press-and-release; scroll gestures never produce one.
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const cg = api.current;
    if (!cg || !onClick.current) return;
    // A mouse drag across the board still ends in a click; ignore it if the pointer travelled.
    const down = pressedAt.current;
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > DRAG_TOLERANCE_PX) return;
    // Chessground caches the board's screen position and only refreshes it on scroll or resize.
    // Content above the board can move it without either, so drop the cache before each lookup.
    cg.state.dom.bounds.clear();
    const key = cg.getKeyAtDomPos([e.clientX, e.clientY]);
    if (key) onClick.current(key);
  };

  return (
    <div
      className={`board-frame${props.onSquareClick ? ' is-clickable' : ''}`}
      onPointerDown={(e) => (pressedAt.current = { x: e.clientX, y: e.clientY })}
      onClick={handleClick}
    >
      <div ref={el} className="board-surface" />
    </div>
  );
}

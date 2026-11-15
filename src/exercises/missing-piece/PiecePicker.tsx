import { useState } from 'react';
import { Button, SegmentedControl } from '@mantine/core';
import 'chessground/assets/chessground.cburnett.css';
import type { Color, Role } from '../../lib/positions';
import type { PieceGuess } from './scoring';

// The king is offered too, so the picker does not give away that kings are never removed.
const ROLES: Role[] = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];

/** A piece image from the chessground piece set, usable outside the board. */
export function PieceIcon(p: { color: Color; role: Role }) {
  // Chessground's piece set is keyed on a <piece> tag, which React does not know.
  // Both values come from fixed unions, so the markup is safe to inline.
  return (
    <span
      className="cg-wrap mp-piece-icon"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: `<piece class="${p.role} ${p.color}"></piece>` }}
    />
  );
}

export default function PiecePicker(p: { onSubmit: (g: PieceGuess) => void }) {
  const [color, setColor] = useState<Color>('white');
  const [role, setRole] = useState<Role | null>(null);

  return (
    <div className="mp-picker">
      <SegmentedControl
        fullWidth
        aria-label="Piece colour"
        value={color}
        onChange={(v) => setColor(v as Color)}
        data={[
          { value: 'white', label: 'White' },
          { value: 'black', label: 'Black' },
        ]}
      />
      <div className="mp-picker-roles" role="group" aria-label="Piece type">
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            className="mp-picker-role"
            aria-pressed={role === r}
            aria-label={`${color} ${r}`}
            onClick={() => setRole(r)}
          >
            <PieceIcon color={color} role={r} />
          </button>
        ))}
      </div>
      <Button fullWidth disabled={role === null} onClick={() => role && p.onSubmit({ color, role })}>
        Confirm piece
      </Button>
    </div>
  );
}

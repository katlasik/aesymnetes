import { Button } from '@mantine/core';
import { wholeSeconds } from './useCountdown';

/** The big Next button, showing the seconds until the next position starts by itself. */
export default function NextButton(p: {
  label: string;
  msLeft: number | null;
  seconds: number;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <Button className="ex-next" size="xl" fullWidth loading={p.busy} onClick={p.onClick}>
      {p.label}
      <span className="ex-next-in" aria-hidden="true">
        {wholeSeconds(p.msLeft ?? p.seconds * 1000)}
      </span>
    </Button>
  );
}

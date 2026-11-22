import { Progress } from '@mantine/core';
import { useT } from '../../i18n/react';

/** Progress through a session: a bar of finished positions and "current/total". */
export default function ProgressStatus(p: { done: number; current: number; total: number }) {
  const t = useT();
  return (
    <div className="ex-status">
      <Progress
        value={(100 * p.done) / p.total}
        size="md"
        radius="xl"
        aria-label={t.common.positionOf(p.current, p.total)}
        className="ex-progress"
      />
      <span className="ex-progress-count">
        {p.current}/{p.total}
      </span>
    </div>
  );
}

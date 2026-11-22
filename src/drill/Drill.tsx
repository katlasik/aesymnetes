import { useState, type ComponentType } from 'react';
import { Button, Modal, Table } from '@mantine/core';
import ExerciseProvider from '../components/exercise/ExerciseProvider';
import type { DrillStep } from '../components/exercise/drill';
import { useCountdown, wholeSeconds } from '../components/exercise/useCountdown';
import { FindSquareExercise, RUN_SECONDS } from '../exercises/find-square/FindSquare';
import { HangingPiecesExercise } from '../exercises/hanging-pieces/HangingPieces';
import { MissingPieceExercise } from '../exercises/missing-piece/MissingPiece';
import { RepeatMovesExercise } from '../exercises/repeat-moves/RepeatMoves';
import type { Messages } from '../i18n';
import { useT } from '../i18n/react';
import './Drill.css';

const INTRO_SECONDS = 5;

const STEPS: { text: (t: Messages) => { name: string; intro: string }; Exercise: ComponentType<{ drill?: DrillStep }> }[] = [
  { text: (t) => ({ name: t.missingPiece.title, intro: t.missingPiece.intro }), Exercise: MissingPieceExercise },
  { text: (t) => ({ name: t.repeatMoves.title, intro: t.repeatMoves.intro }), Exercise: RepeatMovesExercise },
  { text: (t) => ({ name: t.findSquare.title, intro: t.findSquare.intro(RUN_SECONDS) }), Exercise: FindSquareExercise },
  { text: (t) => ({ name: t.hangingPieces.title, intro: t.hangingPieces.intro }), Exercise: HangingPiecesExercise },
];

function Run() {
  const t = useT();
  const [step, setStep] = useState(0);
  const [introOpen, setIntroOpen] = useState(true);
  const [results, setResults] = useState<string[]>([]);
  const [drillRun, setDrillRun] = useState(0);

  const done = step >= STEPS.length;
  const remaining = useCountdown(
    !done && introOpen
      ? { key: `intro-${drillRun}-${step}`, seconds: INTRO_SECONDS, onDone: () => setIntroOpen(false) }
      : null,
  );

  const finish = (result: string) => {
    setResults((r) => [...r, result]);
    setStep((s) => s + 1);
    setIntroOpen(true);
  };

  const restart = () => {
    setResults([]);
    setStep(0);
    setIntroOpen(true);
    setDrillRun((n) => n + 1);
  };

  if (done) {
    return (
      <div className="drill-done">
        <h1 className="ex-title">{t.drill.complete}</h1>
        <Table className="ex-rounds" verticalSpacing={6} horizontalSpacing="xs">
          <Table.Tbody>
            {STEPS.map((s, i) => (
              <Table.Tr key={i}>
                <Table.Td>{s.text(t).name}</Table.Td>
                <Table.Td ta="right">{results[i]}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <div className="ex-actions">
          <Button size="md" onClick={restart}>
            {t.drill.again}
          </Button>
          <Button size="md" variant="default" component="a" href="/">
            {t.drill.home}
          </Button>
        </div>
      </div>
    );
  }

  const { text, Exercise } = STEPS[step];
  const { name, intro } = text(t);
  return (
    <>
      <p className="drill-step">
        {t.drill.exerciseOf(step + 1, STEPS.length)}
      </p>
      <Exercise
        key={`${drillRun}-${step}`}
        drill={{ start: !introOpen, isLast: step === STEPS.length - 1, onFinish: finish }}
      />
      <Modal
        opened={introOpen}
        onClose={() => setIntroOpen(false)}
        withCloseButton={false}
        closeOnClickOutside={false}
        centered
        size="md"
        overlayProps={{ backgroundOpacity: 0.45, blur: 2 }}
        title={name}
        classNames={{ title: 'drill-intro-title' }}
      >
        <div className="drill-intro">
          <p className="drill-intro-text">{intro}</p>
          <div className="drill-intro-foot">
            <div className="ex-clock ex-clock-small" role="timer" aria-label={t.drill.secondsUntilStart}>
              {wholeSeconds(remaining ?? INTRO_SECONDS * 1000)}
            </div>
            <Button variant="default" onClick={() => setIntroOpen(false)}>
              {t.drill.startNow}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function Drill() {
  return (
    <ExerciseProvider>
      <Run />
    </ExerciseProvider>
  );
}

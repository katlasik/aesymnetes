import type { ReactNode } from 'react';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { cssVariablesResolver, theme } from './theme';
import './exercise.css';

/** Mantine with the site theme, plus the styles every exercise shares. */
export default function ExerciseProvider(p: { children: ReactNode }) {
  return (
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme="auto">
      {p.children}
    </MantineProvider>
  );
}

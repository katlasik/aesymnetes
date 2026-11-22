import type { ReactNode } from 'react';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import type { Locale } from '../../i18n';
import { I18nProvider } from '../../i18n/react';
import { cssVariablesResolver, theme } from './theme';
import './exercise.css';

/** Mantine with the site theme, the site's messages, and the styles every exercise shares. */
export default function ExerciseProvider(p: { locale?: Locale; children: ReactNode }) {
  return (
    <I18nProvider locale={p.locale}>
      <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme="auto">
        {p.children}
      </MantineProvider>
    </I18nProvider>
  );
}

import { createTheme, type CSSVariablesResolver, type MantineColorsTuple } from '@mantine/core';

// Fountain-pen blue: the one accent. The board is the only warm object on the page.
const ink: MantineColorsTuple = [
  '#eef3fb',
  '#d9e3f5',
  '#b3c6ea',
  '#8aa8df',
  '#6990d6',
  '#4f7dcf',
  '#3d6fc8',
  '#2f5eb3',
  '#1f4fa3',
  '#164291',
];

export const theme = createTheme({
  primaryColor: 'ink',
  primaryShade: { light: 8, dark: 4 },
  colors: { ink },
  fontFamily: "'Instrument Sans Variable', ui-sans-serif, 'Helvetica Neue', Arial, sans-serif",
  headings: { fontFamily: "'Instrument Sans Variable', ui-sans-serif, 'Helvetica Neue', Arial, sans-serif" },
  defaultRadius: 'sm',
});

// Keep Mantine's page colours in step with the plain-Astro pages (see Base.astro).
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-body': '#eceff1',
    '--mantine-color-text': '#18212b',
    '--mantine-color-dimmed': '#5c6875',
  },
  dark: {
    '--mantine-color-body': '#12171d',
    '--mantine-color-text': '#e3e8ed',
    '--mantine-color-dimmed': '#8d99a6',
  },
});

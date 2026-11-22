import { en, type Messages } from './en';

export type { Messages, Piece, PieceOn, Preset } from './en';

/**
 * The languages the site is written in. To add one: write `src/i18n/<code>.ts` as an object that
 * `satisfies Messages`, and list it here. Then pass the locale to `I18nProvider` and `Base`.
 */
const MESSAGES = { en } satisfies Record<string, Messages>;

export type Locale = keyof typeof MESSAGES;
export const DEFAULT_LOCALE: Locale = 'en';

export function messagesFor(locale: Locale = DEFAULT_LOCALE): Messages {
  return MESSAGES[locale];
}

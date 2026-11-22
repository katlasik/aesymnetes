import { createContext, useContext, type ReactNode } from 'react';
import { DEFAULT_LOCALE, messagesFor, type Locale, type Messages } from './index';

const MessagesContext = createContext<Messages>(messagesFor(DEFAULT_LOCALE));

export function I18nProvider(p: { locale?: Locale; children: ReactNode }) {
  return <MessagesContext.Provider value={messagesFor(p.locale)}>{p.children}</MessagesContext.Provider>;
}

/** The current language's messages: `const t = useT(); t.common.start`. */
export function useT(): Messages {
  return useContext(MessagesContext);
}

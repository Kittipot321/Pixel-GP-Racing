// Language context: the active UI language, its messages, and a setter.
//
// The choice is remembered in localStorage (only written when the player
// switches) and mirrored to <html lang> so assistive tech and the browser use
// the right language. Storage can be missing or throw (private browsing);
// every access is guarded and falls back to the default language.
//
// Components outside a LanguageProvider (e.g. unit tests that mount a single
// page) get the default language, so they keep rendering Thai text.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_LANGUAGE,
  MESSAGES,
  isLanguage,
  type Language,
  type Messages,
} from './messages.ts';

export const LANGUAGE_STORAGE_KEY = 'pixel-race.lang';

export interface I18nValue {
  lang: Language;
  t: Messages;
  setLang: (lang: Language) => void;
}

const I18nContext = createContext<I18nValue>({
  lang: DEFAULT_LANGUAGE,
  t: MESSAGES[DEFAULT_LANGUAGE],
  setLang: () => {},
});

export function readLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(saved) ? saved : DEFAULT_LANGUAGE;
  } catch (err) {
    console.warn('Language preference: could not read the saved value', err);
    return DEFAULT_LANGUAGE;
  }
}

function writeLanguage(lang: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch (err) {
    console.warn('Language preference: could not save the value', err);
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(readLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    writeLanguage(next);
  }, []);

  const value = useMemo(() => ({ lang, t: MESSAGES[lang], setLang }), [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

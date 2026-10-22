// Theme context: light or dark colors for the whole site, race track included.
//
// The first visit follows the system setting (prefers-color-scheme). Once the
// player switches, the choice is remembered in localStorage and wins from then
// on. The active theme is mirrored to <html data-theme> (the CSS tokens in
// index.css switch on it) and to color-scheme, so native controls match.
// index.html applies the same rule before React mounts, so there is no flash.
// Storage and matchMedia can be missing or throw; every access is guarded.
//
// Components outside a ThemeProvider (e.g. unit tests that mount a single
// page) get the dark theme, which is the original look.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = 'dark';

export const THEME_STORAGE_KEY = 'pixel-race.theme';

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

export interface ThemeValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  toggleTheme: () => {},
});

function systemTheme(): Theme {
  try {
    if (typeof window.matchMedia !== 'function') {
      return DEFAULT_THEME;
    }
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch (err) {
    console.warn('Theme preference: could not read the system setting', err);
    return DEFAULT_THEME;
  }
}

/** The saved theme, else the system setting, else dark. */
export function readTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(saved)) {
      return saved;
    }
  } catch (err) {
    console.warn('Theme preference: could not read the saved value', err);
  }
  return systemTheme();
}

function writeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (err) {
    console.warn('Theme preference: could not save the value', err);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    writeTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      writeTheme(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

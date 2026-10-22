// Light / dark switch.
//
// One button that flips the theme. Its accessible name says what it does, and
// aria-pressed reports whether dark mode is on, so a reader hears the current
// state as well as the action.

import { pixelButtonCompact } from '../app/ui.ts';
import { useI18n } from '../i18n/i18n-context.tsx';
import { useTheme } from './theme-context.tsx';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const isDark = theme === 'dark';
  const action = isDark ? t.theme.toLight : t.theme.toDark;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`${pixelButtonCompact} min-w-10 ${className}`}
      aria-label={t.theme.toggle}
      aria-pressed={isDark}
      title={action}
      data-testid="theme-toggle"
    >
      <span aria-hidden="true">{isDark ? '🌙' : '☀️'}</span>
    </button>
  );
}

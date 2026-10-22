// TH / EN language switch.
//
// Two pressed-state buttons in a labelled group. Each button's accessible name
// is the language's own name ("ภาษาไทย", "English"), so a reader can find
// their language whichever one is active.

import { useI18n } from './i18n-context.tsx';
import type { Language } from './messages.ts';

const OPTIONS: { lang: Language; short: string; name: string }[] = [
  { lang: 'th', short: 'TH', name: 'ภาษาไทย' },
  { lang: 'en', short: 'EN', name: 'English' },
];

const optionButton =
  'cursor-pointer px-2 py-1 font-pixel text-[0.6rem] leading-relaxed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-pressed:bg-accent aria-pressed:text-on-accent';

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { lang, t, setLang } = useI18n();

  return (
    <div
      role="group"
      aria-label={t.language.groupLabel}
      className={`inline-flex border-4 border-edge bg-panel text-snow shadow-[4px_4px_0_0_#000] ${className}`}
      data-testid="language-toggle"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.lang}
          type="button"
          lang={option.lang}
          aria-label={option.name}
          aria-pressed={lang === option.lang}
          onClick={() => setLang(option.lang)}
          className={optionButton}
          data-testid={`language-${option.lang}`}
        >
          {option.short}
        </button>
      ))}
    </div>
  );
}

// Language switch tests: Thai is the default, switching re-renders the page
// text in English, the choice is remembered, and <html lang> follows it.

import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../test-support/render.tsx';
import { LANGUAGE_STORAGE_KEY, LanguageProvider, useI18n } from './i18n-context.tsx';
import { LanguageToggle } from './LanguageToggle.tsx';
import { MESSAGES } from './messages.ts';

function Sample() {
  const { t } = useI18n();
  return <p data-testid="sample">{t.nav.play}</p>;
}

function renderToggle() {
  return renderWithProviders(
    <LanguageProvider>
      <LanguageToggle />
      <Sample />
    </LanguageProvider>,
  );
}

describe('LanguageToggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = '';
  });

  it('starts in Thai with the TH option pressed', () => {
    renderToggle();

    expect(screen.getByTestId('sample')).toHaveTextContent('เล่นเกม');
    expect(screen.getByTestId('language-th')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('language-en')).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.lang).toBe('th');
  });

  it('switches the text to English and back, remembering the choice', () => {
    renderToggle();

    fireEvent.click(screen.getByTestId('language-en'));
    expect(screen.getByTestId('sample')).toHaveTextContent('Play');
    expect(screen.getByTestId('language-en')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');

    fireEvent.click(screen.getByTestId('language-th'));
    expect(screen.getByTestId('sample')).toHaveTextContent('เล่นเกม');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('th');
  });

  it('restores a saved language and ignores an unknown saved value', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    const { unmount } = renderToggle();
    expect(screen.getByTestId('sample')).toHaveTextContent('Play');
    unmount();

    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
    renderToggle();
    expect(screen.getByTestId('sample')).toHaveTextContent('เล่นเกม');
  });
});

describe('apiMessage', () => {
  it('translates known API messages to Thai and keeps unknown ones as sent', () => {
    expect(MESSAGES.th.apiMessage('Password is required')).toBe('กรุณากรอกรหัสผ่าน');
    expect(MESSAGES.th.apiMessage('Something else')).toBe('Something else');
    expect(MESSAGES.en.apiMessage('Password is required')).toBe('Password is required');
  });
});

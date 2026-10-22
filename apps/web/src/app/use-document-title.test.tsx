import { act, render } from '@testing-library/react';
import { LanguageProvider, useI18n, type I18nValue } from '../i18n/i18n-context.tsx';
import { pageTitle, useDocumentTitle } from './use-document-title.ts';

let i18n: I18nValue;

function Page({ name }: { name: 'home' | 'leaderboard' }) {
  i18n = useI18n();
  useDocumentTitle(name === 'home' ? null : i18n.t.nav.leaderboard);
  return null;
}

describe('pageTitle', () => {
  it('uses the tagline on the home page and the page name elsewhere', () => {
    expect(pageTitle(null, 'tagline')).toBe('Pixel GP Racing - tagline');
    expect(pageTitle('Leaderboard', 'tagline')).toBe('Leaderboard | Pixel GP Racing');
  });
});

describe('useDocumentTitle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.title = '';
  });

  it('sets the Thai home title by default', () => {
    render(
      <LanguageProvider>
        <Page name="home" />
      </LanguageProvider>,
    );
    expect(document.title).toBe('Pixel GP Racing - เกมทายผลแข่งรถ F1 พิกเซล');
  });

  it('follows a language switch', () => {
    render(
      <LanguageProvider>
        <Page name="leaderboard" />
      </LanguageProvider>,
    );
    expect(document.title).toBe('อันดับ | Pixel GP Racing');

    act(() => i18n.setLang('en'));
    expect(document.title).toBe('Leaderboard | Pixel GP Racing');
  });

  it('updates when the page changes', () => {
    const { rerender } = render(
      <LanguageProvider>
        <Page name="leaderboard" />
      </LanguageProvider>,
    );
    rerender(
      <LanguageProvider>
        <Page name="home" />
      </LanguageProvider>,
    );
    expect(document.title).toBe('Pixel GP Racing - เกมทายผลแข่งรถ F1 พิกเซล');
  });
});

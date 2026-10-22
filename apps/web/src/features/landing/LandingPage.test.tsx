// Landing page: the wireframe sections render, every call to action leads to
// /play, missing screenshots fall back to a placeholder, and the score note
// follows the accounts switch.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../test-support/render.tsx';
import { LanguageProvider } from '../../i18n/i18n-context.tsx';

const authState = { authEnabled: true };

vi.mock('../auth/auth-context.tsx', () => ({
  useAuth: () => ({ ...authState, user: null, initializing: false }),
}));

const { LandingPage } = await import('./LandingPage.tsx');

describe('LandingPage', () => {
  beforeEach(() => {
    authState.authEnabled = true;
  });

  it('renders the hero heading and every section heading', () => {
    renderWithProviders(<LandingPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pixel GP Racing');
    const h2s = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(h2s).toEqual([
      expect.stringContaining('ทำไมต้องเล่นเกมนี้?'),
      expect.stringContaining('วิธีการเล่น'),
      expect.stringContaining('ภาพบรรยากาศในเกม'),
      expect.stringContaining('พร้อมลุ้นแล้วหรือยัง?'),
    ]);
  });

  it('sends every call to action to /play', () => {
    renderWithProviders(<LandingPage />);

    for (const id of ['landing-header-cta', 'landing-hero-cta', 'landing-final-cta']) {
      expect(screen.getByTestId(id)).toHaveAttribute('href', '/play');
    }
  });

  it('links the guide to the how-to-play section', () => {
    const { container } = renderWithProviders(<LandingPage />);

    expect(screen.getByTestId('landing-guide-link')).toHaveAttribute('href', '#how-to-play');
    const section = container.querySelector('#how-to-play');
    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).getAllByRole('listitem')).toHaveLength(3);
  });

  it('shows a placeholder when a screenshot is missing', () => {
    renderWithProviders(<LandingPage />);

    const slot = screen.getByTestId('shot-race');
    fireEvent.error(within(slot).getByRole('img'));

    expect(screen.getByTestId('shot-race-placeholder')).toHaveAttribute(
      'aria-label',
      'รถ F1 สี่สีชิงตำแหน่งกลางสนาม',
    );
    expect(within(slot).queryByRole('img', { name: '' })).not.toBeInTheDocument();
  });

  it('hides the score note when accounts are turned off', () => {
    authState.authEnabled = false;
    renderWithProviders(<LandingPage />);

    expect(screen.queryByTestId('landing-score-note')).not.toBeInTheDocument();
  });

  it('shows the score note when accounts are on', () => {
    renderWithProviders(<LandingPage />);

    expect(screen.getByTestId('landing-score-note')).toBeInTheDocument();
  });

  it('switches the text to English', () => {
    renderWithProviders(
      <LanguageProvider>
        <LandingPage />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getAllByTestId('language-en')[0]);

    expect(screen.getByRole('heading', { level: 2, name: /Why play\?/ })).toBeInTheDocument();
    expect(screen.getByTestId('landing-final-cta')).toHaveTextContent('Play free right now!');
  });
});

// Route-guard tests (FR4.1, FR4.5): a guest can open /play, while /leaderboard
// and /profile still send them to the login page. With accounts turned off,
// every account route redirects to /play instead.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './test-support/render.tsx';

const authState = { authEnabled: true };

vi.mock('./features/auth/auth-context.tsx', () => ({
  useAuth: () => ({
    ...authState,
    user: null,
    isAuthenticated: false,
    initializing: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

// Keep Phaser out of jsdom: the play page only needs a placeholder canvas here.
vi.mock('./game/GameCanvas.tsx', () => ({
  GameCanvas: () => <div data-testid="game-canvas" />,
}));

const { AppRoutes } = await import('./App.tsx');

describe('AppRoutes for a guest', () => {
  beforeEach(() => {
    authState.authEnabled = true;
  });

  it('opens the landing page at /', () => {
    renderWithProviders(<AppRoutes />, { route: '/' });

    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    expect(screen.queryByTestId('app-layout')).not.toBeInTheDocument();
  });

  it('opens the play page at /play', () => {
    renderWithProviders(<AppRoutes />, { route: '/play' });

    expect(screen.getByTestId('play-page')).toBeInTheDocument();
    expect(screen.getByTestId('guest-banner')).toBeInTheDocument();
  });

  it('redirects /leaderboard to the login page', () => {
    renderWithProviders(<AppRoutes />, { route: '/leaderboard' });

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('leaderboard-page')).not.toBeInTheDocument();
  });

  it('redirects /profile to the login page', () => {
    renderWithProviders(<AppRoutes />, { route: '/profile' });

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('profile-page')).not.toBeInTheDocument();
  });

  it.each(['/', '/play', '/login', '/register'])(
    'shows the fixed bottom-right donate button on %s',
    (route) => {
      renderWithProviders(<AppRoutes />, { route });

      const donate = screen.getByTestId('donate-button');
      expect(donate).toHaveClass('fixed', 'bottom-4', 'right-4');
      expect(donate).toHaveAttribute('target', '_blank');
      expect(donate).toHaveAttribute('rel', 'noopener noreferrer');
      expect(donate.getAttribute('href')).toMatch(/^https:\/\/(www\.)?buymeacoffee\.com\//);
    },
  );
});

describe('AppRoutes with accounts turned off', () => {
  beforeEach(() => {
    authState.authEnabled = false;
  });

  it.each(['/login', '/register', '/leaderboard', '/profile'])(
    'redirects %s to the play page',
    (route) => {
      renderWithProviders(<AppRoutes />, { route });

      expect(screen.getByTestId('play-page')).toBeInTheDocument();
      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
      expect(screen.queryByTestId('register-page')).not.toBeInTheDocument();
    },
  );
});

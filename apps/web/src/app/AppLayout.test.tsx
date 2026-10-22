// AppLayout nav tests (FR4.5, FR4.6): guests see login/register and none of the
// account-only links; logged-in players see their name and logout; nothing
// session-dependent shows while the stored session is being verified. Also
// FR2.1: /play uses the full page width, other pages keep the 820px column.
// Phone menu: the menu button opens and closes the stacked nav panel, Esc and
// navigation close it, and the theme switch is always in the header.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../test-support/render.tsx';

const authState: {
  authEnabled: boolean;
  user: { username: string } | null;
  isAuthenticated: boolean;
  initializing: boolean;
} = { authEnabled: true, user: null, isAuthenticated: false, initializing: false };

vi.mock('../features/auth/auth-context.tsx', () => ({
  useAuth: () => ({ ...authState, logout: vi.fn() }),
}));

const { AppLayout } = await import('./AppLayout.tsx');

describe('AppLayout nav', () => {
  beforeEach(() => {
    authState.authEnabled = true;
    authState.user = null;
    authState.isAuthenticated = false;
    authState.initializing = false;
  });

  it('shows play, login, and register to a guest, and hides account-only links', () => {
    renderWithProviders(<AppLayout />);

    expect(screen.getByTestId('nav-play')).toBeInTheDocument();
    expect(screen.getByTestId('nav-login')).toHaveAttribute('href', '/login');
    expect(screen.getByTestId('nav-register')).toHaveAttribute('href', '/register');
    expect(screen.queryByTestId('nav-logout')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-leaderboard')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-profile')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-username')).not.toBeInTheDocument();
  });

  it('shows the username, account links, and logout to a logged-in player', () => {
    authState.user = { username: 'tester' };
    authState.isAuthenticated = true;

    renderWithProviders(<AppLayout />);

    expect(screen.getByTestId('nav-username')).toHaveTextContent('tester');
    expect(screen.getByTestId('nav-logout')).toBeInTheDocument();
    expect(screen.getByTestId('nav-leaderboard')).toBeInTheDocument();
    expect(screen.getByTestId('nav-profile')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-login')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-register')).not.toBeInTheDocument();
  });

  it('uses the full page width on /play and keeps the 820px column elsewhere', () => {
    const { unmount } = renderWithProviders(<AppLayout />, { route: '/play' });
    expect(screen.getByTestId('app-main')).not.toHaveClass('max-w-[820px]');
    expect(screen.getByTestId('app-main')).toHaveClass('w-full');
    unmount();

    renderWithProviders(<AppLayout />, { route: '/leaderboard' });
    expect(screen.getByTestId('app-main')).toHaveClass('max-w-[820px]');
  });

  it('shows neither login nor logout while the session is being verified', () => {
    authState.initializing = true;

    renderWithProviders(<AppLayout />);

    expect(screen.getByTestId('nav-play')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-login')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-register')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-logout')).not.toBeInTheDocument();
  });

  it('opens and closes the phone menu with the menu button and Esc', () => {
    renderWithProviders(<AppLayout />);
    const toggle = screen.getByTestId('nav-menu-toggle');
    const menu = screen.getByTestId('nav-menu');

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'nav-menu');
    expect(menu).toHaveClass('hidden');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName('ปิดเมนู');
    expect(menu).toHaveClass('flex');
    expect(menu).not.toHaveClass('hidden');
    // The menu holds the session links and the language switch.
    expect(menu).toContainElement(screen.getByTestId('nav-login'));
    expect(menu).toContainElement(screen.getByTestId('language-toggle'));

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(menu).toHaveClass('hidden');
  });

  it('closes the phone menu after navigating', () => {
    renderWithProviders(<AppLayout />, { route: '/leaderboard' });
    fireEvent.click(screen.getByTestId('nav-menu-toggle'));
    expect(screen.getByTestId('nav-menu-toggle')).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByTestId('nav-play'));
    expect(screen.getByTestId('nav-menu-toggle')).toHaveAttribute('aria-expanded', 'false');
  });

  it('always shows the theme switch in the header', () => {
    renderWithProviders(<AppLayout />);
    expect(screen.getByTestId('app-nav')).toContainElement(screen.getByTestId('theme-toggle'));
  });

  it('shows only the play link to a guest when accounts are turned off', () => {
    authState.authEnabled = false;

    renderWithProviders(<AppLayout />);

    expect(screen.getByTestId('nav-play')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-login')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-register')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-logout')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-leaderboard')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-profile')).not.toBeInTheDocument();
  });
});

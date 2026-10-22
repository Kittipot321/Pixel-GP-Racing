// Shared layout: a top nav and the outlet for the active route.
//
// Logged-in players see play/leaderboard/profile links, their username, and a
// logout button. Guests see the play link plus login/register links (the
// leaderboard and profile need an account). While the stored session is being
// verified, the session-dependent links are held back so neither set flashes.
// With accounts turned off (VITE_AUTH_ENABLED=false) the login/register links
// are hidden too, leaving just the play link.
// The TH/EN language switch is always shown, and so is the light/dark switch.
//
// Phones (below the `sm` breakpoint) get a compact header: the play link, the
// theme switch, and a menu button that opens the rest of the nav as a stacked
// panel. The menu closes on navigation and on Esc. From `sm` up the same
// links sit on one row and the menu button is hidden; the links are rendered
// once for both layouts (CSS order and visibility only).
//
// The play page uses the full page width so the race track can grow; every
// other page keeps the 820px content column. The track keeps its own height
// within the viewport (GameCanvas measures where it starts on the page).

import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context.tsx';
import { useI18n } from '../i18n/i18n-context.tsx';
import { LanguageToggle } from '../i18n/LanguageToggle.tsx';
import { ThemeToggle } from '../theme/ThemeToggle.tsx';
import { pixelButton, pixelButtonCompact } from './ui.ts';

const navLink =
  'font-pixel text-[0.7rem] leading-relaxed text-muted no-underline hover:text-snow focus-visible:outline-2 focus-visible:outline-accent';

export function AppLayout() {
  const { authEnabled, user, initializing, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isGuest = authEnabled && !initializing && !user;
  const isPlayPage = pathname === '/play' || pathname.startsWith('/play/');
  const [menuOpen, setMenuOpen] = useState(false);

  // A new page closes the phone menu.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen" data-testid="app-layout">
      <nav
        className="flex flex-wrap items-center gap-3 border-b-4 border-black bg-panel px-3 py-2 sm:gap-4 sm:px-5 sm:py-3"
        data-testid="app-nav"
      >
        <Link to="/play" className={`${navLink} order-1`} data-testid="nav-play">
          {t.nav.play}
        </Link>
        <ThemeToggle className="order-2 ml-auto sm:order-3 sm:ml-0" />
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className={`${pixelButtonCompact} order-3 min-w-8 sm:hidden`}
          aria-expanded={menuOpen}
          aria-controls="nav-menu"
          aria-label={menuOpen ? t.nav.closeMenu : t.nav.menu}
          data-testid="nav-menu-toggle"
        >
          <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
        </button>
        <div
          id="nav-menu"
          className={`${menuOpen ? 'flex' : 'hidden'} order-4 basis-full flex-col items-start gap-3 border-t-2 border-edge pt-3 sm:order-2 sm:flex sm:flex-1 sm:basis-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 sm:border-0 sm:pt-0`}
          data-testid="nav-menu"
        >
          {user && (
            <>
              <Link to="/leaderboard" className={navLink} data-testid="nav-leaderboard">
                {t.nav.leaderboard}
              </Link>
              <Link to="/profile" className={navLink} data-testid="nav-profile">
                {t.nav.profile}
              </Link>
            </>
          )}
          <span className="hidden flex-1 sm:block" />
          <LanguageToggle />
          {user && (
            <>
              <span className="font-bold text-accent-text" data-testid="nav-username">
                {user.username}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className={pixelButton}
                data-testid="nav-logout"
              >
                {t.nav.logout}
              </button>
            </>
          )}
          {isGuest && (
            <>
              <Link to="/login" className={navLink} data-testid="nav-login">
                {t.common.login}
              </Link>
              <Link to="/register" className={pixelButton} data-testid="nav-register">
                {t.common.register}
              </Link>
            </>
          )}
        </div>
      </nav>
      <main
        className={
          isPlayPage ? 'w-full px-2 py-0 sm:px-6' : 'mx-auto w-full max-w-[820px] p-3 sm:p-6'
        }
        data-testid="app-main"
      >
        <Outlet />
      </main>
    </div>
  );
}

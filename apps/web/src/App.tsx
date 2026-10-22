// Pixel GP Racing application shell.
//
// Wires routing: the landing page at / (its own header and footer), public auth
// routes (login/register), a public /play route (guests can play without
// logging in; nothing is saved for them), and the protected
// leaderboard/profile routes inside the AppLayout. The
// AuthProvider supplies the session; ProtectedRoute guards each route that
// needs a logged-in player. LanguageProvider supplies the Thai/English UI text,
// and ThemeProvider the light/dark colors.
//
// With accounts turned off (VITE_AUTH_ENABLED=false) the login, register,
// leaderboard and profile routes are not registered at all, so typing those
// URLs falls through to the catch-all redirect to /play.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './features/auth/auth-context.tsx';
import { LanguageProvider } from './i18n/i18n-context.tsx';
import { ThemeProvider } from './theme/theme-context.tsx';
import { ProtectedRoute } from './features/auth/ProtectedRoute.tsx';
import { AppLayout } from './app/AppLayout.tsx';
import { DonateButton } from './app/DonateButton.tsx';
import { LoginPage } from './features/auth/LoginPage.tsx';
import { RegisterPage } from './features/auth/RegisterPage.tsx';
import { LandingPage } from './features/landing/LandingPage.tsx';
import { PlayPage } from './features/race/PlayPage.tsx';
import { LeaderboardPage } from './features/leaderboard/LeaderboardPage.tsx';
import { ProfilePage } from './features/profile/ProfilePage.tsx';

/**
 * The route table, without router or auth providers (tests mount it in a MemoryRouter).
 * The floating donate button sits beside the routes so it shows on every page,
 * login and register included, and stays mounted when the route changes.
 */
export function AppRoutes() {
  return (
    <>
      <AppRouteTable />
      <DonateButton />
    </>
  );
}

function AppRouteTable() {
  const { authEnabled } = useAuth();
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      {authEnabled && <Route path="/login" element={<LoginPage />} />}
      {authEnabled && <Route path="/register" element={<RegisterPage />} />}
      <Route element={<AppLayout />}>
        <Route path="/play" element={<PlayPage />} />
        {authEnabled && (
          <Route
            path="/leaderboard"
            element={
              <ProtectedRoute>
                <LeaderboardPage />
              </ProtectedRoute>
            }
          />
        )}
        {authEnabled && (
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
        )}
      </Route>
      <Route path="*" element={<Navigate to="/play" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

// Route guard: renders its children only for an authenticated user, otherwise
// redirects to the login page. While the stored token is being verified it
// shows a lightweight loading state so we never flash the login page. With
// accounts turned off there is no login page, so it sends players to /play.

import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './auth-context.tsx';
import { useI18n } from '../../i18n/i18n-context.tsx';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { authEnabled, isAuthenticated, initializing } = useAuth();
  const { t } = useI18n();

  if (!authEnabled) {
    return <Navigate to="/play" replace />;
  }
  if (initializing) {
    return (
      <p data-testid="auth-loading" className="p-6 text-center font-pixel text-xs text-muted">
        {t.common.authChecking}
      </p>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

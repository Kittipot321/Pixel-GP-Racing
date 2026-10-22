// Login page: identifier + password with client-side validation, loading, and
// error states. On success the auth context stores the token and we navigate to
// the game. The page sits outside the app nav, so it carries its own TH/EN switch.

import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginRequestSchema } from '@pixel-race/shared-types';
import { ApiRequestError } from '../../services/api.ts';
import {
  errorText,
  pixelButtonPrimary,
  pixelHeading,
  pixelInput,
  pixelLink,
  pixelPanel,
} from '../../app/ui.ts';
import { useI18n } from '../../i18n/i18n-context.tsx';
import { useDocumentTitle } from '../../app/use-document-title.ts';
import { LanguageToggle } from '../../i18n/LanguageToggle.tsx';
import { ThemeToggle } from '../../theme/ThemeToggle.tsx';
import { useAuth } from './auth-context.tsx';

const fieldLabel = 'flex flex-col gap-1.5 text-sm text-muted';

export function LoginPage() {
  const { login } = useAuth();
  const { t } = useI18n();
  useDocumentTitle(t.common.login);
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = loginRequestSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message;
      setError(issue ? t.apiMessage(issue) : t.login.incomplete);
      return;
    }

    setSubmitting(true);
    try {
      await login(parsed.data);
      navigate('/play');
    } catch (err) {
      setError(err instanceof ApiRequestError ? t.apiMessage(err.message) : t.login.failed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className="mx-auto my-6 w-full max-w-[420px] px-4 sm:my-12 sm:px-5"
      data-testid="login-page"
    >
      <div className="mb-4 flex items-center justify-end gap-3">
        <ThemeToggle />
        <LanguageToggle />
      </div>
      <h1 className={pixelHeading}>{t.common.login}</h1>
      <form onSubmit={handleSubmit} className={`${pixelPanel} flex flex-col gap-4`} noValidate>
        <label className={fieldLabel}>
          {t.login.identifier}
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className={pixelInput}
            data-testid="login-identifier"
            autoComplete="username"
          />
        </label>
        <label className={fieldLabel}>
          {t.login.password}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={pixelInput}
            data-testid="login-password"
            autoComplete="current-password"
          />
        </label>

        {error && (
          <p className={errorText} role="alert" data-testid="login-error">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className={pixelButtonPrimary}
          data-testid="login-submit"
        >
          {submitting ? t.login.submitting : t.common.login}
        </button>
      </form>
      <p className="mt-4 text-muted">
        {t.login.noAccount}{' '}
        <Link to="/register" className={pixelLink} data-testid="login-to-register">
          {t.common.register}
        </Link>
      </p>
      <p className="mt-2 text-muted">
        {t.common.or}{' '}
        <Link to="/play" className={pixelLink} data-testid="login-play-as-guest">
          {t.common.playAsGuest}
        </Link>{' '}
        {t.common.noScoreSaved}
      </p>
    </main>
  );
}

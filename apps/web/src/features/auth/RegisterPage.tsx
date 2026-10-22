// Registration page: username/email/password with client-side validation
// (shared Zod schema), loading, and error states. The page sits outside the app
// nav, so it carries its own TH/EN switch.

import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerRequestSchema } from '@pixel-race/shared-types';
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

export function RegisterPage() {
  const { register } = useAuth();
  const { t } = useI18n();
  useDocumentTitle(t.common.register);
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = registerRequestSchema.safeParse({ username, email, password });
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message;
      setError(issue ? t.apiMessage(issue) : t.register.invalid);
      return;
    }

    setSubmitting(true);
    try {
      await register(parsed.data);
      navigate('/play');
    } catch (err) {
      setError(err instanceof ApiRequestError ? t.apiMessage(err.message) : t.register.failed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className="mx-auto my-6 w-full max-w-[420px] px-4 sm:my-12 sm:px-5"
      data-testid="register-page"
    >
      <div className="mb-4 flex items-center justify-end gap-3">
        <ThemeToggle />
        <LanguageToggle />
      </div>
      <h1 className={pixelHeading}>{t.common.register}</h1>
      <form onSubmit={handleSubmit} className={`${pixelPanel} flex flex-col gap-4`} noValidate>
        <label className={fieldLabel}>
          {t.register.username}
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={pixelInput}
            data-testid="register-username"
            autoComplete="username"
          />
        </label>
        <label className={fieldLabel}>
          {t.register.email}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={pixelInput}
            data-testid="register-email"
            autoComplete="email"
          />
        </label>
        <label className={fieldLabel}>
          {t.register.password}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={pixelInput}
            data-testid="register-password"
            autoComplete="new-password"
          />
        </label>

        {error && (
          <p className={errorText} role="alert" data-testid="register-error">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className={pixelButtonPrimary}
          data-testid="register-submit"
        >
          {submitting ? t.register.submitting : t.common.register}
        </button>
      </form>
      <p className="mt-4 text-muted">
        {t.register.haveAccount}{' '}
        <Link to="/login" className={pixelLink} data-testid="register-to-login">
          {t.common.login}
        </Link>
      </p>
      <p className="mt-2 text-muted">
        {t.common.or}{' '}
        <Link to="/play" className={pixelLink} data-testid="register-play-as-guest">
          {t.common.playAsGuest}
        </Link>{' '}
        {t.common.noScoreSaved}
      </p>
    </main>
  );
}

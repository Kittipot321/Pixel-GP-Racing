// Profile page — the player's stats plus a paginated, deterministically-sorted
// race history. Loading, empty, and error states are handled for both queries.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api.ts';
import { useAuth } from '../auth/auth-context.tsx';
import { useI18n } from '../../i18n/i18n-context.tsx';
import { useDocumentTitle } from '../../app/use-document-title.ts';
import {
  errorText,
  pixelButton,
  pixelFrame,
  pixelHeading,
  pixelPanel,
  tableCell,
} from '../../app/ui.ts';

const PAGE_SIZE = 10;

const statItem = 'border-4 border-edge bg-ink p-3';

export function ProfilePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  useDocumentTitle(t.nav.profile);
  const [page, setPage] = useState(1);

  const statsQuery = useQuery({ queryKey: ['stats'], queryFn: () => api.stats() });
  const historyQuery = useQuery({
    queryKey: ['history', page],
    queryFn: () => api.history(page, PAGE_SIZE),
  });

  const totalPages = historyQuery.data
    ? Math.max(1, Math.ceil(historyQuery.data.total / PAGE_SIZE))
    : 1;

  return (
    <section className="flex flex-col gap-4" data-testid="profile-page">
      <h1 className={pixelHeading}>{t.profile.title(user?.username ?? null)}</h1>

      <div className={pixelPanel} data-testid="profile-stats">
        {statsQuery.isLoading && (
          <p className="text-muted" data-testid="stats-loading">
            {t.profile.statsLoading}
          </p>
        )}
        {statsQuery.isError && (
          <p role="alert" className={errorText} data-testid="stats-error">
            {t.profile.statsError}
          </p>
        )}
        {statsQuery.data && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <li className={statItem} data-testid="stat-points">
              {t.profile.totalPoints}: {statsQuery.data.totalPoints}
            </li>
            <li className={statItem} data-testid="stat-settled">
              {t.profile.settledRaces}: {statsQuery.data.settledRaces}
            </li>
            <li className={statItem} data-testid="stat-correct">
              {t.profile.correctGuesses}: {statsQuery.data.correctGuesses}
            </li>
            <li className={statItem} data-testid="stat-accuracy">
              {t.profile.accuracy}: {(statsQuery.data.accuracy * 100).toFixed(0)}%
            </li>
          </ul>
        )}
      </div>

      <h2 className="font-pixel text-sm leading-relaxed text-snow">{t.profile.historyTitle}</h2>
      {historyQuery.isLoading && (
        <p className="text-muted" data-testid="history-loading">
          {t.profile.historyLoading}
        </p>
      )}
      {historyQuery.isError && (
        <p role="alert" className={errorText} data-testid="history-error">
          {t.profile.historyError}
        </p>
      )}
      {historyQuery.data && historyQuery.data.items.length === 0 && (
        <p className="text-muted" data-testid="history-empty">
          {t.profile.historyEmpty}
        </p>
      )}
      {historyQuery.data && historyQuery.data.items.length > 0 && (
        <div className={`${pixelFrame} overflow-x-auto`}>
          <table className="w-full border-collapse" data-testid="history-table">
            <thead className="font-pixel text-[0.65rem] text-accent-text">
              <tr>
                <th className={tableCell}>{t.profile.colGuess}</th>
                <th className={tableCell}>{t.profile.colWinner}</th>
                <th className={tableCell}>{t.profile.colResult}</th>
                <th className={tableCell}>{t.profile.colPoints}</th>
              </tr>
            </thead>
            <tbody>
              {historyQuery.data.items.map((row) => (
                <tr key={row.raceId} data-testid={`history-row-${row.raceId}`}>
                  <td className={tableCell}>{t.cars[row.guessedColor]}</td>
                  <td className={tableCell}>{t.cars[row.winnerColor]}</td>
                  <td className={tableCell}>
                    {row.isCorrect ? t.profile.correct : t.profile.wrong}
                  </td>
                  <td className={`${tableCell} font-pixel text-xs`}>{row.pointsAwarded}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 sm:gap-4" data-testid="history-pager">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className={pixelButton}
          data-testid="history-prev"
        >
          {t.common.prev}
        </button>
        <span className="font-pixel text-xs">{t.common.pageStatus(page, totalPages)}</span>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className={pixelButton}
          data-testid="history-next"
        >
          {t.common.next}
        </button>
      </div>
    </section>
  );
}

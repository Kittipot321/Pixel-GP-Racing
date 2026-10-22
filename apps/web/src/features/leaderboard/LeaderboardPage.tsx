// Leaderboard page — all-time / daily toggle with pagination.
// Shows loading, empty, and error states.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LeaderboardPeriod } from '@pixel-race/shared-types';
import { api } from '../../services/api.ts';
import { useI18n } from '../../i18n/i18n-context.tsx';
import { useDocumentTitle } from '../../app/use-document-title.ts';
import { errorText, pixelButton, pixelFrame, pixelHeading, tableCell } from '../../app/ui.ts';

const PAGE_SIZE = 10;

const tabButton = `${pixelButton} aria-selected:border-black aria-selected:bg-car-blue aria-selected:text-white`;

export function LeaderboardPage() {
  const { t } = useI18n();
  useDocumentTitle(t.nav.leaderboard);
  const [period, setPeriod] = useState<LeaderboardPeriod>('daily');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['leaderboard', period, page],
    queryFn: () => api.leaderboard(period, page, PAGE_SIZE),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  function changePeriod(next: LeaderboardPeriod) {
    setPeriod(next);
    setPage(1);
  }

  return (
    <section className="flex flex-col gap-4" data-testid="leaderboard-page">
      <h1 className={pixelHeading}>{t.leaderboard.title}</h1>

      <div className="flex flex-wrap gap-3" role="tablist" data-testid="leaderboard-tabs">
        <button
          type="button"
          role="tab"
          aria-selected={period === 'daily'}
          onClick={() => changePeriod('daily')}
          className={tabButton}
          data-testid="tab-daily"
        >
          {t.leaderboard.daily}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={period === 'all-time'}
          onClick={() => changePeriod('all-time')}
          className={tabButton}
          data-testid="tab-all-time"
        >
          {t.leaderboard.allTime}
        </button>
      </div>

      {isLoading && (
        <p className="text-muted" data-testid="leaderboard-loading">
          {t.common.loading}
        </p>
      )}

      {isError && (
        <p role="alert" className={errorText} data-testid="leaderboard-error">
          {t.leaderboard.loadFailed}: {error instanceof Error ? t.apiMessage(error.message) : ''}
        </p>
      )}

      {data && data.items.length === 0 && (
        <p className="text-muted" data-testid="leaderboard-empty">
          {t.leaderboard.empty}
        </p>
      )}

      {data && data.items.length > 0 && (
        <div className={`${pixelFrame} overflow-x-auto`}>
          <table className="w-full border-collapse" data-testid="leaderboard-table">
            <thead className="font-pixel text-[0.65rem] text-accent-text">
              <tr>
                <th className={tableCell}>{t.leaderboard.colRank}</th>
                <th className={tableCell}>{t.leaderboard.colPlayer}</th>
                <th className={tableCell}>{t.leaderboard.colTotal}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((entry) => (
                <tr key={entry.userId} data-testid={`leaderboard-row-${entry.userId}`}>
                  <td className={`${tableCell} font-pixel text-xs`}>{entry.rank}</td>
                  <td className={tableCell}>{entry.username}</td>
                  <td className={`${tableCell} font-pixel text-xs`}>{entry.totalPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 sm:gap-4" data-testid="leaderboard-pager">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className={pixelButton}
          data-testid="pager-prev"
        >
          {t.common.prev}
        </button>
        <span className="font-pixel text-xs" data-testid="pager-status">
          {t.common.pageStatus(page, totalPages)}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className={pixelButton}
          data-testid="pager-next"
        >
          {t.common.next}
        </button>
      </div>
    </section>
  );
}

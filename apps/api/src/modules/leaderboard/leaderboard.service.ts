// Leaderboard, stats, and history business logic.
//
// Aggregation runs in SQL (see the repository); this layer computes the daily
// boundary, assigns deterministic ranks, and derives accuracy. Timestamps are
// stored in UTC; only the daily boundary is computed in Asia/Bangkok (UTC+7)
// per NFR5.

import type {
  HistoryEntry,
  LeaderboardEntry,
  LeaderboardPeriod,
  Paginated,
  UserStats,
} from '@pixel-race/shared-types';
import type { DbClient } from '../../shared/db.js';
import {
  countLeaderboard,
  countUserHistory,
  selectLeaderboard,
  selectUserHistory,
  selectUserStats,
} from './leaderboard.repository.js';

/** Fixed offset for Asia/Bangkok (no DST): UTC+7. */
const BANGKOK_OFFSET_HOURS = 7;
const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * The UTC instant marking the start of "today" in Asia/Bangkok, as an ISO
 * string. A ledger entry at or after this instant counts toward the daily
 * board. Computed from `now` so it is testable with an injected clock.
 */
export function startOfBangkokDayUtc(now: Date = new Date()): string {
  // Shift into Bangkok local time, truncate to midnight, shift back to UTC.
  const bangkokMs = now.getTime() + BANGKOK_OFFSET_HOURS * MS_PER_HOUR;
  const bangkok = new Date(bangkokMs);
  const midnightBangkokMs = Date.UTC(
    bangkok.getUTCFullYear(),
    bangkok.getUTCMonth(),
    bangkok.getUTCDate(),
  );
  const startUtcMs = midnightBangkokMs - BANGKOK_OFFSET_HOURS * MS_PER_HOUR;
  return new Date(startUtcMs).toISOString();
}

/**
 * A page of the leaderboard. `period` selects all-time vs daily; ranks are
 * assigned by the SQL ordering (points DESC, userId ASC) offset by the page.
 */
export function getLeaderboard(
  db: DbClient,
  params: { period: LeaderboardPeriod; page: number; pageSize: number; now?: Date },
): Paginated<LeaderboardEntry> {
  const sinceIso =
    params.period === 'daily' ? startOfBangkokDayUtc(params.now) : undefined;
  const offset = (params.page - 1) * params.pageSize;

  const rows = selectLeaderboard(db, { sinceIso, limit: params.pageSize, offset });
  const total = countLeaderboard(db, { sinceIso });

  const items: LeaderboardEntry[] = rows.map((row, i) => ({
    rank: offset + i + 1,
    userId: row.userId,
    username: row.username,
    totalPoints: row.totalPoints,
  }));

  return { items, page: params.page, pageSize: params.pageSize, total };
}

/**
 * A player's aggregate statistics. Accuracy is correct/settled, defined as 0
 * when the player has no settled races (avoids division by zero).
 */
export function getUserStats(db: DbClient, userId: string): UserStats {
  const row = selectUserStats(db, userId);
  const accuracy = row.settledRaces === 0 ? 0 : row.correctGuesses / row.settledRaces;
  return {
    totalPoints: row.totalPoints,
    settledRaces: row.settledRaces,
    correctGuesses: row.correctGuesses,
    accuracy,
  };
}

/** A deterministically-ordered page of a player's settled-race history. */
export function getUserHistory(
  db: DbClient,
  params: { userId: string; page: number; pageSize: number },
): Paginated<HistoryEntry> {
  const offset = (params.page - 1) * params.pageSize;
  const rows = selectUserHistory(db, {
    userId: params.userId,
    limit: params.pageSize,
    offset,
  });
  const total = countUserHistory(db, params.userId);

  const items: HistoryEntry[] = rows.map((r) => ({
    raceId: r.raceId,
    guessedColor: r.guessedColor,
    winnerColor: r.winnerColor,
    isCorrect: r.isCorrect,
    pointsAwarded: r.pointsAwarded,
    settledAt: r.settledAt,
  }));

  return { items, page: params.page, pageSize: params.pageSize, total };
}

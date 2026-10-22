// Data access for leaderboard, player stats, and history.
//
// All aggregation is pushed into SQL (SUM / GROUP BY / COUNT) so we never load
// every row into application memory. Ranking tie-breaks are deterministic:
// higher points first, then ascending userId. The daily boundary is computed
// as a UTC instant by the service and passed in as a `sinceIso` filter.

import { and, asc, count, desc, eq, gte, sql } from 'drizzle-orm';
import { guesses, races, scoreLedger, users } from '@pixel-race/database';
import type { CarColor } from '@pixel-race/shared-types';
import type { DbClient } from '../../shared/db.js';

export interface LeaderboardRow {
  userId: string;
  username: string;
  totalPoints: number;
}

/**
 * Ranked leaderboard page. When `sinceIso` is set, only ledger entries created
 * at or after that UTC instant count (used for the daily board). Ordering is
 * SUM(points) DESC, userId ASC — fully deterministic for tie-breaking.
 */
export function selectLeaderboard(
  db: DbClient,
  params: { sinceIso?: string; limit: number; offset: number },
): LeaderboardRow[] {
  const totalPoints = sql<number>`coalesce(sum(${scoreLedger.points}), 0)`;
  const where = params.sinceIso ? gte(scoreLedger.createdAt, params.sinceIso) : undefined;

  return db
    .select({
      userId: users.id,
      username: users.username,
      totalPoints,
    })
    .from(scoreLedger)
    .innerJoin(users, eq(users.id, scoreLedger.userId))
    .where(where)
    .groupBy(users.id, users.username)
    .orderBy(desc(totalPoints), asc(users.id))
    .limit(params.limit)
    .offset(params.offset)
    .all();
}

/** Count of distinct ranked players (for pagination totals). */
export function countLeaderboard(db: DbClient, params: { sinceIso?: string }): number {
  const where = params.sinceIso ? gte(scoreLedger.createdAt, params.sinceIso) : undefined;
  const rows = db
    .select({ userId: scoreLedger.userId })
    .from(scoreLedger)
    .where(where)
    .groupBy(scoreLedger.userId)
    .all();
  return rows.length;
}

export interface StatsRow {
  totalPoints: number;
  settledRaces: number;
  correctGuesses: number;
}

/**
 * Aggregate a single player's stats. `settledRaces` and `correctGuesses` come
 * from their settled guesses; `totalPoints` from the ledger (the authoritative
 * source). Accuracy is derived by the service.
 */
export function selectUserStats(db: DbClient, userId: string): StatsRow {
  const points = db
    .select({ total: sql<number>`coalesce(sum(${scoreLedger.points}), 0)` })
    .from(scoreLedger)
    .where(eq(scoreLedger.userId, userId))
    .get();

  const settled = db
    .select({
      settledRaces: count(),
      correctGuesses: sql<number>`coalesce(sum(case when ${guesses.isCorrect} then 1 else 0 end), 0)`,
    })
    .from(guesses)
    .where(and(eq(guesses.userId, userId), sql`${guesses.pointsAwarded} is not null`))
    .get();

  return {
    totalPoints: points?.total ?? 0,
    settledRaces: settled?.settledRaces ?? 0,
    correctGuesses: settled?.correctGuesses ?? 0,
  };
}

export interface HistoryRow {
  raceId: string;
  guessedColor: CarColor;
  winnerColor: CarColor;
  isCorrect: boolean;
  pointsAwarded: number;
  settledAt: string;
}

/**
 * A page of the player's settled-race history, newest first with a stable
 * tie-break on raceId so the order is deterministic across identical settle
 * timestamps.
 */
export function selectUserHistory(
  db: DbClient,
  params: { userId: string; limit: number; offset: number },
): HistoryRow[] {
  const rows = db
    .select({
      raceId: races.id,
      guessedColor: guesses.guessedColor,
      winnerColor: races.winnerColor,
      isCorrect: guesses.isCorrect,
      pointsAwarded: guesses.pointsAwarded,
      settledAt: races.settledAt,
    })
    .from(guesses)
    .innerJoin(races, eq(races.id, guesses.raceId))
    .where(and(eq(guesses.userId, params.userId), eq(races.status, 'SETTLED')))
    .orderBy(desc(races.settledAt), asc(races.id))
    .limit(params.limit)
    .offset(params.offset)
    .all();

  // Settled rows always have a winner, a boolean result, points, and settledAt;
  // narrow the nullable columns for the typed contract.
  return rows.map((r) => ({
    raceId: r.raceId,
    guessedColor: r.guessedColor,
    winnerColor: r.winnerColor as CarColor,
    isCorrect: r.isCorrect ?? false,
    pointsAwarded: r.pointsAwarded ?? 0,
    settledAt: r.settledAt ?? '',
  }));
}

/** Count of the player's settled-race history rows (for pagination totals). */
export function countUserHistory(db: DbClient, userId: string): number {
  const row = db
    .select({ total: count() })
    .from(guesses)
    .innerJoin(races, eq(races.id, guesses.raceId))
    .where(and(eq(guesses.userId, userId), eq(races.status, 'SETTLED')))
    .get();
  return row?.total ?? 0;
}

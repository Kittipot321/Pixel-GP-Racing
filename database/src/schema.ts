// Drizzle ORM schema for Pixel Race (SQLite).
//
// Design notes:
// - Timestamps are stored as ISO-8601 UTC text (e.g. "2026-10-20T12:00:00.000Z").
//   SQLite has no native datetime type; text sorts lexicographically in
//   chronological order for this format, which keeps history queries simple.
// - Enums (car color, race status) are stored as text with a CHECK constraint
//   so the database rejects any value outside the allowed set, independent of
//   application-level validation.
// - Every foreign key is declared so SQLite can enforce referential integrity
//   (foreign-key enforcement itself is turned on per-connection in connection.ts).

import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { CAR_COLORS, RACE_STATUSES } from '@pixel-race/shared-types';

/** Players. The password hash never leaves this table into any public shape. */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  // Email is stored already-normalized (lowercased) by the auth layer; the
  // unique index then enforces one account per normalized email.
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

/**
 * Race rounds. `winnerColor` stays NULL until the race is settled.
 *
 * Races are per-player: `ownerId` identifies the single player the round
 * belongs to. "The caller's current open race" and owner authorization both
 * key off this column.
 */
export const races = sqliteTable(
  'races',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status', { enum: RACE_STATUSES }).notNull().default('OPEN'),
    // Nullable: the authoritative winner is hidden until settlement discloses it.
    winnerColor: text('winner_color', { enum: CAR_COLORS }),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    startedAt: text('started_at'),
    settledAt: text('settled_at'),
  },
  (table) => [
    // "Latest OPEN race for this owner" is the hot path for GET /races/current.
    index('races_owner_status_idx').on(table.ownerId, table.status),
  ],
);

/**
 * Predictions. A player may guess at most once per race — enforced by the
 * composite unique constraint on (race_id, user_id).
 */
export const guesses = sqliteTable(
  'guesses',
  {
    id: text('id').primaryKey(),
    raceId: text('race_id')
      .notNull()
      .references(() => races.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    guessedColor: text('guessed_color', { enum: CAR_COLORS }).notNull(),
    // Boolean stored as 0/1; NULL until the race is settled.
    isCorrect: integer('is_correct', { mode: 'boolean' }),
    // 0 or 1 points; NULL until the race is settled.
    pointsAwarded: integer('points_awarded'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    unique('guesses_race_user_unique').on(table.raceId, table.userId),
    index('guesses_user_idx').on(table.userId),
  ],
);

/**
 * Immutable score awards. One entry per player per settled race — the unique
 * constraint is the last line of defence against duplicate score awards even
 * under concurrent settlement attempts.
 */
export const scoreLedger = sqliteTable(
  'score_ledger',
  {
    id: text('id').primaryKey(),
    raceId: text('race_id')
      .notNull()
      .references(() => races.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    points: integer('points').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    unique('score_ledger_race_user_unique').on(table.raceId, table.userId),
    // Aggregation: SUM(points) GROUP BY user_id for leaderboard totals.
    index('score_ledger_user_idx').on(table.userId),
    // History: list a user's awards most-recent-first.
    index('score_ledger_user_created_idx').on(table.userId, table.createdAt),
  ],
);

// Inferred row types for use by repositories/services in later phases.
export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type RaceRow = typeof races.$inferSelect;
export type NewRaceRow = typeof races.$inferInsert;
export type GuessRow = typeof guesses.$inferSelect;
export type NewGuessRow = typeof guesses.$inferInsert;
export type ScoreLedgerRow = typeof scoreLedger.$inferSelect;
export type NewScoreLedgerRow = typeof scoreLedger.$inferInsert;

// Business-logic + integration tests for the leaderboard service.
//
// Covers: ranking ordering with a deterministic tie-break (points DESC, then
// userId ASC), accuracy calculation (including the no-settled-races case), and
// the Asia/Bangkok daily boundary computation.

import { describe, it, expect } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  openDb,
  users,
  races,
  guesses,
  scoreLedger,
  type DbConnection,
} from '@pixel-race/database';
import {
  getLeaderboard,
  getUserStats,
  startOfBangkokDayUtc,
} from './leaderboard.service.js';

const MIGRATIONS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../database/migrations',
);

function freshDb(): DbConnection {
  const conn = openDb({ path: ':memory:' });
  migrate(conn.db, { migrationsFolder: MIGRATIONS });
  return conn;
}

function addUser(conn: DbConnection, id: string): void {
  conn.db
    .insert(users)
    .values({ id, username: `name-${id}`, email: `${id}@x.io`, passwordHash: 'h' })
    .run();
}

function addLedger(conn: DbConnection, userId: string, points: number, createdAt: string): void {
  const raceId = `race-${userId}-${createdAt}`;
  conn.db.insert(races).values({ id: raceId, ownerId: userId, status: 'SETTLED', winnerColor: 'RED', createdAt }).run();
  conn.db.insert(scoreLedger).values({ id: `led-${raceId}`, raceId, userId, points, createdAt }).run();
}

describe('startOfBangkokDayUtc', () => {
  it('returns the previous-day 17:00Z boundary for an early-UTC instant', () => {
    // 2026-01-15T02:00:00Z is 09:00 in Bangkok on the 15th → day starts at
    // 2026-01-14T17:00:00Z (midnight Bangkok on the 15th).
    const boundary = startOfBangkokDayUtc(new Date('2026-01-15T02:00:00.000Z'));
    expect(boundary).toBe('2026-01-14T17:00:00.000Z');
  });

  it('returns the same-day 17:00Z boundary for a late-UTC instant', () => {
    // 2026-01-15T20:00:00Z is 03:00 Bangkok on the 16th → boundary is
    // 2026-01-15T17:00:00Z (midnight Bangkok on the 16th).
    const boundary = startOfBangkokDayUtc(new Date('2026-01-15T20:00:00.000Z'));
    expect(boundary).toBe('2026-01-15T17:00:00.000Z');
  });
});

describe('getLeaderboard', () => {
  it('orders by points DESC then userId ASC (deterministic tie-break)', () => {
    const conn = freshDb();
    try {
      // bbb and aaa both have 2 points → tie broken by userId ascending (aaa first).
      addUser(conn, 'aaa');
      addUser(conn, 'bbb');
      addUser(conn, 'ccc');
      addLedger(conn, 'aaa', 1, '2026-01-01T00:00:00.000Z');
      addLedger(conn, 'aaa', 1, '2026-01-02T00:00:00.000Z');
      addLedger(conn, 'bbb', 1, '2026-01-01T00:00:00.000Z');
      addLedger(conn, 'bbb', 1, '2026-01-02T00:00:00.000Z');
      addLedger(conn, 'ccc', 3, '2026-01-01T00:00:00.000Z');

      const board = getLeaderboard(conn.db, { period: 'all-time', page: 1, pageSize: 10 });

      expect(board.items.map((i) => i.userId)).toEqual(['ccc', 'aaa', 'bbb']);
      expect(board.items.map((i) => i.rank)).toEqual([1, 2, 3]);
      expect(board.items[0].totalPoints).toBe(3);
      expect(board.total).toBe(3);
    } finally {
      conn.close();
    }
  });
});

describe('getUserStats', () => {
  it('computes accuracy as correct / settled', () => {
    const conn = freshDb();
    try {
      const userId = 'player1';
      addUser(conn, userId);
      // Two settled races: one correct (1 pt), one wrong (0 pt).
      const mkSettled = (suffix: string, guessed: 'RED' | 'BLUE', correct: boolean, points: number) => {
        const raceId = `r-${suffix}`;
        conn.db.insert(races).values({ id: raceId, ownerId: userId, status: 'SETTLED', winnerColor: 'RED', createdAt: '2026-01-01T00:00:00.000Z', settledAt: '2026-01-01T00:00:01.000Z' }).run();
        conn.db.insert(guesses).values({ id: `g-${suffix}`, raceId, userId, guessedColor: guessed, isCorrect: correct, pointsAwarded: points, createdAt: '2026-01-01T00:00:00.000Z' }).run();
        conn.db.insert(scoreLedger).values({ id: `l-${suffix}`, raceId, userId, points, createdAt: '2026-01-01T00:00:01.000Z' }).run();
      };
      mkSettled('a', 'RED', true, 1);
      mkSettled('b', 'BLUE', false, 0);

      const stats = getUserStats(conn.db, userId);

      expect(stats.settledRaces).toBe(2);
      expect(stats.correctGuesses).toBe(1);
      expect(stats.totalPoints).toBe(1);
      expect(stats.accuracy).toBe(0.5);
    } finally {
      conn.close();
    }
  });

  it('returns zero accuracy when the player has no settled races', () => {
    const conn = freshDb();
    try {
      addUser(conn, 'newbie');
      const stats = getUserStats(conn.db, 'newbie');
      expect(stats.settledRaces).toBe(0);
      expect(stats.accuracy).toBe(0);
      expect(stats.totalPoints).toBe(0);
    } finally {
      conn.close();
    }
  });
});

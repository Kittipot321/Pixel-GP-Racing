// Business-logic + integration tests for settlement.
//
// Covers: pure scoring (1 for a match, 0 otherwise), awarding on settle, and
// idempotency — a repeated settle must not double-award (the ledger stays at
// one entry). Runs against a real in-memory DB so the transaction and unique
// constraint are exercised, not mocked.

import { describe, it, expect } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  openDb,
  users,
  races,
  guesses,
  scoreLedger,
  type DbConnection,
} from '@pixel-race/database';
import type { CarColor } from '@pixel-race/shared-types';
import { scoreGuess, settleRace } from './settlement.service.js';
import { nowIso } from '../../shared/clock.js';

const MIGRATIONS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../database/migrations',
);

function freshDb(): DbConnection {
  const conn = openDb({ path: ':memory:' });
  migrate(conn.db, { migrationsFolder: MIGRATIONS });
  return conn;
}

/** Seed a RUNNING race owned by a new user with a single guess. */
function seedRunningRace(
  conn: DbConnection,
  params: { winner: CarColor; guessed: CarColor },
): { ownerId: string; raceId: string } {
  const ownerId = randomUUID();
  const raceId = randomUUID();
  conn.db
    .insert(users)
    .values({ id: ownerId, username: `u-${ownerId.slice(0, 8)}`, email: `${ownerId}@x.io`, passwordHash: 'h' })
    .run();
  conn.db
    .insert(races)
    .values({
      id: raceId,
      ownerId,
      status: 'RUNNING',
      winnerColor: params.winner,
      createdAt: nowIso(),
      startedAt: nowIso(),
    })
    .run();
  conn.db
    .insert(guesses)
    .values({ id: randomUUID(), raceId, userId: ownerId, guessedColor: params.guessed, createdAt: nowIso() })
    .run();
  return { ownerId, raceId };
}

describe('scoreGuess', () => {
  it('awards 1 for a correct guess', () => {
    expect(scoreGuess('RED', 'RED')).toBe(1);
  });
  it('awards 0 for an incorrect guess', () => {
    expect(scoreGuess('RED', 'BLUE')).toBe(0);
  });
});

describe('settleRace', () => {
  it('awards 1 point and discloses the winner on a correct guess', () => {
    const conn = freshDb();
    try {
      const { ownerId, raceId } = seedRunningRace(conn, { winner: 'RED', guessed: 'RED' });

      const result = settleRace(conn.db, { raceId, ownerId });

      expect(result.isCorrect).toBe(true);
      expect(result.pointsAwarded).toBe(1);
      expect(result.winnerColor).toBe('RED');

      const ledger = conn.db.select().from(scoreLedger).where(eq(scoreLedger.raceId, raceId)).all();
      expect(ledger).toHaveLength(1);
      expect(ledger[0].points).toBe(1);

      const race = conn.db.select().from(races).where(eq(races.id, raceId)).get();
      expect(race?.status).toBe('SETTLED');
    } finally {
      conn.close();
    }
  });

  it('awards 0 points on an incorrect guess', () => {
    const conn = freshDb();
    try {
      const { ownerId, raceId } = seedRunningRace(conn, { winner: 'BLUE', guessed: 'YELLOW' });

      const result = settleRace(conn.db, { raceId, ownerId });

      expect(result.isCorrect).toBe(false);
      expect(result.pointsAwarded).toBe(0);

      const ledger = conn.db.select().from(scoreLedger).where(eq(scoreLedger.raceId, raceId)).all();
      expect(ledger).toHaveLength(1);
      expect(ledger[0].points).toBe(0);
    } finally {
      conn.close();
    }
  });

  it('is idempotent: a repeated settle does not double-award', () => {
    const conn = freshDb();
    try {
      const { ownerId, raceId } = seedRunningRace(conn, { winner: 'WHITE', guessed: 'WHITE' });

      const first = settleRace(conn.db, { raceId, ownerId });
      const second = settleRace(conn.db, { raceId, ownerId });

      // Same authoritative result returned both times.
      expect(second).toEqual(first);

      // Exactly one ledger entry survives — no duplicate award.
      const ledger = conn.db.select().from(scoreLedger).where(eq(scoreLedger.raceId, raceId)).all();
      expect(ledger).toHaveLength(1);
    } finally {
      conn.close();
    }
  });

  it('rejects settling a race that is not RUNNING yet', () => {
    const conn = freshDb();
    try {
      const ownerId = randomUUID();
      const raceId = randomUUID();
      conn.db
        .insert(users)
        .values({ id: ownerId, username: 'open-owner', email: 'oo@x.io', passwordHash: 'h' })
        .run();
      conn.db
        .insert(races)
        .values({ id: raceId, ownerId, status: 'OPEN', winnerColor: 'RED', createdAt: nowIso() })
        .run();

      expect(() => settleRace(conn.db, { raceId, ownerId })).toThrow(/RUNNING/i);
    } finally {
      conn.close();
    }
  });
});

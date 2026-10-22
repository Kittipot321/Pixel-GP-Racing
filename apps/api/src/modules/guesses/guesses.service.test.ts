// Integration tests for the guess service against a real in-memory DB.
//
// Covers: a first guess is accepted, a duplicate guess is rejected (409 via the
// unique constraint), and a guess after the race closes is rejected.

import { describe, it, expect } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  openDb,
  users,
  races,
  type DbConnection,
} from '@pixel-race/database';
import type { RaceStatus } from '@pixel-race/shared-types';
import { submitGuess } from './guesses.service.js';
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

function seedRace(conn: DbConnection, status: RaceStatus): { ownerId: string; raceId: string } {
  const ownerId = randomUUID();
  const raceId = randomUUID();
  conn.db
    .insert(users)
    .values({ id: ownerId, username: `u-${ownerId.slice(0, 8)}`, email: `${ownerId}@x.io`, passwordHash: 'h' })
    .run();
  conn.db
    .insert(races)
    .values({ id: raceId, ownerId, status, winnerColor: 'RED', createdAt: nowIso() })
    .run();
  return { ownerId, raceId };
}

describe('submitGuess', () => {
  it('accepts a first guess and never leaks the winner', () => {
    const conn = freshDb();
    try {
      const { ownerId, raceId } = seedRace(conn, 'OPEN');
      const result = submitGuess(conn.db, { raceId, userId: ownerId, guessedColor: 'BLUE' });
      expect(result).toEqual({ raceId, guessedColor: 'BLUE', status: 'accepted' });
      expect(result).not.toHaveProperty('winnerColor');
    } finally {
      conn.close();
    }
  });

  it('rejects a duplicate guess from the same player', () => {
    const conn = freshDb();
    try {
      const { ownerId, raceId } = seedRace(conn, 'OPEN');
      submitGuess(conn.db, { raceId, userId: ownerId, guessedColor: 'BLUE' });
      expect(() =>
        submitGuess(conn.db, { raceId, userId: ownerId, guessedColor: 'RED' }),
      ).toThrow(/already guessed/i);
    } finally {
      conn.close();
    }
  });

  it('rejects a guess once the race has closed (RUNNING)', () => {
    const conn = freshDb();
    try {
      const { ownerId, raceId } = seedRace(conn, 'RUNNING');
      expect(() =>
        submitGuess(conn.db, { raceId, userId: ownerId, guessedColor: 'BLUE' }),
      ).toThrow(/no longer accepting/i);
    } finally {
      conn.close();
    }
  });
});

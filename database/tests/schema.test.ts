// Phase 1 database validation tests.
//
// Each test runs against a fresh in-memory SQLite database created by applying
// the generated migrations to a clean handle — this exercises the real
// migration SQL, not an ad-hoc schema. We assert the guarantees Phase 1
// promises: foreign keys, unique constraints, and transaction rollback.

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { openDb, type DbConnection } from '../src/connection.js';
import { guesses, races, scoreLedger, users } from '../src/schema.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, '../migrations');

function makeUser(username: string) {
  return {
    id: randomUUID(),
    username,
    email: `${username}@example.com`,
    passwordHash: 'test-hash',
  };
}

describe('database schema (clean in-memory DB)', () => {
  let conn: DbConnection;

  beforeEach(() => {
    // A fresh, clean database for every test — migrations applied from scratch.
    conn = openDb({ path: ':memory:' });
    migrate(conn.db, { migrationsFolder });
  });

  afterEach(() => {
    conn.close();
  });

  it('applies migrations and creates all four tables', () => {
    const tables = conn.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toContain('users');
    expect(tables).toContain('races');
    expect(tables).toContain('guesses');
    expect(tables).toContain('score_ledger');
  });

  it('enforces foreign keys: a guess cannot reference a missing user', () => {
    const owner = makeUser('fk-owner');
    conn.db.insert(users).values(owner).run();
    const raceId = randomUUID();
    conn.db.insert(races).values({ id: raceId, ownerId: owner.id, status: 'OPEN' }).run();

    expect(() =>
      conn.db
        .insert(guesses)
        .values({
          id: randomUUID(),
          raceId,
          userId: 'does-not-exist',
          guessedColor: 'RED',
        })
        .run(),
    ).toThrow(/FOREIGN KEY/i);
  });

  it('prevents duplicate guesses for the same (race, user)', () => {
    const user = makeUser('alice');
    const raceId = randomUUID();
    conn.db.insert(users).values(user).run();
    conn.db.insert(races).values({ id: raceId, ownerId: user.id, status: 'OPEN' }).run();

    conn.db
      .insert(guesses)
      .values({ id: randomUUID(), raceId, userId: user.id, guessedColor: 'RED' })
      .run();

    expect(() =>
      conn.db
        .insert(guesses)
        .values({ id: randomUUID(), raceId, userId: user.id, guessedColor: 'BLUE' })
        .run(),
    ).toThrow(/UNIQUE/i);
  });

  it('prevents duplicate score-ledger entries for the same (race, user)', () => {
    const user = makeUser('bob');
    const raceId = randomUUID();
    conn.db.insert(users).values(user).run();
    conn.db
      .insert(races)
      .values({ id: raceId, ownerId: user.id, status: 'SETTLED', winnerColor: 'RED' })
      .run();

    conn.db
      .insert(scoreLedger)
      .values({ id: randomUUID(), raceId, userId: user.id, points: 1 })
      .run();

    expect(() =>
      conn.db
        .insert(scoreLedger)
        .values({ id: randomUUID(), raceId, userId: user.id, points: 1 })
        .run(),
    ).toThrow(/UNIQUE/i);
  });

  it('enforces unique usernames and emails', () => {
    conn.db.insert(users).values(makeUser('carol')).run();

    // Same username, different email.
    expect(() =>
      conn.db
        .insert(users)
        .values({ ...makeUser('carol'), email: 'other@example.com' })
        .run(),
    ).toThrow(/UNIQUE/i);
  });

  it('rolls back a transaction so no partial writes remain', () => {
    const user = makeUser('dave');

    expect(() =>
      conn.db.transaction((tx) => {
        tx.insert(users).values(user).run();
        // Force a failure mid-transaction (missing FK target).
        tx.insert(guesses)
          .values({
            id: randomUUID(),
            raceId: 'missing-race',
            userId: user.id,
            guessedColor: 'RED',
          })
          .run();
      }),
    ).toThrow();

    // The user insert must have been rolled back with the failed transaction.
    const rows = conn.db.select().from(users).all();
    expect(rows).toHaveLength(0);
  });
});

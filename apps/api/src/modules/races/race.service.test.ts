// Business-logic unit tests for the race service.
//
// Covers: winner selection is uniform over the four colors, state-transition
// validation (valid + invalid), and that a created race hides its winner.

import { describe, it, expect } from 'vitest';
import { CAR_COLORS } from '@pixel-race/shared-types';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDb, users, type DbConnection } from '@pixel-race/database';
import { canTransition, createRace, pickWinnerColor } from './race.service.js';

const MIGRATIONS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../database/migrations',
);

function freshDb(): DbConnection {
  const conn = openDb({ path: ':memory:' });
  migrate(conn.db, { migrationsFolder: MIGRATIONS });
  return conn;
}

describe('pickWinnerColor', () => {
  it('only ever returns one of the four car colors', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(CAR_COLORS).toContain(pickWinnerColor());
    }
  });

  it('can produce every one of the four colors (uniform coverage)', () => {
    const seen = new Set<string>();
    // 2000 draws makes missing any of 4 uniform outcomes astronomically unlikely.
    for (let i = 0; i < 2000; i += 1) {
      seen.add(pickWinnerColor());
    }
    for (const color of CAR_COLORS) {
      expect(seen.has(color)).toBe(true);
    }
  });
});

describe('canTransition', () => {
  it('allows the valid forward transitions', () => {
    expect(canTransition('OPEN', 'RUNNING')).toBe(true);
    expect(canTransition('RUNNING', 'SETTLED')).toBe(true);
  });

  it('rejects invalid transitions and resets', () => {
    expect(canTransition('OPEN', 'SETTLED')).toBe(false);
    expect(canTransition('RUNNING', 'OPEN')).toBe(false);
    expect(canTransition('SETTLED', 'RUNNING')).toBe(false);
    expect(canTransition('SETTLED', 'OPEN')).toBe(false);
    expect(canTransition('OPEN', 'OPEN')).toBe(false);
  });
});

describe('createRace', () => {
  it('creates an OPEN race and hides the winner from the public view', () => {
    const conn = freshDb();
    try {
      const ownerId = randomUUID();
      conn.db
        .insert(users)
        .values({ id: ownerId, username: 'owner', email: 'o@example.com', passwordHash: 'h' })
        .run();

      const race = createRace(conn.db, ownerId);

      expect(race.status).toBe('OPEN');
      // Public view never discloses the winner before settlement.
      expect(race.winnerColor).toBeNull();
    } finally {
      conn.close();
    }
  });
});

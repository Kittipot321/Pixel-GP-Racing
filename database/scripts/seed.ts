// Development seed data for Pixel Race.
//
// Inserts a small, self-consistent dataset so the app has something to show in
// local development: two users, one settled race with a known winner, matching
// guesses, and the score-ledger entries those guesses produced.
//
// Idempotent: if the users already exist the script does nothing, so it can be
// run repeatedly without piling up duplicates or hitting unique constraints.
//
// NOTE: the password hashes below are placeholders for development only. Real
// Argon2id hashing arrives with the auth module in Phase 2. These are not valid
// credentials and must never be used in production.

import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { openDb, DEFAULT_DB_PATH } from '../src/connection.js';
import { guesses, races, scoreLedger, users } from '../src/schema.js';

const DEV_PLACEHOLDER_HASH = 'dev-placeholder-not-a-real-hash';

// Repo root, two segments up from database/scripts/, so a relative
// DATABASE_PATH resolves the same way the API and db:migrate resolve it.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Resolve DATABASE_PATH consistently with the API: repo-root-anchored. */
function resolveDbPath(): string {
  const raw = process.env.DATABASE_PATH?.trim();
  if (!raw) {
    return DEFAULT_DB_PATH;
  }
  if (raw === ':memory:' || isAbsolute(raw)) {
    return raw;
  }
  return resolve(REPO_ROOT, raw);
}

function nowIso(): string {
  return new Date().toISOString();
}

function run(): void {
  const path = resolveDbPath();
  // allowCreate: the seed script runs right after migrate as part of the
  // sanctioned bootstrap path; it may open a freshly-created database.
  const { db, close } = openDb({ path, allowCreate: true });

  try {
    const existing = db.select().from(users).where(eq(users.username, 'ada')).all();
    if (existing.length > 0) {
      console.log('Seed data already present — skipping.');
      return;
    }

    const ts = nowIso();
    const ada = { id: randomUUID(), username: 'ada', email: 'ada@example.com' };
    const grace = { id: randomUUID(), username: 'grace', email: 'grace@example.com' };
    const raceId = randomUUID();

    // All inserts run in one transaction so a seeded race is never left
    // half-populated if any step fails.
    db.transaction((tx) => {
      tx.insert(users)
        .values([
          { ...ada, passwordHash: DEV_PLACEHOLDER_HASH, createdAt: ts, updatedAt: ts },
          { ...grace, passwordHash: DEV_PLACEHOLDER_HASH, createdAt: ts, updatedAt: ts },
        ])
        .run();

      // A finished race (owned by ada) whose winner was RED.
      tx.insert(races)
        .values({
          id: raceId,
          ownerId: ada.id,
          status: 'SETTLED',
          winnerColor: 'RED',
          createdAt: ts,
          startedAt: ts,
          settledAt: ts,
        })
        .run();

      // ada guessed RED (correct, +1); grace guessed BLUE (incorrect, +0).
      tx.insert(guesses)
        .values([
          {
            id: randomUUID(),
            raceId,
            userId: ada.id,
            guessedColor: 'RED',
            isCorrect: true,
            pointsAwarded: 1,
            createdAt: ts,
          },
          {
            id: randomUUID(),
            raceId,
            userId: grace.id,
            guessedColor: 'BLUE',
            isCorrect: false,
            pointsAwarded: 0,
            createdAt: ts,
          },
        ])
        .run();

      // Ledger: one row per player for the settled race.
      tx.insert(scoreLedger)
        .values([
          { id: randomUUID(), raceId, userId: ada.id, points: 1, createdAt: ts },
          { id: randomUUID(), raceId, userId: grace.id, points: 0, createdAt: ts },
        ])
        .run();
    });

    console.log(`Seeded 2 users and 1 settled race into ${path}`);
  } finally {
    close();
  }
}

run();

// Data access for guesses.
//
// Pure persistence. Business rules (race must be OPEN, response must not leak
// the winner) live in the service layer.

import { and, eq } from 'drizzle-orm';
import { guesses, type GuessRow } from '@pixel-race/database';
import type { CarColor } from '@pixel-race/shared-types';
import type { DbClient } from '../../shared/db.js';

export interface NewGuessInput {
  id: string;
  raceId: string;
  userId: string;
  guessedColor: CarColor;
  createdAt: string;
}

/**
 * Insert a guess. The composite unique constraint on (race_id, user_id) is the
 * authoritative dedup guard — a duplicate surfaces as a thrown SQLite error
 * that the service maps to a 409.
 */
export function insertGuess(db: DbClient, input: NewGuessInput): GuessRow {
  const [row] = db.insert(guesses).values(input).returning().all();
  return row;
}

/** The caller's guess for a race, if any. */
export function findGuessByRaceAndUser(
  db: DbClient,
  raceId: string,
  userId: string,
): GuessRow | undefined {
  return db
    .select()
    .from(guesses)
    .where(and(eq(guesses.raceId, raceId), eq(guesses.userId, userId)))
    .get();
}

/** All guesses for a race (used by settlement to score each one). */
export function findGuessesByRace(db: DbClient, raceId: string): GuessRow[] {
  return db.select().from(guesses).where(eq(guesses.raceId, raceId)).all();
}

/** Record the settled outcome on a guess row. */
export function updateGuessOutcome(
  db: DbClient,
  params: { id: string; isCorrect: boolean; pointsAwarded: number },
): void {
  db.update(guesses)
    .set({ isCorrect: params.isCorrect, pointsAwarded: params.pointsAwarded })
    .where(eq(guesses.id, params.id))
    .run();
}

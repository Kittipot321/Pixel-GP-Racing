// Race settlement business logic.
//
// Settlement is the point where the hidden winner is disclosed and points are
// awarded. It must be:
//   - transactional: guess outcomes, ledger insert, and the status change all
//     commit together or not at all;
//   - idempotent: settling an already-SETTLED race returns the same result and
//     never double-awards, guaranteed by the status compare-and-set AND the
//     (race_id, user_id) unique ledger constraint;
//   - concurrency-safe: two simultaneous settle calls cannot both award.
//
// Scoring: a correct guess earns exactly 1 point, an incorrect guess 0.

import { randomUUID } from 'node:crypto';
import type { CarColor, SettleResult } from '@pixel-race/shared-types';
import type { DbClient } from '../../shared/db.js';
import { conflict, notFound } from '../../shared/errors.js';
import { nowIso } from '../../shared/clock.js';
import { findRaceById, updateRaceStatus } from './races.repository.js';
import { findGuessesByRace, updateGuessOutcome } from '../guesses/guesses.repository.js';
import { insertLedgerEntry } from './score-ledger.repository.js';

/** Points for a correct guess. Incorrect guesses earn zero. */
export const CORRECT_POINTS = 1;
export const INCORRECT_POINTS = 0;

/** Pure scoring rule: 1 point iff the guess matches the winner. */
export function scoreGuess(guessedColor: CarColor, winnerColor: CarColor): number {
  return guessedColor === winnerColor ? CORRECT_POINTS : INCORRECT_POINTS;
}

/** SQLite UNIQUE-violation detector — the idempotency backstop for the ledger. */
function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

/**
 * Build the authoritative result view for the race owner from a settled race
 * and the owner's (single) guess.
 */
function resultFor(
  raceId: string,
  winnerColor: CarColor,
  guessedColor: CarColor | null,
): SettleResult {
  const isCorrect = guessedColor !== null && guessedColor === winnerColor;
  return {
    raceId,
    winnerColor,
    guessedColor,
    isCorrect,
    pointsAwarded: isCorrect ? CORRECT_POINTS : INCORRECT_POINTS,
  };
}

/**
 * Settle a race. The race must exist and be RUNNING to transition to SETTLED.
 * If the race is ALREADY SETTLED this returns the same result without awarding
 * again (idempotent). The compare-and-set status update is the primary guard
 * against concurrent double-settlement; the ledger unique constraint is the
 * backstop.
 */
export function settleRace(
  db: DbClient,
  params: { raceId: string; ownerId: string },
): SettleResult {
  const race = findRaceById(db, params.raceId);
  if (!race) {
    throw notFound('Race not found');
  }
  if (race.ownerId !== params.ownerId) {
    // Treat as not-found to avoid disclosing another player's race existence.
    throw notFound('Race not found');
  }
  if (race.winnerColor === null) {
    // Should never happen: the winner is chosen at creation. Fail loud.
    throw conflict('RACE_INVALID', 'Race has no stored winner');
  }

  const winnerColor = race.winnerColor;

  // Already settled: return the same authoritative result, no re-award.
  if (race.status === 'SETTLED') {
    const guess = findGuessesByRace(db, params.raceId).find(
      (g) => g.userId === params.ownerId,
    );
    return resultFor(params.raceId, winnerColor, guess?.guessedColor ?? null);
  }

  if (race.status !== 'RUNNING') {
    throw conflict('INVALID_TRANSITION', 'Race must be RUNNING before it can be settled');
  }

  // Everything below commits atomically or rolls back together.
  return db.transaction((tx) => {
    // Compare-and-set RUNNING→SETTLED. If another settle won the race, 0 rows
    // change and we bail — the winner's transaction already awarded points.
    const timestamp = nowIso();
    const changed = updateRaceStatus(tx, {
      id: params.raceId,
      expected: 'RUNNING',
      next: 'SETTLED',
      timestamp,
    });
    if (changed === 0) {
      throw conflict('ALREADY_SETTLING', 'Race is already being settled');
    }

    const guesses = findGuessesByRace(tx, params.raceId);
    let ownerGuessColor: CarColor | null = null;

    for (const guess of guesses) {
      const points = scoreGuess(guess.guessedColor, winnerColor);
      const isCorrect = points === CORRECT_POINTS;
      updateGuessOutcome(tx, { id: guess.id, isCorrect, pointsAwarded: points });

      try {
        insertLedgerEntry(tx, {
          id: randomUUID(),
          raceId: params.raceId,
          userId: guess.userId,
          points,
          createdAt: timestamp,
        });
      } catch (error) {
        // The unique constraint is the last line of defence; if a concurrent
        // settle already inserted this entry, do not double-award.
        if (!isUniqueViolation(error)) {
          throw error;
        }
      }

      if (guess.userId === params.ownerId) {
        ownerGuessColor = guess.guessedColor;
      }
    }

    return resultFor(params.raceId, winnerColor, ownerGuessColor);
  });
}

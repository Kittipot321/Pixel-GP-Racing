// Guess submission business logic.
//
// A player may submit exactly one guess per race, only while the race is OPEN.
// The response deliberately omits the winner so the hidden result cannot leak.
// Dedup is enforced by the (race_id, user_id) unique constraint as the final
// guard, even under concurrent submissions.

import { randomUUID } from 'node:crypto';
import type { CarColor, CreateGuessResponse } from '@pixel-race/shared-types';
import type { DbClient } from '../../shared/db.js';
import { conflict, forbidden, notFound } from '../../shared/errors.js';
import { nowIso } from '../../shared/clock.js';
import { findRaceById } from '../races/races.repository.js';
import { insertGuess } from './guesses.repository.js';

/** SQLite UNIQUE-violation detector for the guess dedup guard. */
function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

/**
 * Submit a guess for a race. The race must exist, belong to the caller, and be
 * OPEN. Returns an "accepted" acknowledgement with no winner. A duplicate
 * guess (enforced by the unique constraint) becomes a 409.
 */
export function submitGuess(
  db: DbClient,
  params: { raceId: string; userId: string; guessedColor: CarColor },
): CreateGuessResponse {
  const race = findRaceById(db, params.raceId);
  if (!race) {
    throw notFound('Race not found');
  }
  if (race.ownerId !== params.userId) {
    throw forbidden('You do not have access to this race');
  }
  if (race.status !== 'OPEN') {
    throw conflict('RACE_CLOSED', 'This race is no longer accepting guesses');
  }

  try {
    insertGuess(db, {
      id: randomUUID(),
      raceId: params.raceId,
      userId: params.userId,
      guessedColor: params.guessedColor,
      createdAt: nowIso(),
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict('GUESS_EXISTS', 'You have already guessed in this race');
    }
    throw error;
  }

  return {
    raceId: params.raceId,
    guessedColor: params.guessedColor,
    status: 'accepted',
  };
}

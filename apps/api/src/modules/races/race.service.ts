// Race lifecycle business logic.
//
// Owns winner selection (uniform over the four colors), the OPEN→RUNNING→SETTLED
// state machine with validated transitions, and the public projection that
// hides the winner until settlement. The server is the single source of truth:
// clients never supply a winner.

import { randomInt, randomUUID } from 'node:crypto';
import { CAR_COLORS, type CarColor, type RaceStatus } from '@pixel-race/shared-types';
import type { RaceRow } from '@pixel-race/database';
import type { DbClient } from '../../shared/db.js';
import { conflict, forbidden, notFound } from '../../shared/errors.js';
import { nowIso } from '../../shared/clock.js';
import {
  findCurrentOpenRace,
  findRaceById,
  insertRace,
  updateRaceStatus,
} from './races.repository.js';

/**
 * Pick a winning color uniformly at random from the four colors. Uses the
 * crypto-grade `randomInt` with an exclusive upper bound, which is unbiased
 * across `[0, CAR_COLORS.length)` — every color has probability 1/4.
 */
export function pickWinnerColor(): CarColor {
  return CAR_COLORS[randomInt(CAR_COLORS.length)];
}

/** Valid forward transitions. Anything not listed here is rejected. */
const VALID_TRANSITIONS: Record<RaceStatus, RaceStatus[]> = {
  OPEN: ['RUNNING'],
  RUNNING: ['SETTLED'],
  SETTLED: [],
};

/** Whether `next` is a legal transition from `current`. */
export function canTransition(current: RaceStatus, next: RaceStatus): boolean {
  return VALID_TRANSITIONS[current].includes(next);
}

/**
 * Public projection of a race. The winner is only disclosed once SETTLED; in
 * OPEN/RUNNING it is forced to null so the hidden result can never leak.
 */
export function toPublicRace(row: RaceRow): RaceRow {
  if (row.status === 'SETTLED') {
    return row;
  }
  return { ...row, winnerColor: null };
}

/** Create a new per-player race with a hidden, server-chosen winner. */
export function createRace(db: DbClient, ownerId: string): RaceRow {
  const row = insertRace(db, {
    id: randomUUID(),
    ownerId,
    winnerColor: pickWinnerColor(),
    createdAt: nowIso(),
  });
  return toPublicRace(row);
}

/** The caller's latest OPEN race, projected for public view (winner hidden). */
export function getCurrentOpenRace(db: DbClient, ownerId: string): RaceRow | undefined {
  const row = findCurrentOpenRace(db, ownerId);
  return row ? toPublicRace(row) : undefined;
}

/**
 * Fetch a race for a specific owner. Enforces ownership (a player may only see
 * their own race) and hides the winner until settlement. Throws 404 when the
 * race does not exist and 403 when it belongs to someone else.
 */
export function getRaceForOwner(db: DbClient, raceId: string, ownerId: string): RaceRow {
  const row = findRaceById(db, raceId);
  if (!row) {
    throw notFound('Race not found');
  }
  if (row.ownerId !== ownerId) {
    throw forbidden('You do not have access to this race');
  }
  return toPublicRace(row);
}

/**
 * Start a race: OPEN → RUNNING, which closes guessing. Enforces ownership and a
 * valid transition. Uses a compare-and-set update so a concurrent start cannot
 * double-advance the lifecycle.
 */
export function startRace(db: DbClient, raceId: string, ownerId: string): RaceRow {
  const row = findRaceById(db, raceId);
  if (!row) {
    throw notFound('Race not found');
  }
  if (row.ownerId !== ownerId) {
    throw forbidden('You do not have access to this race');
  }
  if (!canTransition(row.status, 'RUNNING')) {
    throw conflict('INVALID_TRANSITION', `Cannot start a race in status ${row.status}`);
  }

  const changed = updateRaceStatus(db, {
    id: raceId,
    expected: 'OPEN',
    next: 'RUNNING',
    timestamp: nowIso(),
  });
  if (changed === 0) {
    // Lost the compare-and-set: someone else advanced it first.
    throw conflict('INVALID_TRANSITION', 'Race is no longer open');
  }

  const updated = findRaceById(db, raceId);
  return toPublicRace(updated!);
}

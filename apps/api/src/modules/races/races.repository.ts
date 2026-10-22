// Data access for races.
//
// Pure persistence. Winner selection, transition validation, and settlement
// logic live in the service layer; this module only moves rows.

import { and, desc, eq } from 'drizzle-orm';
import { races, type RaceRow } from '@pixel-race/database';
import type { CarColor, RaceStatus } from '@pixel-race/shared-types';
import type { DbClient } from '../../shared/db.js';

/** Fields required to create a race. The winner is chosen by the service. */
export interface NewRaceInput {
  id: string;
  ownerId: string;
  winnerColor: CarColor;
  createdAt: string;
}

// NOTE: the shipped schema has no owner column; races are keyed to their owner
// via their guess ownership in the POC. To enforce per-player ownership and
// "current open race" we persist the owner on the race row. The migration in
// this phase adds the column (see migrations/0001_*).

/** Insert a race row with its (hidden) winner already chosen. */
export function insertRace(db: DbClient, input: NewRaceInput): RaceRow {
  const [row] = db
    .insert(races)
    .values({
      id: input.id,
      ownerId: input.ownerId,
      status: 'OPEN',
      winnerColor: input.winnerColor,
      createdAt: input.createdAt,
    })
    .returning()
    .all();
  return row;
}

/** Fetch a race by id. Returns undefined when not found. */
export function findRaceById(db: DbClient, id: string): RaceRow | undefined {
  return db.select().from(races).where(eq(races.id, id)).get();
}

/** The caller's most recently created OPEN race, or undefined if none. */
export function findCurrentOpenRace(db: DbClient, ownerId: string): RaceRow | undefined {
  return db
    .select()
    .from(races)
    .where(and(eq(races.ownerId, ownerId), eq(races.status, 'OPEN')))
    .orderBy(desc(races.createdAt))
    .get();
}

/**
 * Update a race's status (and the matching timestamp). Returns the number of
 * rows changed so callers can detect a lost optimistic race. The `expected`
 * status guards the transition at the SQL level (compare-and-set).
 */
export function updateRaceStatus(
  db: DbClient,
  params: {
    id: string;
    expected: RaceStatus;
    next: RaceStatus;
    timestamp: string;
  },
): number {
  const patch: Partial<RaceRow> = { status: params.next };
  if (params.next === 'RUNNING') {
    patch.startedAt = params.timestamp;
  } else if (params.next === 'SETTLED') {
    patch.settledAt = params.timestamp;
  }

  const result = db
    .update(races)
    .set(patch)
    .where(and(eq(races.id, params.id), eq(races.status, params.expected)))
    .run();
  return result.changes;
}

// Data access for the immutable score ledger.
//
// The ledger is the authoritative record of points. Its unique constraint on
// (race_id, user_id) is the last line of defence against duplicate awards under
// concurrent settlement.

import { and, eq } from 'drizzle-orm';
import { scoreLedger, type ScoreLedgerRow } from '@pixel-race/database';
import type { DbClient } from '../../shared/db.js';

export interface NewLedgerInput {
  id: string;
  raceId: string;
  userId: string;
  points: number;
  createdAt: string;
}

/**
 * Insert a ledger entry. A duplicate (same race+user) throws a SQLite UNIQUE
 * error — settlement relies on this to stay idempotent.
 */
export function insertLedgerEntry(db: DbClient, input: NewLedgerInput): ScoreLedgerRow {
  const [row] = db.insert(scoreLedger).values(input).returning().all();
  return row;
}

/** Whether a ledger entry already exists for this race+user. */
export function ledgerEntryExists(db: DbClient, raceId: string, userId: string): boolean {
  const row = db
    .select({ id: scoreLedger.id })
    .from(scoreLedger)
    .where(and(eq(scoreLedger.raceId, raceId), eq(scoreLedger.userId, userId)))
    .get();
  return row !== undefined;
}

// Core domain model for Pixel Race.
//
// These are the pure, transport-agnostic shapes that describe the game's
// entities. They are intentionally free of ORM, HTTP, or framework concerns so
// both the API and the web app can depend on them without pulling in server
// dependencies. Runtime validation lives in `validation.ts`.

/**
 * The four fixed car colors a player can predict. These string literals are the
 * canonical persisted values and must match the database enum exactly.
 */
export const CAR_COLORS = ['RED', 'YELLOW', 'BLUE', 'WHITE'] as const;

/** A car color — one of the four fixed options. */
export type CarColor = (typeof CAR_COLORS)[number];

/**
 * Lifecycle status of a race.
 *
 * - `OPEN`    — accepting predictions.
 * - `RUNNING` — predictions closed, animation/outcome in progress.
 * - `SETTLED` — result disclosed and scores awarded (terminal).
 */
export const RACE_STATUSES = ['OPEN', 'RUNNING', 'SETTLED'] as const;

/** A race lifecycle status. */
export type RaceStatus = (typeof RACE_STATUSES)[number];

/**
 * A registered player.
 *
 * NOTE: this is the *safe* public shape. The password hash is never part of a
 * `User` and must never cross the wire or leave the auth module.
 */
export interface User {
  id: string;
  username: string;
  email: string;
  /** ISO-8601 UTC timestamp. */
  createdAt: string;
  /** ISO-8601 UTC timestamp. */
  updatedAt: string;
}

/**
 * A single race round.
 *
 * `winnerColor` is `null` until the race is settled and the result disclosed —
 * exposing it earlier would leak the authoritative outcome to clients.
 */
export interface Race {
  id: string;
  status: RaceStatus;
  /** Null until the race is settled; never disclosed before settlement. */
  winnerColor: CarColor | null;
  /** ISO-8601 UTC timestamp. */
  createdAt: string;
  /** ISO-8601 UTC timestamp; null until the race starts (RUNNING). */
  startedAt: string | null;
  /** ISO-8601 UTC timestamp; null until the race is settled. */
  settledAt: string | null;
}

/**
 * A player's prediction for a race. Unique per `(raceId, userId)`.
 *
 * `isCorrect` and `pointsAwarded` are `null` until the owning race is settled.
 */
export interface Guess {
  id: string;
  raceId: string;
  userId: string;
  guessedColor: CarColor;
  /** Null until settlement. */
  isCorrect: boolean | null;
  /** Null until settlement; 0 or 1 once settled. */
  pointsAwarded: number | null;
  /** ISO-8601 UTC timestamp. */
  createdAt: string;
}

/**
 * An immutable score award for a settled race. Unique per `(raceId, userId)`.
 * The ledger is the authoritative source of a player's total points.
 */
export interface ScoreLedgerEntry {
  id: string;
  raceId: string;
  userId: string;
  /** Non-negative integer points awarded for this race. */
  points: number;
  /** ISO-8601 UTC timestamp. */
  createdAt: string;
}

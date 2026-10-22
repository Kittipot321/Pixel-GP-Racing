// Runtime validation schemas and shared API request/response contracts.
//
// Zod is the single source of truth for runtime validation. Where a type can
// be derived from a schema we use `z.infer` so the compile-time type and the
// runtime check can never drift apart.

import { z } from 'zod';
import { CAR_COLORS, RACE_STATUSES } from './domain.js';

/** Runtime guard for a car color. Rejects any value outside the four colors. */
export const carColorSchema = z.enum(CAR_COLORS);

/** Runtime guard for a race status. */
export const raceStatusSchema = z.enum(RACE_STATUSES);

// --- Auth: registration ---------------------------------------------------

/** Allowed username characters: letters, digits, underscore, hyphen. */
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Registration input. Normalization rules (lowercasing email, trimming) are
 * documented here and applied by `.transform` so callers get canonical values.
 */
export const registerRequestSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(32, 'Username must be at most 32 characters')
    .regex(USERNAME_PATTERN, 'Username may contain only letters, numbers, "_" and "-"'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('A valid email address is required')
    .max(254, 'Email is too long'),
  // Policy: 8-128 chars. Strength beyond length is enforced at the auth layer
  // in a later phase; this is the baseline schema contract.
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

// --- Auth: login -----------------------------------------------------------

export const loginRequestSchema = z.object({
  // Login accepts either username or email in a single identifier field.
  identifier: z.string().trim().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

// --- Guesses ---------------------------------------------------------------

/** Body for submitting a prediction to a race. */
export const createGuessRequestSchema = z.object({
  guessedColor: carColorSchema,
});

export type CreateGuessRequest = z.infer<typeof createGuessRequestSchema>;

/**
 * The response returned when a guess is accepted. Deliberately does NOT include
 * the winner — that would leak the hidden result before settlement.
 */
export interface CreateGuessResponse {
  raceId: string;
  guessedColor: (typeof CAR_COLORS)[number];
  status: 'accepted';
}

// --- Pagination ------------------------------------------------------------

/** Shared pagination query params with safe bounds and defaults. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** A single page of results plus the metadata a client needs to page through. */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

// --- Auth responses --------------------------------------------------------

import type { User, Race, CarColor } from './domain.js';

/** Response returned by register and login: the safe user plus an access token. */
export interface AuthResponse {
  user: User;
  /** Short-lived JWT access token. No refresh token is issued (POC). */
  token: string;
}

// --- Race responses --------------------------------------------------------

/**
 * Public view of a race. `winnerColor` is only present once the race is
 * `SETTLED`; it is omitted (hidden) while `OPEN`/`RUNNING`.
 */
export type RacePublicState = Race;

/** Settlement result returned to the race owner after a race is settled. */
export interface SettleResult {
  raceId: string;
  winnerColor: CarColor;
  guessedColor: CarColor | null;
  isCorrect: boolean;
  pointsAwarded: number;
}

// --- Leaderboard / stats / history -----------------------------------------

/** Period filter for the leaderboard. */
export const leaderboardPeriodSchema = z.enum(['all-time', 'daily']);
export type LeaderboardPeriod = z.infer<typeof leaderboardPeriodSchema>;

/** Query params for the leaderboard endpoint: pagination plus a period filter. */
export const leaderboardQuerySchema = paginationQuerySchema.extend({
  period: leaderboardPeriodSchema.default('all-time'),
});
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;

/** A single ranked row on the leaderboard. */
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  totalPoints: number;
}

/** Aggregate statistics for a single player. */
export interface UserStats {
  totalPoints: number;
  settledRaces: number;
  correctGuesses: number;
  /** Ratio in [0, 1]; 0 when the player has no settled races. */
  accuracy: number;
}

/** One row of a player's settled-race history. */
export interface HistoryEntry {
  raceId: string;
  guessedColor: CarColor;
  winnerColor: CarColor;
  isCorrect: boolean;
  pointsAwarded: number;
  settledAt: string;
}

// --- Errors ----------------------------------------------------------------

/** Consistent error envelope returned by the API on failure. */
export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

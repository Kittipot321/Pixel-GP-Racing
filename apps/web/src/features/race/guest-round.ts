// Guest round — the browser-only outcome of a race for players who are not
// logged in. A guest round never touches the API and never awards points: the
// result only says who won and whether the guess was right.

import { CAR_COLORS, type CarColor } from '@pixel-race/shared-types';

export interface GuestResult {
  winnerColor: CarColor;
  guessedColor: CarColor;
  isCorrect: boolean;
}

/** Pick a winner uniformly (1/4 each). Out-of-range or non-finite random values are clamped. */
export function pickGuestWinner(random: () => number = Math.random): CarColor {
  const value = random();
  const safe = Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;
  // Guard random() === 1 so the index never runs past the last color.
  const index = Math.min(Math.floor(safe * CAR_COLORS.length), CAR_COLORS.length - 1);
  return CAR_COLORS[index] as CarColor;
}

/** Settle a guest round in memory: pick the winner and compare it with the guess. */
export function settleGuestRound(
  guessed: CarColor,
  random: () => number = Math.random,
): GuestResult {
  if (!(CAR_COLORS as readonly string[]).includes(guessed)) {
    throw new Error(`Unknown guessed color: ${String(guessed)}`);
  }
  const winnerColor = pickGuestWinner(random);
  return { winnerColor, guessedColor: guessed, isCorrect: winnerColor === guessed };
}

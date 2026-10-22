// Guest-round logic tests (FR4.2, FR4.3): a browser-side uniform pick of the
// winner and an in-memory result that carries no points.

import { describe, it, expect } from 'vitest';
import type { CarColor } from '@pixel-race/shared-types';
import { pickGuestWinner, settleGuestRound } from './guest-round.ts';

describe('pickGuestWinner', () => {
  it.each([
    [0, 'RED'],
    [0.25, 'YELLOW'],
    [0.5, 'BLUE'],
    [0.75, 'WHITE'],
  ])('maps random %s to %s', (value, expected) => {
    expect(pickGuestWinner(() => value)).toBe(expected);
  });

  it('maps 0.999999 to WHITE', () => {
    expect(pickGuestWinner(() => 0.999999)).toBe('WHITE');
  });

  it('never runs past the last color when random returns exactly 1', () => {
    expect(pickGuestWinner(() => 1)).toBe('WHITE');
  });
});

describe('settleGuestRound', () => {
  it('is correct only when the guess matches the winner', () => {
    expect(settleGuestRound('BLUE', () => 0.5)).toEqual({
      winnerColor: 'BLUE',
      guessedColor: 'BLUE',
      isCorrect: true,
    });
    expect(settleGuestRound('RED', () => 0.5)).toEqual({
      winnerColor: 'BLUE',
      guessedColor: 'RED',
      isCorrect: false,
    });
  });

  it('carries no points field', () => {
    const result = settleGuestRound('RED', () => 0);

    expect(result).not.toHaveProperty('pointsAwarded');
    expect(Object.keys(result).sort()).toEqual(['guessedColor', 'isCorrect', 'winnerColor']);
  });

  it('throws for a guess that is not a car color', () => {
    expect(() => settleGuestRound('GREEN' as CarColor, () => 0)).toThrow(/Unknown guessed color/);
  });
});

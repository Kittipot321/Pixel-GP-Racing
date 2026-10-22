// Race-plan logic tests (pure, no Phaser).
//
// Covers FR2.1 (15 s race), FR2.2 (>= 5 lead changes), FR2.3/FR2.5 (the fixed
// winner crosses first) and NFR3 (deterministic with an injected random).

import { describe, it, expect } from 'vitest';
import { CAR_COLORS, type CarColor } from '@pixel-race/shared-types';
import {
  createRacePlan,
  countLeadChanges,
  leaderAt,
  progressAt,
  runoffDistance,
  runoffStopMs,
  LEAD_HOLD_MS,
  MIN_LEAD_CHANGES,
  RACE_DURATION_MS,
  type RacePlan,
} from './race-plan.ts';

/** Small seeded PRNG (mulberry32) so every run is reproducible. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEEDS = Array.from({ length: 20 }, (_, i) => 1000 + i * 7919);

/** First sampled time (10 ms steps) at which a car reaches the finish line. */
function firstFinishMs(plan: RacePlan, color: CarColor): number {
  for (let t = 0; t <= RACE_DURATION_MS * 2; t += 10) {
    if (progressAt(plan, color, t) >= 1) {
      return t;
    }
  }
  return Number.POSITIVE_INFINITY;
}

function expectWinnerFirstAtFifteenSeconds(plan: RacePlan): void {
  const winnerFinish = firstFinishMs(plan, plan.winner);
  expect(winnerFinish).toBeGreaterThanOrEqual(RACE_DURATION_MS - 500);
  expect(winnerFinish).toBeLessThanOrEqual(RACE_DURATION_MS + 500);
  for (const color of CAR_COLORS) {
    if (color !== plan.winner) {
      expect(firstFinishMs(plan, color)).toBeGreaterThan(winnerFinish);
      expect(progressAt(plan, color, RACE_DURATION_MS)).toBeLessThan(1);
    }
  }
}

function expectMonotonic(plan: RacePlan): void {
  for (const color of CAR_COLORS) {
    let previous = 0;
    for (let t = 0; t <= RACE_DURATION_MS + 1500; t += 50) {
      const value = progressAt(plan, color, t);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  }
}

describe('createRacePlan', () => {
  it.each(CAR_COLORS)('makes %s cross the line first at about 15000 ms', (winner) => {
    const plan = createRacePlan(winner, seeded(42));

    expect(plan.winner).toBe(winner);
    expectWinnerFirstAtFifteenSeconds(plan);
    expect(leaderAt(plan, RACE_DURATION_MS)).toBe(winner);
  });

  it('changes the lead at least 5 times for 20 seeded random sources', () => {
    SEEDS.forEach((seed, i) => {
      const winner = CAR_COLORS[i % CAR_COLORS.length] as CarColor;
      const plan = createRacePlan(winner, seeded(seed));

      const changes = countLeadChanges(plan, { sampleMs: 50, holdMs: LEAD_HOLD_MS });
      expect(changes, `seed ${seed}`).toBeGreaterThanOrEqual(MIN_LEAD_CHANGES);
      expectWinnerFirstAtFifteenSeconds(plan);
    });
  });

  it('never moves any car backwards', () => {
    for (const seed of SEEDS.slice(0, 5)) {
      expectMonotonic(createRacePlan('BLUE', seeded(seed)));
    }
  });

  it('starts every car level on the grid with no leader', () => {
    const plan = createRacePlan('RED', seeded(7));

    for (const color of CAR_COLORS) {
      expect(progressAt(plan, color, 0)).toBe(0);
    }
    expect(leaderAt(plan, 0)).toBeNull();
  });

  it.each([
    ['always 0', () => 0],
    ['always 0.999999', () => 0.999999],
    ['NaN', () => Number.NaN],
  ])('still produces a valid race when random is %s', (_label, random) => {
    const plan = createRacePlan('WHITE', random);

    expect(countLeadChanges(plan)).toBeGreaterThanOrEqual(MIN_LEAD_CHANGES);
    expectWinnerFirstAtFifteenSeconds(plan);
    expectMonotonic(plan);
  });

  it('throws for a winner that is not a car color', () => {
    expect(() => createRacePlan('GREEN' as CarColor)).toThrow(/Unknown winner color/);
  });
});

describe('countLeadChanges', () => {
  it('rejects a non-positive sample interval', () => {
    const plan = createRacePlan('YELLOW', seeded(3));

    expect(() => countLeadChanges(plan, { sampleMs: 0 })).toThrow(/sampleMs/);
  });
});

describe('runoffDistance (braking past the finish line)', () => {
  const speed = 0.25; // px per ms
  const stopPx = 300;
  const stopMs = runoffStopMs(speed, stopPx);

  it('is zero at and before the line', () => {
    expect(runoffDistance(0, speed, stopPx)).toBe(0);
    expect(runoffDistance(-100, speed, stopPx)).toBe(0);
  });

  it('leaves the line at race speed and only ever moves forward', () => {
    expect(runoffDistance(1, speed, stopPx)).toBeCloseTo(speed, 3);
    let previous = 0;
    for (let s = 0; s <= stopMs + 200; s += 16) {
      const d = runoffDistance(s, speed, stopPx);
      expect(d).toBeGreaterThanOrEqual(previous);
      previous = d;
    }
  });

  it('stops exactly stopPx past the line and stays there', () => {
    expect(stopMs).toBe(2400);
    expect(runoffDistance(stopMs - 1e-6, speed, stopPx)).toBeCloseTo(stopPx, 3);
    expect(runoffDistance(stopMs, speed, stopPx)).toBe(stopPx);
    expect(runoffDistance(stopMs * 3, speed, stopPx)).toBe(stopPx);
  });

  it('does not move with an invalid speed or stop distance', () => {
    expect(runoffDistance(500, 0, stopPx)).toBe(0);
    expect(runoffDistance(500, Number.NaN, stopPx)).toBe(0);
    expect(runoffDistance(500, speed, -10)).toBe(0);
    expect(runoffStopMs(-1, stopPx)).toBe(0);
  });
});

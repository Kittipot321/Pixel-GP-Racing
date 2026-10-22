// Race plan — the pure, Phaser-free choreography of one 15-second race.
//
// The winner is decided elsewhere (the server for logged-in players, the
// browser for guests); this module only decides HOW the race looks on the way
// to that fixed result. Every car follows a shared linear baseline
// (t / duration) plus a small per-car offset that is eased between keyframes.
// Each segment between keyframes has one intended leader, consecutive leaders
// always differ, and the last leader is the winner, so the lead visibly changes
// hands several times before the winner crosses the line first at exactly
// RACE_DURATION_MS.
//
// Lead-change definition (shared by the scene and the tests):
//   - the leader is the car with the strictly highest progress (0..1);
//   - when the top is tied (e.g. everyone on the start line) there is no new
//     leader, so the previous leader keeps the lead;
//   - a change only counts once the new leader has stayed ahead continuously
//     for at least LEAD_HOLD_MS.

import { CAR_COLORS, type CarColor } from '@pixel-race/shared-types';

export const RACE_DURATION_MS = 15000;
export const LEAD_HOLD_MS = 500;
export const MIN_LEAD_CHANGES = 5;

/** Minimum length of a segment between two keyframes. */
const MIN_SEGMENT_MS = 1500;
/** The final segment is longer so the winner's last overtake is held in time. */
const MIN_FINAL_SEGMENT_MS = 2000;
/** Leader offset above the baseline at the end of its segment: [0.012, 0.025). */
const LEADER_OFFSET_MIN = 0.012;
const LEADER_OFFSET_SPAN = 0.013;
/** Non-leader offset below the baseline: (-0.03, -0.015]. Keeps the pack close. */
const CHASER_OFFSET_MAX = -0.015;
const CHASER_OFFSET_SPAN = 0.015;
const MAX_ATTEMPTS = 20;
const DEFAULT_SAMPLE_MS = 50;
const TIE_EPSILON = 1e-9;

export interface RacePlan {
  readonly winner: CarColor;
  readonly durationMs: number;
  /** Keyframe times in ms; starts at 0 and ends at durationMs. */
  readonly timesMs: readonly number[];
  /** Per-car offset from the shared baseline at each keyframe. */
  readonly offsets: Readonly<Record<CarColor, readonly number[]>>;
  /** Intended leader of each segment (timesMs[i] .. timesMs[i + 1]). */
  readonly segmentLeaders: readonly CarColor[];
}

export interface LeadChangeOptions {
  sampleMs?: number;
  holdMs?: number;
}

function isCarColor(value: unknown): value is CarColor {
  return typeof value === 'string' && (CAR_COLORS as readonly string[]).includes(value);
}

/** Wrap a random source so it always yields a finite value in [0, 1). */
function safeRandom(random: () => number): () => number {
  return () => {
    const value = random();
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.min(Math.max(value, 0), 0.999999);
  };
}

function pickIndex(random: () => number, length: number): number {
  return Math.min(Math.floor(random() * length), length - 1);
}

/** Segment leaders, built backwards from the winner so no leader repeats twice in a row. */
function buildLeaders(winner: CarColor, segments: number, random: () => number): CarColor[] {
  const leaders: CarColor[] = [winner];
  while (leaders.length < segments) {
    const next = leaders[0] as CarColor;
    const options = CAR_COLORS.filter((color) => color !== next);
    leaders.unshift(options[pickIndex(random, options.length)] as CarColor);
  }
  return leaders;
}

/** Keyframe times: every segment >= MIN_SEGMENT_MS, the last >= MIN_FINAL_SEGMENT_MS. */
function buildTimes(segments: number, random: () => number): number[] {
  const minimums = Array.from({ length: segments }, (_, i) =>
    i === segments - 1 ? MIN_FINAL_SEGMENT_MS : MIN_SEGMENT_MS,
  );
  const slack = RACE_DURATION_MS - minimums.reduce((sum, value) => sum + value, 0);
  const weights = minimums.map(() => 0.5 + random());
  const weightSum = weights.reduce((sum, value) => sum + value, 0);

  const times = [0];
  let elapsed = 0;
  minimums.forEach((minimum, i) => {
    elapsed += minimum + (slack * (weights[i] as number)) / weightSum;
    times.push(i === segments - 1 ? RACE_DURATION_MS : elapsed);
  });
  return times;
}

function buildOffsets(
  winner: CarColor,
  leaders: readonly CarColor[],
  random: () => number,
): Record<CarColor, number[]> {
  const offsets = {} as Record<CarColor, number[]>;
  for (const color of CAR_COLORS) {
    offsets[color] = [0]; // everyone starts level on the grid
  }
  leaders.forEach((leader, i) => {
    const isFinal = i === leaders.length - 1;
    for (const color of CAR_COLORS) {
      let offset: number;
      if (color === leader) {
        // The winner ends exactly on the baseline, i.e. progress 1 at the finish.
        offset =
          isFinal && color === winner ? 0 : LEADER_OFFSET_MIN + random() * LEADER_OFFSET_SPAN;
      } else {
        offset = CHASER_OFFSET_MAX - random() * CHASER_OFFSET_SPAN;
      }
      offsets[color].push(offset);
    }
  });
  return offsets;
}

function buildPlan(winner: CarColor, random: () => number): RacePlan {
  const segments = random() < 0.5 ? 7 : 8;
  const leaders = buildLeaders(winner, segments, random);
  return {
    winner,
    durationMs: RACE_DURATION_MS,
    timesMs: buildTimes(segments, random),
    offsets: buildOffsets(winner, leaders, random),
    segmentLeaders: leaders,
  };
}

/** A fixed, known-good plan used if random attempts ever fail validation. */
function buildFallbackPlan(winner: CarColor): RacePlan {
  const sequence = [0.5, 0.2, 0.8, 0.35, 0.65];
  let cursor = 0;
  return buildPlan(winner, () => {
    const value = sequence[cursor % sequence.length] as number;
    cursor += 1;
    return value;
  });
}

function offsetAt(plan: RacePlan, color: CarColor, tMs: number): number {
  const times = plan.timesMs;
  const values = plan.offsets[color];
  const last = times.length - 1;
  if (tMs >= (times[last] as number)) {
    return values[last] as number;
  }
  let i = 1;
  while (i < last && tMs >= (times[i] as number)) {
    i += 1;
  }
  const t0 = times[i - 1] as number;
  const t1 = times[i] as number;
  const o0 = values[i - 1] as number;
  const o1 = values[i] as number;
  const u = (tMs - t0) / (t1 - t0);
  const eased = (1 - Math.cos(Math.PI * u)) / 2; // smooth start and end of every segment
  return o0 + (o1 - o0) * eased;
}

/**
 * Progress (0..1) of one car at a time in ms. Times before the start return 0;
 * after the race clock ends cars keep moving at baseline speed until they reach 1.
 */
export function progressAt(plan: RacePlan, color: CarColor, tMs: number): number {
  if (!(tMs > 0)) {
    return 0;
  }
  const value = tMs / plan.durationMs + offsetAt(plan, color, tMs);
  return Math.min(Math.max(value, 0), 1);
}

/** Time in ms at which a car reaches progress 1 (the winner: exactly durationMs). */
export function finishTimeMs(plan: RacePlan, color: CarColor): number {
  const finalOffset = plan.offsets[color][plan.timesMs.length - 1] as number;
  return plan.durationMs * (1 - finalOffset);
}

/** Time in ms a car needs to brake from `speedPxPerMs` to a stop within `stopPx`. */
export function runoffStopMs(speedPxPerMs: number, stopPx: number): number {
  if (!(speedPxPerMs > 0) || !(stopPx > 0)) {
    return 0;
  }
  return (2 * stopPx) / speedPxPerMs;
}

/**
 * Distance in px a car has rolled past the finish line `sinceFinishMs` after
 * crossing it at `speedPxPerMs`, braking evenly to a stop exactly `stopPx` past
 * the line. Speed at the line matches the race speed, so there is no jolt.
 */
export function runoffDistance(sinceFinishMs: number, speedPxPerMs: number, stopPx: number): number {
  const stopMs = runoffStopMs(speedPxPerMs, stopPx);
  if (!(sinceFinishMs > 0) || stopMs === 0) {
    return 0;
  }
  if (sinceFinishMs >= stopMs) {
    return stopPx;
  }
  const s = sinceFinishMs;
  return speedPxPerMs * s - ((speedPxPerMs * speedPxPerMs) / (4 * stopPx)) * s * s;
}

/** The car with the strictly highest progress, or null when the top is tied. */
export function leaderAt(plan: RacePlan, tMs: number): CarColor | null {
  let best: CarColor | null = null;
  let bestValue = -Infinity;
  let tied = false;
  for (const color of CAR_COLORS) {
    const value = progressAt(plan, color, tMs);
    if (value > bestValue + TIE_EPSILON) {
      best = color;
      bestValue = value;
      tied = false;
    } else if (Math.abs(value - bestValue) <= TIE_EPSILON) {
      tied = true;
    }
  }
  return tied ? null : best;
}

/** Count confirmed lead changes between 0 and durationMs (see definition above). */
export function countLeadChanges(plan: RacePlan, options: LeadChangeOptions = {}): number {
  const sampleMs = options.sampleMs ?? DEFAULT_SAMPLE_MS;
  const holdMs = options.holdMs ?? LEAD_HOLD_MS;
  if (!(sampleMs > 0)) {
    throw new Error(`sampleMs must be a positive number, got ${sampleMs}`);
  }

  let confirmed: CarColor | null = null;
  let candidate: CarColor | null = null;
  let candidateSince = 0;
  let changes = 0;

  for (let t = 0; t <= plan.durationMs; t += sampleMs) {
    const leader = leaderAt(plan, t);
    if (leader === null || leader === confirmed) {
      candidate = null; // a tie keeps the current leader and breaks any challenge
    } else if (confirmed === null) {
      confirmed = leader; // first car to break away from the grid; not a change
    } else if (leader !== candidate) {
      candidate = leader;
      candidateSince = t;
    }
    if (candidate !== null && t - candidateSince >= holdMs) {
      confirmed = candidate;
      candidate = null;
      changes += 1;
    }
  }
  return changes;
}

function isMonotonic(plan: RacePlan, sampleMs: number): boolean {
  return CAR_COLORS.every((color) => {
    let previous = 0;
    for (let t = 0; t <= finishTimeMs(plan, color) + sampleMs; t += sampleMs) {
      const value = progressAt(plan, color, t);
      if (value < previous) {
        return false;
      }
      previous = value;
    }
    return true;
  });
}

/** True when the plan meets every race requirement (lead changes, finish order, monotonic). */
export function isValidRacePlan(plan: RacePlan): boolean {
  const end = plan.durationMs;
  const winnerFinishes = progressAt(plan, plan.winner, end) === 1;
  const othersBehind = CAR_COLORS.every(
    (color) => color === plan.winner || progressAt(plan, color, end) < 1,
  );
  return (
    winnerFinishes &&
    othersBehind &&
    leaderAt(plan, end) === plan.winner &&
    countLeadChanges(plan) >= MIN_LEAD_CHANGES &&
    isMonotonic(plan, DEFAULT_SAMPLE_MS)
  );
}

/**
 * Build a race plan that ends with `winner` crossing first at RACE_DURATION_MS
 * after at least MIN_LEAD_CHANGES lead changes. Retries up to MAX_ATTEMPTS
 * random plans, then falls back to a fixed known-good plan.
 */
export function createRacePlan(winner: CarColor, random: () => number = Math.random): RacePlan {
  if (!isCarColor(winner)) {
    throw new Error(`Unknown winner color: ${String(winner)}`);
  }
  const source = safeRandom(random);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const plan = buildPlan(winner, source);
    if (isValidRacePlan(plan)) {
      return plan;
    }
  }
  return buildFallbackPlan(winner);
}

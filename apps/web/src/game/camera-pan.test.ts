// Camera pan tests (pure, no Phaser).

import { describe, it, expect } from 'vitest';
import { cameraPanX, type CameraPanOptions } from './camera-pan.ts';

const options: CameraPanOptions = { speedPxPerMs: 0.25, rampMs: 1000, endX: 3000, brakePx: 300 };
const FRAME_MS = 16;

/** Approximate speed (px per ms) at time t from two nearby samples. */
function speedAt(t: number, opts: CameraPanOptions = options): number {
  return (cameraPanX(t + 0.5, opts) - cameraPanX(t - 0.5, opts)) / 1;
}

describe('cameraPanX', () => {
  it('rests on the start grid at and before lights out', () => {
    expect(cameraPanX(0, options)).toBe(0);
    expect(cameraPanX(-500, options)).toBe(0);
    expect(speedAt(1)).toBeLessThan(0.01); // eases away from rest
  });

  it('never moves backward', () => {
    let previous = 0;
    for (let t = 0; t <= 20000; t += FRAME_MS) {
      const x = cameraPanX(t, options);
      expect(x).toBeGreaterThanOrEqual(previous);
      previous = x;
    }
  });

  it('cruises at a steady race speed between the ramp and the brake', () => {
    expect(speedAt(2000)).toBeCloseTo(0.25, 6);
    expect(speedAt(6000)).toBeCloseTo(0.25, 6);
    expect(cameraPanX(5000, options)).toBeCloseTo(0.25 * (5000 - 500), 6);
  });

  it('changes speed smoothly at the ramp end and the brake start', () => {
    const brakeStartMs = (3000 - 300) / 0.25 + 500;
    for (const t of [1000, brakeStartMs]) {
      expect(Math.abs(speedAt(t + FRAME_MS) - speedAt(t - FRAME_MS))).toBeLessThan(0.01);
    }
  });

  it('stops exactly at endX and stays there', () => {
    expect(cameraPanX(20000, options)).toBe(3000);
    expect(cameraPanX(60000, options)).toBe(3000);
  });

  it('stays put with invalid input', () => {
    expect(cameraPanX(5000, { ...options, speedPxPerMs: 0 })).toBe(0);
    expect(cameraPanX(5000, { ...options, speedPxPerMs: Number.NaN })).toBe(0);
    expect(cameraPanX(Number.NaN, options)).toBe(0);
    expect(cameraPanX(5000, { ...options, endX: -10 })).toBe(0);
  });
});

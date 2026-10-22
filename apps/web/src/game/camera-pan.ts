// Camera pan — the pure, Phaser-free path the race camera follows.
//
// The camera does not watch the cars; it pans on its own schedule from the
// start grid to the finish run-off. Its speed eases up from rest after lights
// out (smoothstep over rampMs), holds the race's baseline speed so the pack
// drifts and overtakes inside a steadily moving frame, then brakes evenly to
// stop exactly at endX. Speed is continuous throughout, so the pan never jolts.

import { runoffDistance } from './race-plan.ts';

export interface CameraPanOptions {
  /** Cruise speed in px per ms (the race's baseline speed). */
  readonly speedPxPerMs: number;
  /** Time to ease from rest up to cruise speed. */
  readonly rampMs: number;
  /** Camera x where the pan comes to rest. */
  readonly endX: number;
  /** Distance over which the camera brakes before endX. */
  readonly brakePx: number;
}

/** Camera x after the ramp-and-cruise part of the pan, before any braking. */
function cruiseX(tMs: number, speed: number, rampMs: number): number {
  if (rampMs > 0 && tMs < rampMs) {
    const u = tMs / rampMs;
    return speed * rampMs * (u * u * u - (u * u * u * u) / 2); // integral of smoothstep
  }
  return speed * (tMs - Math.max(rampMs, 0) / 2);
}

/** Camera x (0 at the start grid) `tMs` after lights out. */
export function cameraPanX(tMs: number, options: CameraPanOptions): number {
  const { speedPxPerMs: speed, rampMs, endX, brakePx } = options;
  if (!(tMs > 0) || !(speed > 0) || !(endX > 0)) {
    return 0;
  }
  const ramp = Math.max(rampMs, 0);
  const brakeStartX = endX - Math.max(brakePx, 0);
  if (!(brakePx > 0) || brakeStartX < (speed * ramp) / 2) {
    // No room to brake after the ramp: cruise and stop at endX.
    return Math.min(cruiseX(tMs, speed, ramp), endX);
  }
  const x = cruiseX(tMs, speed, ramp);
  if (x < brakeStartX) {
    return x;
  }
  const brakeStartMs = brakeStartX / speed + ramp / 2;
  return brakeStartX + runoffDistance(tMs - brakeStartMs, speed, brakePx);
}

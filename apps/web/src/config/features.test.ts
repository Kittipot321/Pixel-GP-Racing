import { describe, expect, it } from 'vitest';
import { parseBooleanFlag } from './features.ts';

describe('parseBooleanFlag', () => {
  it.each(['true', '1', 'on', 'yes', ' TRUE ', 'On'])('reads %j as true', (raw) => {
    expect(parseBooleanFlag(raw, false)).toBe(true);
  });

  it.each(['false', '0', 'off', 'no', ' FALSE ', 'Off'])('reads %j as false', (raw) => {
    expect(parseBooleanFlag(raw, true)).toBe(false);
  });

  it.each([undefined, '', '   ', 'maybe'])('falls back to the default for %j', (raw) => {
    expect(parseBooleanFlag(raw, true)).toBe(true);
    expect(parseBooleanFlag(raw, false)).toBe(false);
  });
});

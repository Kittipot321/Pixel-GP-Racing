// Race audio tests with a fake AudioContext (jsdom has no Web Audio).
// Covers FR1.1–FR1.4 (sounds, mute, un-mute mid-race), FR1.2 (dispose),
// NFR2 (master gain <= 0.2), NFR3 (unlock resumes), NFR4 (no Web Audio).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { MASTER_GAIN, createRaceAudio } from './race-audio.ts';

function fakeParam(initial = 0) {
  return {
    value: initial,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
}

class FakeNode {
  connected: unknown[] = [];
  connect = vi.fn((target: unknown) => {
    this.connected.push(target);
    return target;
  });
  disconnect = vi.fn();
}

class FakeGain extends FakeNode {
  gain = fakeParam(1);
}

class FakeOscillator extends FakeNode {
  type = 'sine';
  frequency = fakeParam(440);
  onended: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
}

class FakeFilter extends FakeNode {
  type = 'lowpass';
  frequency = fakeParam(350);
}

class FakeAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  currentTime = 0;
  destination = { kind: 'destination' };
  gains: FakeGain[] = [];
  oscillators: FakeOscillator[] = [];
  createGain = vi.fn(() => {
    const node = new FakeGain();
    this.gains.push(node);
    return node;
  });
  createOscillator = vi.fn(() => {
    const node = new FakeOscillator();
    this.oscillators.push(node);
    return node;
  });
  createBiquadFilter = vi.fn(() => new FakeFilter());
  resume = vi.fn(() => {
    this.state = 'running';
    return Promise.resolve();
  });
  close = vi.fn(() => {
    this.state = 'closed';
    return Promise.resolve();
  });

  /** The gain node wired straight to the speakers. */
  master(): FakeGain {
    const master = this.gains.find((g) => g.connected.includes(this.destination));
    if (!master) throw new Error('no master gain connected to destination');
    return master;
  }
}

function setup(muted = false) {
  const ctx = new FakeAudioContext();
  const audio = createRaceAudio({
    createContext: () => ctx as unknown as AudioContext,
    muted,
  });
  return { ctx, audio };
}

describe('race audio', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the master gain at or below 0.2', () => {
    const { ctx, audio } = setup();
    audio.unlock();

    expect(MASTER_GAIN).toBeLessThanOrEqual(0.2);
    expect(ctx.master().gain.value).toBe(MASTER_GAIN);
    expect(ctx.master().gain.value).toBeLessThanOrEqual(0.2);
  });

  it('plays the light beep, go tone, and finish sound as started/stopped oscillators', () => {
    const { ctx, audio } = setup();

    audio.playLightBeep();
    expect(ctx.oscillators).toHaveLength(1);
    audio.playGo();
    expect(ctx.oscillators).toHaveLength(2);
    expect(ctx.oscillators[1]?.frequency.setValueAtTime).toHaveBeenCalledWith(880, 0);
    audio.playFinish();
    expect(ctx.oscillators.length).toBeGreaterThan(2);

    for (const osc of ctx.oscillators) {
      expect(osc.start).toHaveBeenCalledTimes(1);
      expect(osc.stop).toHaveBeenCalledTimes(1);
    }
  });

  it('silences everything at once when muted, including a running engine', () => {
    const { ctx, audio } = setup();
    audio.startEngine();
    const engine = ctx.oscillators[0];
    expect(engine?.start).toHaveBeenCalled();

    audio.setMuted(true);
    expect(audio.isMuted()).toBe(true);
    expect(ctx.master().gain.value).toBe(0);

    // One-shot sounds are not played while muted.
    audio.playLightBeep();
    expect(ctx.oscillators).toHaveLength(1);
  });

  it('resumes the engine when un-muted mid-race, but not after it stopped', () => {
    const { ctx, audio } = setup(true);
    audio.startEngine();
    const engine = ctx.oscillators[0];
    expect(engine).toBeDefined();
    expect(ctx.master().gain.value).toBe(0);

    audio.setMuted(false);
    expect(ctx.master().gain.value).toBe(MASTER_GAIN);
    expect(engine?.stop).not.toHaveBeenCalled(); // still running → audible again

    audio.stopEngine();
    expect(engine?.stop).toHaveBeenCalledTimes(1);
    audio.setMuted(true);
    audio.setMuted(false);
    // No new engine oscillator appears after the race ended.
    expect(ctx.oscillators).toHaveLength(1);
  });

  it('starts only one engine at a time', () => {
    const { ctx, audio } = setup();
    audio.startEngine();
    audio.startEngine();
    expect(ctx.oscillators).toHaveLength(1);
  });

  it('resumes the context on unlock()', () => {
    const { ctx, audio } = setup();
    audio.unlock();
    expect(ctx.resume).toHaveBeenCalledTimes(1);

    audio.unlock(); // already running
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it('does nothing and never throws without Web Audio', () => {
    const audio = createRaceAudio({ createContext: () => null });
    expect(() => {
      audio.unlock();
      audio.playLightBeep();
      audio.playGo();
      audio.startEngine();
      audio.setMuted(true);
      audio.setMuted(false);
      audio.playFinish();
      audio.stopEngine();
      audio.dispose();
    }).not.toThrow();
  });

  it('logs instead of throwing when creating the context fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const audio = createRaceAudio({
      createContext: () => {
        throw new Error('blocked');
      },
    });
    expect(() => audio.playGo()).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('stops the engine and closes the context on dispose()', () => {
    const { ctx, audio } = setup();
    audio.startEngine();
    const engine = ctx.oscillators[0];

    audio.dispose();
    expect(engine?.stop).toHaveBeenCalledTimes(1);
    expect(ctx.close).toHaveBeenCalledTimes(1);

    // Later calls are ignored.
    audio.playFinish();
    audio.startEngine();
    expect(ctx.oscillators).toHaveLength(1);
  });
});

// Race sounds, synthesized with the Web Audio API (no audio files).
//
// Every sound is an OscillatorNode shaped by a GainNode envelope, routed
// through one master GainNode into the speakers. The master gain is 0.15 when
// sound is on (kept at or below 0.2 so the game stays quiet) and 0 when muted,
// so muting silences everything at once, including an engine that is running.
//
// The engine is tracked separately from the mute state: while the race is on,
// the engine oscillator keeps running even when muted, so un-muting mid-race
// brings the engine back straight away. After stopEngine() it is gone, and
// un-muting does not restart it.
//
// The AudioContext is created lazily through an injectable factory (tests pass
// a fake; jsdom has no Web Audio). Without Web Audio, or if any Web Audio call
// throws, the methods log the problem and do nothing, so the game still plays.
// Browsers keep a new context suspended until a user gesture: call unlock()
// synchronously inside the click that leads to the race.

/** Master volume when sound is on (NFR2: must not exceed 0.2). */
export const MASTER_GAIN = 0.15;

/** Creates the AudioContext, or returns null when Web Audio is unavailable. */
export type AudioContextFactory = () => AudioContext | null;

export interface RaceAudio {
  /** Create/resume the context. Call synchronously inside a user click. */
  unlock(): void;
  /** Short beep for one start light coming on. */
  playLightBeep(): void;
  /** Higher, longer tone for lights out. */
  playGo(): void;
  /** Start the continuous engine sound (no-op if already running). */
  startEngine(): void;
  /** Stop the engine sound. */
  stopEngine(): void;
  /** Short fanfare when the winner crosses the line. */
  playFinish(): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  /** Stop everything and close the context; later calls do nothing. */
  dispose(): void;
}

export interface RaceAudioOptions {
  createContext?: AudioContextFactory;
  /** Initial mute state (from the saved sound preference). */
  muted?: boolean;
}

/** Either may be missing at runtime (jsdom, old browsers), whatever lib.dom says. */
type WindowWithWebkitAudio = Window & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

/** Default factory: the browser's AudioContext (or the old webkit prefix), else null. */
export const browserAudioContextFactory: AudioContextFactory = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  const w = window as WindowWithWebkitAudio;
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  return Ctor ? new Ctor() : null;
};

interface ToneSpec {
  frequency: number;
  durationSec: number;
  type: OscillatorType;
  peak: number;
  /** Seconds after "now" to start the tone. */
  offsetSec?: number;
}

const LIGHT_BEEP: ToneSpec = { frequency: 440, durationSec: 0.15, type: 'square', peak: 0.6 };
const GO_TONE: ToneSpec = { frequency: 880, durationSec: 0.45, type: 'square', peak: 0.7 };
const FINISH_NOTES: ToneSpec[] = [
  { frequency: 523.25, durationSec: 0.12, type: 'square', peak: 0.6, offsetSec: 0 },
  { frequency: 659.25, durationSec: 0.12, type: 'square', peak: 0.6, offsetSec: 0.13 },
  { frequency: 783.99, durationSec: 0.12, type: 'square', peak: 0.6, offsetSec: 0.26 },
  { frequency: 1046.5, durationSec: 0.35, type: 'square', peak: 0.7, offsetSec: 0.39 },
];

const ENGINE_IDLE_HZ = 55;
const ENGINE_RACE_HZ = 95;
const ENGINE_REV_SEC = 1.5;
const ENGINE_FILTER_HZ = 700;
const ENGINE_LEVEL = 0.5;
/** Envelope floor: exponential ramps cannot reach exactly 0. */
const SILENT = 0.0001;

interface EngineNodes {
  osc: OscillatorNode;
  filter: BiquadFilterNode;
  level: GainNode;
}

function logAudioError(action: string, err: unknown): void {
  console.warn(`Race audio: ${action} failed`, err);
}

export function createRaceAudio(options: RaceAudioOptions = {}): RaceAudio {
  const createContext = options.createContext ?? browserAudioContextFactory;
  let muted = options.muted ?? false;
  let disposed = false;
  let unavailable = false;
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let engine: EngineNodes | null = null;

  /** Build the context + master gain on first use; null when audio is unavailable. */
  function ensureContext(): AudioContext | null {
    if (disposed || unavailable) {
      return null;
    }
    if (ctx) {
      return ctx;
    }
    try {
      const created = createContext();
      if (!created) {
        unavailable = true;
        return null;
      }
      const gain = created.createGain();
      gain.gain.value = muted ? 0 : MASTER_GAIN;
      gain.connect(created.destination);
      ctx = created;
      master = gain;
      return ctx;
    } catch (err) {
      unavailable = true;
      logAudioError('creating the AudioContext', err);
      return null;
    }
  }

  /** Run a Web Audio action, logging (never throwing) on failure. */
  function guarded(action: string, run: (context: AudioContext, out: GainNode) => void): void {
    const context = ensureContext();
    if (!context || !master) {
      return;
    }
    try {
      run(context, master);
    } catch (err) {
      logAudioError(action, err);
    }
  }

  function playTone(context: AudioContext, out: GainNode, spec: ToneSpec): void {
    const start = context.currentTime + (spec.offsetSec ?? 0);
    const end = start + spec.durationSec;
    const osc = context.createOscillator();
    const envelope = context.createGain();
    osc.type = spec.type;
    osc.frequency.setValueAtTime(spec.frequency, start);
    envelope.gain.setValueAtTime(spec.peak, start);
    envelope.gain.exponentialRampToValueAtTime(SILENT, end);
    osc.connect(envelope);
    envelope.connect(out);
    osc.onended = () => {
      osc.disconnect();
      envelope.disconnect();
    };
    osc.start(start);
    osc.stop(end);
  }

  function playTones(action: string, specs: ToneSpec[]): void {
    if (muted) {
      return; // one-shot sounds are simply skipped while muted
    }
    guarded(action, (context, out) => specs.forEach((spec) => playTone(context, out, spec)));
  }

  function buildEngine(context: AudioContext, out: GainNode): EngineNodes {
    const now = context.currentTime;
    const osc = context.createOscillator();
    const filter = context.createBiquadFilter();
    const level = context.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(ENGINE_IDLE_HZ, now);
    osc.frequency.exponentialRampToValueAtTime(ENGINE_RACE_HZ, now + ENGINE_REV_SEC);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(ENGINE_FILTER_HZ, now);
    level.gain.setValueAtTime(ENGINE_LEVEL, now);
    osc.connect(filter);
    filter.connect(level);
    level.connect(out);
    osc.start(now);
    return { osc, filter, level };
  }

  function stopEngine(): void {
    const running = engine;
    engine = null;
    if (!running) {
      return;
    }
    try {
      running.osc.stop();
      running.osc.disconnect();
      running.filter.disconnect();
      running.level.disconnect();
    } catch (err) {
      logAudioError('stopping the engine', err);
    }
  }

  return {
    unlock() {
      const context = ensureContext();
      if (!context || context.state !== 'suspended') {
        return;
      }
      try {
        context.resume().catch((err: unknown) => logAudioError('resuming the AudioContext', err));
      } catch (err) {
        logAudioError('resuming the AudioContext', err);
      }
    },
    playLightBeep() {
      playTones('playing the light beep', [LIGHT_BEEP]);
    },
    playGo() {
      playTones('playing the go tone', [GO_TONE]);
    },
    startEngine() {
      if (engine) {
        return;
      }
      // Built even while muted (master gain is 0) so un-muting resumes it.
      guarded('starting the engine', (context, out) => {
        engine = buildEngine(context, out);
      });
    },
    stopEngine,
    playFinish() {
      playTones('playing the finish sound', FINISH_NOTES);
    },
    setMuted(next: boolean) {
      muted = next;
      if (master) {
        try {
          master.gain.value = muted ? 0 : MASTER_GAIN;
        } catch (err) {
          logAudioError('changing the volume', err);
        }
      }
    },
    isMuted() {
      return muted;
    },
    dispose() {
      if (disposed) {
        return;
      }
      stopEngine();
      disposed = true;
      const context = ctx;
      ctx = null;
      master = null;
      if (!context) {
        return;
      }
      try {
        context.close().catch((err: unknown) => logAudioError('closing the AudioContext', err));
      } catch (err) {
        logAudioError('closing the AudioContext', err);
      }
    },
  };
}

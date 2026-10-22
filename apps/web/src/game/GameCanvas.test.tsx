// Phaser wrapper tests.
//
// `phaser` is mocked so we never spin up a real WebGL/canvas game, and the race
// audio module is mocked so we can see which sounds the bus signals trigger.
// We assert:
//   - the wrapper creates exactly one game on mount and calls game.destroy(true)
//     on unmount (the cleanup contract that prevents leaked contexts), with
//     Phaser's own audio switched off;
//   - light-on / lights-out / race-finished on the bus play the matching sounds;
//   - the sound toggle flips aria-pressed, mutes the audio, and saves the choice;
//   - the fullscreen button is hidden without the Fullscreen API, shown with it;
//   - the frame publishes its measured top edge as --game-frame-top and caps
//     its width from it, re-measuring on layout change (FR2.1);
//   - a Modal passed as a child mounts inside the frame and fills it, so it
//     stays visible while the frame is fullscreen;
//   - `topLeft` content is pinned in the frame's top-left corner;
//   - a site theme change is sent to the scene as THEME_CHANGED;
//   - unmounting disposes the audio; the ref handle unlocks audio.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { RaceAudio } from './audio/race-audio.ts';
import { SOUND_STORAGE_KEY } from './audio/sound-preference.ts';
import { GAME_EVENTS } from './events.ts';

// Capture constructor calls and the destroy spy across instances.
const destroySpy = vi.fn();
const constructed: Array<{ audio?: { noAudio?: boolean } }> = [];
const buses: Array<{ emit: (event: string, ...args: unknown[]) => void }> = [];

vi.mock('phaser', () => {
  // A small working emitter, so the test can fire bus events at the wrapper.
  class FakeEmitter {
    private handlers = new Map<string, Set<(...args: unknown[]) => void>>();
    constructor() {
      buses.push(this);
    }
    on(event: string, fn: (...args: unknown[]) => void) {
      if (!this.handlers.has(event)) this.handlers.set(event, new Set());
      this.handlers.get(event)?.add(fn);
      return this;
    }
    off(event: string, fn: (...args: unknown[]) => void) {
      this.handlers.get(event)?.delete(fn);
      return this;
    }
    emit(event: string, ...args: unknown[]) {
      this.handlers.get(event)?.forEach((fn) => fn(...args));
      return true;
    }
    removeAllListeners() {
      this.handlers.clear();
      return this;
    }
  }
  class FakeGame {
    registry = { set: vi.fn(), get: vi.fn() };
    scene = { start: vi.fn(), getScene: vi.fn() };
    scale = { refresh: vi.fn() };
    events = { once: vi.fn() };
    destroy = destroySpy;
    constructor(config: { audio?: { noAudio?: boolean } }) {
      constructed.push(config);
    }
  }
  const Phaser = {
    AUTO: 0,
    Game: FakeGame,
    Scale: { FIT: 0, CENTER_BOTH: 0 },
    Scene: class {},
    Events: { EventEmitter: FakeEmitter },
    Core: { Events: { READY: 'ready' } },
  };
  return { default: Phaser, ...Phaser };
});

type AudioSpy = { [K in keyof RaceAudio]: ReturnType<typeof vi.fn> };
const audios: AudioSpy[] = [];
const audioOptions: Array<{ muted?: boolean }> = [];

vi.mock('./audio/race-audio.ts', () => ({
  createRaceAudio: (options: { muted?: boolean }) => {
    audioOptions.push(options);
    const audio: AudioSpy = {
      unlock: vi.fn(),
      playLightBeep: vi.fn(),
      playGo: vi.fn(),
      startEngine: vi.fn(),
      stopEngine: vi.fn(),
      playFinish: vi.fn(),
      setMuted: vi.fn(),
      isMuted: vi.fn(() => options.muted ?? false),
      dispose: vi.fn(),
    };
    audios.push(audio);
    return audio;
  },
}));

// Import after the mocks are registered.
const { GameCanvas } = await import('./GameCanvas.tsx');
const { Modal } = await import('../app/Modal.tsx');
const { ThemeProvider } = await import('../theme/theme-context.tsx');
const { ThemeToggle } = await import('../theme/ThemeToggle.tsx');
type Handle = import('./GameCanvas.tsx').GameCanvasHandle;

function lastBus() {
  const bus = buses[buses.length - 1];
  if (!bus) throw new Error('no bus created');
  return bus;
}

function lastAudio() {
  const audio = audios[audios.length - 1];
  if (!audio) throw new Error('no audio created');
  return audio;
}

describe('GameCanvas', () => {
  beforeEach(() => {
    destroySpy.mockClear();
    constructed.length = 0;
    buses.length = 0;
    audios.length = 0;
    audioOptions.length = 0;
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates one Phaser game on mount and destroys it on unmount', () => {
    const { unmount } = render(<GameCanvas winnerColor={null} />);

    // Exactly one game instance created, with Phaser's own audio off.
    expect(constructed).toHaveLength(1);
    expect(constructed[0]?.audio?.noAudio).toBe(true);
    expect(destroySpy).not.toHaveBeenCalled();

    unmount();

    // Teardown destroys the game (removing the canvas + loop).
    expect(destroySpy).toHaveBeenCalledWith(true);
  });

  it('plays the matching sound for each race signal on the bus', () => {
    const onRaceFinished = vi.fn();
    render(<GameCanvas winnerColor={null} onRaceFinished={onRaceFinished} />);
    const bus = lastBus();
    const audio = lastAudio();

    bus.emit(GAME_EVENTS.LIGHT_ON, { lit: 1 });
    bus.emit(GAME_EVENTS.LIGHT_ON, { lit: 2 });
    expect(audio.playLightBeep).toHaveBeenCalledTimes(2);

    bus.emit(GAME_EVENTS.LIGHTS_OUT);
    expect(audio.playGo).toHaveBeenCalledTimes(1);
    expect(audio.startEngine).toHaveBeenCalledTimes(1);

    bus.emit(GAME_EVENTS.RACE_FINISHED, { winnerColor: 'RED' });
    expect(audio.stopEngine).toHaveBeenCalled();
    expect(audio.playFinish).toHaveBeenCalledTimes(1);
    expect(onRaceFinished).toHaveBeenCalledTimes(1);
  });

  it('toggles sound with aria-pressed, mutes the audio, and saves the choice', () => {
    render(<GameCanvas winnerColor={null} />);
    const toggle = screen.getByTestId('sound-toggle');
    const audio = lastAudio();

    // Default: sound on.
    expect(audioOptions[0]?.muted).toBe(false);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(audio.setMuted).toHaveBeenLastCalledWith(true);
    expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBe('off');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(audio.setMuted).toHaveBeenLastCalledWith(false);
    expect(audio.unlock).toHaveBeenCalled(); // the click unlocks audio
    expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBe('on');
  });

  it('starts muted when the saved preference is off', () => {
    localStorage.setItem(SOUND_STORAGE_KEY, 'off');
    render(<GameCanvas winnerColor={null} />);

    expect(audioOptions[0]?.muted).toBe(true);
    expect(screen.getByTestId('sound-toggle')).toHaveAttribute('aria-pressed', 'false');
  });

  it('hides the fullscreen button without the Fullscreen API', () => {
    expect('requestFullscreen' in HTMLElement.prototype).toBe(false); // jsdom
    render(<GameCanvas winnerColor={null} />);

    expect(screen.queryByTestId('fullscreen-toggle')).not.toBeInTheDocument();
    expect(screen.getByTestId('sound-toggle')).toBeInTheDocument();
  });

  it('shows the fullscreen button and requests fullscreen on the track frame', () => {
    const request = vi.fn(() => Promise.resolve());
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      value: request,
      configurable: true,
      writable: true,
    });
    try {
      render(<GameCanvas winnerColor={null} />);
      fireEvent.click(screen.getByTestId('fullscreen-toggle'));
      expect(request).toHaveBeenCalledTimes(1);
      expect(request.mock.contexts[0]).toBe(screen.getByTestId('game-frame'));
    } finally {
      delete (HTMLElement.prototype as { requestFullscreen?: unknown }).requestFullscreen;
    }
  });

  it('caps the track height from its measured top edge (FR2.1)', () => {
    let frameTop = 180;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          top: frameTop,
          left: 0,
          right: 0,
          bottom: frameTop,
          width: 0,
          height: 0,
          x: 0,
          y: frameTop,
          toJSON: () => ({}),
        }) as DOMRect,
    );
    render(<GameCanvas winnerColor={null} />);
    const frame = screen.getByTestId('game-frame');

    // The top edge (relative to the document) is published on mount...
    expect(frame.style.getPropertyValue('--game-frame-top')).toBe('180px');
    // ...and the width cap uses it, leaving the frame's 1rem bottom margin.
    expect(frame).toHaveClass('max-w-[calc((100dvh-var(--game-frame-top,0px)-1rem)*16/9)]');

    // A layout change re-measures (jsdom has no ResizeObserver: window resize).
    frameTop = 240;
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(frame.style.getPropertyValue('--game-frame-top')).toBe('240px');
  });

  it('mounts a child Modal inside the track frame so it shows in fullscreen', () => {
    render(
      <GameCanvas winnerColor={null}>
        <Modal open title="ผลการแข่ง" onClose={() => {}} testId="track-modal">
          <p>inside</p>
        </Modal>
      </GameCanvas>,
    );
    const frame = screen.getByTestId('game-frame');
    const backdrop = screen.getByTestId('track-modal-backdrop');

    expect(frame).toContainElement(screen.getByRole('dialog', { name: 'ผลการแข่ง' }));
    // Fills the frame (not the viewport) and sits above the track controls.
    expect(backdrop).toHaveClass('absolute', 'inset-0', 'z-30');
    expect(backdrop).not.toHaveClass('fixed');
    expect(screen.getByTestId('track-modal')).toHaveClass('max-h-full');
  });

  it('pins topLeft content to the track corner only when given', () => {
    const { rerender } = render(<GameCanvas winnerColor={null} />);
    expect(screen.queryByTestId('game-top-left')).not.toBeInTheDocument();

    rerender(<GameCanvas winnerColor={null} topLeft={<button type="button">pick</button>} />);
    const corner = screen.getByTestId('game-top-left');
    expect(screen.getByTestId('game-frame')).toContainElement(corner);
    expect(corner).toHaveClass('absolute', 'z-20');
    expect(corner).toContainElement(screen.getByRole('button', { name: 'pick' }));
  });

  it('sends each theme change to the scene on the bus', () => {
    render(
      <ThemeProvider>
        <GameCanvas winnerColor={null} />
        <ThemeToggle />
      </ThemeProvider>,
    );
    const emit = vi.spyOn(lastBus(), 'emit');

    fireEvent.click(screen.getByTestId('theme-toggle'));
    expect(emit).toHaveBeenLastCalledWith(GAME_EVENTS.THEME_CHANGED, 'light');

    fireEvent.click(screen.getByTestId('theme-toggle'));
    expect(emit).toHaveBeenLastCalledWith(GAME_EVENTS.THEME_CHANGED, 'dark');
  });

  it('disposes the audio on unmount and unlocks it through the ref handle', () => {
    const ref = createRef<Handle>();
    const { unmount } = render(<GameCanvas ref={ref} winnerColor={null} />);
    const audio = lastAudio();

    act(() => ref.current?.unlockAudio());
    expect(audio.unlock).toHaveBeenCalledTimes(1);

    unmount();
    expect(audio.dispose).toHaveBeenCalledTimes(1);
  });
});

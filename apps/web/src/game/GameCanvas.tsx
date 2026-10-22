// React wrapper that owns a single Phaser game instance and its sounds.
//
// Lifecycle ownership is the whole point of this component: it creates the game
// on mount and DESTROYS it on unmount (removing the canvas and the event bus),
// so navigating away never leaks a WebGL context or a running game loop. The
// server winner is pushed in via props; the component never decides the winner.
//
// It also owns the race audio for the same lifetime: the scene's bus signals
// drive the sounds (light-on → beep, lights-out → go tone + engine,
// race-finished → engine stop + finish sound), and unmounting stops every sound.
// Phaser's own audio is switched off so only one AudioContext exists. Browsers
// only allow audio after a user gesture, so the page calls the ref handle
// unlockAudio() synchronously inside the click that starts the race.
//
// Layout: the track frame is as wide as the page allows and kept 16:9. Its
// height must fit in the viewport below everything above it (nav, page heading,
// guest banner, gaps), so the frame measures its own top edge relative to the
// document and publishes it as the CSS variable --game-frame-top. The width cap
// is (100dvh - --game-frame-top - 1rem) * 16/9, where 1rem is the frame's bottom
// margin, so the whole track stays visible without scrolling. The top is
// re-measured whenever the page layout changes size (ResizeObserver on the
// body, or window resize where ResizeObserver is missing) and after leaving
// fullscreen. The sound toggle and the fullscreen button sit on top of the
// track; fullscreen applies to this frame only, so both buttons stay usable
// while fullscreen. The fullscreen button is hidden when the browser has no
// Fullscreen API. The optional `overlay` prop renders centered on the track
// (the play page puts its new-round button, then the picked car with its
// submit-guess button, there and clears it while racing).
// The optional `topLeft` prop renders in the top-left corner, opposite the
// sound/fullscreen buttons (the play page shows the submitted car there while
// waiting for the result).
// `children` render under a ModalHostContext that points at the frame, so any
// Modal passed as a child (the round and result dialogs) opens on top of the
// track and stays visible while the frame is fullscreen.
//
// Theme: the scene's scenery follows the site theme. The current theme is put
// in the game registry before boot and every change is sent on the bus
// (THEME_CHANGED), so the track switches live without restarting the game.
// On phones the track controls use the compact button size.

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import Phaser from 'phaser';
import type { CarColor } from '@pixel-race/shared-types';
import { BootScene } from './BootScene.ts';
import { RaceScene, GAME_DIMENSIONS } from './RaceScene.ts';
import { GAME_EVENTS, PENDING_RUN_KEY, createGameBus, type RunRacePayload } from './events.ts';
import { createRaceAudio, type RaceAudio } from './audio/race-audio.ts';
import { readSoundEnabled, writeSoundEnabled } from './audio/sound-preference.ts';
import { useFullscreen } from './fullscreen.ts';
import { THEME_KEY } from './palette.ts';
import { pixelButtonCompact } from '../app/ui.ts';
import { useTheme } from '../theme/theme-context.tsx';
import { ModalHostContext } from '../app/Modal.tsx';
import { useI18n } from '../i18n/i18n-context.tsx';

export interface GameCanvasProps {
  /**
   * When set, the scene animates a race whose winner is this already-decided
   * color (the server's winner, or the browser's pick in guest mode).
   */
  winnerColor?: CarColor | null;
  /**
   * Identifies the current race run. The animation re-fires whenever this
   * changes, so a new race always animates even when consecutive races share
   * the same winning color.
   */
  raceId?: string | null;
  /** Called once the winning car crosses the finish line. */
  onRaceFinished?: () => void;
  /**
   * Content shown centered on top of the track (e.g. the new-round button).
   * The page decides when to show it; pass nothing to keep the track clear.
   */
  overlay?: ReactNode;
  /**
   * Content pinned to the top-left corner of the track, above the overlay and
   * below any open dialog. Pass nothing to leave the corner empty.
   */
  topLeft?: ReactNode;
  /**
   * Dialogs for the track (Modal elements). They mount inside the frame, so
   * they cover the track and remain visible in fullscreen.
   */
  children?: ReactNode;
}

/** Imperative handle for the page that hosts the canvas. */
export interface GameCanvasHandle {
  /** Unlock browser audio; call synchronously inside a user click. */
  unlockAudio: () => void;
}

const overlayButton = `${pixelButtonCompact} min-w-8 sm:min-w-10`;

/** CSS variable holding the frame's top edge (px from the document top). */
const FRAME_TOP_VAR = '--game-frame-top';

/**
 * Keep FRAME_TOP_VAR on the frame equal to its top edge relative to the
 * document. Writes the style directly (no React state), and only when the
 * value changes: the variable changes the frame's width, never its top, so one
 * measure per layout change settles without a loop.
 */
function useFrameTopVariable(frameRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }
    let lastTop: string | null = null;
    const measure = () => {
      try {
        // While fullscreen the frame is pinned to the screen; keep the in-page value.
        if (document.fullscreenElement === frame) {
          return;
        }
        const top = Math.max(0, Math.round(frame.getBoundingClientRect().top + window.scrollY));
        const value = `${top}px`;
        if (value !== lastTop) {
          lastTop = value;
          frame.style.setProperty(FRAME_TOP_VAR, value);
        }
      } catch (err) {
        console.warn('GameCanvas: could not measure the track frame position', err);
      }
    };

    measure();
    document.addEventListener('fullscreenchange', measure);
    if (typeof ResizeObserver === 'undefined') {
      // Older browsers (and jsdom): re-measure on window resize instead.
      window.addEventListener('resize', measure);
      return () => {
        document.removeEventListener('fullscreenchange', measure);
        window.removeEventListener('resize', measure);
      };
    }
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    return () => {
      document.removeEventListener('fullscreenchange', measure);
      observer.disconnect();
    };
  }, [frameRef]);
}

export const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(function GameCanvas(
  { winnerColor, raceId, onRaceFinished, overlay, topLeft, children },
  ref,
) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  // The frame element as state too, so the modal host context updates once it mounts.
  const [modalHost, setModalHost] = useState<HTMLDivElement | null>(null);
  const setFrame = useCallback((el: HTMLDivElement | null) => {
    frameRef.current = el;
    setModalHost(el);
  }, []);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const busRef = useRef<Phaser.Events.EventEmitter | null>(null);
  const audioRef = useRef<RaceAudio | null>(null);
  // Keep the latest callback without re-creating the game.
  const onFinishedRef = useRef(onRaceFinished);
  onFinishedRef.current = onRaceFinished;

  const [soundOn, setSoundOn] = useState(() => readSoundEnabled());
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;

  const { theme } = useTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const fullscreen = useFullscreen(frameRef);
  const { t } = useI18n();
  useFrameTopVariable(frameRef);

  useImperativeHandle(ref, () => ({ unlockAudio: () => audioRef.current?.unlock() }), []);

  // Create the game and its audio exactly once, destroy both on unmount.
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const bus = createGameBus();
    busRef.current = bus;
    const audio = createRaceAudio({ muted: !soundOnRef.current });
    audioRef.current = audio;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: GAME_DIMENSIONS.width,
      height: GAME_DIMENSIONS.height,
      pixelArt: true, // nearest-neighbor scaling for crisp pixel art
      audio: { noAudio: true }, // sounds come from race-audio, not Phaser
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [BootScene, RaceScene],
      callbacks: {
        // Stash the bus in the game registry before any scene boots; scenes
        // read it from there, which avoids scene-data timing issues.
        preBoot: (g) => {
          g.registry.set('bus', bus);
          g.registry.set(THEME_KEY, themeRef.current);
        },
      },
    });
    gameRef.current = game;

    const forwardFinish = () => {
      audio.stopEngine();
      audio.playFinish();
      onFinishedRef.current?.();
    };
    const onLightOn = () => audio.playLightBeep();
    const onLightsOut = () => {
      audio.playGo();
      audio.startEngine();
    };
    bus.on(GAME_EVENTS.RACE_FINISHED, forwardFinish);
    bus.on(GAME_EVENTS.LIGHT_ON, onLightOn);
    bus.on(GAME_EVENTS.LIGHTS_OUT, onLightsOut);

    return () => {
      // Full teardown: remove listeners, silence audio, destroy the game + canvas.
      bus.off(GAME_EVENTS.RACE_FINISHED, forwardFinish);
      bus.off(GAME_EVENTS.LIGHT_ON, onLightOn);
      bus.off(GAME_EVENTS.LIGHTS_OUT, onLightsOut);
      bus.removeAllListeners();
      audio.dispose();
      game.destroy(true);
      audioRef.current = null;
      gameRef.current = null;
      busRef.current = null;
    };
  }, []);

  // Run the race whenever a new run is requested. Keyed on raceId (not just
  // winnerColor) so a new race re-animates even when its winner repeats the
  // previous race's color.
  useEffect(() => {
    if (winnerColor && busRef.current) {
      const payload: RunRacePayload = { winnerColor };
      // A new run restarts the lights; no engine should carry over.
      audioRef.current?.stopEngine();
      // Also park the request in the registry: if the scene is still booting it
      // picks it up on create(); a live scene consumes it from the event.
      gameRef.current?.registry.set(PENDING_RUN_KEY, payload);
      busRef.current.emit(GAME_EVENTS.RUN_RACE, payload);
    }
  }, [winnerColor, raceId]);

  // Theme switch: keep the registry current (for a scene still booting) and
  // tell a live scene to repaint its scenery.
  useEffect(() => {
    gameRef.current?.registry.set(THEME_KEY, theme);
    busRef.current?.emit(GAME_EVENTS.THEME_CHANGED, theme);
  }, [theme]);

  // Entering/leaving fullscreen resizes the frame; let Phaser re-fit at once.
  useEffect(() => {
    try {
      gameRef.current?.scale?.refresh();
    } catch (err) {
      console.warn('GameCanvas: could not refit the game after a fullscreen change', err);
    }
  }, [fullscreen.isFullscreen]);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    audioRef.current?.setMuted(!next);
    if (next) {
      audioRef.current?.unlock(); // this click is a user gesture
    }
    writeSoundEnabled(next);
  }

  return (
    <div
      ref={setFrame}
      className="relative mx-auto my-2 aspect-video w-full max-w-[calc((100dvh-var(--game-frame-top,0px)-1rem)*16/9)] overflow-hidden border-4 border-black bg-black shadow-[6px_6px_0_0_#000] sm:my-4 [&:fullscreen]:border-0"
      data-testid="game-frame"
    >
      <div
        ref={containerRef}
        className="h-full w-full [image-rendering:pixelated]"
        data-testid="game-canvas"
      />
      {overlay && (
        // pointer-events-none on the layer so only the overlay content takes clicks.
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          data-testid="game-overlay"
        >
          <div className="pointer-events-auto">{overlay}</div>
        </div>
      )}
      {topLeft && (
        <div
          className="absolute left-1 top-1 z-20 flex max-w-[70%] flex-wrap items-center gap-1 sm:left-2 sm:top-2 sm:gap-2"
          data-testid="game-top-left"
        >
          {topLeft}
        </div>
      )}
      <div
        className="absolute right-1 top-1 z-20 flex gap-1 sm:right-2 sm:top-2 sm:gap-2"
        data-testid="game-controls"
      >
        <button
          type="button"
          onClick={toggleSound}
          className={overlayButton}
          aria-label={t.game.sound}
          aria-pressed={soundOn}
          title={soundOn ? t.game.mute : t.game.unmute}
          data-testid="sound-toggle"
        >
          <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span>
        </button>
        {fullscreen.isSupported && (
          <button
            type="button"
            onClick={fullscreen.toggle}
            className={overlayButton}
            aria-label={fullscreen.isFullscreen ? t.game.exitFullscreen : t.game.fullscreen}
            title={fullscreen.isFullscreen ? t.game.exitFullscreen : t.game.fullscreen}
            data-testid="fullscreen-toggle"
          >
            <span aria-hidden="true">{fullscreen.isFullscreen ? '🗗' : '⛶'}</span>
          </button>
        )}
      </div>
      <ModalHostContext.Provider value={modalHost}>{children}</ModalHostContext.Provider>
    </div>
  );
});

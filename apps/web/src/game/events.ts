// Typed React ↔ Phaser communication.
//
// A tiny event bus (Phaser.Events.EventEmitter) carries the race signals.
// React tells the scene which winner to animate toward (the server's winner
// for logged-in players, the browser's pick for guests), and the scene tells
// React when the winner has crossed the line. The animation never decides it.
// The scene also announces each start light and lights out, so React can play
// the countdown sounds in step with the gantry. React also tells the scene
// when the site theme changes, so the track switches between night and day.

import Phaser from 'phaser';
import type { CarColor } from '@pixel-race/shared-types';

export const GAME_EVENTS = {
  /** React → scene: run the race, with the already-decided winning color. */
  RUN_RACE: 'run-race',
  /** Scene → React: the winning car has reached the finish line. */
  RACE_FINISHED: 'race-finished',
  /** Scene → React: one more start light came on (1–5). */
  LIGHT_ON: 'light-on',
  /** Scene → React: all lights went out; the race clock starts. */
  LIGHTS_OUT: 'lights-out',
  /** React → scene: the site theme changed; payload is 'light' or 'dark'. */
  THEME_CHANGED: 'theme-changed',
} as const;

/**
 * Game-registry key holding the latest RUN_RACE request. The React wrapper sets
 * it before emitting, so a request sent while the scene is still booting is
 * played as soon as the scene is ready; the scene clears it once consumed.
 */
export const PENDING_RUN_KEY = 'pending-run';

export interface RunRacePayload {
  winnerColor: CarColor;
}

export interface RaceFinishedPayload {
  winnerColor: CarColor;
}

export interface LightOnPayload {
  /** How many lights are now lit (1–5). */
  lit: number;
}

/** Create a fresh event bus for one game instance. */
export function createGameBus(): Phaser.Events.EventEmitter {
  return new Phaser.Events.EventEmitter();
}

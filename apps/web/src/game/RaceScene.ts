// RaceScene — a 640x360 pixel-art F1 race.
//
// Draws a grandstand with an animated crowd, a four-lane track with red/white
// kerbs and road lines, a checkered finish line and flag, and a five-light
// start gantry. The track is longer than the screen and fixed in the world. The
// camera pans on its own steady schedule (see camera-pan.ts) from the start grid,
// past the finish line, to the run-off area where every car brakes to a stop
// after crossing. The winner is supplied through RUN_RACE (server for
// logged-in players, browser for guests); the scene only choreographs the run
// with a race plan (see race-plan.ts) so that car crosses the line first after
// several lead changes. The scene never chooses the winner.
//
// Run timeline: five red lights come on one every 500 ms (LIGHT_ON on the bus
// for each), then all go out together at LIGHTS_OUT_MS (< 3 s, not part of the
// 15 s race clock), emitting LIGHTS_OUT once. The race clock then runs
// RACE_DURATION_MS; when the winner reaches the line the scene emits
// RACE_FINISHED once, and the other cars keep driving until they finish. React
// plays the countdown, engine, and finish sounds from these three signals.
//
// Theme: the scenery follows the site theme (night track in dark mode, day
// track in light mode). The starting theme comes from the game registry and
// THEME_CHANGED switches it live, even mid-race, without touching the run.

import Phaser from 'phaser';
import { CAR_COLORS, type CarColor } from '@pixel-race/shared-types';
import { CAR_FRAMES, CAR_HEIGHT, CAR_WIDTH, TEXTURES, carTextureKey } from './BootScene.ts';
import {
  GAME_EVENTS,
  PENDING_RUN_KEY,
  type LightOnPayload,
  type RaceFinishedPayload,
  type RunRacePayload,
} from './events.ts';
import { cameraPanX, type CameraPanOptions } from './camera-pan.ts';
import { RACE_PALETTES, THEME_KEY, themedTexture, toRaceTheme, type RaceTheme } from './palette.ts';
import {
  RACE_DURATION_MS,
  createRacePlan,
  finishTimeMs,
  progressAt,
  runoffDistance,
  runoffStopMs,
  type RacePlan,
} from './race-plan.ts';

const GAME_WIDTH = 640;
const GAME_HEIGHT = 360;

const STAND_HEIGHT = 80;
const KERB_HEIGHT = 8;
const TRACK_TOP = STAND_HEIGHT + KERB_HEIGHT;
const LANE_HEIGHT = 60;
const TRACK_HEIGHT = LANE_HEIGHT * CAR_COLORS.length;
const TRACK_BOTTOM = TRACK_TOP + TRACK_HEIGHT;

const CAR_SCALE = 2;
const START_LINE_X = 112;
const TRACK_LENGTH = 4000;
const FINISH_LINE_X = START_LINE_X + TRACK_LENGTH;
/** Cars cross the line at race speed and brake to a stop this far past it. */
const RUNOFF_PX = 360;
const RACE_SPEED_PX_PER_MS = TRACK_LENGTH / RACE_DURATION_MS;
const RUNOFF_STOP_MS = runoffStopMs(RACE_SPEED_PX_PER_MS, RUNOFF_PX);
/**
 * Time for the camera to ease up to race speed after lights out. The pack pulls
 * ahead of the camera by about speed x PAN_RAMP_MS / 2 meanwhile (~200 px).
 */
const PAN_RAMP_MS = 1500;
/** Distance over which the camera brakes before coming to rest. */
const PAN_BRAKE_PX = 400;
/** Screen x of the stopped cars' noses in the final view (finish line to their left). */
const FINAL_CAR_SCREEN_X = 480;
const CAMERA_PAN: CameraPanOptions = {
  speedPxPerMs: RACE_SPEED_PX_PER_MS,
  rampMs: PAN_RAMP_MS,
  endX: FINISH_LINE_X + RUNOFF_PX - FINAL_CAR_SCREEN_X,
  brakePx: PAN_BRAKE_PX,
};
/** The world ends exactly at the right edge of the camera's final view. */
const WORLD_WIDTH = CAMERA_PAN.endX + GAME_WIDTH;

const LIGHT_COUNT = 5;
const LIGHT_STEP_MS = 500;
/** All lights out (go!) 300 ms after the fifth light: 2.8 s total, under 3 s. */
const LIGHTS_OUT_MS = LIGHT_COUNT * LIGHT_STEP_MS + 300;
const GANTRY_LINGER_MS = 800;

const WHEEL_FRAME_MS = 80;
const CROWD_FRAME_MS = 300;
const SMOKE_MIN_GAP_MS = 250;

type RunState = 'idle' | 'lights' | 'racing' | 'finished';

export class RaceScene extends Phaser.Scene {
  private bus!: Phaser.Events.EventEmitter;
  private cars: Partial<Record<CarColor, Phaser.GameObjects.Image>> = {};
  private nextSmokeAt: Partial<Record<CarColor, number>> = {};
  private crowd: Phaser.GameObjects.TileSprite[] = [];
  private startLights: Phaser.GameObjects.Image[] = [];
  private gantry!: Phaser.GameObjects.Container;
  private gantryFrame!: Phaser.GameObjects.Rectangle;
  private stand!: Phaser.GameObjects.Graphics;
  private flagPole!: Phaser.GameObjects.Graphics;
  private asphalt!: Phaser.GameObjects.TileSprite;
  private grass!: Phaser.GameObjects.TileSprite;
  private theme: RaceTheme = 'dark';
  private smoke = new Set<Phaser.GameObjects.Image>();

  private runState: RunState = 'idle';
  private plan: RacePlan | null = null;
  private phaseStartedAt = 0;
  private wheelFrame = 0;
  private finishEmitted = false;
  /** Lights announced on the bus so far in this run (each one exactly once). */
  private litAnnounced = 0;

  private readonly handleRunRace = (payload: RunRacePayload) => this.startRun(payload);
  private readonly handleThemeChanged = (theme: unknown) => this.applyTheme(toRaceTheme(theme));

  constructor() {
    super('RaceScene');
  }

  create(): void {
    // The React wrapper stashes the shared event bus in the game registry.
    this.bus = this.registry.get('bus') as Phaser.Events.EventEmitter;
    this.theme = toRaceTheme(this.registry.get(THEME_KEY));
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    this.drawGrandstand();
    this.drawTrack();
    this.drawFinish();
    this.createGantry();
    this.placeCars();
    this.paintScenery();

    this.bus.on(GAME_EVENTS.RUN_RACE, this.handleRunRace);
    this.bus.on(GAME_EVENTS.THEME_CHANGED, this.handleThemeChanged);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);

    // A request that arrived while the game was still booting.
    const pending = this.registry.get(PENDING_RUN_KEY) as RunRacePayload | undefined;
    if (pending) {
      this.startRun(pending);
    }
  }

  override update(time: number): void {
    this.animateCrowd(time);
    if (this.runState === 'lights') {
      this.updateLights(time);
    } else if (this.runState === 'racing') {
      this.updateRace(time);
    }
    if (this.runState === 'racing' || this.runState === 'finished') {
      // The pan runs on race time alone; it never watches the cars.
      this.cameras.main.setScroll(cameraPanX(time - this.phaseStartedAt, CAMERA_PAN), 0);
    }
  }

  // --- Scenery --------------------------------------------------------------

  /** Switch the scenery to another theme; the race itself is untouched. */
  private applyTheme(theme: RaceTheme): void {
    if (theme === this.theme) {
      return;
    }
    this.theme = theme;
    this.paintScenery();
  }

  /** Apply the current theme's colors and textures to every themed piece. */
  private paintScenery(): void {
    const palette = RACE_PALETTES[this.theme];
    this.cameras.main.setBackgroundColor(palette.background);

    const g = this.stand;
    g.clear();
    g.fillStyle(palette.standFill, 1);
    g.fillRect(0, 0, WORLD_WIDTH, STAND_HEIGHT);
    g.fillStyle(palette.standRoof, 1);
    g.fillRect(0, 0, WORLD_WIDTH, 6); // roof
    for (let x = 0; x < WORLD_WIDTH; x += 64) {
      g.fillRect(x + 30, 6, 4, STAND_HEIGHT - 6); // support pillars
    }
    this.crowd.forEach((layer, frame) =>
      layer.setTexture(themedTexture(TEXTURES.CROWD[frame] as string, this.theme)),
    );

    this.asphalt.setTexture(themedTexture(TEXTURES.ASPHALT, this.theme));
    this.grass.setTexture(themedTexture(TEXTURES.GRASS, this.theme));

    this.flagPole.clear();
    this.flagPole.fillStyle(palette.flagPole, 1);
    this.flagPole.fillRect(FINISH_LINE_X + 6, 14, 3, STAND_HEIGHT - 14);

    this.gantryFrame.setFillStyle(palette.gantry).setStrokeStyle(2, palette.gantryStroke);
  }

  private drawGrandstand(): void {
    this.stand = this.add.graphics();
    this.crowd = TEXTURES.CROWD.map((key, frame) =>
      this.add
        .tileSprite(0, 8, WORLD_WIDTH, 72, themedTexture(key, this.theme))
        .setOrigin(0, 0)
        .setVisible(frame === 0),
    );
  }

  private drawTrack(): void {
    // The whole track is laid out in world space; the camera moves over it.
    const kerbTop = this.add.tileSprite(0, STAND_HEIGHT, WORLD_WIDTH, KERB_HEIGHT, TEXTURES.KERB);
    const asphalt = this.add.tileSprite(
      0,
      TRACK_TOP,
      WORLD_WIDTH,
      TRACK_HEIGHT,
      themedTexture(TEXTURES.ASPHALT, this.theme),
    );
    const kerbBottom = this.add.tileSprite(0, TRACK_BOTTOM, WORLD_WIDTH, KERB_HEIGHT, TEXTURES.KERB);
    const grassTop = TRACK_BOTTOM + KERB_HEIGHT;
    const grass = this.add.tileSprite(
      0,
      grassTop,
      WORLD_WIDTH,
      GAME_HEIGHT - grassTop,
      themedTexture(TEXTURES.GRASS, this.theme),
    );
    this.asphalt = asphalt;
    this.grass = grass;
    const pieces = [kerbTop, asphalt, kerbBottom, grass];

    for (let lane = 1; lane < CAR_COLORS.length; lane += 1) {
      const y = TRACK_TOP + lane * LANE_HEIGHT - 2;
      pieces.push(this.add.tileSprite(0, y, WORLD_WIDTH, 4, TEXTURES.ROAD_LINE));
    }
    pieces.forEach((sprite) => sprite.setOrigin(0, 0));

    // Static start line on the grid.
    this.add.rectangle(START_LINE_X - 2, TRACK_TOP, 4, TRACK_HEIGHT, 0xf5f5f5).setOrigin(0, 0);
  }

  private drawFinish(): void {
    this.add
      .tileSprite(FINISH_LINE_X, TRACK_TOP, 16, TRACK_HEIGHT, TEXTURES.CHECKER)
      .setOrigin(0, 0)
      .setDepth(2);

    // Checkered flag waving on a pole above the finish line.
    // The pole is painted by paintScenery() in the theme's color.
    this.flagPole = this.add.graphics().setDepth(3);
    const flag = this.add
      .image(FINISH_LINE_X + 9, 16, TEXTURES.FLAG)
      .setOrigin(0, 0)
      .setScale(1.5)
      .setDepth(3);
    this.tweens.add({
      targets: flag,
      scaleX: 1.2,
      duration: 260,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createGantry(): void {
    const width = LIGHT_COUNT * 22 + 12;
    // Colors are set by paintScenery() for the current theme.
    const frame = this.add.rectangle(0, 0, width, 30);
    this.gantryFrame = frame;
    this.startLights = Array.from({ length: LIGHT_COUNT }, (_, i) =>
      this.add.image((i - (LIGHT_COUNT - 1) / 2) * 22, 0, TEXTURES.LIGHT_OFF),
    );
    this.gantry = this.add
      .container(GAME_WIDTH / 2, 40, [frame, ...this.startLights])
      .setDepth(10)
      .setVisible(false);
  }

  private laneCenterY(index: number): number {
    return TRACK_TOP + index * LANE_HEIGHT + LANE_HEIGHT / 2;
  }

  private carX(progress: number): number {
    return START_LINE_X + progress * (FINISH_LINE_X - START_LINE_X);
  }

  /** One car per lane, nose on the start line (origin at the nose). */
  private placeCars(): void {
    CAR_COLORS.forEach((color, index) => {
      this.cars[color] = this.add
        .image(this.carX(0), this.laneCenterY(index), carTextureKey(color, 0))
        .setOrigin(1, 0.5)
        .setDisplaySize(CAR_WIDTH * CAR_SCALE, CAR_HEIGHT * CAR_SCALE)
        .setDepth(5);
    });
  }

  // --- Run lifecycle -------------------------------------------------------

  private startRun(payload: RunRacePayload): void {
    this.registry.remove(PENDING_RUN_KEY);
    let plan: RacePlan;
    try {
      plan = createRacePlan(payload.winnerColor);
    } catch (err) {
      // The bus is a boundary: a malformed request must not crash the game loop.
      console.error('RaceScene: ignoring invalid race request', err);
      return;
    }
    this.plan = plan;
    this.finishEmitted = false;
    this.litAnnounced = 0;
    this.clearSmoke();
    this.resetCars();
    this.cameras.main.setScroll(0, 0); // back to the start grid
    this.setLitCount(0);
    this.gantry.setVisible(true);
    this.runState = 'lights';
    this.phaseStartedAt = this.time.now;
  }

  private resetCars(): void {
    CAR_COLORS.forEach((color, index) => {
      this.cars[color]?.setPosition(this.carX(0), this.laneCenterY(index));
      this.cars[color]?.setTexture(carTextureKey(color, 0));
      this.nextSmokeAt[color] = 0;
    });
    this.wheelFrame = 0;
  }

  private setLitCount(count: number): void {
    this.startLights.forEach((light, i) =>
      light.setTexture(i < count ? TEXTURES.LIGHT_ON : TEXTURES.LIGHT_OFF),
    );
  }

  private updateLights(time: number): void {
    const elapsed = time - this.phaseStartedAt;
    if (elapsed >= LIGHTS_OUT_MS) {
      this.setLitCount(0); // lights out — go!
      this.runState = 'racing';
      this.phaseStartedAt = this.phaseStartedAt + LIGHTS_OUT_MS;
      this.bus.emit(GAME_EVENTS.LIGHTS_OUT);
      return;
    }
    const lit = Math.min(LIGHT_COUNT, Math.floor(elapsed / LIGHT_STEP_MS) + 1);
    this.setLitCount(lit);
    // Announce every newly lit light, even if a slow frame skipped one.
    while (this.litAnnounced < lit) {
      this.litAnnounced += 1;
      const payload: LightOnPayload = { lit: this.litAnnounced };
      this.bus.emit(GAME_EVENTS.LIGHT_ON, payload);
    }
  }

  private updateRace(time: number): void {
    const plan = this.plan;
    if (!plan) {
      return;
    }
    const t = time - this.phaseStartedAt;
    if (t > GANTRY_LINGER_MS) {
      this.gantry.setVisible(false);
    }

    this.moveCars(plan, t, time);

    if (!this.finishEmitted && t >= plan.durationMs) {
      this.finishEmitted = true;
      const payload: RaceFinishedPayload = { winnerColor: plan.winner };
      this.bus.emit(GAME_EVENTS.RACE_FINISHED, payload);
    }
    const lastFinish = Math.max(...CAR_COLORS.map((color) => finishTimeMs(plan, color)));
    if (t >= lastFinish + RUNOFF_STOP_MS) {
      this.runState = 'finished';
    }
  }

  private moveCars(plan: RacePlan, t: number, time: number): void {
    const frame = Math.floor(t / WHEEL_FRAME_MS) % CAR_FRAMES;
    const frameChanged = frame !== this.wheelFrame;
    this.wheelFrame = frame;

    for (const color of CAR_COLORS) {
      const car = this.cars[color];
      if (!car) {
        continue;
      }
      const sinceFinish = t - finishTimeMs(plan, color);
      if (sinceFinish >= RUNOFF_STOP_MS) {
        car.x = FINISH_LINE_X + RUNOFF_PX;
        continue; // stopped in the run-off: wheels and smoke stop
      }
      const crossed = sinceFinish >= 0;
      car.x = crossed
        ? FINISH_LINE_X + runoffDistance(sinceFinish, RACE_SPEED_PX_PER_MS, RUNOFF_PX)
        : this.carX(progressAt(plan, color, t));
      if (frameChanged) {
        car.setTexture(carTextureKey(color, frame));
      }
      if (!crossed && time >= (this.nextSmokeAt[color] ?? 0)) {
        this.emitSmoke(car);
        this.nextSmokeAt[color] = time + SMOKE_MIN_GAP_MS + Math.random() * SMOKE_MIN_GAP_MS;
      }
    }
  }

  private emitSmoke(car: Phaser.GameObjects.Image): void {
    const puff = this.add
      .image(car.x - car.displayWidth, car.y + (Math.random() * 8 - 4), TEXTURES.SMOKE)
      .setAlpha(0.7)
      .setScale(2)
      .setDepth(4);
    this.smoke.add(puff);
    this.tweens.add({
      targets: puff,
      x: puff.x - 36,
      alpha: 0,
      scale: 4,
      duration: 600,
      onComplete: () => this.removePuff(puff),
    });
  }

  private removePuff(puff: Phaser.GameObjects.Image): void {
    this.tweens.killTweensOf(puff);
    this.smoke.delete(puff);
    puff.destroy();
  }

  private clearSmoke(): void {
    [...this.smoke].forEach((puff) => this.removePuff(puff));
  }

  private animateCrowd(time: number): void {
    const active = Math.floor(time / CROWD_FRAME_MS) % this.crowd.length;
    this.crowd.forEach((layer, i) => layer.setVisible(i === active));
  }

  private cleanup(): void {
    this.bus?.off(GAME_EVENTS.RUN_RACE, this.handleRunRace);
    this.bus?.off(GAME_EVENTS.THEME_CHANGED, this.handleThemeChanged);
    this.smoke.clear();
    this.runState = 'idle';
  }
}

export const GAME_DIMENSIONS = { width: GAME_WIDTH, height: GAME_HEIGHT };

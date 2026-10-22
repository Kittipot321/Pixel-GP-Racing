// BootScene — draws every pixel-art texture procedurally (no external binary
// assets) with Phaser Graphics, then starts the RaceScene. Pixel-art rendering
// is configured on the game (see GameCanvas), so these small textures scale up
// with crisp nearest-neighbor edges. Scenery textures that follow the site
// theme (asphalt, grass, crowd) are baked once per theme; use themedTexture()
// to get the key for a theme.
//
// All Phaser calls live inside create(): nothing runs at module load, which
// keeps the module importable under the lightweight Phaser mock in tests.

import Phaser from 'phaser';
import { CAR_COLORS, type CarColor } from '@pixel-race/shared-types';
import { CAR_HEX } from './colors.ts';
import { RACE_PALETTES, RACE_THEMES, themedTexture, type RacePalette } from './palette.ts';

/** Source size of one F1 car texture (drawn nose-right, viewed from above). */
export const CAR_WIDTH = 32;
export const CAR_HEIGHT = 16;
/** Number of wheel animation frames per car. */
export const CAR_FRAMES = 2;

export const TEXTURES = {
  ASPHALT: 'asphalt',
  KERB: 'kerb',
  ROAD_LINE: 'road-line',
  CHECKER: 'checker',
  FLAG: 'flag',
  CROWD: ['crowd-0', 'crowd-1'],
  GRASS: 'grass',
  LIGHT_ON: 'light-on',
  LIGHT_OFF: 'light-off',
  SMOKE: 'smoke',
} as const;

/** Texture key for a car of the given color and wheel frame (0 or 1). */
export function carTextureKey(color: string, frame = 0): string {
  return `car-${color}-${frame}`;
}

/** Blend a 0xRRGGBB color toward black (amount < 0) or white (amount > 0). */
function shade(hex: number, amount: number): number {
  const target = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const mix = (channel: number) => Math.round(channel + (target - channel) * t);
  const r = mix((hex >> 16) & 0xff);
  const g = mix((hex >> 8) & 0xff);
  const b = mix(hex & 0xff);
  return (r << 16) | (g << 8) | b;
}

type Painter = Phaser.GameObjects.Graphics;

function rect(g: Painter, color: number, x: number, y: number, w: number, h: number): void {
  g.fillStyle(color, 1);
  g.fillRect(x, y, w, h);
}

/** A 6x4 tyre whose tread lines shift by one pixel between frames, so wheels look like they spin. */
function drawTyre(g: Painter, x: number, y: number, frame: number): void {
  rect(g, 0x111111, x, y, 6, 4);
  rect(g, 0x555555, x + 1 + frame, y, 1, 4);
  rect(g, 0x555555, x + 3 + frame, y, 1, 4);
}

function drawCar(g: Painter, color: CarColor, frame: number): void {
  const body = CAR_HEX[color];
  const wing = shade(body, -0.45);
  const highlight = shade(body, 0.35);

  drawTyre(g, 5, 0, frame); // rear wheels
  drawTyre(g, 5, 12, frame);
  drawTyre(g, 21, 0, frame); // front wheels
  drawTyre(g, 21, 12, frame);
  rect(g, 0x2b2b2b, 7, 4, 2, 8); // rear suspension
  rect(g, 0x2b2b2b, 23, 4, 2, 8); // front suspension

  rect(g, wing, 0, 1, 3, 14); // rear wing
  rect(g, 0x111111, 3, 6, 2, 4); // wing mount
  rect(g, body, 4, 5, 22, 6); // main body
  rect(g, body, 10, 4, 10, 8); // sidepods
  rect(g, body, 26, 6, 3, 4); // nose
  rect(g, wing, 29, 2, 3, 12); // front wing
  rect(g, highlight, 19, 7, 8, 2); // nose stripe
  rect(g, 0x111111, 13, 6, 5, 4); // cockpit
  rect(g, 0xffffff, 14, 7, 2, 2); // helmet
  rect(g, 0x3b7de2, 16, 7, 1, 2); // visor
}

function drawAsphalt(g: Painter, palette: RacePalette): void {
  rect(g, palette.asphalt, 0, 0, 32, 32);
  const speckles = [
    [3, 4],
    [11, 9],
    [20, 2],
    [27, 14],
    [6, 19],
    [15, 25],
    [24, 28],
    [30, 22],
    [9, 30],
    [18, 16],
  ];
  for (const [x, y] of speckles) {
    rect(g, palette.asphaltSpeck, x as number, y as number, 2, 1);
  }
}

function drawChecker(g: Painter, size: number, square: number): void {
  for (let y = 0; y < size; y += square) {
    for (let x = 0; x < size; x += square) {
      const isDark = (x / square + y / square) % 2 === 0;
      rect(g, isDark ? 0x111111 : 0xf5f5f5, x, y, square, square);
    }
  }
}

function drawCrowd(g: Painter, frame: number, palette: RacePalette): void {
  const shirts = [0xe23b3b, 0x3b7de2, 0xf2c531, 0x4caf50];
  const skins = [0xf1c27d, 0xc68642, 0x8d5524, 0xe0ac69];
  rect(g, palette.crowdBack, 0, 0, 32, 24);
  for (let row = 0; row < 2; row += 1) {
    for (let i = 0; i < 4; i += 1) {
      const x = i * 8 + 2;
      // Every other fan jumps (1px up, arms raised) on frame 1.
      const lift = frame === 1 && (i + row) % 2 === 0 ? 1 : 0;
      const y = row * 12 + 2 - lift;
      rect(g, skins[(i + row) % 4] as number, x + 1, y, 3, 3);
      rect(g, shirts[(i + row * 2) % 4] as number, x, y + 3, 5, 6);
      if (lift === 1) {
        rect(g, skins[(i + row) % 4] as number, x - 1, y, 1, 3);
        rect(g, skins[(i + row) % 4] as number, x + 5, y, 1, 3);
      }
    }
  }
}

function drawLight(g: Painter, isOn: boolean): void {
  rect(g, 0x111111, 0, 0, 14, 14);
  rect(g, isOn ? 0xff2020 : 0x401010, 2, 2, 10, 10);
  if (isOn) {
    rect(g, 0xff9a9a, 4, 4, 3, 2); // glint
  }
}

function drawSmoke(g: Painter): void {
  rect(g, 0xcfcfd6, 1, 0, 4, 6);
  rect(g, 0xcfcfd6, 0, 1, 6, 4);
}

function drawGrass(g: Painter, palette: RacePalette): void {
  rect(g, palette.grass, 0, 0, 32, 16);
  for (const [x, y] of [
    [4, 3],
    [13, 10],
    [22, 5],
    [28, 12],
    [9, 13],
  ]) {
    rect(g, palette.grassBlade, x as number, y as number, 1, 2);
  }
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    for (const color of CAR_COLORS) {
      for (let frame = 0; frame < CAR_FRAMES; frame += 1) {
        this.bake(carTextureKey(color, frame), CAR_WIDTH, CAR_HEIGHT, (g) =>
          drawCar(g, color, frame),
        );
      }
    }
    // Scenery that changes with the site theme: one copy per theme.
    for (const theme of RACE_THEMES) {
      const palette = RACE_PALETTES[theme];
      this.bake(themedTexture(TEXTURES.ASPHALT, theme), 32, 32, (g) => drawAsphalt(g, palette));
      this.bake(themedTexture(TEXTURES.GRASS, theme), 32, 16, (g) => drawGrass(g, palette));
      TEXTURES.CROWD.forEach((key, frame) =>
        this.bake(themedTexture(key, theme), 32, 24, (g) => drawCrowd(g, frame, palette)),
      );
    }
    this.bake(TEXTURES.KERB, 32, 8, (g) => {
      rect(g, 0xe23b3b, 0, 0, 16, 8);
      rect(g, 0xf5f5f5, 16, 0, 16, 8);
    });
    this.bake(TEXTURES.ROAD_LINE, 32, 4, (g) => rect(g, 0xf5f5f5, 0, 0, 16, 4));
    this.bake(TEXTURES.CHECKER, 16, 16, (g) => drawChecker(g, 16, 8));
    this.bake(TEXTURES.FLAG, 24, 16, (g) => drawChecker(g, 24, 4));
    this.bake(TEXTURES.LIGHT_ON, 14, 14, (g) => drawLight(g, true));
    this.bake(TEXTURES.LIGHT_OFF, 14, 14, (g) => drawLight(g, false));
    this.bake(TEXTURES.SMOKE, 6, 6, drawSmoke);

    this.scene.start('RaceScene');
  }

  /** Draw into a throwaway Graphics object and store the result as a texture. */
  private bake(key: string, width: number, height: number, draw: (g: Painter) => void): void {
    const g = this.add.graphics();
    draw(g);
    g.generateTexture(key, width, height);
    g.destroy();
  }
}

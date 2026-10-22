// Car color → hex mapping for the Phaser game.
//
// The four canonical CarColor values map to the pixel-art palette used for the
// car sprites and the lane legend. Keeping this in one place means the UI and
// the game render identical colors.

import type { CarColor } from '@pixel-race/shared-types';

export const CAR_HEX: Record<CarColor, number> = {
  RED: 0xe23b3b,
  YELLOW: 0xf2c531,
  BLUE: 0x3b7de2,
  WHITE: 0xf5f5f5,
};

/** CSS hex strings for use in React (swatches, legends). */
export const CAR_CSS: Record<CarColor, string> = {
  RED: '#e23b3b',
  YELLOW: '#f2c531',
  BLUE: '#3b7de2',
  WHITE: '#f5f5f5',
};

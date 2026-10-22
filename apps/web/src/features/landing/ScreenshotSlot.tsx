// A 16:9 framed screenshot for the landing page.
//
// Shows the image at `src`. If it fails to load (the file has not been added
// to public/landing/ yet), the slot draws a small pixel race scene instead:
// asphalt lanes with the four car colors and the caption, so the page never
// shows a broken image.

import { useState } from 'react';
import { CAR_COLORS } from '@pixel-race/shared-types';
import { CAR_CSS } from '../../game/colors.ts';
import { pixelFrame } from '../../app/ui.ts';

interface ScreenshotSlotProps {
  src: string;
  alt: string;
  /** The hero image loads eagerly; gallery images wait until scrolled near. */
  eager?: boolean;
  testId?: string;
}

/** How far along each lane the placeholder car sits (percent). */
const PLACEHOLDER_PROGRESS = [62, 78, 54, 70];

export function ScreenshotSlot({ src, alt, eager = false, testId }: ScreenshotSlotProps) {
  const [failed, setFailed] = useState(false);

  return (
    <figure className={`${pixelFrame} m-0 overflow-hidden`} data-testid={testId}>
      <div className="relative aspect-video w-full bg-[#2f6b2f]">
        {failed ? (
          <div
            role="img"
            aria-label={alt}
            className="absolute inset-0 flex flex-col justify-center gap-[6%] bg-[#3a3f4b] px-[6%] py-[8%]"
            data-testid={testId ? `${testId}-placeholder` : undefined}
          >
            {CAR_COLORS.map((color, i) => (
              <div
                key={color}
                className="relative h-[12%] border-y-2 border-dashed border-white/30"
              >
                <span
                  className="absolute top-1/2 h-[140%] w-[9%] -translate-y-1/2 border-2 border-black"
                  style={{ left: `${PLACEHOLDER_PROGRESS[i]}%`, backgroundColor: CAR_CSS[color] }}
                />
              </div>
            ))}
            <span
              aria-hidden="true"
              className="absolute top-0 right-[10%] bottom-0 w-[3%] bg-[repeating-linear-gradient(0deg,#000_0_8px,#fff_8px_16px)]"
            />
          </div>
        ) : (
          <img
            src={src}
            alt={alt}
            loading={eager ? 'eager' : 'lazy'}
            onError={() => setFailed(true)}
            className="absolute inset-0 h-full w-full object-cover [image-rendering:pixelated]"
          />
        )}
      </div>
      <figcaption className="border-t-4 border-edge px-3 py-2 text-sm text-muted">{alt}</figcaption>
    </figure>
  );
}

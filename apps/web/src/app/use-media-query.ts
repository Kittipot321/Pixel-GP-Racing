// useMediaQuery — true while a CSS media query matches, updated live.
//
// Where matchMedia is missing (old browsers, jsdom) or throws, it reports a
// match, so layouts keep their wide-screen behavior instead of guessing.

import { useEffect, useState } from 'react';

/** Tailwind's `sm` breakpoint: 640px and up. */
export const SM_UP = '(min-width: 640px)';

function matches(query: string): boolean {
  try {
    if (typeof window.matchMedia !== 'function') {
      return true;
    }
    return window.matchMedia(query).matches;
  } catch (err) {
    console.warn(`useMediaQuery: could not evaluate "${query}"`, err);
    return true;
  }
}

export function useMediaQuery(query: string): boolean {
  const [isMatch, setIsMatch] = useState(() => matches(query));

  useEffect(() => {
    let list: MediaQueryList;
    try {
      if (typeof window.matchMedia !== 'function') {
        return;
      }
      list = window.matchMedia(query);
    } catch {
      return; // already reported by matches()
    }
    const update = () => setIsMatch(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return isMatch;
}

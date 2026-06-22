'use client';

import { useState, useEffect } from 'react';

/**
 * Custom hook to detect if the current viewport is mobile based on a breakpoint.
 * It uses `window.matchMedia` and is SSR-safe (returns false initially on the server).
 *
 * Args:
 *     breakpoint (number): The maximum width in pixels to be considered mobile. Defaults to 639.
 *
 * Returns:
 *     boolean: True if viewport width is less than or equal to the breakpoint, false otherwise.
 */
export function useIsMobile(breakpoint: number = 639): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(`(max-width: ${breakpoint}px)`);
    
    // Set initial value
    setIsMobile(mediaQueryList.matches);

    // Event listener for changes
    const listener = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    // Use addEventListener/removeEventListener for modern browsers
    mediaQueryList.addEventListener('change', listener);
    return () => {
      mediaQueryList.removeEventListener('change', listener);
    };
  }, [breakpoint]);

  return isMobile;
}

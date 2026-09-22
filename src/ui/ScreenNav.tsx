import type { ReactNode } from 'react';

/**
 * A screen's navigation buttons, pinned so they never scroll away: a rail on the right of a wide
 * window, where the Encounter keeps its keypad, and a bar along the bottom of a narrow one. Put
 * the primary button first, so it is first in Tab order; the layout places it.
 */
export function ScreenNav({ children }: { children: ReactNode }) {
  return <nav className="screen-nav" aria-label="Screen">{children}</nav>;
}

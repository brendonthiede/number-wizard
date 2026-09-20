import { useEffect, useState } from 'react';
import type { Achievement } from '../game/achievements';

export const ROTATE_MS = 4000;

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * The newly earned Achievements, one at a time in a slot of fixed height, so a big win never
 * pushes the Loot off the screen. It rotates on its own until the Player uses or focuses an arrow,
 * and never when the device asks for reduced motion. It stays quiet for a screen reader while it
 * rotates and announces each slide once the Player drives it.
 */
export function AchievementCarousel({ earned }: { earned: Achievement[] }) {
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);
  const count = earned.length;

  useEffect(() => {
    // Old browsers and jsdom have no matchMedia; without it the carousel just rotates.
    if (!auto || count < 2 || globalThis.matchMedia?.(REDUCED_MOTION).matches) return;
    const timer = setInterval(() => setIndex((i) => i + 1), ROTATE_MS);
    return () => clearInterval(timer);
  }, [auto, count]);

  if (count === 0) return null;
  // The index only ever grows or wraps by hand; the remainder keeps it inside a list that changed length.
  const at = ((index % count) + count) % count;
  const shown = earned[at]!;
  const step = (by: number) => { setAuto(false); setIndex(at + by); };
  const stop = () => setAuto(false);

  return (
    <div className="carousel" role="group" aria-roledescription="carousel" aria-label="New Achievements">
      {count > 1 && (
        <button type="button" className="carousel-arrow" aria-label="Previous Achievement" onClick={() => step(-1)} onFocus={stop}>‹</button>
      )}
      <div className="carousel-slide" aria-live={auto ? 'off' : 'polite'}>
        <p className="achievement-line"><span className="medal-glyph earned" aria-hidden="true" />Achievement: {shown.name}</p>
        <p className="achievement-hint">{shown.hint}</p>
        {count > 1 && <p className="carousel-count">{at + 1} of {count}</p>}
      </div>
      {count > 1 && (
        <button type="button" className="carousel-arrow" aria-label="Next Achievement" onClick={() => step(1)} onFocus={stop}>›</button>
      )}
    </div>
  );
}

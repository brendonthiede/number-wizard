import { useEffect, useRef, type RefObject } from 'react';

/**
 * A ref whose element takes focus once on mount, so Enter works without a tap. Never `autoFocus`
 * or a bare `focus()`: the browser scrolls to the control and pushes the top of the screen off the top.
 */
export function useFocusOnMount<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}

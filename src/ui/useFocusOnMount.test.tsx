// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { useFocusOnMount } from './useFocusOnMount';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Probe() {
  const ref = useFocusOnMount<HTMLButtonElement>();
  return <button type="button" ref={ref}>Continue</button>;
}

it('focuses its element once on mount, without letting the browser scroll to it', () => {
  const focus = vi.spyOn(HTMLElement.prototype, 'focus');
  const { rerender } = render(<Probe />);
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Continue' }));
  expect(focus).toHaveBeenCalledTimes(1);
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  rerender(<Probe />);
  expect(focus).toHaveBeenCalledTimes(1);
});

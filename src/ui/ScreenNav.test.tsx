// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ScreenNav } from './ScreenNav';

afterEach(cleanup);

it('is a labelled navigation landmark holding its buttons, with the primary one first in Tab order', () => {
  render(
    <ScreenNav>
      <button type="button" className="primary">Continue</button>
      <button type="button">Title</button>
    </ScreenNav>,
  );
  const nav = screen.getByRole('navigation', { name: 'Screen' });
  const buttons = screen.getAllByRole('button');
  expect(buttons.map((b) => b.textContent)).toEqual(['Continue', 'Title']);
  expect(nav.contains(buttons[0]!)).toBe(true);
});

import { expect, it } from 'vitest';
import { art } from './art';

it('resolves an art slug to its shipped WebP under the site base path', () => {
  expect(art('monster/odd-owl')).toBe(`${import.meta.env.BASE_URL}art/monster/odd-owl.webp`);
});

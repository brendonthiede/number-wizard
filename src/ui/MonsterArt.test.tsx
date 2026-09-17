// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { MonsterArt } from './MonsterArt';

afterEach(cleanup);

describe('MonsterArt', () => {
  it('renders the monster image and removes it when the file is missing', () => {
    const { container } = render(<MonsterArt monsterId="odd-owl" />);
    const img = container.querySelector('img.monster') as HTMLImageElement;
    expect(img.getAttribute('src')).toContain('art/monster/odd-owl.png');
    fireEvent.error(img);
    expect(container.querySelector('img.monster')).toBeNull();
  });
});

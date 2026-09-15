import { describe, expect, it } from 'vitest';
import { APP_TITLE } from './App';

describe('App', () => {
  it('has the game title', () => {
    expect(APP_TITLE).toBe('Number Wizard');
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { emptySave, withCharacter } from '../storage/save';
import { soundSettings } from './sound';
import { TitleScreen } from './TitleScreen';

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); });

const save = withCharacter(emptySave('noah'), 'Noah', 'character-01');
const noop = () => {};

describe('TitleScreen sound toggles', () => {
  it('Effects starts on, flips its label and the stored setting, and remembers it across a mount', () => {
    render(<TitleScreen save={save} onPlay={noop} onSurvival={noop} onTrophies={noop} onGuide={noop} />);
    const effects = screen.getByRole('button', { name: 'Effects on' });
    fireEvent.click(effects);
    expect(screen.getByRole('button', { name: 'Effects off' })).toBeTruthy();
    expect(soundSettings().effects).toBe(false);
    cleanup();
    render(<TitleScreen save={save} onPlay={noop} onSurvival={noop} onTrophies={noop} onGuide={noop} />);
    expect(screen.getByRole('button', { name: 'Effects off' })).toBeTruthy();
  });

  it('Music is greyed until music exists', () => {
    render(<TitleScreen save={save} onPlay={noop} onSurvival={noop} onTrophies={noop} onGuide={noop} />);
    const music = screen.getByRole('button', { name: 'Music coming soon' }) as HTMLButtonElement;
    expect(music.disabled).toBe(true);
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Effect, playEffect, setSoundSettings, SOUND_KEY, soundSettings } from './sound';

interface FakeOsc { type: string; freqs: number[]; ramps: number[]; started: number; stopped: number }

/** A fake AudioContext that records every oscillator scheduled on it. */
function fakeAudio() {
  const oscs: FakeOsc[] = [];
  class Ctx {
    currentTime = 0;
    state = 'suspended';
    destination = {};
    resume = vi.fn(async () => { this.state = 'running'; });
    createGain() { const node = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(() => node) }; return node; }
    createOscillator() {
      const o: FakeOsc = { type: 'sine', freqs: [], ramps: [], started: -1, stopped: -1 };
      const node = {
        set type(t: string) { o.type = t; },
        frequency: { setValueAtTime: (f: number) => o.freqs.push(f), linearRampToValueAtTime: (f: number) => o.ramps.push(f) },
        connect: vi.fn(() => node),
        start: (t: number) => { o.started = t; },
        stop: (t: number) => { o.stopped = t; },
      };
      oscs.push(o);
      return node;
    }
  }
  return { Ctx, oscs };
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('soundSettings', () => {
  it('defaults to effects on and music off, round-trips through localStorage, and survives a blocked store', () => {
    expect(soundSettings()).toEqual({ effects: true, music: false });
    setSoundSettings({ effects: false, music: false });
    expect(JSON.parse(localStorage.getItem(SOUND_KEY)!)).toEqual({ effects: false, music: false });
    expect(soundSettings()).toEqual({ effects: false, music: false });
    localStorage.setItem(SOUND_KEY, 'not json');
    expect(soundSettings()).toEqual({ effects: true, music: false });
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    expect(soundSettings()).toEqual({ effects: true, music: false });
    expect(() => setSoundSettings({ effects: false, music: false })).not.toThrow();
  });
});

describe('playEffect', () => {
  it('plays each effect as its notes, in order, on a shared context it resumes first', () => {
    const { Ctx, oscs } = fakeAudio();
    vi.stubGlobal('AudioContext', Ctx);
    const expected: Record<Effect, { types: string[]; freqs: number[] }> = {
      [Effect.Hit]: { types: ['square'], freqs: [440] },
      [Effect.Critical]: { types: ['square', 'square'], freqs: [660, 880] },
      [Effect.Glancing]: { types: ['triangle'], freqs: [440] },
      [Effect.Miss]: { types: ['sawtooth'], freqs: [110] },
      [Effect.LevelUp]: { types: ['square', 'square', 'square', 'square'], freqs: [523, 659, 784, 1047] },
      [Effect.Loot]: { types: ['triangle', 'triangle', 'triangle'], freqs: [880, 1100, 1320] },
    };
    for (const effect of Object.values(Effect)) {
      oscs.length = 0;
      playEffect(effect);
      expect(oscs.map((o) => o.type), effect).toEqual(expected[effect].types);
      expect(oscs.map((o) => o.freqs[0]), effect).toEqual(expected[effect].freqs);
      for (let i = 1; i < oscs.length; i++) expect(oscs[i]!.started, effect).toBeGreaterThanOrEqual(oscs[i - 1]!.stopped);
    }
  });

  it('a Glancing Blow slides down to 330 Hz', () => {
    const { Ctx, oscs } = fakeAudio();
    vi.stubGlobal('AudioContext', Ctx);
    playEffect(Effect.Glancing);
    expect(oscs[0]!.ramps).toEqual([330]);
  });

  it('can start later on the audio clock, so two effects in a row never overlap', () => {
    const { Ctx, oscs } = fakeAudio();
    vi.stubGlobal('AudioContext', Ctx);
    playEffect(Effect.Loot);
    playEffect(Effect.LevelUp, 250);
    const lootEnd = Math.max(...oscs.slice(0, 3).map((o) => o.stopped));
    expect(oscs[3]!.started).toBeGreaterThanOrEqual(0.25);
    expect(oscs[3]!.started).toBeGreaterThanOrEqual(lootEnd);
  });

  it('does nothing when effects are off, and nothing when the browser has no AudioContext', () => {
    const { Ctx, oscs } = fakeAudio();
    vi.stubGlobal('AudioContext', Ctx);
    setSoundSettings({ effects: false, music: false });
    playEffect(Effect.Hit);
    expect(oscs).toHaveLength(0);
    setSoundSettings({ effects: true, music: false });
    vi.stubGlobal('AudioContext', undefined);
    expect(() => playEffect(Effect.Hit)).not.toThrow();
  });
});

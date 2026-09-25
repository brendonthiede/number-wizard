/** The sound effects, each a few synthesised notes. No files: nothing to source, license or ship. */
export const Effect = { Hit: 'hit', Critical: 'critical', Glancing: 'glancing', Miss: 'miss', LevelUp: 'level-up', Loot: 'loot' } as const;
export type Effect = (typeof Effect)[keyof typeof Effect];

/** The two toggles. A device preference, kept out of the save: an Export must not carry one device's speaker choice. */
export interface SoundSettings {
  effects: boolean;
  music: boolean;
}

export const SOUND_KEY = 'number-wizard-sound';
const DEFAULTS: SoundSettings = { effects: true, music: false };
const GAIN = 0.15; // quiet enough for a Chromebook speaker at full volume

interface Note {
  wave: OscillatorType;
  hz: number;
  ms: number;
  slideTo?: number; // end frequency for a slide
}
/** A square-wave note: the bright chiptune voice. */
const sq = (hz: number, ms: number): Note => ({ wave: 'square', hz, ms });
/** A triangle-wave note: softer, for sparkles. */
const tri = (hz: number, ms: number): Note => ({ wave: 'triangle', hz, ms });

const NOTES: Record<Effect, Note[]> = {
  [Effect.Hit]: [sq(440, 90)],
  [Effect.Critical]: [sq(660, 70), sq(880, 70)],
  [Effect.Glancing]: [{ wave: 'triangle', hz: 440, ms: 150, slideTo: 330 }],
  [Effect.Miss]: [{ wave: 'sawtooth', hz: 110, ms: 220 }],
  [Effect.LevelUp]: [sq(523, 90), sq(659, 90), sq(784, 90), sq(1047, 90)],
  [Effect.Loot]: [tri(880, 60), tri(1100, 60), tri(1320, 60)],
};

// The session's own copy: a toggle must hold for the session even when storage refuses the write.
let current: SoundSettings | null = null;

/**
 * The toggles in force. Storage is the record; when it is blocked the session's own last toggle
 * holds, so turning Effects off works even where nothing can be saved. Junk in storage means the defaults.
 */
export function soundSettings(): SoundSettings {
  let raw: string | null;
  try {
    raw = localStorage.getItem(SOUND_KEY);
  } catch {
    return { ...(current ?? DEFAULTS) };
  }
  try {
    const parsed = JSON.parse(raw ?? '');
    return { effects: parsed.effects !== false, music: parsed.music === true };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Stores the toggles; a blocked store is not an error, the defaults simply come back next time. */
export function setSoundSettings(settings: SoundSettings): void {
  current = { ...settings };
  try {
    localStorage.setItem(SOUND_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

let shared: { ctor: unknown; ctx: AudioContext } | null = null;

/** One context for the whole session, since browsers cap how many exist. A replaced constructor (tests stub it) starts a fresh one. */
function context(): AudioContext | null {
  const Ctor = globalThis.AudioContext;
  if (!Ctor) return null;
  if (!shared || shared.ctor !== Ctor) {
    // A browser can refuse another context; sound is optional and a cast must never fail over it.
    try { shared = { ctor: Ctor, ctx: new Ctor() }; } catch { return null; }
  }
  return shared.ctx;
}

/**
 * Plays an effect, starting `delayMs` later on the audio clock so two effects in a row can be
 * spaced without a timer. Returns at once; does nothing when effects are off or the browser has
 * no AudioContext. Every call follows a tap or a key, so resuming the context always succeeds.
 */
export function playEffect(effect: Effect, delayMs = 0): void {
  if (!soundSettings().effects) return;
  const ctx = context();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  let at = ctx.currentTime + delayMs / 1000;
  for (const note of NOTES[effect]) {
    const seconds = note.ms / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = note.wave;
    osc.frequency.setValueAtTime(note.hz, at);
    if (note.slideTo !== undefined) osc.frequency.linearRampToValueAtTime(note.slideTo, at + seconds);
    gain.gain.setValueAtTime(GAIN, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + seconds);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + seconds);
    at += seconds;
  }
}

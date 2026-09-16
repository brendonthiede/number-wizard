import { describe, expect, it } from 'vitest';
import { emptySave, memoryStore, migrate, withAttempt } from './save';
import type { Attempt } from '../engine/types';

const attempt: Attempt = {
  factId: 'tt:3x4', answer: 12, correct: true, durationMs: 1500,
  at: '2026-09-15T12:00:00.000Z', encounterId: 'e1', outcome: 'critical',
};

describe('save data', () => {
  it('starts empty for a Player', () => {
    expect(emptySave('noah')).toEqual({ version: 1, playerId: 'noah', attempts: [] });
  });

  it('appends an Attempt without mutating the original', () => {
    const before = emptySave('noah');
    const after = withAttempt(before, attempt);
    expect(after.attempts).toEqual([attempt]);
    expect(before.attempts).toEqual([]);
  });

  it('memoryStore round-trips and isolates its copy', async () => {
    const store = memoryStore();
    expect(await store.load()).toBeUndefined();
    const data = withAttempt(emptySave('noah'), attempt);
    await store.save(data);
    data.attempts.push(attempt);
    expect((await store.load())?.attempts).toHaveLength(1);
  });
});

describe('migrate', () => {
  it('returns a version-1 save unchanged', () => {
    const data = emptySave('noah');
    expect(migrate(data)).toEqual(data);
  });

  it('throws on an unsupported version', () => {
    expect(() => migrate({ version: 2 })).toThrow('Unsupported save version: 2');
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GuideScreen, LEARNING_PLAN_PROMPT } from './GuideScreen';
import { buildExport, EXPORT_KIND } from '../game/exportFile';
import { PLAN_KIND } from '../game/learningPlan';
import { emptySave, withCharacter, withLearningPlan, type SaveData } from '../storage/save';

afterEach(cleanup);

const NOW = new Date('2026-09-18T15:04:05.000Z');
const base = (): SaveData => ({ ...withCharacter(emptySave('noah'), 'Noah', 'character-01'), character: { name: 'Noah', portrait: 'character-01', xp: 40, survivalBest: 2 } });

function mount(save = base(), overrides: { download?: Mock<(fileName: string, text: string) => void>; copy?: Mock<(text: string) => Promise<void>> } = {}) {
  const props = { onSave: vi.fn(), onReset: vi.fn(), onTitle: vi.fn(), download: vi.fn(), copy: vi.fn(async () => {}), ...overrides };
  render(<GuideScreen save={save} now={() => NOW} {...props} />);
  return props;
}
const paste = (text: string) => fireEvent.change(screen.getByLabelText('Paste a Learning Plan or an Export'), { target: { value: text } });

describe('GuideScreen', () => {
  it('says whether Work labels are hidden, and lets the Guide show them again or hide them', () => {
    const shown = mount();
    expect(screen.getByText('Work labels are shown by default.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hide Work labels' }));
    expect((shown.onSave.mock.calls[0]![0] as SaveData).settings.hideWorkLabels).toBe(true);
    expect(screen.getByText('Work labels hidden.')).toBeTruthy();
    cleanup();

    const hiddenSave = { ...base(), settings: { hideWorkLabels: true } };
    const hidden = mount(hiddenSave);
    expect(screen.getByText('Work labels are hidden by default.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show Work labels' }));
    expect(hidden.onSave).toHaveBeenCalledWith({ ...hiddenSave, settings: { hideWorkLabels: false } });
    expect(screen.getByText('Work labels shown again.')).toBeTruthy();
  });

  it('downloads the Export, or copies it', async () => {
    const p = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Download Export' }));
    expect(p.download).toHaveBeenCalledWith('number-wizard-noah-2026-09-18.json', JSON.stringify(buildExport(base(), NOW), null, 2));
    fireEvent.click(screen.getByRole('button', { name: 'Copy Export' }));
    expect(p.copy).toHaveBeenCalledWith(JSON.stringify(buildExport(base(), NOW), null, 2));
    expect(await screen.findByText('Export copied.')).toBeTruthy();
  });

  it('Copy Prompt copies the Learning Plan prompt with the Export pasted after it', async () => {
    const p = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Copy Prompt' }));
    const text = p.copy.mock.calls[0]![0] as string;
    expect(text.startsWith(LEARNING_PLAN_PROMPT)).toBe(true);
    expect(text.endsWith(JSON.stringify(buildExport(base(), NOW), null, 2))).toBe(true);
    expect(await screen.findByText('Prompt copied. Paste it into Claude.')).toBeTruthy();
  });

  it('imports a Learning Plan at once and shows its summary', () => {
    const p = mount();
    expect(screen.getByText('No Learning Plan.')).toBeTruthy();
    paste(JSON.stringify({ kind: PLAN_KIND, version: 1, thresholds: { 'times-table': 6000 }, monsterHpScale: 1.5, problems: [[7, 8]], note: 'slow and steady' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(screen.getByText('Learning Plan imported.')).toBeTruthy();
    const saved = p.onSave.mock.calls[0]![0] as SaveData;
    expect(saved.learningPlan).toEqual({ plan: expect.objectContaining({ monsterHpScale: 1.5 }), importedAt: NOW.toISOString() });
  });

  it('shows the current plan and removes it', () => {
    const p = mount(withLearningPlan(base(), { kind: PLAN_KIND, version: 1, thresholds: { 'times-table': 6000 }, monsterHpScale: 1.5, problems: [[7, 8]], emphasize: ['tt:7x8'], note: 'slow and steady' }, NOW));
    expect(screen.getByText(/6000 ms/)).toBeTruthy();
    expect(screen.getByText(/1\.5/)).toBeTruthy();
    expect(screen.getByText(/1 emphasised Fact/)).toBeTruthy();
    expect(screen.getByText(/1 explicit Problem left/)).toBeTruthy();
    expect(screen.getByText('slow and steady')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Learning Plan' }));
    expect((p.onSave.mock.calls[0]![0] as SaveData).learningPlan).toBeNull();
  });

  it('rejects a bad file in plain words and changes nothing (invariant 1)', () => {
    const p = mount();
    paste('{"kind":"number-wizard-learning-plan","version":1,"monsterHpScale":9}');
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(screen.getByRole('alert').textContent).toContain('monsterHpScale');
    expect(p.onSave).not.toHaveBeenCalled();
  });

  it('restores an Export only after confirming, and downloads the current save first', () => {
    const p = mount();
    const other = { ...base(), character: { ...base().character, xp: 999 } };
    paste(JSON.stringify({ kind: EXPORT_KIND, exportedAt: NOW.toISOString(), save: other }));
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(p.onSave).not.toHaveBeenCalled();
    expect(screen.getByText("This replaces all of Noah's progress.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    expect((screen.getByRole('button', { name: 'Replace progress' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Download Export' }));
    expect(p.download).toHaveBeenCalledTimes(1);
    expect(p.onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Replace progress' }));
    expect(p.download.mock.invocationCallOrder[0]!).toBeLessThan(p.onSave.mock.invocationCallOrder[0]!);
    expect(p.onSave).toHaveBeenCalledWith(other);
    expect(screen.getByText('Save restored.')).toBeTruthy();
  });

  it('Reset downloads before clearing, and Cancel changes nothing (invariant 7)', () => {
    const p = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByText("This deletes all of Noah's progress.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(p.download).not.toHaveBeenCalled();
    expect(p.onReset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    const destroy = () => screen.getByRole('button', { name: 'Delete progress' }) as HTMLButtonElement;
    // Starting a download is not proof it was saved, so deleting is a separate, later tap.
    expect(destroy().disabled).toBe(true);
    fireEvent.click(destroy());
    expect(p.onReset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Download Export' }));
    expect(p.download).toHaveBeenCalledTimes(1);
    expect(p.onReset).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toBe('Export downloaded. Check the file saved before you go on.');
    expect(destroy().disabled).toBe(false);
    fireEvent.click(destroy());
    expect(p.download.mock.invocationCallOrder[0]!).toBeLessThan(p.onReset.mock.invocationCallOrder[0]!);
    expect(p.onReset).toHaveBeenCalledTimes(1);
  });

  it('a new confirmation always starts locked, even after an earlier download', () => {
    const p = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download Export' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect((screen.getByRole('button', { name: 'Delete progress' }) as HTMLButtonElement).disabled).toBe(true);
    expect(p.onReset).not.toHaveBeenCalled();
  });

  it('a failed download on Reset changes nothing and says so', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const p = mount(base(), { download: vi.fn(() => { throw new Error('blocked'); }) });
      fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
      fireEvent.click(screen.getByRole('button', { name: 'Download Export' }));
      expect(screen.getByRole('alert').textContent).toBe('The Export could not be downloaded, so nothing was changed.');
      expect((screen.getByRole('button', { name: 'Delete progress' }) as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(screen.getByRole('button', { name: 'Delete progress' }));
      expect(p.onReset).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByRole('button', { name: 'Reset' })).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });

  it('a failed download on restoring an Export changes nothing and says so', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const p = mount(base(), { download: vi.fn(() => { throw new Error('blocked'); }) });
      const other = { ...base(), character: { ...base().character, xp: 999 } };
      paste(JSON.stringify({ kind: EXPORT_KIND, exportedAt: NOW.toISOString(), save: other }));
      fireEvent.click(screen.getByRole('button', { name: 'Import' }));
      fireEvent.click(screen.getByRole('button', { name: 'Download Export' }));
      expect(screen.getByRole('alert').textContent).toBe('The Export could not be downloaded, so nothing was changed.');
      fireEvent.click(screen.getByRole('button', { name: 'Replace progress' }));
      expect(p.onSave).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('Copy reports a failure when the clipboard throws synchronously', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      mount(base(), { copy: vi.fn(() => { throw new TypeError('no clipboard'); }) });
      fireEvent.click(screen.getByRole('button', { name: 'Copy Export' }));
      expect((await screen.findByRole('alert')).textContent).toBe('Copy failed. Use Download Export.');
    } finally {
      spy.mockRestore();
    }
  });

  it('Download Export reports a failure', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      mount(base(), { download: vi.fn(() => { throw new Error('blocked'); }) });
      fireEvent.click(screen.getByRole('button', { name: 'Download Export' }));
      expect(screen.getByRole('alert').textContent).toBe('The Export could not be downloaded.');
      expect(screen.queryByText('Export downloaded.')).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it('Title returns to the title screen', () => {
    const p = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Title' }));
    expect(p.onTitle).toHaveBeenCalledTimes(1);
  });

  it('choosing a file fills the textarea', async () => {
    mount();
    const file = new File(['{"a":1}'], 'x.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('Choose file'), { target: { files: [file] } });
    expect(await screen.findByDisplayValue('{"a":1}')).toBeTruthy();
  });

  it('a file that cannot be read reports the failure and changes nothing', async () => {
    const p = mount();
    const file = { text: () => Promise.reject(new Error('nope')) } as unknown as File;
    fireEvent.change(screen.getByLabelText('Choose file'), { target: { files: [file] } });
    expect((await screen.findByRole('alert')).textContent).toBe('That file could not be read.');
    expect(p.onSave).not.toHaveBeenCalled();
  });
  it('keeps Title in the screen navigation, apart from the sections and their status lines (pinned navigation)', () => {
    mount();
    const nav = screen.getByRole('navigation', { name: 'Screen' });
    expect(nav.contains(screen.getByRole('button', { name: 'Title' }))).toBe(true);
    expect(nav.contains(screen.getByRole('button', { name: 'Reset' }))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Copy Export' }));
    expect(nav.contains(screen.getByRole('button', { name: 'Copy Export' }))).toBe(false);
  });

  it('the confirmation view keeps its own layout, with no pinned navigation', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.queryByRole('navigation', { name: 'Screen' })).toBeNull();
    expect(screen.getByRole('main').className).toBe('screen guide guide-confirm');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
  });
});

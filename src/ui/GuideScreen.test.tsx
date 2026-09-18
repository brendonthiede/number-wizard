// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GuideScreen } from './GuideScreen';
import { buildExport, EXPORT_KIND } from '../game/exportFile';
import { PLAN_KIND } from '../game/learningPlan';
import { emptySave, withCharacter, withLearningPlan, type SaveData } from '../storage/save';

afterEach(cleanup);

const NOW = new Date('2026-09-18T15:04:05.000Z');
const base = (): SaveData => ({ ...withCharacter(emptySave('noah'), 'Noah', 'character-01'), character: { name: 'Noah', portrait: 'character-01', xp: 40, survivalBest: 2 } });

function mount(save = base()) {
  const props = { onSave: vi.fn(), onReset: vi.fn(), onTitle: vi.fn(), download: vi.fn(), copy: vi.fn(async () => {}) };
  render(<GuideScreen save={save} now={() => NOW} {...props} />);
  return props;
}
const paste = (text: string) => fireEvent.change(screen.getByLabelText('Paste a Learning Plan or an Export'), { target: { value: text } });

describe('GuideScreen', () => {
  it('downloads the Export, or copies it', async () => {
    const p = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Download Export' }));
    expect(p.download).toHaveBeenCalledWith('number-wizard-noah-2026-09-18.json', JSON.stringify(buildExport(base(), NOW), null, 2));
    fireEvent.click(screen.getByRole('button', { name: 'Copy Export' }));
    expect(p.copy).toHaveBeenCalledWith(JSON.stringify(buildExport(base(), NOW), null, 2));
    expect(await screen.findByText('Export copied.')).toBeTruthy();
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
    expect(screen.getByText(/1 emphasised/)).toBeTruthy();
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
    fireEvent.click(screen.getByRole('button', { name: 'Replace progress' }));
    expect(p.download).toHaveBeenCalledTimes(1);
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
    fireEvent.click(screen.getByRole('button', { name: 'Delete progress' }));
    expect(p.download.mock.invocationCallOrder[0]!).toBeLessThan(p.onReset.mock.invocationCallOrder[0]!);
    expect(p.onReset).toHaveBeenCalledTimes(1);
  });
});

import { useState, type ChangeEvent } from 'react';
import { buildExport, exportFileName, ImportKind, parseImport } from '../game/exportFile';
import { remainingExplicit, scaledHp, thresholdFor } from '../game/learningPlan';
import { withLearningPlan, withoutLearningPlan, type SaveData } from '../storage/save';

interface GuideScreenProps {
  save: SaveData;
  onSave: (save: SaveData) => void;
  onReset: () => void;
  onTitle: () => void;
  now?: () => Date;
  download?: (fileName: string, text: string) => void;
  copy?: (text: string) => Promise<void>;
}

const Pending = { Reset: 'reset', Restore: 'restore' } as const;
type Pending = { kind: typeof Pending.Reset } | { kind: typeof Pending.Restore; save: SaveData };

const browserDownload = (fileName: string, text: string): void => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  // Revoking on a timeout avoids racing the browser's read of the blob URL during the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

/**
 * The Guide's screen: Export, Import of a Learning Plan or an Export, and Reset. The save is the
 * only copy of the Player's history, so anything that replaces it downloads an Export first.
 */
export function GuideScreen({ save, onSave, onReset, onTitle, now = () => new Date(), download = browserDownload, copy = (t) => navigator.clipboard.writeText(t) }: GuideScreenProps) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [backedUp, setBackedUp] = useState(false);

  const exportText = () => JSON.stringify(buildExport(save, now()), null, 2);
  const downloadExport = () => download(exportFileName(save, now()), exportText());
  const say = (message: string) => { setStatus(message); setError(''); };
  const fail = (message: string) => { setError(message); setStatus(''); };

  // Isolates a throw from `download`'s browser side effect (e.g. a blocked download) so a failed
  // Export never lets Reset or a Restore proceed as if the current progress were safely saved.
  const tryDownload = (): boolean => {
    try {
      downloadExport();
      return true;
    } catch (err) {
      console.error('export download failed', err);
      return false;
    }
  };

  // Every confirmation starts locked: an Export from an earlier one may already be stale.
  const open = (next: Pending | null) => { setPending(next); setBackedUp(false); setStatus(''); setError(''); };

  const doImport = () => {
    try {
      const parsed = parseImport(text);
      if (parsed.kind === ImportKind.Plan) {
        onSave(withLearningPlan(save, parsed.plan, now()));
        setText('');
        say('Learning Plan imported.');
      } else {
        open({ kind: Pending.Restore, save: parsed.save });
      }
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err));
    }
  };

  // A browser download gives no completion signal, so the Guide downloads and then confirms as two
  // separate taps: the destructive step never runs in the same gesture that starts the Export.
  const backUp = () => {
    if (tryDownload()) { setBackedUp(true); say('Export downloaded. Check the file saved before you go on.'); }
    else { setBackedUp(false); fail('The Export could not be downloaded, so nothing was changed.'); }
  };

  const confirm = () => {
    if (!pending || !backedUp) return;
    const done = pending;
    open(null);
    if (done.kind === Pending.Reset) onReset();
    else { onSave(done.save); setText(''); say('Save restored.'); }
  };

  // Handles a clipboard write that rejects (normal) or throws synchronously (no `navigator.clipboard`
  // on plain http over a LAN) the same way, so Copy Export never leaves the failure unexplained.
  const copyExport = async () => {
    try {
      await copy(exportText());
      say('Export copied.');
    } catch {
      fail('Copy failed. Use Download Export.');
    }
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setText(await file.text());
    } catch {
      fail('That file could not be read.');
    }
  };

  const stored = save.learningPlan;
  const left = remainingExplicit(save);
  const emphasised = stored?.plan.emphasize?.length ?? 0;

  if (pending) {
    const reset = pending.kind === Pending.Reset;
    return (
      <main className="screen guide">
        <h1>Guide</h1>
        <p>{reset ? `This deletes all of ${save.character.name}'s progress.` : `This replaces all of ${save.character.name}'s progress.`}</p>
        <p>Download an Export of the current progress first, and check the file saved.</p>
        <button type="button" onClick={backUp}>Download Export</button>
        {status && <p role="status">{status}</p>}
        {error && <p role="alert">{error}</p>}
        <button type="button" className="primary" onClick={() => open(null)} autoFocus>Cancel</button>
        <button type="button" onClick={confirm} disabled={!backedUp}>{reset ? 'Delete progress' : 'Replace progress'}</button>
      </main>
    );
  }

  return (
    <main className="screen guide">
      <h1>Guide</h1>
      <section>
        <h2>Export</h2>
        <button type="button" onClick={() => { if (tryDownload()) say('Export downloaded.'); else fail('The Export could not be downloaded.'); }}>Download Export</button>
        <button type="button" onClick={copyExport}>Copy Export</button>
      </section>
      <section>
        <h2>Import</h2>
        <label htmlFor="guide-import">Paste a Learning Plan or an Export</label>
        <textarea id="guide-import" rows={6} value={text} onChange={(e) => setText(e.target.value)} />
        <input type="file" accept="application/json,.json" aria-label="Choose file" onChange={onFile} />
        <button type="button" onClick={doImport} disabled={!text.trim()}>Import</button>
      </section>
      <section>
        <h2>Learning Plan</h2>
        {stored ? (
          <>
            <p>Threshold {thresholdFor(save)} ms. Monster HP scale {stored.plan.monsterHpScale ?? 1} (a 6 HP monster has {scaledHp(save, 6)}).</p>
            <p>{emphasised} emphasised {emphasised === 1 ? 'Fact' : 'Facts'}. {left} explicit {left === 1 ? 'Problem' : 'Problems'} left.</p>
            {stored.plan.note && <p className="guide-note">{stored.plan.note}</p>}
            <button type="button" onClick={() => { onSave(withoutLearningPlan(save)); say('Learning Plan removed.'); }}>Remove Learning Plan</button>
          </>
        ) : <p>No Learning Plan.</p>}
      </section>
      <section>
        <h2>Reset</h2>
        <button type="button" onClick={() => open({ kind: Pending.Reset })}>Reset</button>
      </section>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
      <button type="button" className="primary" onClick={onTitle}>Title</button>
    </main>
  );
}

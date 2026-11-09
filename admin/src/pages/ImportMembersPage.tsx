import { useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePoiId } from '../layout/usePoiId';
import { useI18n } from '../i18n/I18nContext';
import { checkImport, runImport, type ImportCheck, type ImportResult } from '../api/contacts';
import { FIELDS, guessMapping, parseText, readFile, rowsFor, type Mapping, type Table } from '../importFile';

type Step = 'file' | 'match' | 'check' | 'done';
const STEPS: Step[] = ['file', 'match', 'check', 'done'];
const MAX_ROWS = 5000;

/**
 * Import your members (Seb, 9 Nov 2026): a spreadsheet the community
 * already has, its columns matched to ours, a check of what will happen,
 * then everyone on it is a member "not in the app yet".
 */
export function ImportMembersPage() {
  const poiId = usePoiId();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('file');
  const [table, setTable] = useState<Table | null>(null);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<Mapping>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [pasted, setPasted] = useState('');
  const [check, setCheck] = useState<ImportCheck | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function load(next: Table, name: string) {
    if (next.rows.length === 0) {
      setError(t('contacts.importEmpty'));
      return;
    }
    if (next.rows.length > MAX_ROWS) {
      setError(t('contacts.importTooMany', { max: MAX_ROWS }));
      return;
    }
    setError(null);
    setTable(next);
    setFileName(name);
    setMapping(guessMapping(next));
    setStep('match');
  }

  async function chooseFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      load(await readFile(file), file.name);
    } catch (err) {
      setError((err as Error).message === 'old_excel' ? t('contacts.importOldExcel') : t('contacts.importUnreadable'));
    } finally {
      setBusy(false);
    }
  }

  const rows = table ? rowsFor(table, mapping) : [];
  const recognised = mapping.filter((m) => m !== 'skip').length;
  const reachable = mapping.some((m) => m === 'email' || m === 'phone' || m === 'whatsapp' || m === 'telegram');

  async function runCheck() {
    setBusy(true);
    setError(null);
    try {
      setCheck(await checkImport(poiId, rows));
      setStep('check');
    } catch {
      setError(t('contacts.importError'));
    } finally {
      setBusy(false);
    }
  }

  async function runIt() {
    setBusy(true);
    setError(null);
    try {
      setResult(await runImport(poiId, rows, fileName));
      setStep('done');
    } catch {
      setError(t('contacts.importError'));
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = STEPS.indexOf(step);
  const example = (i: number) => table?.rows.find((r) => r[i])?.[i] ?? '';
  const toImport = check ? check.added.length + check.updated.length + check.inApp.length : 0;

  const list = (key: string, entries: { label: string }[]) =>
    open === key && (
      <ul className="muted" style={{ margin: '4px 0 0 86px', fontSize: 15 }}>
        {entries.slice(0, 50).map((e, i) => (
          <li key={i}>{e.label}</li>
        ))}
        {entries.length > 50 && <li>…</li>}
      </ul>
    );

  const figure = (key: string, value: number, title: string, text: string, entries: { label: string }[], bad = false) => (
    <div className="card-row" style={{ display: 'block' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span className={`import-figure${bad ? ' import-figure-bad' : ''}`}>{value}</span>
        <div style={{ flex: 1 }}>
          <p className="card-title" style={{ margin: 0, fontSize: 17 }}>
            {title}
          </p>
          <p className="card-meta">{text}</p>
        </div>
        {entries.length > 0 && (
          <button type="button" className="text-action" onClick={() => setOpen(open === key ? null : key)}>
            {open === key ? t('contacts.hide') : t('contacts.see')}
          </button>
        )}
      </div>
      {list(key, entries)}
    </div>
  );

  const rowsLabel = (e: { name: string; rows: number[] }) => ({
    label: `${e.name} (${t('contacts.rowsLabel', { rows: e.rows.join(', ') })})`,
  });

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link to=".." relative="path" className="btn">
          {t('members.back')}
        </Link>
      </div>
      <h2>{t('contacts.importTitle')}</h2>
      <p className="muted">{t('contacts.importSubtitle')}</p>

      <ol className="import-steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i < stepIndex ? 'import-step-done' : i === stepIndex ? 'import-step-on' : undefined}>
            {i < stepIndex ? '✓ ' : ''}
            {i + 1}. {t(`contacts.step_${s}`)}
          </li>
        ))}
      </ol>

      {error && <p className="error-text">{error}</p>}

      {step === 'file' && (
        <div className="card form">
          <p className="card-title" style={{ marginTop: 0 }}>
            {t('contacts.fileTitle')}
          </p>
          <p className="muted" style={{ marginTop: 0 }}>
            {t('contacts.fileText')}
          </p>
          <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.csv,.txt,.xls" hidden onChange={chooseFile} />
          <div className="card-actions" style={{ marginTop: 0 }}>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}>
              {t('contacts.chooseFile')}
            </button>
          </div>
          <label className="form-after-rows">
            {t('contacts.pasteLabel')}
            <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={6} placeholder={t('contacts.pastePlaceholder')} />
          </label>
          <div className="card-actions">
            <button type="button" className="btn" disabled={!pasted.trim()} onClick={() => load(parseText(pasted), t('contacts.pastedName'))}>
              {t('contacts.usePasted')}
            </button>
          </div>
        </div>
      )}

      {step === 'match' && table && (
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            {t('contacts.matchSummary', { file: fileName, rows: table.rows.length, found: recognised, columns: table.headers.length })}
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="import-map">
              <thead>
                <tr>
                  <th>{t('contacts.colFile')}</th>
                  <th>{t('contacts.colExample')}</th>
                  <th>{t('contacts.colInto')}</th>
                </tr>
              </thead>
              <tbody>
                {table.headers.map((header, i) => (
                  <tr key={i}>
                    <td>{header}</td>
                    <td className="muted">{example(i)}</td>
                    <td>
                      <select
                        value={mapping[i]}
                        aria-label={t('contacts.colIntoFor', { column: header })}
                        onChange={(e) => setMapping(mapping.map((m, j) => (j === i ? (e.target.value as Mapping[number]) : m)))}
                      >
                        <option value="skip">{t('contacts.field_skip')}</option>
                        {FIELDS.map((f) => (
                          <option key={f} value={f}>
                            {t(`contacts.field_${f}`)}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!reachable && <p className="error-text">{t('contacts.needContact')}</p>}
          <label className="import-check form-after-rows" style={{ paddingTop: 16 }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>
              <b>{t('contacts.consentTitle')}</b> {t('contacts.consentText')}
            </span>
          </label>
          <div className="card-actions">
            <button type="button" className="btn btn-primary" disabled={!confirmed || !reachable || busy} onClick={() => void runCheck()}>
              {t('contacts.checkRows', { count: table.rows.length })}
            </button>
            <button type="button" className="btn" onClick={() => setStep('file')}>
              {t('contacts.backStep')}
            </button>
          </div>
        </div>
      )}

      {step === 'check' && check && (
        <div className="card card-list">
          {figure('added', check.added.length, t('contacts.checkAdded'), t('contacts.checkAddedText'), check.added.map(rowsLabel))}
          {check.inApp.length > 0 &&
            figure('inApp', check.inApp.length, t('contacts.checkInApp'), t('contacts.checkInAppText'), check.inApp.map(rowsLabel))}
          {check.updated.length > 0 &&
            figure('updated', check.updated.length, t('contacts.checkUpdated'), t('contacts.checkUpdatedText'), check.updated.map(rowsLabel))}
          {check.merged.length > 0 &&
            figure('merged', check.merged.length, t('contacts.checkMerged'), t('contacts.checkMergedText'), check.merged.map(rowsLabel))}
          {check.problems.length > 0 &&
            figure(
              'problems',
              check.problems.length,
              t('contacts.checkProblems'),
              t('contacts.checkProblemsText'),
              check.problems.map((p) => ({
                label: `${t('contacts.rowsLabel', { rows: p.row })}${p.name ? ` · ${p.name}` : ''} · ${t(`contacts.problem_${p.problem}`)}`,
              })),
              true,
            )}
          <div className="card-actions import-actions">
            <button type="button" className="btn btn-primary" disabled={busy || toImport === 0} onClick={() => void runIt()}>
              {t('contacts.importRun', { count: toImport })}
            </button>
            <button type="button" className="btn" onClick={() => setStep('match')}>
              {t('contacts.backStep')}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="card">
          <p className="card-title" style={{ marginTop: 0 }}>
            {t('contacts.doneTitle', { count: result.added + result.updated + result.inApp })}
          </p>
          <p className="muted">
            {[
              t('contacts.doneAdded', { count: result.added }),
              result.inApp ? t('contacts.doneInApp', { count: result.inApp }) : '',
              result.updated ? t('contacts.doneUpdated', { count: result.updated }) : '',
              result.skipped ? t('contacts.doneSkipped', { count: result.skipped }) : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p>{t('contacts.doneNext')}</p>
          <div className="card-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('../write?kind=invitation', { relative: 'path' })}>
              {t('contacts.inviteThem')}
            </button>
            <Link to="..?tab=list" relative="path" className="btn">
              {t('contacts.seeList')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

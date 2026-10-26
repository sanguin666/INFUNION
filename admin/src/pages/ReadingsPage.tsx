import { Fragment, useEffect, useState } from 'react';
import { usePoiId } from '../layout/usePoiId';
import { useI18n } from '../i18n/I18nContext';
import { intlLocale } from '../i18n/translations';
import {
  deleteReading,
  getReadingsForOffice,
  getReadingsSettings,
  saveReading,
  updateReadingsSettings,
  type DailyReading,
  type ReadingKind,
  type ReadingSection,
} from '../api/readings';
import { DestructiveButton } from '../components/DestructiveButton';

const KINDS: ReadingKind[] = ['first', 'psalm', 'second', 'gospel', 'other'];

// Days shown in the strip at once: two weeks, so the office can prepare
// the next Sunday from any day of this week.
const STRIP_DAYS = 14;

const DEFAULT_NOTIFY_AT = '07:00';

type Draft = {
  word: string;
  sections: ReadingSection[];
  notify: boolean;
  notifyAt: string;
};

// A new day starts with the usual weekday shape; blank texts are dropped
// on saving, so an unused one costs nothing.
const blankSections = (): ReadingSection[] => [
  { kind: 'first', title: null, reference: '', text: '' },
  { kind: 'psalm', title: null, reference: '', text: '' },
  { kind: 'gospel', title: null, reference: '', text: '' },
];

function toDraft(reading: DailyReading | undefined): Draft {
  if (!reading) return { word: '', sections: blankSections(), notify: true, notifyAt: DEFAULT_NOTIFY_AT };
  return {
    word: reading.word ?? '',
    sections: reading.sections.map((s) => ({ ...s, reference: s.reference ?? '' })),
    notify: reading.notifyAt !== null,
    notifyAt: reading.notifyAt ?? DEFAULT_NOTIFY_AT,
  };
}

/** YYYY-MM-DD for a local date. */
function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + days, 12));
}

function asDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/**
 * Lectures du jour: the texts members read in the app, one set per date.
 * The office types or pastes them ahead of time; each published day shows
 * in the app from midnight on its date, and can ring members' phones at
 * the hour chosen here. The official link underneath is for the full
 * texts, which infunion does not copy (copyright).
 */
export function ReadingsPage() {
  const poiId = usePoiId();
  const { t, language } = useI18n();
  const today = dayKey(new Date());
  const [start, setStart] = useState(today);
  const [selected, setSelected] = useState(today);
  const [days, setDays] = useState<Map<string, DailyReading> | null>(null);
  const [draft, setDraft] = useState<Draft>(toDraft(undefined));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkSaved, setLinkSaved] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const end = addDays(start, STRIP_DAYS - 1);

  useEffect(() => {
    getReadingsForOffice(poiId, start, end)
      .then((list) => setDays(new Map(list.map((r) => [r.date, r]))))
      .catch(() => setError(t('readings.loadError')));
  }, [poiId, start]);

  useEffect(() => {
    getReadingsSettings(poiId)
      .then((settings) => setLinkUrl(settings.linkUrl ?? ''))
      .catch(() => undefined);
  }, [poiId]);

  const current = days?.get(selected);

  // A new day picked, or its readings loaded: the form shows what is saved.
  useEffect(() => {
    setDraft(toDraft(current));
    setSaved(null);
  }, [selected, current?.id, days === null]);

  const shortDay = (key: string) =>
    asDate(key).toLocaleDateString(intlLocale(language), { weekday: 'short' });
  const longDay = (key: string) =>
    asDate(key).toLocaleDateString(intlLocale(language), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  function patchSection(index: number, patch: Partial<ReadingSection>) {
    setDraft((d) => ({ ...d, sections: d.sections.map((s, i) => (i === index ? { ...s, ...patch } : s)) }));
  }

  const filledSections = draft.sections
    .filter((s) => s.text.trim())
    .map((s) => ({
      kind: s.kind,
      title: s.kind === 'other' ? s.title?.trim() || null : null,
      reference: s.reference?.trim() || null,
      text: s.text.trim(),
    }));
  const hasContent = filledSections.length > 0 || draft.word.trim().length > 0;

  async function save(published: boolean) {
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const reading = await saveReading(poiId, selected, {
        word: draft.word.trim() || null,
        sections: filledSections,
        published,
        notifyAt: draft.notify ? draft.notifyAt : null,
      });
      setDays((map) => new Map(map ?? []).set(reading.date, reading));
      setSaved(published ? t('readings.publishedOn', { date: longDay(selected) }) : t('readings.draftSaved'));
    } catch {
      setError(t('readings.saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setError(null);
    try {
      await deleteReading(poiId, selected);
      setDays((map) => {
        const next = new Map(map ?? []);
        next.delete(selected);
        return next;
      });
    } catch {
      setError(t('readings.saveError'));
    }
  }

  async function saveLink() {
    setLinkSaved(false);
    setLinkError(null);
    try {
      const settings = await updateReadingsSettings(poiId, linkUrl.trim() || null);
      setLinkUrl(settings.linkUrl ?? '');
      setLinkSaved(true);
    } catch {
      setLinkError(t('readings.linkError'));
    }
  }

  const strip = Array.from({ length: STRIP_DAYS }, (_, i) => addDays(start, i));

  return (
    <div>
      <h2>{t('readings.title')}</h2>
      <p className="muted">{t('readings.subtitle')}</p>

      <div className="readings-strip-nav">
        <button
          type="button"
          className="link-button"
          onClick={() => setStart(addDays(start, -7))}
          aria-label={t('readings.earlier')}
        >
          ‹ {t('readings.earlier')}
        </button>
        {start !== today && (
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setStart(today);
              setSelected(today);
            }}
          >
            {t('readings.backToToday')}
          </button>
        )}
        <button type="button" className="link-button" onClick={() => setStart(addDays(start, 7))}>
          {t('readings.later')} ›
        </button>
      </div>
      <div className="readings-strip" role="radiogroup" aria-label={t('readings.pickDay')}>
        {strip.map((key) => {
          const reading = days?.get(key);
          const state = reading ? (reading.published ? 'published' : 'draft') : 'empty';
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={key === selected}
              aria-label={`${longDay(key)}, ${t(`readings.state_${state}`)}`}
              className={`readings-day ${key === selected ? 'readings-day-on' : ''}`}
              onClick={() => setSelected(key)}
            >
              <span className="readings-day-name">{shortDay(key)}</span>
              <span className="readings-day-number">{asDate(key).getDate()}</span>
              <span className={`readings-dot readings-dot-${state}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <p className="field-hint readings-legend">
        <span className="readings-dot readings-dot-published" aria-hidden="true" /> {t('readings.state_published')}
        {'   '}
        <span className="readings-dot readings-dot-draft" aria-hidden="true" /> {t('readings.state_draft')}
      </p>

      {days === null && !error ? (
        <p className="muted">{t('readings.loading')}</p>
      ) : (
        <form
          className="form card"
          onSubmit={(event) => {
            event.preventDefault();
            save(true);
          }}
        >
          <div className="form-row">
            <span>{t('readings.date')}</span>
            <span className="form-row-value">
              {longDay(selected)}
              {current && (
                <span className="field-hint">
                  {' · '}
                  {current.published
                    ? selected <= today
                      ? t('readings.visibleNow')
                      : t('readings.visibleFrom')
                    : t('readings.state_draft')}
                </span>
              )}
            </span>
          </div>

          <label>
            {t('readings.wordLabel')}
            <textarea
              value={draft.word}
              placeholder={t('readings.wordPlaceholder')}
              onChange={(e) => setDraft((d) => ({ ...d, word: e.target.value }))}
            />
          </label>

          {draft.sections.map((section, index) => (
            <Fragment key={index}>
              <div className="form-row readings-section-start">
                <span>{t('readings.textNumber', { number: String(index + 1) })}</span>
                <div className="chips" role="radiogroup" aria-label={t('readings.kindLabel')}>
                  {KINDS.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      role="radio"
                      aria-checked={section.kind === kind}
                      className={`chip ${section.kind === kind ? 'chip-selected' : ''}`}
                      onClick={() => patchSection(index, { kind })}
                    >
                      {t(`readings.kind_${kind}`)}
                    </button>
                  ))}
                </div>
              </div>
              {section.kind === 'other' && (
                <label>
                  {t('readings.customTitle')}
                  <input value={section.title ?? ''} onChange={(e) => patchSection(index, { title: e.target.value })} />
                </label>
              )}
              <label>
                {t('readings.reference')}
                <input
                  value={section.reference ?? ''}
                  placeholder={t('readings.referencePlaceholder')}
                  onChange={(e) => patchSection(index, { reference: e.target.value })}
                />
              </label>
              <label>
                {t('readings.text')}
                <textarea
                  className="readings-text"
                  value={section.text}
                  placeholder={t('readings.textPlaceholder')}
                  onChange={(e) => patchSection(index, { text: e.target.value })}
                />
              </label>
              <div className="form-row">
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setDraft((d) => ({ ...d, sections: d.sections.filter((_, i) => i !== index) }))}
                >
                  {t('readings.removeText')}
                </button>
              </div>
            </Fragment>
          ))}

          <div className="form-row readings-section-start">
            <button
              type="button"
              className="link-button"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  sections: [...d.sections, { kind: 'other', title: null, reference: '', text: '' }],
                }))
              }
            >
              + {t('readings.addText')}
            </button>
          </div>

          <div className="form-row readings-section-start">
            <span>{t('readings.notifyLabel')}</span>
            <div className="chips" role="radiogroup" aria-label={t('readings.notifyLabel')}>
              {[true, false].map((notify) => (
                <button
                  key={String(notify)}
                  type="button"
                  role="radio"
                  aria-checked={draft.notify === notify}
                  className={`chip ${draft.notify === notify ? 'chip-selected' : ''}`}
                  onClick={() => setDraft((d) => ({ ...d, notify }))}
                >
                  {notify ? t('readings.notifyYes') : t('readings.notifyNo')}
                </button>
              ))}
            </div>
            {draft.notify && (
              <input
                type="time"
                className="readings-time"
                aria-label={t('readings.notifyTime')}
                value={draft.notifyAt}
                onChange={(e) => setDraft((d) => ({ ...d, notifyAt: e.target.value || DEFAULT_NOTIFY_AT }))}
              />
            )}
            <span className="field-hint">
              {current?.notifiedAt ? t('readings.notifySent') : t('readings.notifyHint')}
            </span>
          </div>

          <div className="card-actions">
            <button type="submit" className="btn btn-primary" disabled={saving || !hasContent}>
              {current?.published ? t('readings.saveChanges') : t('readings.publish')}
            </button>
            <button type="button" className="btn" disabled={saving || !hasContent} onClick={() => save(false)}>
              {current?.published ? t('readings.unpublish') : t('readings.saveDraft')}
            </button>
            {current && <DestructiveButton label={t('readings.deleteDay')} onConfirm={remove} />}
          </div>
          {saved && <p className="muted">{saved}</p>}
          {error && <p className="error-text">{error}</p>}
        </form>
      )}

      <form
        className="form card"
        onSubmit={(event) => {
          event.preventDefault();
          saveLink();
        }}
      >
        <label>
          {t('readings.linkLabel')}
          <input
            type="url"
            value={linkUrl}
            placeholder="https://www.aelf.org/{date}/romain/messe"
            onChange={(e) => {
              setLinkUrl(e.target.value);
              setLinkSaved(false);
            }}
          />
          <span className="field-hint">{t('readings.linkHint')}</span>
        </label>
        <div className="card-actions">
          <button type="submit" className="btn btn-primary">
            {t('readings.linkSave')}
          </button>
          {linkSaved && <span className="muted">{t('readings.linkSaved')}</span>}
        </div>
        {linkError && <p className="error-text">{linkError}</p>}
      </form>
    </div>
  );
}

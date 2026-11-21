import { useEffect, useState, type FormEvent } from 'react';
import { usePoiId } from '../layout/usePoiId';
import { useI18n } from '../i18n/I18nContext';
import {
  createLivestream,
  deleteLivestream,
  getLivestreams,
  updateLivestream,
} from '../api/livestreams';
import type { Livestream, LivestreamStatus } from '../api/types';
import { Dialog } from '../components/Dialog';
import { MoreMenu } from '../components/Reorder';
import { intlLocale } from '../i18n/translations';
import { hideFromList, useUndo } from '../components/Undo';

const STATUS_OPTIONS: LivestreamStatus[] = ['upcoming', 'live', 'ended'];

export function LivestreamsPage() {
  const poiId = usePoiId();
  const { t, language } = useI18n();
  const [items, setItems] = useState<Livestream[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const statusLabels: Record<LivestreamStatus, string> = {
    upcoming: t('livestreams.statusUpcoming'),
    live: t('livestreams.statusLive'),
    ended: t('livestreams.statusEnded'),
  };

  function load() {
    getLivestreams(poiId)
      .then(setItems)
      .catch(() => setError(t('livestreams.loadError')));
  }

  useEffect(load, [poiId]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !url.trim() || !scheduledAt) return;
    setSubmitting(true);
    try {
      const created = await createLivestream(poiId, {
        title: title.trim(),
        url: url.trim(),
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      setItems((current) =>
        [created, ...(current ?? [])].sort(
          (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
        ),
      );
      setTitle('');
      setUrl('');
      setScheduledAt('');
      setNewOpen(false);
    } catch {
      setError(t('livestreams.createError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(item: Livestream, status: LivestreamStatus) {
    try {
      const updated = await updateLivestream(poiId, item.id, { status });
      setItems((current) => current?.map((s) => (s.id === item.id ? updated : s)) ?? null);
    } catch {
      setError(t('livestreams.statusError'));
    }
  }

  const undo = useUndo();

  function handleDelete(id: string) {
    undo.deleteLater({
      name: items?.find((entry) => entry.id === id)?.title,
      hide: () => hideFromList(setItems, id),
      commit: () => deleteLivestream(poiId, id),
      onError: () => setError(t('livestreams.deleteError')),
    });
  }

  return (
    <div>
      {/* The form opens from a button and the links sit in one list
          (Seb, 21 Nov 2026). */}
      <div className="page-head">
        <div>
          <h2>{t('livestreams.title')}</h2>
          <p className="muted">{t('livestreams.subtitle')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setNewOpen(true)}>
          {t('livestreams.newButton')}
        </button>
      </div>

      <Dialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title={t('livestreams.newButton')}
        closeLabel={t('common.cancel')}
      >
        <form className="form" onSubmit={handleCreate}>
          <label>
            {t('livestreams.titleLabel')}
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label>
            {t('livestreams.urlLabel')}
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              required
            />
          </label>
          <label>
            {t('livestreams.scheduledAtLabel')}
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || !title.trim() || !url.trim() || !scheduledAt}
          >
            {submitting ? t('livestreams.scheduling') : t('livestreams.schedule')}
          </button>
        </form>
      </Dialog>

      {error && <p className="error-text">{error}</p>}
      {items === null && !error && <p className="muted">{t('livestreams.loading')}</p>}

      {items && items.length > 0 && (
        <ul className="card card-list" style={{ listStyle: 'none' }}>
          {items.map((item) => (
            <li key={item.id} className="card-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="card-title" style={{ margin: 0 }}>
                  {item.title}
                </p>
                <p className="card-meta" style={{ margin: 0, overflowWrap: 'anywhere' }}>
                  {new Date(item.scheduledAt).toLocaleString(intlLocale(language), { dateStyle: 'long', timeStyle: 'short' })}
                  {' · '}
                  <a href={item.url} target="_blank" rel="noreferrer">
                    {item.url}
                  </a>
                </p>
              </div>
              <select
                aria-label={t('livestreams.statusLabel', { name: item.title })}
                value={item.status}
                onChange={(e) => handleStatusChange(item, e.target.value as LivestreamStatus)}
                style={{ width: 'auto' }}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
              <MoreMenu
                label={t('reorder.more', { name: item.title })}
                items={[{ label: t('livestreams.delete'), destructive: true, undoable: true, onSelect: () => handleDelete(item.id) }]}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

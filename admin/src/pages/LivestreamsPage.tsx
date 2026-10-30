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
import { DestructiveButton } from '../components/DestructiveButton';

const STATUS_OPTIONS: LivestreamStatus[] = ['upcoming', 'live', 'ended'];

export function LivestreamsPage() {
  const poiId = usePoiId();
  const { t } = useI18n();
  const [items, setItems] = useState<Livestream[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  async function handleDelete(id: string) {
    try {
      await deleteLivestream(poiId, id);
      setItems((current) => current?.filter((s) => s.id !== id) ?? null);
    } catch {
      setError(t('livestreams.deleteError'));
    }
  }

  return (
    <div>
      <h2>{t('livestreams.title')}</h2>
      <p className="muted">{t('livestreams.subtitle')}</p>

      <form className="form card" onSubmit={handleCreate}>
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

      {error && <p className="error-text">{error}</p>}
      {items === null && !error && <p className="muted">{t('livestreams.loading')}</p>}

      <div className="card-grid">
      {items?.map((item) => (
        <div key={item.id} className="card">
          <p className="card-title">{item.title}</p>
          <p>
            <a href={item.url} target="_blank" rel="noreferrer">
              {item.url}
            </a>
          </p>
          <p className="card-meta">{new Date(item.scheduledAt).toLocaleString()}</p>
          <div className="card-actions">
            <select
              value={item.status}
              onChange={(e) => handleStatusChange(item, e.target.value as LivestreamStatus)}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
            <DestructiveButton label={t('livestreams.delete')} onConfirm={() => handleDelete(item.id)} />
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

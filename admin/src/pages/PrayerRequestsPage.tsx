import { useEffect, useState } from 'react';
import { usePoiId } from '../layout/usePoiId';
import { useI18n } from '../i18n/I18nContext';
import { deletePrayerRequest, getPrayerRequests } from '../api/prayerRequests';
import type { PrayerRequest } from '../api/types';
import { DestructiveButton } from '../components/DestructiveButton';

export function PrayerRequestsPage() {
  const poiId = usePoiId();
  const { t } = useI18n();
  const [items, setItems] = useState<PrayerRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    getPrayerRequests(poiId)
      .then(setItems)
      .catch(() => setError(t('prayerRequests.loadError')));
  }

  useEffect(load, [poiId]);

  async function handleDelete(id: string) {
    try {
      await deletePrayerRequest(poiId, id);
      setItems((current) => current?.filter((r) => r.id !== id) ?? null);
    } catch {
      setError(t('prayerRequests.removeError'));
    }
  }

  return (
    <div>
      <h2>{t('prayerRequests.title')}</h2>
      <p className="muted">{t('prayerRequests.subtitle')}</p>

      {error && <p className="error-text">{error}</p>}
      {items === null && !error && <p className="muted">{t('prayerRequests.loading')}</p>}
      {items?.length === 0 && <p className="muted">{t('prayerRequests.empty')}</p>}

      <div className="card-grid">
      {items?.map((item) => (
        <div key={item.id} className="card">
          <p>{item.message}</p>
          <p className="card-meta">
            — {item.authorName ?? t('prayerRequests.anonymous')} · {item.prayerCount}{' '}
            {t('prayerRequests.prayingSuffix')} · {new Date(item.createdAt).toLocaleString()}
          </p>
          <div className="card-actions">
            <DestructiveButton label={t('prayerRequests.remove')} onConfirm={() => handleDelete(item.id)} />
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

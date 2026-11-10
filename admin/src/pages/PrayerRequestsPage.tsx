import { useEffect, useState } from 'react';
import { usePoiId } from '../layout/usePoiId';
import { useI18n } from '../i18n/I18nContext';
import { deletePrayerRequest, getPrayerRequests } from '../api/prayerRequests';
import type { PrayerRequest } from '../api/types';
import { DestructiveButton } from '../components/DestructiveButton';
import { TabBar, TabPanel, useTab } from '../components/Tabs';
import { ReportedPanel } from '../components/ReportedPanel';
import { getReportCount } from '../api/moderation';
import { hideFromList, useUndo } from '../components/Undo';

const TABS = ['requests', 'reported'] as const;

export function PrayerRequestsPage() {
  const poiId = usePoiId();
  const { t } = useI18n();
  const [items, setItems] = useState<PrayerRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useTab(TABS);
  const [reported, setReported] = useState<number | null>(null);

  function load() {
    getPrayerRequests(poiId)
      .then(setItems)
      .catch(() => setError(t('prayerRequests.loadError')));
    getReportCount(poiId)
      .then((c) => setReported(c.prayer))
      .catch(() => setReported(null));
  }

  useEffect(load, [poiId]);

  const undo = useUndo();

  function handleDelete(id: string) {
    undo.deleteLater({
      name: undefined,
      hide: () => hideFromList(setItems, id),
      commit: () => deletePrayerRequest(poiId, id),
      onError: () => setError(t('prayerRequests.removeError')),
    });
  }

  return (
    <div>
      <h2>{t('prayerRequests.title')}</h2>
      <p className="muted">{t('prayerRequests.subtitle')}</p>

      <TabBar
        idPrefix="prayer-requests"
        label={t('tabs.label')}
        current={tab}
        onChange={setTab}
        tabs={[
          { key: 'requests', label: t('moderation.tabPrayers') },
          { key: 'reported', label: t('moderation.tabReported'), count: reported },
        ]}
      />

      <TabPanel idPrefix="prayer-requests" tabKey="reported" current={tab}>
        <ReportedPanel poiId={poiId} area="prayer" onChanged={load} />
      </TabPanel>

      <TabPanel idPrefix="prayer-requests" tabKey="requests" current={tab}>
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
      </TabPanel>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { getPoi } from '../api/pois';
import type { Poi } from '../api/types';
import { AccountPanel } from './AccountPanel';
import { ContentLanguageCard } from './CommunityInfoCards';
import { TourResetCard } from './TourResetCard';

/**
 * Dashboard › Account (Seb, 10 Nov 2026, when Settings went away): the
 * language the community writes in, the tour and tips, the data export
 * and closing the account.
 */
export function DashboardAccountTab({ poiId }: { poiId: string }) {
  const [poi, setPoi] = useState<Poi | null>(null);

  useEffect(() => {
    setPoi(null);
    getPoi(poiId)
      .then(setPoi)
      .catch(() => {});
  }, [poiId]);

  if (!poi) return null;
  return (
    <>
      <ContentLanguageCard key={`language-${poi.id}`} poi={poi} onSaved={setPoi} />
      <TourResetCard />
      <AccountPanel key={poi.id} poi={poi} />
    </>
  );
}

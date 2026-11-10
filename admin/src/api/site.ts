import { apiGet, apiPatch } from './client';

export const SITE_PARTS = ['home', 'badges', 'timetable', 'events', 'news', 'campaign', 'map'] as const;
export type SitePart = (typeof SITE_PARTS)[number];

export type SiteSettings = { slug: string; published: boolean; hidden: SitePart[]; url: string };

const base = (poiId: string) => `/pois/${encodeURIComponent(poiId)}/site`;

export const getSite = (poiId: string) => apiGet<SiteSettings>(base(poiId));
export const updateSite = (poiId: string, patch: Partial<Pick<SiteSettings, 'slug' | 'published' | 'hidden'>>) =>
  apiPatch<SiteSettings>(base(poiId), patch);

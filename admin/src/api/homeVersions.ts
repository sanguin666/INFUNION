import { apiDelete, apiGet, apiPatch, apiPost } from './client';

export type HomeVersion = {
  id: string;
  name: string;
  auto: boolean;
  live: boolean;
  sections: { type: string; title: string | null }[];
  badges: number;
  important: boolean;
  createdAt: string;
  updatedAt: string;
};

const base = (poiId: string) => `/pois/${encodeURIComponent(poiId)}/page-versions`;

export const getHomeVersions = (poiId: string) => apiGet<{ versions: HomeVersion[]; max: number }>(base(poiId));
export const saveHomeVersion = (poiId: string, name: string) => apiPost<HomeVersion>(base(poiId), { name });
export const switchHomeVersion = (poiId: string, id: string) => apiPost<HomeVersion>(`${base(poiId)}/${id}/use`);
export const renameHomeVersion = (poiId: string, id: string, name: string) =>
  apiPatch<HomeVersion>(`${base(poiId)}/${id}`, { name });
export const deleteHomeVersion = (poiId: string, id: string) => apiDelete<void>(`${base(poiId)}/${id}`);

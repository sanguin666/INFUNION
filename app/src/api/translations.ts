import { apiPost } from './client';

export type TranslatableKind = 'post' | 'comment' | 'prayer' | 'announcement' | 'event';

export type Translation = {
  id: string;
  sourceLanguage: string;
  alreadyInTarget: boolean;
  fields: Record<string, string>;
};

/** The language each text is written in (ISO 639-1, "ca" for Valencian too). */
export function getContentLanguages(
  poiId: string,
  body: { kind: TranslatableKind; ids: string[] },
): Promise<Record<string, string>> {
  return apiPost(`/pois/${encodeURIComponent(poiId)}/translations/languages`, body);
}

export function translateContent(
  poiId: string,
  body: { kind: TranslatableKind; ids: string[]; language: string },
): Promise<Translation[]> {
  return apiPost(`/pois/${encodeURIComponent(poiId)}/translations`, body);
}

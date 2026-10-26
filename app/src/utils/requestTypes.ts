import type { RequestType } from '../api/requests';
import type { PoiType } from '../api/types';
import type { Translations } from '../i18n/translations';

type RequestsKey = `requests.${Extract<keyof Translations['requests'], string>}`;

// In the order people ask for them most. A church is asked for
// sacraments; every other kind of place (an association, a club) for
// sign-ups, appointments and documents (Seb, 26 Oct 2026).
const CHURCH_TYPES: RequestType[] = [
  'baptism',
  'wedding',
  'funeral',
  'certificate',
  'meeting',
  'first_communion',
  'confirmation',
  'sick_visit',
  'blessing',
  'other',
];
const GENERAL_TYPES: RequestType[] = ['registration', 'meeting', 'certificate', 'other'];

export function requestTypesFor(poiType: PoiType): RequestType[] {
  return poiType === 'church' ? CHURCH_TYPES : GENERAL_TYPES;
}

/** The translation key naming a request type at this kind of place. */
export function requestTypeKey(type: RequestType, poiType: PoiType): RequestsKey {
  if (poiType !== 'church') {
    if (type === 'meeting') return 'requests.type_meeting_team';
    if (type === 'certificate') return 'requests.type_certificate_doc';
  }
  return `requests.type_${type}`;
}

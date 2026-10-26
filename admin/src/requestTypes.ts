import type { useI18n } from './i18n/I18nContext';
import type { ServiceRequestType } from './api/types';

type T = ReturnType<typeof useI18n>['t'];

// What a member asked for, in the dashboard's language. Shared by the
// Requests page and the first page's to-do list.
export function typeName(type: ServiceRequestType, t: T): string {
  switch (type) {
    case 'baptism':
      return t('requests.typeBaptism');
    case 'wedding':
      return t('requests.typeWedding');
    case 'funeral':
      return t('requests.typeFuneral');
    case 'first_communion':
      return t('requests.typeFirstCommunion');
    case 'confirmation':
      return t('requests.typeConfirmation');
    case 'certificate':
      return t('requests.typeCertificate');
    case 'meeting':
      return t('requests.typeMeeting');
    case 'blessing':
      return t('requests.typeBlessing');
    case 'sick_visit':
      return t('requests.typeSickVisit');
    case 'registration':
      return t('requests.typeRegistration');
    case 'other':
      return t('requests.typeOther');
  }
}

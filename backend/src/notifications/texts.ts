import { intlLocale, Language } from '../common/enums/language.enum.js';
import { ServiceRequestStatus, ServiceRequestType } from '../service-requests/entities/service-request.entity.js';

/**
 * The words notifications are written in. The backend writes them because
 * a push is shown by the phone itself, with the app closed. Only the
 * frame is translated: what the office wrote (a news title, a reply)
 * goes out as written.
 */
const TEXTS = {
  en: {
    live: 'Live now: {title}',
    readingsReady: 'Today’s readings are here.',
    inOneHour: 'In 1 hour: {title}',
    requestTitle: 'Your request: {type}',
    officeReplied: 'The office replied: “{body}”',
    officeSentFile: 'The office sent you a file.',
    appointment: 'Appointment: {when}',
    statusNow: 'Your request is now: {status}',
    documentAsked: 'The office is asking for a document: {label}',
    messageFrom: '{name}: {body}',
    office: 'The office',
    monthlyGiftFailed: 'Your monthly gift of {amount} didn’t go through. Open the app to update your card.',
    monthlyGiftCardExpiring: 'The card for your monthly gift of {amount} expires before the next payment. Open the app to update it.',
  },
  es: {
    live: 'En directo: {title}',
    readingsReady: 'Ya están las lecturas de hoy.',
    inOneHour: 'Dentro de 1 hora: {title}',
    requestTitle: 'Tu solicitud: {type}',
    officeReplied: 'La oficina ha respondido: «{body}»',
    officeSentFile: 'La oficina te ha enviado un archivo.',
    appointment: 'Cita: {when}',
    statusNow: 'Tu solicitud está ahora: {status}',
    documentAsked: 'La oficina te pide un documento: {label}',
    messageFrom: '{name}: {body}',
    office: 'La oficina',
    monthlyGiftFailed: 'Tu donativo mensual de {amount} no se ha podido cobrar. Abre la aplicación para actualizar tu tarjeta.',
    monthlyGiftCardExpiring: 'La tarjeta de tu donativo mensual de {amount} caduca antes del próximo cobro. Abre la aplicación para actualizarla.',
  },
  fr: {
    live: 'En direct : {title}',
    readingsReady: 'Les lectures du jour sont disponibles.',
    inOneHour: 'Dans 1 heure : {title}',
    requestTitle: 'Votre demande : {type}',
    officeReplied: 'L’accueil a répondu : « {body} »',
    officeSentFile: 'L’accueil vous a envoyé un fichier.',
    appointment: 'Rendez-vous : {when}',
    statusNow: 'Votre demande est maintenant : {status}',
    documentAsked: 'L’accueil vous demande un document : {label}',
    messageFrom: '{name} : {body}',
    office: 'L’accueil',
    monthlyGiftFailed: 'Votre don mensuel de {amount} n’a pas pu être prélevé. Ouvrez l’application pour mettre à jour votre carte.',
    monthlyGiftCardExpiring: 'La carte de votre don mensuel de {amount} expire avant le prochain prélèvement. Ouvrez l’application pour la mettre à jour.',
  },
  va: {
    live: 'En directe: {title}',
    readingsReady: 'Ja estan les lectures de hui.',
    inOneHour: 'D’ací a 1 hora: {title}',
    requestTitle: 'La teua sol·licitud: {type}',
    officeReplied: 'El despatx ha respost: «{body}»',
    officeSentFile: 'El despatx t’ha enviat un fitxer.',
    appointment: 'Cita: {when}',
    statusNow: 'La teua sol·licitud ara està: {status}',
    documentAsked: 'El despatx et demana un document: {label}',
    messageFrom: '{name}: {body}',
    office: 'El despatx',
    monthlyGiftFailed: 'El teu donatiu mensual de {amount} no s’ha pogut cobrar. Obri l’aplicació per a actualitzar la teua targeta.',
    monthlyGiftCardExpiring: 'La targeta del teu donatiu mensual de {amount} caduca abans del pròxim cobrament. Obri l’aplicació per a actualitzar-la.',
  },
  gl: {
    live: 'En directo: {title}',
    readingsReady: 'Xa están as lecturas de hoxe.',
    inOneHour: 'Dentro de 1 hora: {title}',
    requestTitle: 'A túa solicitude: {type}',
    officeReplied: 'O despacho respondeu: «{body}»',
    officeSentFile: 'O despacho enviouche un ficheiro.',
    appointment: 'Cita: {when}',
    statusNow: 'A túa solicitude está agora: {status}',
    documentAsked: 'O despacho pídeche un documento: {label}',
    messageFrom: '{name}: {body}',
    office: 'O despacho',
    monthlyGiftFailed: 'Non se puido cobrar a túa doazón mensual de {amount}. Abre a aplicación para actualizar a túa tarxeta.',
    monthlyGiftCardExpiring: 'A tarxeta da túa doazón mensual de {amount} caduca antes do próximo cobro. Abre a aplicación para actualizala.',
  },
  pt: {
    live: 'Em direto: {title}',
    readingsReady: 'As leituras de hoje já estão disponíveis.',
    inOneHour: 'Daqui a 1 hora: {title}',
    requestTitle: 'O seu pedido: {type}',
    officeReplied: 'A secretaria respondeu: «{body}»',
    officeSentFile: 'A secretaria enviou-lhe um ficheiro.',
    appointment: 'Marcação: {when}',
    statusNow: 'O seu pedido está agora: {status}',
    documentAsked: 'A secretaria pede-lhe um documento: {label}',
    messageFrom: '{name}: {body}',
    office: 'A secretaria',
    monthlyGiftFailed: 'Não foi possível cobrar o seu donativo mensal de {amount}. Abra a aplicação para atualizar o seu cartão.',
    monthlyGiftCardExpiring: 'O cartão do seu donativo mensal de {amount} expira antes do próximo pagamento. Abra a aplicação para o atualizar.',
  },
} satisfies Record<Language, Record<string, string>>;

const REQUEST_TYPES: Record<Language, Record<ServiceRequestType, string>> = {
  en: {
    baptism: 'Baptism', wedding: 'Wedding', funeral: 'Funeral', first_communion: 'First Communion',
    confirmation: 'Confirmation', certificate: 'Certificate', meeting: 'Meeting', blessing: 'Blessing',
    sick_visit: 'Visit to a sick person', other: 'Other request', registration: 'Registration',
  },
  es: {
    baptism: 'Bautizo', wedding: 'Boda', funeral: 'Funeral', first_communion: 'Primera Comunión',
    confirmation: 'Confirmación', certificate: 'Certificado', meeting: 'Cita', blessing: 'Bendición',
    sick_visit: 'Visita a un enfermo', other: 'Otra solicitud', registration: 'Inscripción',
  },
  fr: {
    baptism: 'Baptême', wedding: 'Mariage', funeral: 'Obsèques', first_communion: 'Première communion',
    confirmation: 'Confirmation', certificate: 'Certificat', meeting: 'Rendez-vous', blessing: 'Bénédiction',
    sick_visit: 'Visite à un malade', other: 'Autre demande', registration: 'Inscription',
  },
  va: {
    baptism: 'Bateig', wedding: 'Boda', funeral: 'Funeral', first_communion: 'Primera Comunió',
    confirmation: 'Confirmació', certificate: 'Certificat', meeting: 'Cita', blessing: 'Benedicció',
    sick_visit: 'Visita a un malalt', other: 'Una altra sol·licitud', registration: 'Inscripció',
  },
  gl: {
    baptism: 'Bautizo', wedding: 'Voda', funeral: 'Funeral', first_communion: 'Primeira Comuñón',
    confirmation: 'Confirmación', certificate: 'Certificado', meeting: 'Cita', blessing: 'Bendición',
    sick_visit: 'Visita a un enfermo', other: 'Outra solicitude', registration: 'Inscrición',
  },
  pt: {
    baptism: 'Batismo', wedding: 'Casamento', funeral: 'Funeral', first_communion: 'Primeira Comunhão',
    confirmation: 'Crisma', certificate: 'Certificado', meeting: 'Marcação', blessing: 'Bênção',
    sick_visit: 'Visita a um doente', other: 'Outro pedido', registration: 'Inscrição',
  },
};

const REQUEST_STATUSES: Record<Language, Record<ServiceRequestStatus, string>> = {
  en: { received: 'received', in_progress: 'in progress', appointment_set: 'appointment set', completed: 'done', cancelled: 'cancelled' },
  es: { received: 'recibida', in_progress: 'en curso', appointment_set: 'cita fijada', completed: 'terminada', cancelled: 'cancelada' },
  fr: { received: 'reçue', in_progress: 'en cours', appointment_set: 'rendez-vous fixé', completed: 'terminée', cancelled: 'annulée' },
  va: { received: 'rebuda', in_progress: 'en curs', appointment_set: 'cita fixada', completed: 'acabada', cancelled: 'cancel·lada' },
  gl: { received: 'recibida', in_progress: 'en curso', appointment_set: 'cita fixada', completed: 'rematada', cancelled: 'cancelada' },
  pt: { received: 'recebido', in_progress: 'em curso', appointment_set: 'marcação feita', completed: 'concluído', cancelled: 'cancelado' },
};

export function text(
  language: Language,
  key: keyof (typeof TEXTS)['en'],
  params: Record<string, string> = {},
): string {
  const template = (TEXTS[language] ?? TEXTS.en)[key];
  return template.replace(/\{(\w+)\}/g, (_, name: string) => params[name] ?? '');
}

export function requestTypeLabel(language: Language, type: ServiceRequestType): string {
  return (REQUEST_TYPES[language] ?? REQUEST_TYPES.en)[type] ?? type;
}

export function requestStatusLabel(language: Language, status: ServiceRequestStatus): string {
  return (REQUEST_STATUSES[language] ?? REQUEST_STATUSES.en)[status] ?? status;
}

/** "Sun 27 Sep, 12:00" in the reader's language and time zone. */
export function formatWhen(date: Date, language: Language, timeZone?: string | null): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  };
  try {
    return date.toLocaleString(intlLocale(language), { ...options, timeZone: timeZone ?? undefined });
  } catch {
    // An unknown time zone name: fall back to the server's clock rather than fail.
    return date.toLocaleString(intlLocale(language), options);
  }
}

/** "12:00" in the reader's language and time zone. */
export function formatTime(date: Date, language: Language, timeZone?: string | null): string {
  try {
    return date.toLocaleTimeString(intlLocale(language), { hour: '2-digit', minute: '2-digit', timeZone: timeZone ?? undefined });
  } catch {
    return date.toLocaleTimeString(intlLocale(language), { hour: '2-digit', minute: '2-digit' });
  }
}

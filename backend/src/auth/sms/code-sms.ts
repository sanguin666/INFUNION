import { Language } from '../../common/enums/language.enum.js';

// The app's seven languages; short enough for one SMS.
const TEXTS: Record<Language, string> = {
  [Language.EN]: '{{code}} is your infunion code. It works for 10 minutes.',
  [Language.ES]: '{{code}} es tu código de infunion. Válido durante 10 minutos.',
  [Language.FR]: '{{code}} est votre code infunion. Valable 10 minutes.',
  [Language.VA]: '{{code}} és el teu codi d’infunion. Vàlid durant 10 minuts.',
  [Language.CA]: '{{code}} és el teu codi d’infunion. Vàlid durant 10 minuts.',
  [Language.GL]: '{{code}} é o teu código de infunion. Válido durante 10 minutos.',
  [Language.PT]: '{{code}} é o seu código infunion. Válido durante 10 minutos.',
};

/** The sign-in code SMS, in the language the app is shown in. */
export function codeSms(code: string, language?: string): string {
  return (TEXTS[language as Language] ?? TEXTS[Language.EN]).replace('{{code}}', code);
}

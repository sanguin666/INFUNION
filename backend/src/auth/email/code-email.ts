import { Language } from '../../common/enums/language.enum.js';
import type { EmailMessage } from './email-sender.js';
import {
  emailCode,
  emailHeading,
  emailLayout,
  emailParagraph,
} from '../../common/email/email-layout.js';

type CodeEmailText = {
  subject: string;
  heading: string;
  intro: string;
  expiry: string;
  ignore: string;
};

// The app's seven languages. `{{code}}` is replaced in the subject so the
// code can be read straight from the notification without opening it.
const TEXTS: Record<Language, CodeEmailText> = {
  [Language.EN]: {
    subject: '{{code}} is your infunion code',
    heading: 'Your sign-in code',
    intro: 'Here is your code to sign in to infunion:',
    expiry: 'It works for 10 minutes.',
    ignore: 'If you didn’t ask for it, you can ignore this email.',
  },
  [Language.ES]: {
    subject: '{{code}} es tu código de infunion',
    heading: 'Tu código de acceso',
    intro: 'Este es tu código para entrar en infunion:',
    expiry: 'Es válido durante 10 minutos.',
    ignore: 'Si no lo has pedido, puedes ignorar este correo.',
  },
  [Language.FR]: {
    subject: '{{code}} est votre code infunion',
    heading: 'Votre code de connexion',
    intro: 'Voici votre code pour vous connecter à infunion :',
    expiry: 'Il est valable 10 minutes.',
    ignore: 'Si vous ne l’avez pas demandé, vous pouvez ignorer cet e-mail.',
  },
  [Language.VA]: {
    subject: '{{code}} és el teu codi d’infunion',
    heading: 'El teu codi d’accés',
    intro: 'Este és el teu codi per a entrar en infunion:',
    expiry: 'És vàlid durant 10 minuts.',
    ignore: 'Si no l’has demanat, pots ignorar este correu.',
  },
  [Language.CA]: {
    subject: '{{code}} és el teu codi d’infunion',
    heading: 'El teu codi d’accés',
    intro: 'Aquest és el teu codi per entrar en infunion:',
    expiry: 'És vàlid durant 10 minuts.',
    ignore: 'Si no l’has demanat, pots ignorar aquest correu.',
  },
  [Language.GL]: {
    subject: '{{code}} é o teu código de infunion',
    heading: 'O teu código de acceso',
    intro: 'Este é o teu código para entrar en infunion:',
    expiry: 'É válido durante 10 minutos.',
    ignore: 'Se non o pediches, podes ignorar este correo.',
  },
  [Language.PT]: {
    subject: '{{code}} é o seu código infunion',
    heading: 'O seu código de acesso',
    intro: 'Este é o seu código para entrar no infunion:',
    expiry: 'É válido durante 10 minutos.',
    ignore: 'Se não o pediu, pode ignorar este email.',
  },
};

/** The sign-in code email, in the language the app is shown in. */
export function codeEmail(
  to: string,
  code: string,
  language?: string,
): EmailMessage {
  const text = TEXTS[language as Language] ?? TEXTS[Language.EN];
  return {
    to,
    subject: text.subject.replace('{{code}}', code),
    text: `${text.intro}\n\n${code}\n\n${text.expiry}\n${text.ignore}\n`,
    html: emailLayout(
      [
        emailHeading(text.heading),
        emailParagraph(text.intro, { muted: true }),
        emailCode(code),
        emailParagraph(`${text.expiry}\n${text.ignore}`, {
          muted: true,
          small: true,
        }),
      ].join(''),
      language,
    ),
  };
}

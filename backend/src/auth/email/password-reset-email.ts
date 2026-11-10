import { Language } from '../../common/enums/language.enum.js';
import type { EmailMessage } from './email-sender.js';
import {
  emailButton,
  emailHeading,
  emailLayout,
  emailParagraph,
  emailText,
} from '../../common/email/email-layout.js';

type ResetEmailText = {
  subject: string;
  heading: string;
  intro: string;
  button: string;
  expiry: string;
  ignore: string;
};

// The dashboard's seven languages (Seb, 5 Nov 2026). Same email for a
// community admin and for the superadmin.
const TEXTS: Record<Language, ResetEmailText> = {
  [Language.EN]: {
    subject: 'Choose a new infunion password',
    heading: 'Reset your password',
    intro:
      'Someone asked to reset the password of the infunion dashboard account {{email}}. If it was you, choose a new one here:',
    button: 'Choose a new password',
    expiry: 'The link works for one hour and only once.',
    ignore:
      'If you didn’t ask for it, ignore this email: your password stays the same.',
  },
  [Language.ES]: {
    subject: 'Elige una nueva contraseña de infunion',
    heading: 'Restablecer la contraseña',
    intro:
      'Alguien ha pedido restablecer la contraseña de la cuenta de administración de infunion {{email}}. Si has sido tú, elige una nueva aquí:',
    button: 'Elegir una nueva contraseña',
    expiry: 'El enlace funciona durante una hora y una sola vez.',
    ignore:
      'Si no lo has pedido, ignora este correo: tu contraseña no cambia.',
  },
  [Language.FR]: {
    subject: 'Choisissez un nouveau mot de passe infunion',
    heading: 'Réinitialiser le mot de passe',
    intro:
      'Quelqu’un a demandé à réinitialiser le mot de passe du compte d’administration infunion {{email}}. Si c’est vous, choisissez-en un nouveau ici :',
    button: 'Choisir un nouveau mot de passe',
    expiry: 'Le lien est valable une heure et une seule fois.',
    ignore:
      'Si vous ne l’avez pas demandé, ignorez cet e-mail : votre mot de passe reste le même.',
  },
  [Language.VA]: {
    subject: 'Tria una contrasenya nova d’infunion',
    heading: 'Restablir la contrasenya',
    intro:
      'Algú ha demanat restablir la contrasenya del compte d’administració d’infunion {{email}}. Si has sigut tu, tria’n una de nova ací:',
    button: 'Triar una contrasenya nova',
    expiry: 'L’enllaç funciona durant una hora i una sola vegada.',
    ignore:
      'Si no l’has demanat, ignora este correu: la contrasenya no canvia.',
  },
  [Language.CA]: {
    subject: 'Tria una contrasenya nova d’infunion',
    heading: 'Restablir la contrasenya',
    intro:
      'Algú ha demanat restablir la contrasenya del compte d’administració d’infunion {{email}}. Si has estat tu, tria’n una de nova aquí:',
    button: 'Triar una contrasenya nova',
    expiry: 'L’enllaç funciona durant una hora i una sola vegada.',
    ignore:
      'Si no l’has demanat, ignora aquest correu: la contrasenya no canvia.',
  },
  [Language.GL]: {
    subject: 'Escolle un contrasinal novo de infunion',
    heading: 'Restablecer o contrasinal',
    intro:
      'Alguén pediu restablecer o contrasinal da conta de administración de infunion {{email}}. Se fuches ti, escolle un novo aquí:',
    button: 'Escoller un contrasinal novo',
    expiry: 'A ligazón funciona durante unha hora e unha soa vez.',
    ignore:
      'Se non o pediches, ignora este correo: o teu contrasinal non cambia.',
  },
  [Language.PT]: {
    subject: 'Escolha uma nova palavra-passe infunion',
    heading: 'Repor a palavra-passe',
    intro:
      'Alguém pediu para repor a palavra-passe da conta de administração infunion {{email}}. Se foi você, escolha uma nova aqui:',
    button: 'Escolher uma nova palavra-passe',
    expiry: 'A ligação funciona durante uma hora e uma única vez.',
    ignore:
      'Se não o pediu, ignore este email: a sua palavra-passe mantém-se.',
  },
};

/** The "forgot password" email with its one-hour link. */
export function passwordResetEmail(
  to: string,
  link: string,
  language?: string,
): EmailMessage {
  const text = TEXTS[language as Language] ?? TEXTS[Language.EN];
  const intro = text.intro.replace('{{email}}', to);
  return {
    to,
    subject: text.subject,
    text: emailText(`${intro}\n\n${link}\n\n${text.expiry}\n${text.ignore}`, language),
    html: emailLayout(
      [
        emailHeading(text.heading),
        emailParagraph(intro, { muted: true }),
        emailButton(text.button, link),
        emailParagraph(`${text.expiry}\n${text.ignore}`, {
          muted: true,
          small: true,
        }),
      ].join(''),
      language,
    ),
  };
}

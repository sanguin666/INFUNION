import { Language } from '../../common/enums/language.enum.js';
import type { EmailMessage } from './email-sender.js';

type CodeEmailText = {
  subject: string;
  intro: string;
  expiry: string;
  ignore: string;
};

// The app's six languages. `{{code}}` is replaced in the subject so the
// code can be read straight from the notification without opening it.
const TEXTS: Record<Language, CodeEmailText> = {
  [Language.EN]: {
    subject: '{{code}} is your infunion code',
    intro: 'Here is your code to sign in to infunion:',
    expiry: 'It works for 10 minutes.',
    ignore: 'If you didn’t ask for it, you can ignore this email.',
  },
  [Language.ES]: {
    subject: '{{code}} es tu código de infunion',
    intro: 'Este es tu código para entrar en infunion:',
    expiry: 'Es válido durante 10 minutos.',
    ignore: 'Si no lo has pedido, puedes ignorar este correo.',
  },
  [Language.FR]: {
    subject: '{{code}} est votre code infunion',
    intro: 'Voici votre code pour vous connecter à infunion :',
    expiry: 'Il est valable 10 minutes.',
    ignore: 'Si vous ne l’avez pas demandé, vous pouvez ignorer cet e-mail.',
  },
  [Language.VA]: {
    subject: '{{code}} és el teu codi d’infunion',
    intro: 'Este és el teu codi per a entrar en infunion:',
    expiry: 'És vàlid durant 10 minuts.',
    ignore: 'Si no l’has demanat, pots ignorar este correu.',
  },
  [Language.GL]: {
    subject: '{{code}} é o teu código de infunion',
    intro: 'Este é o teu código para entrar en infunion:',
    expiry: 'É válido durante 10 minutos.',
    ignore: 'Se non o pediches, podes ignorar este correo.',
  },
  [Language.PT]: {
    subject: '{{code}} é o seu código infunion',
    intro: 'Este é o seu código para entrar no infunion:',
    expiry: 'É válido durante 10 minutos.',
    ignore: 'Se não o pediu, pode ignorar este email.',
  },
};

/** The sign-in code email, in the language the app is shown in. */
export function codeEmail(to: string, code: string, language?: string): EmailMessage {
  const text = TEXTS[language as Language] ?? TEXTS[Language.EN];
  return {
    to,
    subject: text.subject.replace('{{code}}', code),
    text: `${text.intro}\n\n${code}\n\n${text.expiry}\n${text.ignore}\n`,
    html: `<!doctype html><html><body style="margin:0;padding:24px;background:#F6F5F9;font-family:Arial,Helvetica,sans-serif;color:#1D1A2D">
<div style="max-width:420px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
<p style="margin:0 0 4px;font-size:20px;font-weight:bold">in<span style="color:#6C4FD9">fun</span>ion</p>
<p style="font-size:16px;line-height:1.5">${text.intro}</p>
<p style="font-size:34px;letter-spacing:8px;font-weight:bold;color:#6C4FD9;margin:16px 0">${code}</p>
<p style="font-size:14px;line-height:1.5;color:#5b5870">${text.expiry}<br>${text.ignore}</p>
</div></body></html>`,
  };
}

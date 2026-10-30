import { Language } from '../common/enums/language.enum.js';
import type { EmailMessage } from '../auth/email/email-sender.js';

/**
 * The emails a registration request sends, in the six languages, written
 * to the person who registered their place. `{{name}}` style fields are
 * filled by `fill`. Plain text first; the HTML is the same text in
 * paragraphs, so both always say the same thing.
 */
type Texts = {
  receivedSubject: string;
  received: string[];
  readySubject: string;
  ready: string[];
  readyPassword: string;
  readyExisting: string;
  readyButton: string;
  questionSubject: string;
  questionIntro: string;
  questionOutro: string;
  declinedSubject: string;
  declinedIntro: string;
  declinedOutro: string;
  withdrawInfo: string;
  withdrawnSubject: string;
  withdrawn: string;
  withdrawnOpen: string;
  hello: string;
  signature: string;
};

const TEXTS: Record<Language, Texts> = {
  [Language.EN]: {
    receivedSubject: 'We have received the request for {{place}}',
    received: [
      'Thank you for registering {{place}} on infunion.',
      'We check every place before opening it, usually within 2 working days. We may call or email you.',
      'You signed the Terms of service for places ({{terms}}) and the Data processing agreement ({{dpa}}) as {{signed}} on {{date}}.',
    ],
    readySubject: '{{place}} is ready on infunion',
    ready: ['We checked your place and your dashboard is open.'],
    readyPassword: 'Sign in with {{email}} and this temporary password: {{password}}. Change it in your profile after signing in.',
    readyExisting: 'Sign in with {{email}} as usual: {{place}} is now in your list of places.',
    readyButton: 'Open my dashboard',
    questionSubject: 'A question about {{place}}',
    questionIntro: 'Before we open {{place}}, we need one more thing from you:',
    questionOutro: 'Just write to {{contact}}.',
    declinedSubject: 'Your request for {{place}}',
    declinedIntro: 'We are sorry, we cannot open {{place}} on infunion:',
    declinedOutro: 'If you think this is a mistake, write to {{contact}}.',
    withdrawInfo: 'You can withdraw from this contract within 14 days of our approval, or at any time before it, without giving a reason: {{withdrawUrl}}',
    withdrawnSubject: 'You have withdrawn the request for {{place}}',
    withdrawn: 'We have received your withdrawal from the contract for {{place}} on {{date}}. Nothing is due.',
    withdrawnOpen: "Your dashboard for {{place}} is closed and its plan is stopped within 2 working days. Members' data is deleted as the Data processing agreement says.",
    hello: 'Hello {{first}},',
    signature: 'The infunion team',
  },
  [Language.ES]: {
    receivedSubject: 'Hemos recibido la solicitud de {{place}}',
    received: [
      'Gracias por registrar {{place}} en infunion.',
      'Revisamos cada lugar antes de abrirlo, normalmente en 2 días laborables. Puede que te llamemos o te escribamos.',
      'Firmaste las Condiciones del servicio para lugares ({{terms}}) y el Acuerdo de tratamiento de datos ({{dpa}}) como {{signed}} el {{date}}.',
    ],
    readySubject: '{{place}} ya está en infunion',
    ready: ['Hemos revisado tu lugar y tu panel ya está abierto.'],
    readyPassword: 'Entra con {{email}} y esta contraseña provisional: {{password}}. Cámbiala en tu perfil después de entrar.',
    readyExisting: 'Entra con {{email}} como siempre: {{place}} ya aparece en tu lista de lugares.',
    readyButton: 'Abrir mi panel',
    questionSubject: 'Una pregunta sobre {{place}}',
    questionIntro: 'Antes de abrir {{place}}, necesitamos algo más:',
    questionOutro: 'Basta con escribir a {{contact}}.',
    declinedSubject: 'Tu solicitud para {{place}}',
    declinedIntro: 'Lo sentimos, no podemos abrir {{place}} en infunion:',
    declinedOutro: 'Si crees que es un error, escribe a {{contact}}.',
    withdrawInfo: 'Puedes desistir de este contrato en los 14 días siguientes a nuestra aprobación, o en cualquier momento antes, sin dar ningún motivo: {{withdrawUrl}}',
    withdrawnSubject: 'Has desistido de la solicitud de {{place}}',
    withdrawn: 'Hemos recibido tu desistimiento del contrato de {{place}} el {{date}}. No tienes nada que pagar.',
    withdrawnOpen: 'Cerramos el panel de {{place}} y paramos su plan en 2 días laborables. Los datos de los miembros se borran como dice el Acuerdo de tratamiento de datos.',
    hello: 'Hola, {{first}}:',
    signature: 'El equipo de infunion',
  },
  [Language.FR]: {
    receivedSubject: 'Nous avons bien reçu la demande pour {{place}}',
    received: [
      'Merci d’avoir inscrit {{place}} sur infunion.',
      'Nous vérifions chaque lieu avant de l’ouvrir, en général sous 2 jours ouvrés. Nous pourrons vous appeler ou vous écrire.',
      'Vous avez signé les Conditions de service pour les lieux ({{terms}}) et l’Accord de traitement des données ({{dpa}}) au nom de {{signed}} le {{date}}.',
    ],
    readySubject: '{{place}} est prêt sur infunion',
    ready: ['Nous avons vérifié votre lieu : votre tableau de bord est ouvert.'],
    readyPassword: 'Connectez-vous avec {{email}} et ce mot de passe provisoire : {{password}}. Changez-le dans votre profil une fois connecté.',
    readyExisting: 'Connectez-vous avec {{email}} comme d’habitude : {{place}} est maintenant dans votre liste de lieux.',
    readyButton: 'Ouvrir mon tableau de bord',
    questionSubject: 'Une question sur {{place}}',
    questionIntro: 'Avant d’ouvrir {{place}}, il nous manque une chose :',
    questionOutro: 'Il suffit d’écrire à {{contact}}.',
    declinedSubject: 'Votre demande pour {{place}}',
    declinedIntro: 'Nous sommes désolés, nous ne pouvons pas ouvrir {{place}} sur infunion :',
    declinedOutro: 'Si vous pensez qu’il s’agit d’une erreur, écrivez à {{contact}}.',
    withdrawInfo: 'Vous pouvez vous rétracter de ce contrat dans les 14 jours suivant notre validation, ou à tout moment avant, sans donner de motif : {{withdrawUrl}}',
    withdrawnSubject: 'Vous avez retiré la demande pour {{place}}',
    withdrawn: 'Nous avons bien reçu votre rétractation du contrat pour {{place}} le {{date}}. Vous n’avez rien à payer.',
    withdrawnOpen: 'Nous fermons le tableau de bord de {{place}} et arrêtons son offre sous 2 jours ouvrés. Les données des membres sont supprimées comme le prévoit l’Accord de traitement des données.',
    hello: 'Bonjour {{first}},',
    signature: 'L’équipe infunion',
  },
  [Language.VA]: {
    receivedSubject: 'Hem rebut la sol·licitud de {{place}}',
    received: [
      'Gràcies per registrar {{place}} en infunion.',
      'Revisem cada lloc abans d’obrir-lo, normalment en 2 dies laborables. És possible que et cridem o t’escrivim.',
      'Vas signar les Condicions del servici per a llocs ({{terms}}) i l’Acord de tractament de dades ({{dpa}}) com a {{signed}} el {{date}}.',
    ],
    readySubject: '{{place}} ja està en infunion',
    ready: ['Hem revisat el teu lloc i el teu panell ja està obert.'],
    readyPassword: 'Entra amb {{email}} i esta contrasenya provisional: {{password}}. Canvia-la en el teu perfil després d’entrar.',
    readyExisting: 'Entra amb {{email}} com sempre: {{place}} ja apareix en la teua llista de llocs.',
    readyButton: 'Obrir el meu panell',
    questionSubject: 'Una pregunta sobre {{place}}',
    questionIntro: 'Abans d’obrir {{place}}, necessitem una cosa més:',
    questionOutro: 'Només cal que escrigues a {{contact}}.',
    declinedSubject: 'La teua sol·licitud per a {{place}}',
    declinedIntro: 'Ho sentim, no podem obrir {{place}} en infunion:',
    declinedOutro: 'Si creus que és un error, escriu a {{contact}}.',
    withdrawInfo: 'Pots desistir d’este contracte en els 14 dies següents a la nostra aprovació, o en qualsevol moment abans, sense donar cap motiu: {{withdrawUrl}}',
    withdrawnSubject: 'Has desistit de la sol·licitud de {{place}}',
    withdrawn: 'Hem rebut el teu desistiment del contracte de {{place}} el {{date}}. No has de pagar res.',
    withdrawnOpen: 'Tanquem el panell de {{place}} i parem el seu pla en 2 dies laborables. Les dades dels membres s’esborren com diu l’Acord de tractament de dades.',
    hello: 'Hola, {{first}}:',
    signature: 'L’equip d’infunion',
  },
  [Language.GL]: {
    receivedSubject: 'Recibimos a solicitude de {{place}}',
    received: [
      'Grazas por rexistrar {{place}} en infunion.',
      'Revisamos cada lugar antes de abrilo, normalmente en 2 días laborables. Pode que te chamemos ou te escribamos.',
      'Asinaches as Condicións do servizo para lugares ({{terms}}) e o Acordo de tratamento de datos ({{dpa}}) como {{signed}} o {{date}}.',
    ],
    readySubject: '{{place}} xa está en infunion',
    ready: ['Revisamos o teu lugar e o teu panel xa está aberto.'],
    readyPassword: 'Entra con {{email}} e este contrasinal provisional: {{password}}. Cámbiao no teu perfil despois de entrar.',
    readyExisting: 'Entra con {{email}} coma sempre: {{place}} xa aparece na túa lista de lugares.',
    readyButton: 'Abrir o meu panel',
    questionSubject: 'Unha pregunta sobre {{place}}',
    questionIntro: 'Antes de abrir {{place}}, necesitamos unha cousa máis:',
    questionOutro: 'Abonda con escribir a {{contact}}.',
    declinedSubject: 'A túa solicitude para {{place}}',
    declinedIntro: 'Sentímolo, non podemos abrir {{place}} en infunion:',
    declinedOutro: 'Se cres que é un erro, escribe a {{contact}}.',
    withdrawInfo: 'Podes desistir deste contrato nos 14 días seguintes á nosa aprobación, ou en calquera momento antes, sen dar ningún motivo: {{withdrawUrl}}',
    withdrawnSubject: 'Desististe da solicitude de {{place}}',
    withdrawn: 'Recibimos o teu desistimento do contrato de {{place}} o {{date}}. Non tes nada que pagar.',
    withdrawnOpen: 'Pechamos o panel de {{place}} e paramos o seu plan en 2 días laborables. Os datos dos membros bórranse como di o Acordo de tratamento de datos.',
    hello: 'Ola, {{first}}:',
    signature: 'O equipo de infunion',
  },
  [Language.PT]: {
    receivedSubject: 'Recebemos o pedido de {{place}}',
    received: [
      'Obrigado por registar {{place}} no infunion.',
      'Verificamos cada local antes de o abrir, normalmente em 2 dias úteis. Podemos telefonar-lhe ou escrever-lhe.',
      'Assinou os Termos de serviço para locais ({{terms}}) e o Acordo de tratamento de dados ({{dpa}}) como {{signed}} em {{date}}.',
    ],
    readySubject: '{{place}} já está no infunion',
    ready: ['Verificámos o seu local e o seu painel já está aberto.'],
    readyPassword: 'Entre com {{email}} e esta palavra-passe provisória: {{password}}. Altere-a no seu perfil depois de entrar.',
    readyExisting: 'Entre com {{email}} como de costume: {{place}} já aparece na sua lista de locais.',
    readyButton: 'Abrir o meu painel',
    questionSubject: 'Uma pergunta sobre {{place}}',
    questionIntro: 'Antes de abrir {{place}}, precisamos de mais uma coisa:',
    questionOutro: 'Basta escrever para {{contact}}.',
    declinedSubject: 'O seu pedido para {{place}}',
    declinedIntro: 'Lamentamos, não podemos abrir {{place}} no infunion:',
    declinedOutro: 'Se acha que é um erro, escreva para {{contact}}.',
    withdrawInfo: 'Pode desistir deste contrato nos 14 dias seguintes à nossa aprovação, ou a qualquer momento antes, sem indicar motivo: {{withdrawUrl}}',
    withdrawnSubject: 'Desistiu do pedido de {{place}}',
    withdrawn: 'Recebemos a sua desistência do contrato de {{place}} em {{date}}. Não tem nada a pagar.',
    withdrawnOpen: 'Fechamos o painel de {{place}} e paramos o seu plano em 2 dias úteis. Os dados dos membros são apagados como diz o Acordo de tratamento de dados.',
    hello: 'Olá, {{first}}:',
    signature: 'A equipa infunion',
  },
};

type Fields = Record<string, string>;

// Where people answer: the sending address is not read.
const CONTACT = 'hello@infunion.app';

function fill(text: string, fields: Fields): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => fields[key] ?? match);
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

function build(to: string, subject: string, paragraphs: string[], link?: { label: string; url: string }): EmailMessage {
  const text = [...paragraphs, ...(link ? [`${link.label}: ${link.url}`] : [])].join('\n\n');
  const html = [
    ...paragraphs.map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`),
    ...(link
      ? [
          `<p><a href="${escapeHtml(link.url)}" style="display:inline-block;background:#6C4FD9;color:#fff;padding:10px 18px;border-radius:10px;font-weight:700;text-decoration:none">${escapeHtml(link.label)}</a></p>`,
        ]
      : []),
  ].join('');
  return { to, subject, text, html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1D1A2D">${html}</div>` };
}

function texts(language: Language): Texts {
  return TEXTS[language] ?? TEXTS[Language.EN];
}

export type RegistrationMailFields = { email: string; firstName: string; placeName: string; language: Language };

export function receivedEmail(
  r: RegistrationMailFields & { signedName: string; date: string; terms: string; dpa: string; withdrawUrl: string },
): EmailMessage {
  const t = texts(r.language);
  const f = { place: r.placeName, first: r.firstName, signed: r.signedName, date: r.date, terms: r.terms, dpa: r.dpa, withdrawUrl: r.withdrawUrl };
  return build(r.email, fill(t.receivedSubject, f), [
    fill(t.hello, f),
    ...t.received.map((p) => fill(p, f)),
    fill(t.withdrawInfo, f),
    t.signature,
  ]);
}

export function readyEmail(
  r: RegistrationMailFields & { dashboardUrl: string; temporaryPassword: string | null; withdrawUrl: string },
): EmailMessage {
  const t = texts(r.language);
  const f = { place: r.placeName, first: r.firstName, email: r.email, password: r.temporaryPassword ?? '', withdrawUrl: r.withdrawUrl };
  return build(
    r.email,
    fill(t.readySubject, f),
    [fill(t.hello, f), ...t.ready.map((p) => fill(p, f)), fill(r.temporaryPassword ? t.readyPassword : t.readyExisting, f), fill(t.withdrawInfo, f), t.signature],
    { label: t.readyButton, url: r.dashboardUrl },
  );
}

export function questionEmail(r: RegistrationMailFields & { message: string }): EmailMessage {
  const t = texts(r.language);
  const f = { place: r.placeName, first: r.firstName, contact: CONTACT };
  return build(r.email, fill(t.questionSubject, f), [fill(t.hello, f), fill(t.questionIntro, f), r.message, fill(t.questionOutro, f), t.signature]);
}

export function declinedEmail(r: RegistrationMailFields & { reason: string }): EmailMessage {
  const t = texts(r.language);
  const f = { place: r.placeName, first: r.firstName, contact: CONTACT };
  return build(r.email, fill(t.declinedSubject, f), [fill(t.hello, f), fill(t.declinedIntro, f), r.reason, fill(t.declinedOutro, f), t.signature]);
}

/** The acknowledgement of a withdrawal, on a durable medium (Directive 2023/2673). */
export function withdrawnEmail(r: RegistrationMailFields & { date: string; wasOpen: boolean }): EmailMessage {
  const t = texts(r.language);
  const f = { place: r.placeName, first: r.firstName, date: r.date };
  return build(r.email, fill(t.withdrawnSubject, f), [
    fill(t.hello, f),
    fill(t.withdrawn, f),
    ...(r.wasOpen ? [fill(t.withdrawnOpen, f)] : []),
    t.signature,
  ]);
}

/** To the superadmin, in English: a place withdrew; an opened place must be closed by hand. */
export function withdrawalNoticeEmail(to: string, r: { placeName: string; email: string; reason: string | null; opened: boolean; reviewUrl: string }): EmailMessage {
  return build(
    to,
    `Withdrawal: ${r.placeName}`,
    [
      `${r.email} has withdrawn from the contract for ${r.placeName}.`,
      ...(r.reason ? [`Reason given: ${r.reason}`] : []),
      ...(r.opened ? ['The place was already open: close it and stop its plan within 2 working days.'] : ['The request had not been approved yet: nothing else to do.']),
    ],
    { label: 'Open the request', url: r.reviewUrl },
  );
}

/** To the superadmin, in English: a new request is waiting. */
export function newRequestEmail(to: string, r: { placeName: string; city: string; plan: string; email: string; reviewUrl: string }): EmailMessage {
  return build(
    to,
    `New place request: ${r.placeName}`,
    [`${r.placeName} (${r.city}) asks to join infunion on the ${r.plan} plan.`, `Sent by ${r.email}.`],
    { label: 'Review the request', url: r.reviewUrl },
  );
}

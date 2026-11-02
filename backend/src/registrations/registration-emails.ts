import { Language } from '../common/enums/language.enum.js';
import type { EmailMessage } from '../auth/email/email-sender.js';
import {
  EMAIL_SUPPORT,
  type EmailLink,
  emailButton,
  emailDate,
  emailDetails,
  emailHeading,
  emailLayout,
  emailParagraph,
  emailQuote,
  emailRichParagraph,
} from '../common/email/email-layout.js';

/**
 * The emails a registration request sends, in the six languages, written
 * to the person who registered their place. `{{name}}` style fields are
 * filled by `fill`. Plain text first; the HTML is the same text in
 * paragraphs, so both always say the same thing.
 */
type Texts = {
  receivedHeading: string;
  readyHeading: string;
  readyLogin: string;
  emailLabel: string;
  passwordLabel: string;
  readyChange: string;
  questionHeading: string;
  declinedHeading: string;
  withdrawnHeading: string;
  withdrawLink: string;
  termsLabel: string;
  dpaLabel: string;
  receivedSubject: string;
  received: string[];
  readySubject: string;
  ready: string[];
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
    receivedHeading: 'Request received',
    readyHeading: 'Your place is ready',
    readyLogin: 'Sign in to your dashboard with:',
    emailLabel: 'Email',
    passwordLabel: 'Temporary password',
    readyChange: 'Change the password in your profile after signing in.',
    questionHeading: 'One more thing',
    declinedHeading: 'About your request',
    withdrawnHeading: 'Withdrawal confirmed',
    withdrawLink: 'Withdraw from the contract',
    termsLabel: 'Terms of service for places',
    dpaLabel: 'Data processing agreement',
    receivedSubject: 'We have received the request for {{place}}',
    received: [
      'Thank you for registering {{place}} on infunion.',
      'We check every place before opening it, usually within 2 working days. We may call or email you.',
      'You signed the {{termsLink}} ({{terms}}) and the {{dpaLink}} ({{dpa}}) as {{signed}} on {{date}}.',
    ],
    readySubject: '{{place}} is ready on infunion',
    ready: ['We checked your place and your dashboard is open.'],
    readyExisting:
      'Sign in with {{email}} as usual: {{place}} is now in your list of places.',
    readyButton: 'Open my dashboard',
    questionSubject: 'A question about {{place}}',
    questionIntro: 'Before we open {{place}}, we need one more thing from you:',
    questionOutro: 'Just write to {{contact}}.',
    declinedSubject: 'Your request for {{place}}',
    declinedIntro: 'We are sorry, we cannot open {{place}} on infunion:',
    declinedOutro: 'If you think this is a mistake, write to {{contact}}.',
    withdrawInfo:
      'You can withdraw from this contract within 14 days of our approval, or at any time before it, without giving a reason.',
    withdrawnSubject: 'You have withdrawn the request for {{place}}',
    withdrawn:
      'We have received your withdrawal from the contract for {{place}} on {{date}}. Nothing is due.',
    withdrawnOpen:
      "Your dashboard for {{place}} is closed and its plan is stopped within 2 working days. Members' data is deleted as the Data processing agreement says.",
    hello: 'Hello {{first}},',
    signature: 'The infunion team',
  },
  [Language.ES]: {
    receivedHeading: 'Solicitud recibida',
    readyHeading: 'Tu lugar está listo',
    readyLogin: 'Entra en tu panel con:',
    emailLabel: 'Correo',
    passwordLabel: 'Contraseña provisional',
    readyChange: 'Cambia la contraseña en tu perfil después de entrar.',
    questionHeading: 'Una cosa más',
    declinedHeading: 'Sobre tu solicitud',
    withdrawnHeading: 'Desistimiento confirmado',
    withdrawLink: 'Desistir del contrato',
    termsLabel: 'Condiciones del servicio para lugares',
    dpaLabel: 'Acuerdo de tratamiento de datos',
    receivedSubject: 'Hemos recibido la solicitud de {{place}}',
    received: [
      'Gracias por registrar {{place}} en infunion.',
      'Revisamos cada lugar antes de abrirlo, normalmente en 2 días laborables. Puede que te llamemos o te escribamos.',
      'Firmaste las {{termsLink}} ({{terms}}) y el {{dpaLink}} ({{dpa}}) como {{signed}} el {{date}}.',
    ],
    readySubject: '{{place}} ya está en infunion',
    ready: ['Hemos revisado tu lugar y tu panel ya está abierto.'],
    readyExisting:
      'Entra con {{email}} como siempre: {{place}} ya aparece en tu lista de lugares.',
    readyButton: 'Abrir mi panel',
    questionSubject: 'Una pregunta sobre {{place}}',
    questionIntro: 'Antes de abrir {{place}}, necesitamos algo más:',
    questionOutro: 'Basta con escribir a {{contact}}.',
    declinedSubject: 'Tu solicitud para {{place}}',
    declinedIntro: 'Lo sentimos, no podemos abrir {{place}} en infunion:',
    declinedOutro: 'Si crees que es un error, escribe a {{contact}}.',
    withdrawInfo:
      'Puedes desistir de este contrato en los 14 días siguientes a nuestra aprobación, o en cualquier momento antes, sin dar ningún motivo.',
    withdrawnSubject: 'Has desistido de la solicitud de {{place}}',
    withdrawn:
      'Hemos recibido tu desistimiento del contrato de {{place}} el {{date}}. No tienes nada que pagar.',
    withdrawnOpen:
      'Cerramos el panel de {{place}} y paramos su plan en 2 días laborables. Los datos de los miembros se borran como dice el Acuerdo de tratamiento de datos.',
    hello: 'Hola, {{first}}:',
    signature: 'El equipo de infunion',
  },
  [Language.FR]: {
    receivedHeading: 'Demande reçue',
    readyHeading: 'Votre lieu est prêt',
    readyLogin: 'Connectez-vous à votre tableau de bord avec :',
    emailLabel: 'E-mail',
    passwordLabel: 'Mot de passe provisoire',
    readyChange: 'Changez le mot de passe dans votre profil une fois connecté.',
    questionHeading: 'Une dernière chose',
    declinedHeading: 'À propos de votre demande',
    withdrawnHeading: 'Rétractation confirmée',
    withdrawLink: 'Se rétracter du contrat',
    termsLabel: 'Conditions de service pour les lieux',
    dpaLabel: 'Accord de traitement des données',
    receivedSubject: 'Nous avons bien reçu la demande pour {{place}}',
    received: [
      'Merci d’avoir inscrit {{place}} sur infunion.',
      'Nous vérifions chaque lieu avant de l’ouvrir, en général sous 2 jours ouvrés. Nous pourrons vous appeler ou vous écrire.',
      'Vous avez signé les {{termsLink}} ({{terms}}) et l’{{dpaLink}} ({{dpa}}) au nom de {{signed}} le {{date}}.',
    ],
    readySubject: '{{place}} est prêt sur infunion',
    ready: [
      'Nous avons vérifié votre lieu : votre tableau de bord est ouvert.',
    ],
    readyExisting:
      'Connectez-vous avec {{email}} comme d’habitude : {{place}} est maintenant dans votre liste de lieux.',
    readyButton: 'Ouvrir mon tableau de bord',
    questionSubject: 'Une question sur {{place}}',
    questionIntro: 'Avant d’ouvrir {{place}}, il nous manque une chose :',
    questionOutro: 'Il suffit d’écrire à {{contact}}.',
    declinedSubject: 'Votre demande pour {{place}}',
    declinedIntro:
      'Nous sommes désolés, nous ne pouvons pas ouvrir {{place}} sur infunion :',
    declinedOutro:
      'Si vous pensez qu’il s’agit d’une erreur, écrivez à {{contact}}.',
    withdrawInfo:
      'Vous pouvez vous rétracter de ce contrat dans les 14 jours suivant notre validation, ou à tout moment avant, sans donner de motif.',
    withdrawnSubject: 'Vous avez retiré la demande pour {{place}}',
    withdrawn:
      'Nous avons bien reçu votre rétractation du contrat pour {{place}} le {{date}}. Vous n’avez rien à payer.',
    withdrawnOpen:
      'Nous fermons le tableau de bord de {{place}} et arrêtons son offre sous 2 jours ouvrés. Les données des membres sont supprimées comme le prévoit l’Accord de traitement des données.',
    hello: 'Bonjour {{first}},',
    signature: 'L’équipe infunion',
  },
  [Language.VA]: {
    receivedHeading: 'Sol·licitud rebuda',
    readyHeading: 'El teu lloc està llest',
    readyLogin: 'Entra al teu panell amb:',
    emailLabel: 'Correu',
    passwordLabel: 'Contrasenya provisional',
    readyChange: 'Canvia la contrasenya en el teu perfil després d’entrar.',
    questionHeading: 'Una cosa més',
    declinedHeading: 'Sobre la teua sol·licitud',
    withdrawnHeading: 'Desistiment confirmat',
    withdrawLink: 'Desistir del contracte',
    termsLabel: 'Condicions del servici per a llocs',
    dpaLabel: 'Acord de tractament de dades',
    receivedSubject: 'Hem rebut la sol·licitud de {{place}}',
    received: [
      'Gràcies per registrar {{place}} en infunion.',
      'Revisem cada lloc abans d’obrir-lo, normalment en 2 dies laborables. És possible que et cridem o t’escrivim.',
      'Vas signar les {{termsLink}} ({{terms}}) i l’{{dpaLink}} ({{dpa}}) com a {{signed}} el {{date}}.',
    ],
    readySubject: '{{place}} ja està en infunion',
    ready: ['Hem revisat el teu lloc i el teu panell ja està obert.'],
    readyExisting:
      'Entra amb {{email}} com sempre: {{place}} ja apareix en la teua llista de llocs.',
    readyButton: 'Obrir el meu panell',
    questionSubject: 'Una pregunta sobre {{place}}',
    questionIntro: 'Abans d’obrir {{place}}, necessitem una cosa més:',
    questionOutro: 'Només cal que escrigues a {{contact}}.',
    declinedSubject: 'La teua sol·licitud per a {{place}}',
    declinedIntro: 'Ho sentim, no podem obrir {{place}} en infunion:',
    declinedOutro: 'Si creus que és un error, escriu a {{contact}}.',
    withdrawInfo:
      'Pots desistir d’este contracte en els 14 dies següents a la nostra aprovació, o en qualsevol moment abans, sense donar cap motiu.',
    withdrawnSubject: 'Has desistit de la sol·licitud de {{place}}',
    withdrawn:
      'Hem rebut el teu desistiment del contracte de {{place}} el {{date}}. No has de pagar res.',
    withdrawnOpen:
      'Tanquem el panell de {{place}} i parem el seu pla en 2 dies laborables. Les dades dels membres s’esborren com diu l’Acord de tractament de dades.',
    hello: 'Hola, {{first}}:',
    signature: 'L’equip d’infunion',
  },
  [Language.GL]: {
    receivedHeading: 'Solicitude recibida',
    readyHeading: 'O teu lugar está listo',
    readyLogin: 'Entra no teu panel con:',
    emailLabel: 'Correo',
    passwordLabel: 'Contrasinal provisional',
    readyChange: 'Cambia o contrasinal no teu perfil despois de entrar.',
    questionHeading: 'Unha cousa máis',
    declinedHeading: 'Sobre a túa solicitude',
    withdrawnHeading: 'Desistimento confirmado',
    withdrawLink: 'Desistir do contrato',
    termsLabel: 'Condicións do servizo para lugares',
    dpaLabel: 'Acordo de tratamento de datos',
    receivedSubject: 'Recibimos a solicitude de {{place}}',
    received: [
      'Grazas por rexistrar {{place}} en infunion.',
      'Revisamos cada lugar antes de abrilo, normalmente en 2 días laborables. Pode que te chamemos ou te escribamos.',
      'Asinaches as {{termsLink}} ({{terms}}) e o {{dpaLink}} ({{dpa}}) como {{signed}} o {{date}}.',
    ],
    readySubject: '{{place}} xa está en infunion',
    ready: ['Revisamos o teu lugar e o teu panel xa está aberto.'],
    readyExisting:
      'Entra con {{email}} coma sempre: {{place}} xa aparece na túa lista de lugares.',
    readyButton: 'Abrir o meu panel',
    questionSubject: 'Unha pregunta sobre {{place}}',
    questionIntro: 'Antes de abrir {{place}}, necesitamos unha cousa máis:',
    questionOutro: 'Abonda con escribir a {{contact}}.',
    declinedSubject: 'A túa solicitude para {{place}}',
    declinedIntro: 'Sentímolo, non podemos abrir {{place}} en infunion:',
    declinedOutro: 'Se cres que é un erro, escribe a {{contact}}.',
    withdrawInfo:
      'Podes desistir deste contrato nos 14 días seguintes á nosa aprobación, ou en calquera momento antes, sen dar ningún motivo.',
    withdrawnSubject: 'Desististe da solicitude de {{place}}',
    withdrawn:
      'Recibimos o teu desistimento do contrato de {{place}} o {{date}}. Non tes nada que pagar.',
    withdrawnOpen:
      'Pechamos o panel de {{place}} e paramos o seu plan en 2 días laborables. Os datos dos membros bórranse como di o Acordo de tratamento de datos.',
    hello: 'Ola, {{first}}:',
    signature: 'O equipo de infunion',
  },
  [Language.PT]: {
    receivedHeading: 'Pedido recebido',
    readyHeading: 'O seu local está pronto',
    readyLogin: 'Entre no seu painel com:',
    emailLabel: 'Email',
    passwordLabel: 'Palavra-passe provisória',
    readyChange: 'Altere a palavra-passe no seu perfil depois de entrar.',
    questionHeading: 'Só mais uma coisa',
    declinedHeading: 'Sobre o seu pedido',
    withdrawnHeading: 'Desistência confirmada',
    withdrawLink: 'Desistir do contrato',
    termsLabel: 'Termos de serviço para locais',
    dpaLabel: 'Acordo de tratamento de dados',
    receivedSubject: 'Recebemos o pedido de {{place}}',
    received: [
      'Obrigado por registar {{place}} no infunion.',
      'Verificamos cada local antes de o abrir, normalmente em 2 dias úteis. Podemos telefonar-lhe ou escrever-lhe.',
      'Assinou os {{termsLink}} ({{terms}}) e o {{dpaLink}} ({{dpa}}) como {{signed}} em {{date}}.',
    ],
    readySubject: '{{place}} já está no infunion',
    ready: ['Verificámos o seu local e o seu painel já está aberto.'],
    readyExisting:
      'Entre com {{email}} como de costume: {{place}} já aparece na sua lista de locais.',
    readyButton: 'Abrir o meu painel',
    questionSubject: 'Uma pergunta sobre {{place}}',
    questionIntro: 'Antes de abrir {{place}}, precisamos de mais uma coisa:',
    questionOutro: 'Basta escrever para {{contact}}.',
    declinedSubject: 'O seu pedido para {{place}}',
    declinedIntro: 'Lamentamos, não podemos abrir {{place}} no infunion:',
    declinedOutro: 'Se acha que é um erro, escreva para {{contact}}.',
    withdrawInfo:
      'Pode desistir deste contrato nos 14 dias seguintes à nossa aprovação, ou a qualquer momento antes, sem indicar motivo.',
    withdrawnSubject: 'Desistiu do pedido de {{place}}',
    withdrawn:
      'Recebemos a sua desistência do contrato de {{place}} em {{date}}. Não tem nada a pagar.',
    withdrawnOpen:
      'Fechamos o painel de {{place}} e paramos o seu plano em 2 dias úteis. Os dados dos membros são apagados como diz o Acordo de tratamento de dados.',
    hello: 'Olá, {{first}}:',
    signature: 'A equipa infunion',
  },
};

type Fields = Record<string, string>;

// Where people answer: the sending address is not read.
const CONTACT = EMAIL_SUPPORT;

function fill(text: string, fields: Fields): string {
  return text.replace(
    /\{\{(\w+)\}\}/g,
    (match, key: string) => fields[key] ?? match,
  );
}

type Block = { html: string; text: string };

function para(
  text: string,
  options: { muted?: boolean; small?: boolean } = {},
): Block {
  return { html: emailParagraph(text, options), text };
}

function rich(
  template: string,
  fields: Fields,
  links: Record<string, EmailLink> = {},
  options: { muted?: boolean; small?: boolean } = {},
): Block {
  return emailRichParagraph(template, fields, links, options);
}

function button(link: EmailLink): Block {
  return {
    html: emailButton(link.label, link.url),
    text: `${link.label}: ${link.url}`,
  };
}

function quote(text: string): Block {
  return { html: emailQuote(text), text };
}

function details(rows: { label: string; value: string }[]): Block {
  return {
    html: emailDetails(rows),
    text: rows.map((r) => `${r.label}: ${r.value}`).join('\n'),
  };
}

function build(
  to: string,
  subject: string,
  heading: string | null,
  blocks: Block[],
  language: Language = Language.EN,
): EmailMessage {
  return {
    to,
    subject,
    text: [...(heading ? [heading] : []), ...blocks.map((b) => b.text)].join(
      '\n\n',
    ),
    html: emailLayout(
      [
        ...(heading ? [emailHeading(heading)] : []),
        ...blocks.map((b) => b.html),
      ].join(''),
      language,
    ),
  };
}

function texts(language: Language): Texts {
  return TEXTS[language] ?? TEXTS[Language.EN];
}

const contactLink: EmailLink = { label: CONTACT, url: `mailto:${CONTACT}` };

/** The 14-day withdrawal notice: a quieter line with a link (the URL itself in the text version). */
function withdrawBlock(t: Texts, withdrawUrl: string): Block {
  const block = rich(
    `${t.withdrawInfo} {{withdraw}}`,
    {},
    { withdraw: { label: t.withdrawLink, url: withdrawUrl } },
    { muted: true, small: true },
  );
  return { html: block.html, text: `${t.withdrawInfo} ${withdrawUrl}` };
}

/** The landing page next to the withdrawal page (terms.html, dpa.html). */
function landingPage(withdrawUrl: string, page: string): string {
  return withdrawUrl.replace(/withdraw\.html.*$/, page);
}

export type RegistrationMailFields = {
  email: string;
  firstName: string;
  placeName: string;
  language: Language;
};

export function receivedEmail(
  r: RegistrationMailFields & {
    signedName: string;
    date: string;
    terms: string;
    dpa: string;
    withdrawUrl: string;
  },
): EmailMessage {
  const t = texts(r.language);
  const f = {
    place: r.placeName,
    first: r.firstName,
    signed: r.signedName,
    date: emailDate(r.date, r.language),
    terms: r.terms,
    dpa: r.dpa,
  };
  const links = {
    termsLink: {
      label: t.termsLabel,
      url: landingPage(r.withdrawUrl, 'terms.html#places'),
    },
    dpaLink: { label: t.dpaLabel, url: landingPage(r.withdrawUrl, 'dpa.html') },
  };
  return build(
    r.email,
    fill(t.receivedSubject, f),
    t.receivedHeading,
    [
      para(fill(t.hello, f)),
      ...t.received.map((p) => rich(p, f, links)),
      para(t.signature),
      withdrawBlock(t, r.withdrawUrl),
    ],
    r.language,
  );
}

export function readyEmail(
  r: RegistrationMailFields & {
    dashboardUrl: string;
    temporaryPassword: string | null;
    withdrawUrl: string;
  },
): EmailMessage {
  const t = texts(r.language);
  const f = { place: r.placeName, first: r.firstName, email: r.email };
  const login: Block[] = r.temporaryPassword
    ? [
        para(t.readyLogin),
        details([
          { label: t.emailLabel, value: r.email },
          { label: t.passwordLabel, value: r.temporaryPassword },
        ]),
        para(t.readyChange, { muted: true, small: true }),
      ]
    : [para(fill(t.readyExisting, f))];
  return build(
    r.email,
    fill(t.readySubject, f),
    t.readyHeading,
    [
      para(fill(t.hello, f)),
      ...t.ready.map((p) => para(fill(p, f))),
      ...login,
      button({ label: t.readyButton, url: r.dashboardUrl }),
      para(t.signature),
      withdrawBlock(t, r.withdrawUrl),
    ],
    r.language,
  );
}

export function questionEmail(
  r: RegistrationMailFields & { message: string },
): EmailMessage {
  const t = texts(r.language);
  const f = { place: r.placeName, first: r.firstName };
  return build(
    r.email,
    fill(t.questionSubject, f),
    t.questionHeading,
    [
      para(fill(t.hello, f)),
      para(fill(t.questionIntro, f)),
      quote(r.message),
      rich(t.questionOutro, f, { contact: contactLink }),
      para(t.signature),
    ],
    r.language,
  );
}

export function declinedEmail(
  r: RegistrationMailFields & { reason: string },
): EmailMessage {
  const t = texts(r.language);
  const f = { place: r.placeName, first: r.firstName };
  return build(
    r.email,
    fill(t.declinedSubject, f),
    t.declinedHeading,
    [
      para(fill(t.hello, f)),
      para(fill(t.declinedIntro, f)),
      quote(r.reason),
      rich(t.declinedOutro, f, { contact: contactLink }),
      para(t.signature),
    ],
    r.language,
  );
}

/** The acknowledgement of a withdrawal, on a durable medium (Directive 2023/2673). */
export function withdrawnEmail(
  r: RegistrationMailFields & { date: string; wasOpen: boolean },
): EmailMessage {
  const t = texts(r.language);
  const f = {
    place: r.placeName,
    first: r.firstName,
    date: emailDate(r.date, r.language),
  };
  return build(
    r.email,
    fill(t.withdrawnSubject, f),
    t.withdrawnHeading,
    [
      para(fill(t.hello, f)),
      para(fill(t.withdrawn, f)),
      ...(r.wasOpen ? [para(fill(t.withdrawnOpen, f))] : []),
      para(t.signature),
    ],
    r.language,
  );
}

function planName(plan: string): string {
  return plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : plan;
}

/** To the superadmin, in English: a place withdrew; an opened place must be closed by hand. */
export function withdrawalNoticeEmail(
  to: string,
  r: {
    placeName: string;
    email: string;
    reason: string | null;
    opened: boolean;
    reviewUrl: string;
  },
): EmailMessage {
  return build(to, `Withdrawal: ${r.placeName}`, 'A place withdrew', [
    details([
      { label: 'Place', value: r.placeName },
      { label: 'Email', value: r.email },
      {
        label: 'Status',
        value: r.opened ? 'Already open' : 'Not approved yet',
      },
    ]),
    ...(r.reason ? [para('Reason given:'), quote(r.reason)] : []),
    para(
      r.opened
        ? 'The place was already open: close it and stop its plan within 2 working days.'
        : 'The request had not been approved yet: nothing else to do.',
    ),
    button({ label: 'Open the request', url: r.reviewUrl }),
  ]);
}

/** To the superadmin, in English: a new request is waiting. */
export function newRequestEmail(
  to: string,
  r: {
    placeName: string;
    city: string;
    plan: string;
    email: string;
    document?: string | null;
    reviewUrl: string;
  },
): EmailMessage {
  return build(to, `New place request: ${r.placeName}`, 'New place request', [
    para(`${r.placeName} asks to join infunion.`),
    details([
      { label: 'Place', value: r.placeName },
      { label: 'City', value: r.city },
      { label: 'Plan', value: planName(r.plan) },
      { label: 'Email', value: r.email },
      { label: 'Proof document', value: r.document ? r.document : 'None' },
    ]),
    button({ label: 'Review the request', url: r.reviewUrl }),
  ]);
}

import { Language } from '../common/enums/language.enum.js';

/** The words of a community's website, in the community's own language. */
export type SiteStrings = {
  join: string;
  joinTitle: string;
  joinBody: string;
  openApp: string;
  openAppNote: string;
  appStore: string;
  googlePlay: string;
  timetable: string;
  news: string;
  events: string;
  visit: string;
  directions: string;
  campaign: string;
  raised: string;
  raisedOf: string;
  contribute: string;
  moreInApp: string;
  nextMass: string;
  openNow: string;
  until: string;
  closed: string;
  opens: string;
  today: string;
  tomorrow: string;
  important: string;
  madeWith: string;
  notFoundTitle: string;
  notFoundBody: string;
  getApp: string;
  discover: string;
  claim: string;
};

const en: SiteStrings = {
  join: 'Join us in the app',
  joinTitle: 'Join us in the app',
  joinBody: 'Scan with your phone: news, timetable, requests and contributions in one place. Free.',
  openApp: 'Open in the app',
  openAppNote: 'Free on iPhone and Android, it takes you straight to {name}.',
  appStore: 'Download on the',
  googlePlay: 'Get it on',
  timetable: 'Weekly timetable',
  news: 'Latest news',
  events: 'Coming up',
  visit: 'Visit us',
  directions: 'Directions',
  campaign: 'Campaign',
  raised: '{amount} raised',
  raisedOf: '{amount} raised of {goal}',
  contribute: 'Contribute in the app',
  moreInApp: 'More in the app',
  nextMass: 'Next Mass',
  openNow: 'Open now',
  until: 'until {time}',
  closed: 'Closed now',
  opens: 'opens {when}',
  today: 'Today',
  tomorrow: 'Tomorrow',
  important: 'Important',
  madeWith: 'Made with infunion',
  notFoundTitle: 'We couldn’t find this community page',
  notFoundBody: 'It may have moved to a new address, or the team hasn’t put it online yet. In the app you can find the communities near you.',
  getApp: 'Get the app',
  discover: 'What is infunion?',
  claim: 'The union that makes you a community',
};

const es: SiteStrings = {
  join: 'Únete en la app',
  joinTitle: 'Únete en la app',
  joinBody: 'Escanea con tu móvil: noticias, horarios, solicitudes y aportaciones en un solo lugar. Gratis.',
  openApp: 'Abrir en la app',
  openAppNote: 'Gratis en iPhone y Android, te lleva directamente a {name}.',
  appStore: 'Descárgala en',
  googlePlay: 'Disponible en',
  timetable: 'Horario semanal',
  news: 'Últimas noticias',
  events: 'Próximamente',
  visit: 'Visítanos',
  directions: 'Cómo llegar',
  campaign: 'Campaña',
  raised: '{amount} recaudados',
  raisedOf: '{amount} recaudados de {goal}',
  contribute: 'Colaborar en la app',
  moreInApp: 'Más en la app',
  nextMass: 'Próxima misa',
  openNow: 'Abierto ahora',
  until: 'hasta las {time}',
  closed: 'Cerrado ahora',
  opens: 'abre {when}',
  today: 'Hoy',
  tomorrow: 'Mañana',
  important: 'Importante',
  madeWith: 'Hecho con infunion',
  notFoundTitle: 'No hemos encontrado esta página',
  notFoundBody: 'Puede que la comunidad haya cambiado de dirección o que su equipo aún no la haya puesto en línea. En la app encontrarás las comunidades cerca de ti.',
  getApp: 'Descargar la app',
  discover: '¿Qué es infunion?',
  claim: 'La unión que te hace comunidad',
};

const fr: SiteStrings = {
  join: 'Rejoignez-nous dans l’app',
  joinTitle: 'Rejoignez-nous dans l’app',
  joinBody: 'Scannez avec votre téléphone : actualités, horaires, demandes et contributions au même endroit. Gratuit.',
  openApp: 'Ouvrir dans l’app',
  openAppNote: 'Gratuite sur iPhone et Android, elle vous mène directement à {name}.',
  appStore: 'Télécharger dans',
  googlePlay: 'Disponible sur',
  timetable: 'Horaires de la semaine',
  news: 'Dernières actualités',
  events: 'À venir',
  visit: 'Nous trouver',
  directions: 'Itinéraire',
  campaign: 'Campagne',
  raised: '{amount} collectés',
  raisedOf: '{amount} collectés sur {goal}',
  contribute: 'Contribuer dans l’app',
  moreInApp: 'Plus dans l’app',
  nextMass: 'Prochaine messe',
  openNow: 'Ouvert',
  until: 'jusqu’à {time}',
  closed: 'Fermé',
  opens: 'ouvre {when}',
  today: 'Aujourd’hui',
  tomorrow: 'Demain',
  important: 'Important',
  madeWith: 'Réalisé avec infunion',
  notFoundTitle: 'Nous n’avons pas trouvé cette page',
  notFoundBody: 'La communauté a peut-être changé d’adresse, ou son équipe ne l’a pas encore mise en ligne. Dans l’app, vous trouverez les communautés près de chez vous.',
  getApp: 'Télécharger l’app',
  discover: 'Qu’est-ce qu’infunion ?',
  claim: 'L’union qui fait de vous une communauté',
};

const va: SiteStrings = {
  join: 'Uneix-te a l’app',
  joinTitle: 'Uneix-te a l’app',
  joinBody: 'Escaneja amb el mòbil: notícies, horaris, sol·licituds i aportacions en un sol lloc. Gratis.',
  openApp: 'Obri en l’app',
  openAppNote: 'Gratis en iPhone i Android, et porta directament a {name}.',
  appStore: 'Descarrega-la en',
  googlePlay: 'Disponible en',
  timetable: 'Horari setmanal',
  news: 'Últimes notícies',
  events: 'Pròximament',
  visit: 'Visita’ns',
  directions: 'Com arribar',
  campaign: 'Campanya',
  raised: '{amount} recaptats',
  raisedOf: '{amount} recaptats de {goal}',
  contribute: 'Col·labora en l’app',
  moreInApp: 'Més en l’app',
  nextMass: 'Pròxima missa',
  openNow: 'Obert ara',
  until: 'fins a les {time}',
  closed: 'Tancat ara',
  opens: 'obri {when}',
  today: 'Hui',
  tomorrow: 'Demà',
  important: 'Important',
  madeWith: 'Fet amb infunion',
  notFoundTitle: 'No hem trobat esta pàgina',
  notFoundBody: 'Pot ser que la comunitat haja canviat d’adreça o que el seu equip encara no l’haja posada en línia. En l’app trobaràs les comunitats prop de tu.',
  getApp: 'Descarrega l’app',
  discover: 'Què és infunion?',
  claim: 'La unió que et fa comunitat',
};

const ca: SiteStrings = {
  ...va,
  openApp: 'Obre a l’app',
  openAppNote: 'Gratis a iPhone i Android, et porta directament a {name}.',
  join: 'Uneix-te a l’app',
  opens: 'obre {when}',
  today: 'Avui',
  nextMass: 'Propera missa',
  events: 'Properament',
  contribute: 'Col·labora a l’app',
  moreInApp: 'Més a l’app',
  notFoundTitle: 'No hem trobat aquesta pàgina',
  notFoundBody: 'Potser la comunitat ha canviat d’adreça o el seu equip encara no l’ha posada en línia. A l’app trobaràs les comunitats a prop teu.',
  getApp: 'Descarrega l’app',
  discover: 'Què és infunion?',
  claim: 'La unió que et fa comunitat',
};

const gl: SiteStrings = {
  join: 'Únete na app',
  joinTitle: 'Únete na app',
  joinBody: 'Escanea co teu móbil: novas, horarios, solicitudes e achegas nun só lugar. De balde.',
  openApp: 'Abrir na app',
  openAppNote: 'De balde en iPhone e Android, lévate directamente a {name}.',
  appStore: 'Descárgaa en',
  googlePlay: 'Dispoñible en',
  timetable: 'Horario semanal',
  news: 'Últimas novas',
  events: 'Proximamente',
  visit: 'Visítanos',
  directions: 'Como chegar',
  campaign: 'Campaña',
  raised: '{amount} recadados',
  raisedOf: '{amount} recadados de {goal}',
  contribute: 'Colaborar na app',
  moreInApp: 'Máis na app',
  nextMass: 'Próxima misa',
  openNow: 'Aberto agora',
  until: 'ata as {time}',
  closed: 'Pechado agora',
  opens: 'abre {when}',
  today: 'Hoxe',
  tomorrow: 'Mañá',
  important: 'Importante',
  madeWith: 'Feito con infunion',
  notFoundTitle: 'Non atopamos esta páxina',
  notFoundBody: 'Pode que a comunidade cambiase de enderezo ou que o seu equipo aínda non a puxese en liña. Na app atoparás as comunidades preto de ti.',
  getApp: 'Descargar a app',
  discover: 'Que é infunion?',
  claim: 'A unión que te fai comunidade',
};

const pt: SiteStrings = {
  join: 'Junte-se a nós na app',
  joinTitle: 'Junte-se a nós na app',
  joinBody: 'Leia com o telemóvel: notícias, horários, pedidos e contribuições num só lugar. Grátis.',
  openApp: 'Abrir na app',
  openAppNote: 'Grátis em iPhone e Android, leva-o diretamente a {name}.',
  appStore: 'Descarregar na',
  googlePlay: 'Disponível no',
  timetable: 'Horário semanal',
  news: 'Últimas notícias',
  events: 'Brevemente',
  visit: 'Visite-nos',
  directions: 'Como chegar',
  campaign: 'Campanha',
  raised: '{amount} angariados',
  raisedOf: '{amount} angariados de {goal}',
  contribute: 'Contribuir na app',
  moreInApp: 'Mais na app',
  nextMass: 'Próxima missa',
  openNow: 'Aberto agora',
  until: 'até às {time}',
  closed: 'Fechado agora',
  opens: 'abre {when}',
  today: 'Hoje',
  tomorrow: 'Amanhã',
  important: 'Importante',
  madeWith: 'Feito com infunion',
  notFoundTitle: 'Não encontrámos esta página',
  notFoundBody: 'A comunidade pode ter mudado de endereço ou a equipa ainda não a colocou online. Na app encontra as comunidades perto de si.',
  getApp: 'Descarregar a app',
  discover: 'O que é a infunion?',
  claim: 'A união que te faz comunidade',
};

const ALL: Record<string, SiteStrings> = { en, es, fr, va, ca, gl, pt };

export function siteStrings(language: Language | string | null | undefined): SiteStrings {
  return ALL[language ?? 'es'] ?? es;
}

/** The locale dates and money are written in. */
export function siteLocale(language: Language | string | null | undefined): string {
  if (language === 'en') return 'en-GB';
  if (language === 'va' || language === 'ca') return 'ca-ES';
  if (language === 'pt') return 'pt-PT';
  return language ?? 'es';
}

export function fill(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
}

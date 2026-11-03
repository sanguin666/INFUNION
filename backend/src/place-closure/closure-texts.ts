import { Language } from '../common/enums/language.enum.js';

/**
 * The words of a closing: the push members get, and the emails the
 * place's admins get. Push in the member's language, emails in the
 * place's. {place}, {date}, {name}, {days} are filled in.
 */
const TEXTS = {
  en: {
    pushClosingTitle: '{place} is leaving infunion',
    pushClosingBody:
      'The community closes its space on {date}. Download your tax receipts before then.',
    pushStaysTitle: '{place} is staying',
    pushStaysBody:
      'The community is staying on infunion. Monthly gifts that were stopped need to be started again.',
    mailClosingSubject: '{place} closes on {date}',
    mailClosingHeading: 'Your place’s account will close',
    mailClosingIntro:
      '{name} asked to close the account of {place}. It closes on {date}.',
    mailClosingNow:
      'Since now, the place is off the map and search, its QR code no longer works, monthly gifts are stopped and the plan will not renew. Members can still read everything.',
    mailClosingThen:
      'On {date}, content, photos, messages and the member list are erased. Gifts and tax receipts are kept, locked away, as the law requires.',
    mailClosingExport:
      'Download all your data from Settings › Account before then.',
    mailClosingUndo:
      'Changed your mind? Any admin can keep the place from Settings › Account until {date}.',
    mailStaysSubject: '{place} is staying on infunion',
    mailStaysHeading: 'The closing was taken back',
    mailStaysIntro:
      '{name} kept {place}. Nothing will be erased. Monthly gifts that were stopped need to be started again by the members.',
    mailClosedSubject: '{place} is now closed',
    mailClosedHeading: 'Your place’s account is closed',
    mailClosedIntro:
      'The account of {place} closed on {date}. Its content and member list are erased. Gifts and tax receipts are kept locked away, as the law requires; write to privacy@infunion.app if you need them.',
    openAdmin: 'Open Settings › Account',
  },
  es: {
    pushClosingTitle: '{place} deja infunion',
    pushClosingBody:
      'La comunidad cierra su espacio el {date}. Descarga antes tus certificados de donativos.',
    pushStaysTitle: '{place} se queda',
    pushStaysBody:
      'La comunidad se queda en infunion. Los donativos mensuales que se pararon hay que volver a empezarlos.',
    mailClosingSubject: '{place} se cierra el {date}',
    mailClosingHeading: 'La cuenta de tu lugar se va a cerrar',
    mailClosingIntro:
      '{name} ha pedido cerrar la cuenta de {place}. Se cierra el {date}.',
    mailClosingNow:
      'Desde ahora, el lugar ya no aparece en el mapa ni en la búsqueda, su código QR ya no funciona, los donativos mensuales están parados y el plan no se renovará. Los miembros todavía pueden leerlo todo.',
    mailClosingThen:
      'El {date} se borran los contenidos, las fotos, los mensajes y la lista de miembros. Los donativos y certificados se conservan, bloqueados, como exige la ley.',
    mailClosingExport:
      'Antes de esa fecha, descarga todos tus datos desde Ajustes › Cuenta.',
    mailClosingUndo:
      '¿Has cambiado de idea? Cualquier administrador puede conservar el lugar desde Ajustes › Cuenta hasta el {date}.',
    mailStaysSubject: '{place} se queda en infunion',
    mailStaysHeading: 'Se ha anulado el cierre',
    mailStaysIntro:
      '{name} ha conservado {place}. No se borrará nada. Los miembros tienen que volver a empezar los donativos mensuales que se pararon.',
    mailClosedSubject: '{place} ya está cerrado',
    mailClosedHeading: 'La cuenta de tu lugar está cerrada',
    mailClosedIntro:
      'La cuenta de {place} se cerró el {date}. Sus contenidos y su lista de miembros están borrados. Los donativos y certificados se conservan bloqueados, como exige la ley; escribe a privacy@infunion.app si los necesitas.',
    openAdmin: 'Abrir Ajustes › Cuenta',
  },
  fr: {
    pushClosingTitle: '{place} quitte infunion',
    pushClosingBody:
      'La communauté ferme son espace le {date}. Téléchargez vos reçus fiscaux avant cette date.',
    pushStaysTitle: '{place} reste',
    pushStaysBody:
      'La communauté reste sur infunion. Les dons mensuels arrêtés doivent être relancés.',
    mailClosingSubject: '{place} ferme le {date}',
    mailClosingHeading: 'Le compte de votre lieu va fermer',
    mailClosingIntro:
      '{name} a demandé la fermeture du compte de {place}. Il ferme le {date}.',
    mailClosingNow:
      'Dès maintenant, le lieu n’apparaît plus sur la carte ni dans la recherche, son QR code ne fonctionne plus, les dons mensuels sont arrêtés et l’abonnement ne sera pas renouvelé. Les membres peuvent encore tout lire.',
    mailClosingThen:
      'Le {date}, les contenus, photos, messages et la liste des membres sont effacés. Les dons et reçus fiscaux sont conservés, bloqués, comme la loi l’exige.',
    mailClosingExport:
      'Avant cette date, téléchargez toutes vos données depuis Paramètres › Compte.',
    mailClosingUndo:
      'Vous avez changé d’avis ? N’importe quel administrateur peut garder le lieu depuis Paramètres › Compte jusqu’au {date}.',
    mailStaysSubject: '{place} reste sur infunion',
    mailStaysHeading: 'La fermeture est annulée',
    mailStaysIntro:
      '{name} a gardé {place}. Rien ne sera effacé. Les membres doivent relancer les dons mensuels qui ont été arrêtés.',
    mailClosedSubject: '{place} est maintenant fermé',
    mailClosedHeading: 'Le compte de votre lieu est fermé',
    mailClosedIntro:
      'Le compte de {place} a fermé le {date}. Ses contenus et sa liste de membres sont effacés. Les dons et reçus fiscaux sont conservés bloqués, comme la loi l’exige ; écrivez à privacy@infunion.app si vous en avez besoin.',
    openAdmin: 'Ouvrir Paramètres › Compte',
  },
  va: {
    pushClosingTitle: '{place} deixa infunion',
    pushClosingBody:
      'La comunitat tanca el seu espai el {date}. Descarrega abans els teus certificats de donatius.',
    pushStaysTitle: '{place} es queda',
    pushStaysBody:
      'La comunitat es queda a infunion. Els donatius mensuals que es van parar cal tornar-los a començar.',
    mailClosingSubject: '{place} es tanca el {date}',
    mailClosingHeading: 'El compte del teu lloc es tancarà',
    mailClosingIntro:
      '{name} ha demanat tancar el compte de {place}. Es tanca el {date}.',
    mailClosingNow:
      'Des d’ara, el lloc ja no apareix al mapa ni en la cerca, el seu codi QR ja no funciona, els donatius mensuals estan parats i el pla no es renovarà. Els membres encara poden llegir-ho tot.',
    mailClosingThen:
      'El {date} s’esborren els continguts, les fotos, els missatges i la llista de membres. Els donatius i certificats es conserven, bloquejats, com exigix la llei.',
    mailClosingExport:
      'Abans d’eixa data, descarrega totes les teues dades des d’Ajustos › Compte.',
    mailClosingUndo:
      'Has canviat d’idea? Qualsevol administrador pot conservar el lloc des d’Ajustos › Compte fins al {date}.',
    mailStaysSubject: '{place} es queda a infunion',
    mailStaysHeading: 'S’ha anul·lat el tancament',
    mailStaysIntro:
      '{name} ha conservat {place}. No s’esborrarà res. Els membres han de tornar a començar els donatius mensuals que es van parar.',
    mailClosedSubject: '{place} ja està tancat',
    mailClosedHeading: 'El compte del teu lloc està tancat',
    mailClosedIntro:
      'El compte de {place} es va tancar el {date}. Els seus continguts i la llista de membres estan esborrats. Els donatius i certificats es conserven bloquejats, com exigix la llei; escriu a privacy@infunion.app si els necessites.',
    openAdmin: 'Obrir Ajustos › Compte',
  },
  ca: {
    pushClosingTitle: '{place} deixa infunion',
    pushClosingBody:
      'La comunitat tanca el seu espai el {date}. Descarrega abans els teus certificats de donatius.',
    pushStaysTitle: '{place} es queda',
    pushStaysBody:
      'La comunitat es queda a infunion. Els donatius mensuals que es van parar cal tornar-los a començar.',
    mailClosingSubject: '{place} es tanca el {date}',
    mailClosingHeading: 'El compte del teu lloc es tancarà',
    mailClosingIntro:
      '{name} ha demanat tancar el compte de {place}. Es tanca el {date}.',
    mailClosingNow:
      'Des d’ara, el lloc ja no apareix al mapa ni a la cerca, el seu codi QR ja no funciona, els donatius mensuals estan parats i el pla no es renovarà. Els membres encara poden llegir-ho tot.',
    mailClosingThen:
      'El {date} s’esborren els continguts, les fotos, els missatges i la llista de membres. Els donatius i certificats es conserven, bloquejats, com exigeix la llei.',
    mailClosingExport:
      'Abans d’aquesta data, descarrega totes les teves dades des d’Ajustos › Compte.',
    mailClosingUndo:
      'Has canviat d’idea? Qualsevol administrador pot conservar el lloc des d’Ajustos › Compte fins al {date}.',
    mailStaysSubject: '{place} es queda a infunion',
    mailStaysHeading: 'S’ha anul·lat el tancament',
    mailStaysIntro:
      '{name} ha conservat {place}. No s’esborrarà res. Els membres han de tornar a començar els donatius mensuals que es van parar.',
    mailClosedSubject: '{place} ja està tancat',
    mailClosedHeading: 'El compte del teu lloc està tancat',
    mailClosedIntro:
      'El compte de {place} es va tancar el {date}. Els seus continguts i la llista de membres estan esborrats. Els donatius i certificats es conserven bloquejats, com exigeix la llei; escriu a privacy@infunion.app si els necessites.',
    openAdmin: 'Obrir Ajustos › Compte',
  },
  gl: {
    pushClosingTitle: '{place} deixa infunion',
    pushClosingBody:
      'A comunidade pecha o seu espazo o {date}. Descarga antes os teus certificados de doazóns.',
    pushStaysTitle: '{place} queda',
    pushStaysBody:
      'A comunidade queda en infunion. As doazóns mensuais que se pararon hai que volver comezalas.',
    mailClosingSubject: '{place} pecha o {date}',
    mailClosingHeading: 'A conta do teu lugar vai pecharse',
    mailClosingIntro: '{name} pediu pechar a conta de {place}. Pecha o {date}.',
    mailClosingNow:
      'Desde agora, o lugar xa non aparece no mapa nin na busca, o seu código QR xa non funciona, as doazóns mensuais están paradas e o plan non se renovará. Os membros aínda poden lelo todo.',
    mailClosingThen:
      'O {date} bórranse os contidos, as fotos, as mensaxes e a lista de membros. As doazóns e os certificados consérvanse, bloqueados, como esixe a lei.',
    mailClosingExport:
      'Antes desa data, descarga todos os teus datos desde Axustes › Conta.',
    mailClosingUndo:
      'Cambiaches de idea? Calquera administrador pode conservar o lugar desde Axustes › Conta ata o {date}.',
    mailStaysSubject: '{place} queda en infunion',
    mailStaysHeading: 'Anulouse o peche',
    mailStaysIntro:
      '{name} conservou {place}. Non se borrará nada. Os membros teñen que volver comezar as doazóns mensuais que se pararon.',
    mailClosedSubject: '{place} xa está pechado',
    mailClosedHeading: 'A conta do teu lugar está pechada',
    mailClosedIntro:
      'A conta de {place} pechou o {date}. Os seus contidos e a lista de membros están borrados. As doazóns e os certificados consérvanse bloqueados, como esixe a lei; escribe a privacy@infunion.app se os precisas.',
    openAdmin: 'Abrir Axustes › Conta',
  },
  pt: {
    pushClosingTitle: '{place} vai sair do infunion',
    pushClosingBody:
      'A comunidade fecha o seu espaço a {date}. Descarregue antes os seus recibos de donativos.',
    pushStaysTitle: '{place} vai ficar',
    pushStaysBody:
      'A comunidade fica no infunion. Os donativos mensais que foram parados têm de ser iniciados de novo.',
    mailClosingSubject: '{place} fecha a {date}',
    mailClosingHeading: 'A conta do seu local vai fechar',
    mailClosingIntro:
      '{name} pediu para fechar a conta de {place}. Fecha a {date}.',
    mailClosingNow:
      'A partir de agora, o local deixa de aparecer no mapa e na pesquisa, o código QR deixa de funcionar, os donativos mensais estão parados e o plano não será renovado. Os membros ainda podem ler tudo.',
    mailClosingThen:
      'A {date}, os conteúdos, as fotos, as mensagens e a lista de membros são apagados. Os donativos e os recibos são conservados, bloqueados, como exige a lei.',
    mailClosingExport:
      'Antes dessa data, descarregue todos os seus dados em Definições › Conta.',
    mailClosingUndo:
      'Mudou de ideias? Qualquer administrador pode manter o local em Definições › Conta até {date}.',
    mailStaysSubject: '{place} fica no infunion',
    mailStaysHeading: 'O encerramento foi anulado',
    mailStaysIntro:
      '{name} manteve {place}. Nada será apagado. Os membros têm de iniciar de novo os donativos mensais que foram parados.',
    mailClosedSubject: '{place} está agora fechado',
    mailClosedHeading: 'A conta do seu local está fechada',
    mailClosedIntro:
      'A conta de {place} fechou a {date}. Os conteúdos e a lista de membros foram apagados. Os donativos e os recibos são conservados bloqueados, como exige a lei; escreva para privacy@infunion.app se precisar deles.',
    openAdmin: 'Abrir Definições › Conta',
  },
} satisfies Record<Language, Record<string, string>>;

export type ClosureTextKey = keyof (typeof TEXTS)['en'];

export function closureText(
  language: Language | string | undefined,
  key: ClosureTextKey,
  values: Record<string, string> = {},
): string {
  const table =
    (TEXTS as Record<string, Record<ClosureTextKey, string>>)[
      language ?? 'en'
    ] ?? TEXTS.en;
  return table[key].replace(
    /\{(\w+)\}/g,
    (_, name: string) => values[name] ?? `{${name}}`,
  );
}

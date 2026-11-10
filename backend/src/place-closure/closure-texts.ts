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
      'The community is staying on infunion. Monthly contributions that were stopped need to be started again.',
    mailClosingSubject: '{place} closes on {date}',
    mailClosingHeading: 'Your community’s account will close',
    mailClosingIntro:
      '{name} asked to close the account of {place}. It closes on {date}.',
    mailClosingNow:
      'Since now, the community is off the map and search, its QR code no longer works, monthly contributions are stopped and the plan will not renew. Members can still read everything.',
    mailClosingThen:
      'On {date}, content, photos, messages and the member list are erased. Contributions and tax receipts are kept, locked away, as the law requires.',
    mailClosingExport:
      'Download all your data from Dashboard › Account before then.',
    mailClosingUndo:
      'Changed your mind? Any admin can keep the community from Dashboard › Account until {date}.',
    mailStaysSubject: '{place} is staying on infunion',
    mailStaysHeading: 'The closing was taken back',
    mailStaysIntro:
      '{name} kept {place}. Nothing will be erased. Monthly contributions that were stopped need to be started again by the members.',
    mailClosedSubject: '{place} is now closed',
    mailClosedHeading: 'Your community’s account is closed',
    mailClosedIntro:
      'The account of {place} closed on {date}. Its content and member list are erased. Contributions and tax receipts are kept locked away, as the law requires; write to privacy@infunion.app if you need them.',
    openAdmin: 'Open Dashboard › Account',
  },
  es: {
    pushClosingTitle: '{place} deja infunion',
    pushClosingBody:
      'La comunidad cierra su espacio el {date}. Descarga antes tus certificados de donativos.',
    pushStaysTitle: '{place} se queda',
    pushStaysBody:
      'La comunidad se queda en infunion. Las aportaciones mensuales que se pararon hay que volver a empezarlas.',
    mailClosingSubject: '{place} se cierra el {date}',
    mailClosingHeading: 'La cuenta de tu comunidad se va a cerrar',
    mailClosingIntro:
      '{name} ha pedido cerrar la cuenta de {place}. Se cierra el {date}.',
    mailClosingNow:
      'Desde ahora, la comunidad ya no aparece en el mapa ni en la búsqueda, su código QR ya no funciona, las aportaciones mensuales están paradas y el plan no se renovará. Los miembros todavía pueden leerlo todo.',
    mailClosingThen:
      'El {date} se borran los contenidos, las fotos, los mensajes y la lista de miembros. Las aportaciones y certificados se conservan, bloqueados, como exige la ley.',
    mailClosingExport:
      'Antes de esa fecha, descarga todos tus datos desde Panel › Cuenta.',
    mailClosingUndo:
      '¿Has cambiado de idea? Cualquier administrador puede conservar la comunidad desde Panel › Cuenta hasta el {date}.',
    mailStaysSubject: '{place} se queda en infunion',
    mailStaysHeading: 'Se ha anulado el cierre',
    mailStaysIntro:
      '{name} ha conservado {place}. No se borrará nada. Los miembros tienen que volver a empezar las aportaciones mensuales que se pararon.',
    mailClosedSubject: '{place} ya está cerrado',
    mailClosedHeading: 'La cuenta de tu comunidad está cerrada',
    mailClosedIntro:
      'La cuenta de {place} se cerró el {date}. Sus contenidos y su lista de miembros están borrados. Las aportaciones y certificados se conservan bloqueados, como exige la ley; escribe a privacy@infunion.app si los necesitas.',
    openAdmin: 'Abrir Panel › Cuenta',
  },
  fr: {
    pushClosingTitle: '{place} quitte infunion',
    pushClosingBody:
      'La communauté ferme son espace le {date}. Téléchargez vos reçus fiscaux avant cette date.',
    pushStaysTitle: '{place} reste',
    pushStaysBody:
      'La communauté reste sur infunion. Les contributions mensuelles arrêtées doivent être relancées.',
    mailClosingSubject: '{place} ferme le {date}',
    mailClosingHeading: 'Le compte de votre communauté va fermer',
    mailClosingIntro:
      '{name} a demandé la fermeture du compte de {place}. Il ferme le {date}.',
    mailClosingNow:
      'Dès maintenant, la communauté n’apparaît plus sur la carte ni dans la recherche, son QR code ne fonctionne plus, les contributions mensuelles sont arrêtées et l’abonnement ne sera pas renouvelé. Les membres peuvent encore tout lire.',
    mailClosingThen:
      'Le {date}, les contenus, photos, messages et la liste des membres sont effacés. Les contributions et reçus fiscaux sont conservés, bloqués, comme la loi l’exige.',
    mailClosingExport:
      'Avant cette date, téléchargez toutes vos données depuis Tableau de bord › Compte.',
    mailClosingUndo:
      'Vous avez changé d’avis ? N’importe quel administrateur peut garder la communauté depuis Tableau de bord › Compte jusqu’au {date}.',
    mailStaysSubject: '{place} reste sur infunion',
    mailStaysHeading: 'La fermeture est annulée',
    mailStaysIntro:
      '{name} a gardé {place}. Rien ne sera effacé. Les membres doivent relancer les contributions mensuelles qui ont été arrêtées.',
    mailClosedSubject: '{place} est maintenant fermé',
    mailClosedHeading: 'Le compte de votre communauté est fermé',
    mailClosedIntro:
      'Le compte de {place} a fermé le {date}. Ses contenus et sa liste de membres sont effacés. Les contributions et reçus fiscaux sont conservés bloqués, comme la loi l’exige ; écrivez à privacy@infunion.app si vous en avez besoin.',
    openAdmin: 'Ouvrir Tableau de bord › Compte',
  },
  va: {
    pushClosingTitle: '{place} deixa infunion',
    pushClosingBody:
      'La comunitat tanca el seu espai el {date}. Descarrega abans els teus certificats de donatius.',
    pushStaysTitle: '{place} es queda',
    pushStaysBody:
      'La comunitat es queda a infunion. Les aportacions mensuals que es van parar cal tornar-les a començar.',
    mailClosingSubject: '{place} es tanca el {date}',
    mailClosingHeading: 'El compte de la teua comunitat es tancarà',
    mailClosingIntro:
      '{name} ha demanat tancar el compte de {place}. Es tanca el {date}.',
    mailClosingNow:
      'Des d’ara, la comunitat ja no apareix al mapa ni en la cerca, el seu codi QR ja no funciona, les aportacions mensuals estan parades i el pla no es renovarà. Els membres encara poden llegir-ho tot.',
    mailClosingThen:
      'El {date} s’esborren els continguts, les fotos, els missatges i la llista de membres. Les aportacions i certificats es conserven, bloquejats, com exigix la llei.',
    mailClosingExport:
      'Abans d’eixa data, descarrega totes les teues dades des de Tauler › Compte.',
    mailClosingUndo:
      'Has canviat d’idea? Qualsevol administrador pot conservar la comunitat des de Tauler › Compte fins al {date}.',
    mailStaysSubject: '{place} es queda a infunion',
    mailStaysHeading: 'S’ha anul·lat el tancament',
    mailStaysIntro:
      '{name} ha conservat {place}. No s’esborrarà res. Els membres han de tornar a començar les aportacions mensuals que es van parar.',
    mailClosedSubject: '{place} ja està tancat',
    mailClosedHeading: 'El compte de la teua comunitat està tancat',
    mailClosedIntro:
      'El compte de {place} es va tancar el {date}. Els seus continguts i la llista de membres estan esborrats. Les aportacions i certificats es conserven bloquejats, com exigix la llei; escriu a privacy@infunion.app si els necessites.',
    openAdmin: 'Obrir Tauler › Compte',
  },
  ca: {
    pushClosingTitle: '{place} deixa infunion',
    pushClosingBody:
      'La comunitat tanca el seu espai el {date}. Descarrega abans els teus certificats de donatius.',
    pushStaysTitle: '{place} es queda',
    pushStaysBody:
      'La comunitat es queda a infunion. Les aportacions mensuals que es van parar cal tornar-les a començar.',
    mailClosingSubject: '{place} es tanca el {date}',
    mailClosingHeading: 'El compte de la teva comunitat es tancarà',
    mailClosingIntro:
      '{name} ha demanat tancar el compte de {place}. Es tanca el {date}.',
    mailClosingNow:
      'Des d’ara, la comunitat ja no apareix al mapa ni a la cerca, el seu codi QR ja no funciona, les aportacions mensuals estan parades i el pla no es renovarà. Els membres encara poden llegir-ho tot.',
    mailClosingThen:
      'El {date} s’esborren els continguts, les fotos, els missatges i la llista de membres. Les aportacions i certificats es conserven, bloquejats, com exigeix la llei.',
    mailClosingExport:
      'Abans d’aquesta data, descarrega totes les teves dades des de Tauler › Compte.',
    mailClosingUndo:
      'Has canviat d’idea? Qualsevol administrador pot conservar la comunitat des de Tauler › Compte fins al {date}.',
    mailStaysSubject: '{place} es queda a infunion',
    mailStaysHeading: 'S’ha anul·lat el tancament',
    mailStaysIntro:
      '{name} ha conservat {place}. No s’esborrarà res. Els membres han de tornar a començar les aportacions mensuals que es van parar.',
    mailClosedSubject: '{place} ja està tancat',
    mailClosedHeading: 'El compte de la teva comunitat està tancat',
    mailClosedIntro:
      'El compte de {place} es va tancar el {date}. Els seus continguts i la llista de membres estan esborrats. Les aportacions i certificats es conserven bloquejats, com exigeix la llei; escriu a privacy@infunion.app si els necessites.',
    openAdmin: 'Obrir Tauler › Compte',
  },
  gl: {
    pushClosingTitle: '{place} deixa infunion',
    pushClosingBody:
      'A comunidade pecha o seu espazo o {date}. Descarga antes os teus certificados de doazóns.',
    pushStaysTitle: '{place} queda',
    pushStaysBody:
      'A comunidade queda en infunion. As achegas mensuais que se pararon hai que volver comezalas.',
    mailClosingSubject: '{place} pecha o {date}',
    mailClosingHeading: 'A conta da túa comunidade vai pecharse',
    mailClosingIntro: '{name} pediu pechar a conta de {place}. Pecha o {date}.',
    mailClosingNow:
      'Desde agora, a comunidade xa non aparece no mapa nin na busca, o seu código QR xa non funciona, as achegas mensuais están paradas e o plan non se renovará. Os membros aínda poden lelo todo.',
    mailClosingThen:
      'O {date} bórranse os contidos, as fotos, as mensaxes e a lista de membros. As achegas e os certificados consérvanse, bloqueados, como esixe a lei.',
    mailClosingExport:
      'Antes desa data, descarga todos os teus datos desde Panel › Conta.',
    mailClosingUndo:
      'Cambiaches de idea? Calquera administrador pode conservar a comunidade desde Panel › Conta ata o {date}.',
    mailStaysSubject: '{place} queda en infunion',
    mailStaysHeading: 'Anulouse o peche',
    mailStaysIntro:
      '{name} conservou {place}. Non se borrará nada. Os membros teñen que volver comezar as achegas mensuais que se pararon.',
    mailClosedSubject: '{place} xa está pechado',
    mailClosedHeading: 'A conta da túa comunidade está pechada',
    mailClosedIntro:
      'A conta de {place} pechou o {date}. Os seus contidos e a lista de membros están borrados. As achegas e os certificados consérvanse bloqueados, como esixe a lei; escribe a privacy@infunion.app se os precisas.',
    openAdmin: 'Abrir Panel › Conta',
  },
  pt: {
    pushClosingTitle: '{place} vai sair do infunion',
    pushClosingBody:
      'A comunidade fecha o seu espaço a {date}. Descarregue antes os seus recibos de donativos.',
    pushStaysTitle: '{place} vai ficar',
    pushStaysBody:
      'A comunidade fica no infunion. As contribuições mensais que foram paradas têm de ser iniciadas de novo.',
    mailClosingSubject: '{place} fecha a {date}',
    mailClosingHeading: 'A conta da sua comunidade vai fechar',
    mailClosingIntro:
      '{name} pediu para fechar a conta de {place}. Fecha a {date}.',
    mailClosingNow:
      'A partir de agora, a comunidade deixa de aparecer no mapa e na pesquisa, o código QR deixa de funcionar, as contribuições mensais estão paradas e o plano não será renovado. Os membros ainda podem ler tudo.',
    mailClosingThen:
      'A {date}, os conteúdos, as fotos, as mensagens e a lista de membros são apagados. As contribuições e os recibos são conservados, bloqueados, como exige a lei.',
    mailClosingExport:
      'Antes dessa data, descarregue todos os seus dados em Painel › Conta.',
    mailClosingUndo:
      'Mudou de ideias? Qualquer administrador pode manter a comunidade em Painel › Conta até {date}.',
    mailStaysSubject: '{place} fica no infunion',
    mailStaysHeading: 'O encerramento foi anulado',
    mailStaysIntro:
      '{name} manteve {place}. Nada será apagado. Os membros têm de iniciar de novo as contribuições mensais que foram paradas.',
    mailClosedSubject: '{place} está agora fechado',
    mailClosedHeading: 'A conta da sua comunidade está fechada',
    mailClosedIntro:
      'A conta de {place} fechou a {date}. Os conteúdos e a lista de membros foram apagados. As contribuições e os recibos são conservados bloqueados, como exige a lei; escreva para privacy@infunion.app se precisar deles.',
    openAdmin: 'Abrir Painel › Conta',
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

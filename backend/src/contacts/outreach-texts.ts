/**
 * The fixed words around a message a community sends outside the app,
 * in the member's language: the button, why they get it, how to stop it,
 * and the contribution and "stop" pages. What the team wrote goes in
 * as it is.
 */
export type OutreachText = {
  join: string;
  contribute: string;
  why: string;
  stop: string;
  giveTitle: string;
  giveIntro: string;
  giveProject: string;
  giveAmount: string;
  giveOther: string;
  madeWith: string;
  giveName: string;
  giveButton: string;
  giveSecure: string;
  giveDemo: string;
  thanksTitle: string;
  thanksText: string;
  cancelledTitle: string;
  cancelledText: string;
  stopTitle: string;
  stopText: string;
  stopButton: string;
  stoppedTitle: string;
  stoppedText: string;
  goneTitle: string;
  goneText: string;
  whatsappInvite: string;
  bizumButton: string;
  bizumTitle: string;
  bizumStep1: string;
  bizumSendTo: string;
  bizumAmount: string;
  bizumConcept: string;
  bizumConceptWhy: string;
  bizumSent: string;
  bizumThanksTitle: string;
  bizumThanksText: string;
  bizumWaiting: string;
  copy: string;
  copied: string;
};

const en: OutreachText = {
  join: 'Join our community',
  contribute: 'Make a contribution',
  why: 'You receive this email because you are a member of {community}.',
  stop: 'Stop these emails',
  giveTitle: 'Contribute to {community}',
  giveIntro: 'Thank you for supporting your community.',
  giveProject: 'For: {project}',
  giveAmount: 'Amount',
  giveOther: 'Other amount',
  madeWith: 'Made with',
  giveName: 'Your name (optional)',
  giveButton: 'Continue to payment',
  giveSecure: 'Secure payment with Stripe: card, Apple Pay, Google Pay or PayPal.',
  giveDemo: 'Demo: no money is taken.',
  thanksTitle: 'Thank you!',
  thanksText: 'Your contribution went through. You can close this page.',
  cancelledTitle: 'Payment cancelled',
  cancelledText: 'No payment was taken. You can close this page.',
  stopTitle: 'Stop emails from {community}?',
  stopText: 'You will no longer receive emails from {community} through infunion.',
  stopButton: 'Stop the emails',
  stoppedTitle: 'Done',
  stoppedText: '{community} will not write to you by email any more.',
  goneTitle: 'This link no longer works',
  goneText: 'It may have been removed by the community.',
  whatsappInvite: 'Hello {name}, {community} is now on infunion: times, news and contributions on your phone. Join us here: {link}',
  bizumButton: 'Pay with Bizum',
  bizumTitle: 'Send {amount} by Bizum',
  bizumStep1: 'Open your bank app and go to Bizum › Send money.',
  bizumSendTo: 'Send to',
  bizumAmount: 'Amount',
  bizumConcept: 'In the concept, write',
  bizumConceptWhy: 'So the team knows it’s you.',
  bizumSent: 'I’ve sent it',
  bizumThanksTitle: 'Thank you!',
  bizumThanksText: 'Your Bizum of {amount} is on its way to {community}. The team will confirm it once it reaches their account.',
  bizumWaiting: 'Waiting for confirmation',
  copy: 'Copy',
  copied: 'Copied',
};

const es: OutreachText = {
  join: 'Entrar en la comunidad',
  contribute: 'Hacer una contribución',
  why: 'Recibes este correo porque eres miembro de {community}.',
  stop: 'No quiero recibir más correos',
  giveTitle: 'Contribuir a {community}',
  giveIntro: 'Gracias por apoyar a tu comunidad.',
  giveProject: 'Para: {project}',
  giveAmount: 'Importe',
  giveOther: 'Otro importe',
  madeWith: 'Hecho con',
  giveName: 'Tu nombre (opcional)',
  giveButton: 'Continuar al pago',
  giveSecure: 'Pago seguro con Stripe: tarjeta, Apple Pay, Google Pay o PayPal.',
  giveDemo: 'Demostración: no se cobra nada.',
  thanksTitle: '¡Gracias!',
  thanksText: 'Tu contribución se ha realizado. Ya puedes cerrar esta página.',
  cancelledTitle: 'Pago cancelado',
  cancelledText: 'No se ha cobrado nada. Ya puedes cerrar esta página.',
  stopTitle: '¿Dejar de recibir correos de {community}?',
  stopText: 'Ya no recibirás correos de {community} a través de infunion.',
  stopButton: 'Dejar de recibirlos',
  stoppedTitle: 'Hecho',
  stoppedText: '{community} ya no te escribirá por correo.',
  goneTitle: 'Este enlace ya no funciona',
  goneText: 'Es posible que la comunidad lo haya eliminado.',
  whatsappInvite: 'Hola {name}, {community} ya está en infunion: horarios, avisos y contribuciones en tu móvil. Únete aquí: {link}',
  bizumButton: 'Pagar con Bizum',
  bizumTitle: 'Envía {amount} por Bizum',
  bizumStep1: 'Abre la app de tu banco y ve a Bizum › Enviar dinero.',
  bizumSendTo: 'Envíalo a',
  bizumAmount: 'Importe',
  bizumConcept: 'En el concepto, escribe',
  bizumConceptWhy: 'Así el equipo sabrá que eres tú.',
  bizumSent: 'Ya lo he enviado',
  bizumThanksTitle: '¡Gracias!',
  bizumThanksText: 'Tu Bizum de {amount} va de camino a {community}. El equipo lo confirmará cuando llegue a su cuenta.',
  bizumWaiting: 'Pendiente de confirmación',
  copy: 'Copiar',
  copied: 'Copiado',
};

const fr: OutreachText = {
  join: 'Rejoindre la communauté',
  contribute: 'Faire une contribution',
  why: 'Vous recevez cet e-mail car vous êtes membre de {community}.',
  stop: 'Ne plus recevoir ces e-mails',
  giveTitle: 'Contribuer à {community}',
  giveIntro: 'Merci de soutenir votre communauté.',
  giveProject: 'Pour : {project}',
  giveAmount: 'Montant',
  giveOther: 'Autre montant',
  madeWith: 'Réalisé avec',
  giveName: 'Votre nom (facultatif)',
  giveButton: 'Continuer vers le paiement',
  giveSecure: 'Paiement sécurisé avec Stripe : carte, Apple Pay, Google Pay ou PayPal.',
  giveDemo: 'Démonstration : aucun montant n’est prélevé.',
  thanksTitle: 'Merci !',
  thanksText: 'Votre contribution a bien été effectuée. Vous pouvez fermer cette page.',
  cancelledTitle: 'Paiement annulé',
  cancelledText: 'Aucun paiement n’a été pris. Vous pouvez fermer cette page.',
  stopTitle: 'Ne plus recevoir d’e-mails de {community} ?',
  stopText: 'Vous ne recevrez plus d’e-mails de {community} via infunion.',
  stopButton: 'Arrêter les e-mails',
  stoppedTitle: 'C’est fait',
  stoppedText: '{community} ne vous écrira plus par e-mail.',
  goneTitle: 'Ce lien ne fonctionne plus',
  goneText: 'La communauté l’a peut-être supprimé.',
  whatsappInvite: 'Bonjour {name}, {community} est maintenant sur infunion : horaires, nouvelles et contributions sur votre téléphone. Rejoignez-nous ici : {link}',
  bizumButton: 'Payer avec Bizum',
  bizumTitle: 'Envoyez {amount} par Bizum',
  bizumStep1: 'Ouvrez l’application de votre banque, puis Bizum › Envoyer de l’argent.',
  bizumSendTo: 'Envoyez à',
  bizumAmount: 'Montant',
  bizumConcept: 'Dans le motif, écrivez',
  bizumConceptWhy: 'Ainsi l’équipe saura que c’est vous.',
  bizumSent: 'Je l’ai envoyé',
  bizumThanksTitle: 'Merci !',
  bizumThanksText: 'Votre Bizum de {amount} est en route vers {community}. L’équipe le confirmera dès qu’il arrivera sur son compte.',
  bizumWaiting: 'En attente de confirmation',
  copy: 'Copier',
  copied: 'Copié',
};

const va: OutreachText = {
  join: 'Entrar en la comunitat',
  contribute: 'Fer una contribució',
  why: 'Reps este correu perquè eres membre de {community}.',
  stop: 'No vull rebre més correus',
  giveTitle: 'Contribuir a {community}',
  giveIntro: 'Gràcies per donar suport a la teua comunitat.',
  giveProject: 'Per a: {project}',
  giveAmount: 'Import',
  giveOther: 'Un altre import',
  madeWith: 'Fet amb',
  giveName: 'El teu nom (opcional)',
  giveButton: 'Continuar al pagament',
  giveSecure: 'Pagament segur amb Stripe: targeta, Apple Pay, Google Pay o PayPal.',
  giveDemo: 'Demostració: no es cobra res.',
  thanksTitle: 'Gràcies!',
  thanksText: 'La teua contribució s’ha fet. Ja pots tancar esta pàgina.',
  cancelledTitle: 'Pagament cancel·lat',
  cancelledText: 'No s’ha cobrat res. Ja pots tancar esta pàgina.',
  stopTitle: 'Deixar de rebre correus de {community}?',
  stopText: 'Ja no rebràs correus de {community} a través d’infunion.',
  stopButton: 'Deixar de rebre’ls',
  stoppedTitle: 'Fet',
  stoppedText: '{community} ja no t’escriurà per correu.',
  goneTitle: 'Este enllaç ja no funciona',
  goneText: 'És possible que la comunitat l’haja eliminat.',
  whatsappInvite: 'Hola {name}, {community} ja està en infunion: horaris, avisos i contribucions en el teu mòbil. Uneix-te ací: {link}',
  bizumButton: 'Pagar amb Bizum',
  bizumTitle: 'Envia {amount} per Bizum',
  bizumStep1: 'Obri l’app del teu banc i ves a Bizum › Enviar diners.',
  bizumSendTo: 'Envia’l a',
  bizumAmount: 'Import',
  bizumConcept: 'En el concepte, escriu',
  bizumConceptWhy: 'Així l’equip sabrà que eres tu.',
  bizumSent: 'Ja l’he enviat',
  bizumThanksTitle: 'Gràcies!',
  bizumThanksText: 'El teu Bizum de {amount} va cap a {community}. L’equip el confirmarà quan arribe al seu compte.',
  bizumWaiting: 'Pendent de confirmació',
  copy: 'Copiar',
  copied: 'Copiat',
};

const ca: OutreachText = {
  ...va,
  why: 'Reps aquest correu perquè ets membre de {community}.',
  giveIntro: 'Gràcies per donar suport a la teva comunitat.',
  thanksText: 'La teva contribució s’ha fet. Ja pots tancar aquesta pàgina.',
  cancelledText: 'No s’ha cobrat res. Ja pots tancar aquesta pàgina.',
  giveName: 'El teu nom (opcional)',
  goneTitle: 'Aquest enllaç ja no funciona',
  goneText: 'És possible que la comunitat l’hagi eliminat.',
  whatsappInvite: 'Hola {name}, {community} ja és a infunion: horaris, avisos i contribucions al teu mòbil. Uneix-t’hi aquí: {link}',
  bizumButton: 'Pagar amb Bizum',
  bizumTitle: 'Envia {amount} per Bizum',
  bizumStep1: 'Obre l’app del teu banc i ves a Bizum › Enviar diners.',
  bizumSendTo: 'Envia’l a',
  bizumAmount: 'Import',
  bizumConcept: 'Al concepte, escriu',
  bizumConceptWhy: 'Així l’equip sabrà que ets tu.',
  bizumSent: 'Ja l’he enviat',
  bizumThanksTitle: 'Gràcies!',
  bizumThanksText: 'El teu Bizum de {amount} va cap a {community}. L’equip el confirmarà quan arribi al seu compte.',
  bizumWaiting: 'Pendent de confirmació',
  copy: 'Copiar',
  copied: 'Copiat',
};

const gl: OutreachText = {
  join: 'Entrar na comunidade',
  contribute: 'Facer unha contribución',
  why: 'Recibes este correo porque es membro de {community}.',
  stop: 'Non quero recibir máis correos',
  giveTitle: 'Contribuír a {community}',
  giveIntro: 'Grazas por apoiar a túa comunidade.',
  giveProject: 'Para: {project}',
  giveAmount: 'Importe',
  giveOther: 'Outro importe',
  madeWith: 'Feito con',
  giveName: 'O teu nome (opcional)',
  giveButton: 'Continuar ao pagamento',
  giveSecure: 'Pagamento seguro con Stripe: tarxeta, Apple Pay, Google Pay ou PayPal.',
  giveDemo: 'Demostración: non se cobra nada.',
  thanksTitle: 'Grazas!',
  thanksText: 'A túa contribución realizouse. Xa podes pechar esta páxina.',
  cancelledTitle: 'Pagamento cancelado',
  cancelledText: 'Non se cobrou nada. Xa podes pechar esta páxina.',
  stopTitle: 'Deixar de recibir correos de {community}?',
  stopText: 'Xa non recibirás correos de {community} a través de infunion.',
  stopButton: 'Deixar de recibilos',
  stoppedTitle: 'Feito',
  stoppedText: '{community} xa non che escribirá por correo.',
  goneTitle: 'Esta ligazón xa non funciona',
  goneText: 'É posible que a comunidade a eliminase.',
  whatsappInvite: 'Ola {name}, {community} xa está en infunion: horarios, avisos e contribucións no teu móbil. Únete aquí: {link}',
  bizumButton: 'Pagar con Bizum',
  bizumTitle: 'Envía {amount} por Bizum',
  bizumStep1: 'Abre a app do teu banco e vai a Bizum › Enviar diñeiro.',
  bizumSendTo: 'Envíao a',
  bizumAmount: 'Importe',
  bizumConcept: 'No concepto, escribe',
  bizumConceptWhy: 'Así o equipo saberá que es ti.',
  bizumSent: 'Xa o enviei',
  bizumThanksTitle: 'Grazas!',
  bizumThanksText: 'O teu Bizum de {amount} vai camiño de {community}. O equipo confirmarao cando chegue á súa conta.',
  bizumWaiting: 'Pendente de confirmación',
  copy: 'Copiar',
  copied: 'Copiado',
};

const pt: OutreachText = {
  join: 'Entrar na comunidade',
  contribute: 'Fazer uma contribuição',
  why: 'Recebe este e-mail porque é membro de {community}.',
  stop: 'Não quero receber mais e-mails',
  giveTitle: 'Contribuir para {community}',
  giveIntro: 'Obrigado por apoiar a sua comunidade.',
  giveProject: 'Para: {project}',
  giveAmount: 'Montante',
  giveOther: 'Outro montante',
  madeWith: 'Feito com',
  giveName: 'O seu nome (opcional)',
  giveButton: 'Continuar para o pagamento',
  giveSecure: 'Pagamento seguro com a Stripe: cartão, Apple Pay, Google Pay ou PayPal.',
  giveDemo: 'Demonstração: nada é cobrado.',
  thanksTitle: 'Obrigado!',
  thanksText: 'A sua contribuição foi feita. Já pode fechar esta página.',
  cancelledTitle: 'Pagamento cancelado',
  cancelledText: 'Nada foi cobrado. Já pode fechar esta página.',
  stopTitle: 'Deixar de receber e-mails de {community}?',
  stopText: 'Deixará de receber e-mails de {community} através do infunion.',
  stopButton: 'Deixar de receber',
  stoppedTitle: 'Feito',
  stoppedText: '{community} não lhe voltará a escrever por e-mail.',
  goneTitle: 'Esta ligação já não funciona',
  goneText: 'A comunidade pode tê-la removido.',
  whatsappInvite: 'Olá {name}, {community} já está no infunion: horários, avisos e contribuições no seu telemóvel. Junte-se aqui: {link}',
  bizumButton: 'Pagar com Bizum',
  bizumTitle: 'Envie {amount} por Bizum',
  bizumStep1: 'Abra a app do seu banco e vá a Bizum › Enviar dinheiro.',
  bizumSendTo: 'Envie para',
  bizumAmount: 'Montante',
  bizumConcept: 'No conceito, escreva',
  bizumConceptWhy: 'Assim a equipa saberá que é você.',
  bizumSent: 'Já enviei',
  bizumThanksTitle: 'Obrigado!',
  bizumThanksText: 'O seu Bizum de {amount} está a caminho de {community}. A equipa vai confirmá-lo quando chegar à conta.',
  bizumWaiting: 'A aguardar confirmação',
  copy: 'Copiar',
  copied: 'Copiado',
};

const TEXTS: Record<string, OutreachText> = { en, es, fr, va, ca, gl, pt };

export function outreachText(language: string | null | undefined): OutreachText {
  return TEXTS[language ?? ''] ?? en;
}

export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (all, key: string) => values[key] ?? all);
}

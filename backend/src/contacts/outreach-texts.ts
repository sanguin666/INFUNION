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
  giveName: 'Your name (optional)',
  giveButton: 'Continue to payment',
  giveSecure: 'Secure payment with Stripe: card, Apple Pay or Google Pay.',
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
  giveName: 'Tu nombre (opcional)',
  giveButton: 'Continuar al pago',
  giveSecure: 'Pago seguro con Stripe: tarjeta, Apple Pay o Google Pay.',
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
  giveName: 'Votre nom (facultatif)',
  giveButton: 'Continuer vers le paiement',
  giveSecure: 'Paiement sécurisé avec Stripe : carte, Apple Pay ou Google Pay.',
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
  giveName: 'El teu nom (opcional)',
  giveButton: 'Continuar al pagament',
  giveSecure: 'Pagament segur amb Stripe: targeta, Apple Pay o Google Pay.',
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
  giveName: 'O teu nome (opcional)',
  giveButton: 'Continuar ao pagamento',
  giveSecure: 'Pagamento seguro con Stripe: tarxeta, Apple Pay ou Google Pay.',
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
  giveName: 'O seu nome (opcional)',
  giveButton: 'Continuar para o pagamento',
  giveSecure: 'Pagamento seguro com a Stripe: cartão, Apple Pay ou Google Pay.',
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
};

const TEXTS: Record<string, OutreachText> = { en, es, fr, va, ca, gl, pt };

export function outreachText(language: string | null | undefined): OutreachText {
  return TEXTS[language ?? ''] ?? en;
}

export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (all, key: string) => values[key] ?? all);
}

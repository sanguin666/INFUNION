import { Language } from '../common/enums/language.enum.js';
import type { ReportKind, ReportReason } from './entities/content-report.entity.js';

/** The words of the team's "something was reported" email and push. */
type Texts = {
  subject: string;
  heading: string;
  intro: string;
  kinds: Record<ReportKind, string>;
  reasons: Record<ReportReason, string>;
  soon: string;
  button: string;
  push: string;
};

const TEXTS: Record<Language, Texts> = {
  [Language.EN]: {
    subject: 'Something was reported in {place}',
    heading: 'A member reported something',
    intro: 'A member reported this {kind} for “{reason}”:',
    kinds: { post: 'post', comment: 'reply', prayer: 'prayer request' },
    reasons: {
      spam: 'Spam or advertising',
      hateful: 'Insulting or hateful',
      harassment: 'Harassment or threats',
      inappropriate: 'Inappropriate content',
      other: 'Something else',
    },
    soon: 'It is hidden for that member. Please look at it within 24 hours: remove it, keep it, or remove it and block the author from posting.',
    button: 'Open the reports',
    push: 'Reported ({reason}): {excerpt}',
  },
  [Language.ES]: {
    subject: 'Se ha denunciado algo en {place}',
    heading: 'Un miembro ha denunciado algo',
    intro: 'Un miembro ha denunciado esta {kind} por «{reason}»:',
    kinds: { post: 'publicación', comment: 'respuesta', prayer: 'petición de oración' },
    reasons: {
      spam: 'Spam o publicidad',
      hateful: 'Insultante u ofensivo',
      harassment: 'Acoso o amenazas',
      inappropriate: 'Contenido inapropiado',
      other: 'Otra cosa',
    },
    soon: 'Ya no lo ve ese miembro. Revísalo en un plazo de 24 horas: elimínalo, mantenlo, o elimínalo y bloquea al autor para que no publique.',
    button: 'Ver las denuncias',
    push: 'Denunciado ({reason}): {excerpt}',
  },
  [Language.FR]: {
    subject: 'Un contenu a été signalé dans {place}',
    heading: 'Un membre a signalé un contenu',
    intro: 'Un membre a signalé cette {kind} pour « {reason} » :',
    kinds: { post: 'publication', comment: 'réponse', prayer: 'intention de prière' },
    reasons: {
      spam: 'Spam ou publicité',
      hateful: 'Insultant ou haineux',
      harassment: 'Harcèlement ou menaces',
      inappropriate: 'Contenu inapproprié',
      other: 'Autre chose',
    },
    soon: 'Ce membre ne le voit plus. Merci de le regarder sous 24 heures : le retirer, le garder, ou le retirer et bloquer l’auteur.',
    button: 'Voir les signalements',
    push: 'Signalé ({reason}) : {excerpt}',
  },
  [Language.VA]: {
    subject: 'S’ha denunciat alguna cosa a {place}',
    heading: 'Un membre ha denunciat alguna cosa',
    intro: 'Un membre ha denunciat esta {kind} per «{reason}»:',
    kinds: { post: 'publicació', comment: 'resposta', prayer: 'petició d’oració' },
    reasons: {
      spam: 'Spam o publicitat',
      hateful: 'Insultant o ofensiu',
      harassment: 'Assetjament o amenaces',
      inappropriate: 'Contingut inadequat',
      other: 'Una altra cosa',
    },
    soon: 'Eixe membre ja no ho veu. Revisa-ho en 24 hores: elimina-ho, mantín-ho, o elimina-ho i bloqueja l’autor perquè no publique.',
    button: 'Veure les denúncies',
    push: 'Denunciat ({reason}): {excerpt}',
  },
  [Language.CA]: {
    subject: 'S’ha denunciat alguna cosa a {place}',
    heading: 'Un membre ha denunciat alguna cosa',
    intro: 'Un membre ha denunciat aquesta {kind} per «{reason}»:',
    kinds: { post: 'publicació', comment: 'resposta', prayer: 'petició d’oració' },
    reasons: {
      spam: 'Spam o publicitat',
      hateful: 'Insultant o ofensiu',
      harassment: 'Assetjament o amenaces',
      inappropriate: 'Contingut inadequat',
      other: 'Una altra cosa',
    },
    soon: 'Aquest membre ja no ho veu. Revisa-ho en 24 hores: elimina-ho, mantén-ho, o elimina-ho i bloqueja l’autor perquè no publiqui.',
    button: 'Veure les denúncies',
    push: 'Denunciat ({reason}): {excerpt}',
  },
  [Language.GL]: {
    subject: 'Denunciouse algo en {place}',
    heading: 'Un membro denunciou algo',
    intro: 'Un membro denunciou esta {kind} por «{reason}»:',
    kinds: { post: 'publicación', comment: 'resposta', prayer: 'petición de oración' },
    reasons: {
      spam: 'Spam ou publicidade',
      hateful: 'Insultante ou ofensivo',
      harassment: 'Acoso ou ameazas',
      inappropriate: 'Contido inapropiado',
      other: 'Outra cousa',
    },
    soon: 'Ese membro xa non o ve. Revísao nun prazo de 24 horas: elimínao, mantéñoo, ou elimínao e bloquea o autor para que non publique.',
    button: 'Ver as denuncias',
    push: 'Denunciado ({reason}): {excerpt}',
  },
  [Language.PT]: {
    subject: 'Algo foi denunciado em {place}',
    heading: 'Um membro denunciou algo',
    intro: 'Um membro denunciou o seguinte ({kind}) por «{reason}»:',
    kinds: { post: 'publicação', comment: 'resposta', prayer: 'pedido de oração' },
    reasons: {
      spam: 'Spam ou publicidade',
      hateful: 'Insultuoso ou de ódio',
      harassment: 'Assédio ou ameaças',
      inappropriate: 'Conteúdo inapropriado',
      other: 'Outra coisa',
    },
    soon: 'Esse membro já não o vê. Veja-o no prazo de 24 horas: remova-o, mantenha-o, ou remova-o e bloqueie o autor de publicar.',
    button: 'Ver as denúncias',
    push: 'Denunciado ({reason}): {excerpt}',
  },
};

export function moderationTexts(language?: Language | string): Texts {
  return TEXTS[language as Language] ?? TEXTS[Language.EN];
}

export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
}

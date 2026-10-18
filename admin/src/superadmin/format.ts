import type { ModuleType } from '../api/types';

// The superadmin section is Seb's alone, so it speaks French only.

export const MODULE_LABELS: Record<ModuleType, string> = {
  events: 'Événements',
  requests: 'Demandes',
  donations: 'Dons',
  mass_intentions: 'Intentions de messe',
  daily_readings: 'Lectures du jour',
  announcements: 'Actualités',
  livestreams: 'Direct',
  prayer_requests: 'Prières',
  community: 'Communauté',
};

export function moduleLabel(type: string): string {
  return MODULE_LABELS[type as ModuleType] ?? type;
}

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 0 });

export function eur(value: number): string {
  return euros.format(value);
}

const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const dayTime = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function dateFr(iso: string | null | undefined): string {
  return iso ? day.format(new Date(iso)) : '—';
}

export function dateTimeFr(iso: string | null | undefined): string {
  return iso ? dayTime.format(new Date(iso)) : '—';
}

export function ago(iso: string | null | undefined): string {
  if (!iso) return 'jamais';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 2) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'hier';
  if (days < 45) return `il y a ${days} jours`;
  return dateFr(iso);
}

const month = new Intl.DateTimeFormat('fr-FR', { month: 'short' });

export function monthShort(yyyyMm: string): string {
  return month.format(new Date(`${yyyyMm}-01T12:00:00Z`)).replace('.', '');
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Une erreur est survenue.';
}

/** Server error codes, in words. */
export function explain(message: string): string {
  const known: Record<string, string> = {
    wrong_code: 'Ce code ne correspond pas. Prenez le code affiché maintenant dans l’application.',
    wrong_password: 'Mot de passe incorrect.',
    already_admin: 'Cette personne est déjà admin de cette communauté.',
    superadmin_cannot_be_admin: 'Le compte superadmin ne peut pas être admin d’une communauté.',
    name_mismatch: 'Le nom tapé ne correspond pas exactement.',
    trial_used: 'L’essai gratuit de ce module a déjà été utilisé.',
    password_too_short: 'Le nouveau mot de passe doit faire au moins 12 caractères.',
  };
  return known[message] ?? message;
}

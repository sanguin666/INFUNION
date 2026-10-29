import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { intlLocale } from '../i18n/translations';
import { createBadge, deleteBadge, getBadges, reorderBadges, updateBadge, type BadgeInput } from '../api/badges';
import { getCampaigns } from '../api/donations';
import type { ActiveModule, BadgeKind, Campaign, ModuleType, PoiBadge } from '../api/types';
import { DestructiveButton } from '../components/DestructiveButton';
import { toDateInputValue } from '../format';
import { moduleName } from './MenuOrder';

// Kept in step with the backend's MAX_BADGE_TEXT.
const MAX_TEXT = 40;

const LIVE_STATUSES = new Set(['trial', 'active']);

type Draft = { text: string; important: boolean; linkModule: ModuleType | ''; showUntil: string };

const EMPTY_DRAFT: Draft = { text: '', important: false, linkModule: '', showUntil: '' };

function draftFrom(badge: PoiBadge): Draft {
  return {
    text: badge.text ?? '',
    important: badge.important,
    linkModule: badge.linkModule ?? '',
    showUntil: badge.showUntil ?? '',
  };
}

// Empty fields go as null, which clears them on an edit.
function inputFrom(draft: Draft): BadgeInput {
  return {
    text: draft.text.trim(),
    important: draft.important,
    linkModule: draft.linkModule || null,
    showUntil: draft.showUntil || null,
  };
}

/**
 * The small tiles at the very top of the place's home page in the app:
 * four that fill themselves (next Mass, office open or closed, next
 * confessions, a campaign's progress), only switched on or off, and the
 * messages the staff write. One white card lists them all in order; the
 * form beside it writes or edits a message.
 */
// The id the phone preview knows a message by while it is being typed.
export const DRAFT_BADGE_ID = 'draft';

type Props = {
  poiId: string;
  modules: ActiveModule[];
  // The badges as the phone preview should show them, the message in the
  // form included, and which of them differ from what is saved.
  onPreview?: (badges: PoiBadge[], drafts: string[]) => void;
};

export function BadgesSection({ poiId, modules, onPreview }: Props) {
  const { t, language } = useI18n();
  const [badges, setBadges] = useState<PoiBadge[] | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const textInput = useRef<HTMLInputElement>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    getBadges(poiId)
      .then(setBadges)
      .catch(() => setError(t('badges.loadError')));
    getCampaigns(poiId)
      .then(setCampaigns)
      // Only the campaign badge's picker needs these; without them it
      // still offers "the most recent".
      .catch(() => {});
  }, [poiId]);

  useEffect(() => {
    if (!onPreview || !badges) return;
    const input = inputFrom(draft);
    if (editingId) {
      const original = badges.find((b) => b.id === editingId);
      const changed = !!original && JSON.stringify(draftFrom(original)) !== JSON.stringify(draft);
      onPreview(
        badges.map((b) => (b.id === editingId ? { ...b, ...input, text: input.text || b.text } : b)),
        changed ? [editingId] : [],
      );
    } else if (input.text) {
      // A new message lands last, which is where adding it will put it.
      const typed: PoiBadge = {
        id: DRAFT_BADGE_ID,
        kind: 'message',
        position: badges.length,
        enabled: true,
        campaignId: null,
        createdAt: '',
        updatedAt: '',
        text: input.text,
        important: draft.important,
        linkModule: input.linkModule ?? null,
        showUntil: input.showUntil ?? null,
      };
      onPreview([...badges, typed], [DRAFT_BADGE_ID]);
    } else {
      onPreview(badges, []);
    }
  }, [badges, draft, editingId]);

  const AUTO_TITLES: Record<Exclude<BadgeKind, 'message'>, string> = {
    next_mass: t('badges.nextMassTitle'),
    office_hours: t('badges.officeHoursTitle'),
    next_confession: t('badges.nextConfessionTitle'),
    campaign: t('badges.campaignTitle'),
  };

  function replace(updated: PoiBadge) {
    setBadges((current) => current?.map((b) => (b.id === updated.id ? updated : b)) ?? null);
  }

  // "29/09" in French, "09/29" in English.
  function shortDate(value: string): string {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(intlLocale(language), { day: '2-digit', month: '2-digit' });
  }

  function describe(badge: PoiBadge): string {
    switch (badge.kind) {
      case 'next_mass':
      case 'next_confession':
        return t('badges.fromCalendar');
      case 'office_hours':
        return t('badges.fromOfficeHours');
      case 'campaign':
        return t('badges.campaignNote');
      case 'message': {
        const parts = [badge.important ? t('badges.styleImportantShort') : t('badges.styleNormal')];
        if (badge.showUntil) {
          const date = shortDate(badge.showUntil);
          parts.push(
            badge.showUntil < toDateInputValue(new Date().toISOString())
              ? t('badges.ended', { date })
              : t('badges.until', { date }),
          );
        }
        if (badge.linkModule) parts.push(t('badges.opens', { module: moduleName(badge.linkModule, t) }));
        return parts.join(' · ');
      }
    }
  }

  async function save(badge: PoiBadge, body: BadgeInput) {
    setError(null);
    try {
      replace(await updateBadge(poiId, badge.id, body));
    } catch {
      setError(t('badges.saveError'));
      replace(badge);
    }
  }

  function toggle(badge: PoiBadge) {
    // Shown at once; put back if the server says no.
    replace({ ...badge, enabled: !badge.enabled });
    save(badge, { enabled: !badge.enabled });
  }

  async function move(index: number, delta: number) {
    if (!badges) return;
    const target = index + delta;
    if (target < 0 || target >= badges.length) return;
    const next = [...badges];
    [next[index], next[target]] = [next[target], next[index]];
    setBadges(next);
    setError(null);
    try {
      setBadges(await reorderBadges(poiId, next.map((b) => b.id)));
    } catch {
      setError(t('badges.saveError'));
      // Put the list back the way the server still has it.
      setBadges(await getBadges(poiId).catch(() => badges));
    }
  }

  function startEdit(badge: PoiBadge) {
    setEditingId(badge.id);
    setDraft(draftFrom(badge));
    setFormOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setFormOpen(false);
  }

  // The form opens below the list: take the admin there. It stays on the
  // page rather than in a side panel so the phone preview, which shows
  // the badge as it is typed, stays in view.
  useEffect(() => {
    if (formOpen) textInput.current?.focus();
  }, [formOpen, editingId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.text.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      if (editingId) {
        replace(await updateBadge(poiId, editingId, inputFrom(draft)));
      } else {
        const created = await createBadge(poiId, { kind: 'message', enabled: true, ...inputFrom(draft) });
        setBadges((current) => [...(current ?? []), created]);
      }
      resetForm();
    } catch {
      setError(t('badges.saveError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteBadge(poiId, id);
      setBadges((current) => current?.filter((b) => b.id !== id) ?? null);
      if (editingId === id) resetForm();
    } catch {
      setError(t('badges.deleteError'));
    }
  }

  // The modules switched on, plus the one a message already opens if it
  // has since been switched off, so the picker never hides a saved choice.
  const linkable = modules.filter((m) => LIVE_STATUSES.has(m.status)).map((m) => m.moduleType);
  if (draft.linkModule && !linkable.includes(draft.linkModule)) linkable.push(draft.linkModule);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <section aria-label={t('badges.title')}>

      {error && <p className="error-text">{error}</p>}
      {badges === null && !error && <p className="muted">{t('badges.loading')}</p>}

      {badges && (
        <>
          <ol className="card card-list" style={{ listStyle: 'none', margin: '0 0 8px' }}>
            {badges.map((badge, index) => {
              const title =
                badge.kind === 'message' ? badge.text ?? '' : AUTO_TITLES[badge.kind];
              return (
                <li key={badge.id} className="card-row">
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn btn-icon"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={t('badges.moveUp')}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-icon"
                      onClick={() => move(index, 1)}
                      disabled={index === badges.length - 1}
                      aria-label={t('badges.moveDown')}
                    >
                      ↓
                    </button>
                  </div>
                  <span className="badge-kind">
                    {badge.kind === 'message' ? t('badges.kindMessage') : t('badges.kindAuto')}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="card-title" style={{ margin: 0, overflowWrap: 'anywhere' }}>
                      {title}
                    </p>
                    <p className="card-meta" style={{ margin: 0 }}>
                      {describe(badge)}
                      {badge.kind === 'campaign' && (
                        <>
                          {' · '}
                          <select
                            aria-label={t('badges.campaignLabel')}
                            value={badge.campaignId ?? ''}
                            onChange={(e) => {
                              const campaignId = e.target.value || null;
                              replace({ ...badge, campaignId });
                              save(badge, { campaignId });
                            }}
                            style={{ fontSize: 15, padding: '0 2px' }}
                          >
                            <option value="">{t('badges.latestCampaign')}</option>
                            {campaigns.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.title}
                              </option>
                            ))}
                          </select>
                        </>
                      )}
                    </p>
                  </div>
                  {badge.kind === 'message' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
                      <button type="button" className="text-action" onClick={() => startEdit(badge)}>
                        {t('badges.edit')}
                      </button>
                      <DestructiveButton quiet label={t('badges.delete')} onConfirm={() => handleDelete(badge.id)} />
                    </div>
                  )}
                  <input
                    type="checkbox"
                    role="switch"
                    className="switch"
                    checked={badge.enabled}
                    onChange={() => toggle(badge)}
                    aria-label={t('badges.showLabel', { name: title })}
                  />
                </li>
              );
            })}
          </ol>
          <p className="muted" style={{ marginTop: 0, fontSize: 15 }}>
            {t('badges.orderNote')}
          </p>

          {!formOpen && (
            <div className="tab-actions" style={{ justifyContent: 'flex-start' }}>
              <button type="button" className="btn btn-primary" onClick={() => setFormOpen(true)}>
                {t('tabs.addMessage')}
              </button>
            </div>
          )}

          {formOpen && (
            <>
              <h3 id="badge-form-heading">{editingId ? t('badges.editTitle') : t('badges.addTitle')}</h3>
              <form className="form card" onSubmit={handleSubmit} aria-labelledby="badge-form-heading">
                <label>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span>{t('badges.textLabel', { n: MAX_TEXT })}</span>
                    <span aria-live="polite">
                      {draft.text.length}/{MAX_TEXT}
                    </span>
                  </span>
                  <input
                    ref={textInput}
                    value={draft.text}
                    maxLength={MAX_TEXT}
                    onChange={(e) => set({ text: e.target.value })}
                    placeholder={t('badges.textPlaceholder')}
                    required
                  />
                </label>
                <div className="form-row">
                  <span id="badge-style-label">{t('badges.styleLabel')}</span>
                  <div className="chips" role="radiogroup" aria-labelledby="badge-style-label">
                    {[false, true].map((important) => (
                      <button
                        key={String(important)}
                        type="button"
                        role="radio"
                        aria-checked={draft.important === important}
                        className={`chip ${draft.important === important ? 'chip-selected' : ''}`}
                        onClick={() => set({ important })}
                      >
                        {important ? t('badges.styleImportant') : t('badges.styleNormal')}
                      </button>
                    ))}
                  </div>
                </div>
                <label>
                  {t('badges.linkLabel')}
                  <select
                    value={draft.linkModule}
                    onChange={(e) => set({ linkModule: e.target.value as ModuleType | '' })}
                  >
                    <option value="">{t('badges.linkNone')}</option>
                    {linkable.map((type) => (
                      <option key={type} value={type}>
                        {moduleName(type, t)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('badges.untilLabel')}
                  <input type="date" value={draft.showUntil} onChange={(e) => set({ showUntil: e.target.value })} />
                </label>
                <div className="card-actions">
                  <button type="submit" className="btn btn-primary" disabled={submitting || !draft.text.trim()}>
                    {submitting
                      ? t('badges.saving')
                      : editingId
                        ? t('badges.save')
                        : t('badges.add')}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={resetForm}
                    disabled={submitting}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            </>
          )}
        </>
      )}
    </section>
  );
}

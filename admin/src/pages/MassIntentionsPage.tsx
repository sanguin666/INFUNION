import { NavLink } from 'react-router-dom';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { usePoiId } from '../layout/usePoiId';
import { useI18n } from '../i18n/I18nContext';
import { intlLocale } from '../i18n/translations';
import { useAuth } from '../auth/AuthContext';
import { getEvents } from '../api/events';
import {
  addOfficeIntention,
  getIntentionSettings,
  getIntentions,
  updateIntention,
  updateIntentionSettings,
  type IntentionFilter,
} from '../api/massIntentions';
import type { Event, MassIntention, MassIntentionStatus } from '../api/types';
import { DestructiveButton } from '../components/DestructiveButton';
import { CURRENCY, formatMoney, fromLocalInputValue } from '../format';
import { occurrencesBetween } from '../schedule';

// How far ahead the celebration picker offers the community's Masses.
const PICKER_WEEKS = 6;

type Celebration = { at: string; title: string };

// The Masses coming up in the next few weeks, repeating ones included
// (see schedule.ts).
function upcomingMasses(events: Event[]): Celebration[] {
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + PICKER_WEEKS * 7);
  const masses = events.filter((event) => event.category === 'mass');
  return occurrencesBetween(masses, now, horizon).map(({ event, at }) => ({
    at: at.toISOString(),
    title: event.title,
  }));
}

// Which celebration the picker is on: '' for "whenever the community can",
// 'other' for a date typed by hand, or one of the Masses above by its key.
type Choice = { key: string; otherAt: string; otherTitle: string };

const NO_CHOICE: Choice = { key: '', otherAt: '', otherTitle: '' };

function celebrationKey(c: Celebration): string {
  return `${c.at}|${c.title}`;
}

function resolveChoice(choice: Choice, masses: Celebration[]): { celebrationAt: string | null; celebrationTitle: string | null } {
  if (choice.key === 'other') {
    return {
      celebrationAt: choice.otherAt ? fromLocalInputValue(choice.otherAt) : null,
      celebrationTitle: choice.otherTitle.trim() || null,
    };
  }
  const mass = masses.find((m) => celebrationKey(m) === choice.key);
  return mass ? { celebrationAt: mass.at, celebrationTitle: mass.title } : { celebrationAt: null, celebrationTitle: null };
}

function CelebrationFields({
  masses,
  choice,
  onChange,
  formatWhen,
}: {
  masses: Celebration[];
  choice: Choice;
  onChange: (next: Choice) => void;
  formatWhen: (iso: string) => string;
}) {
  const { t } = useI18n();
  return (
    <>
      <label>
        {t('massIntentions.celebrationLabel')}
        <select value={choice.key} onChange={(e) => onChange({ ...choice, key: e.target.value })}>
          <option value="">{t('massIntentions.noDate')}</option>
          {masses.map((mass) => (
            <option key={celebrationKey(mass)} value={celebrationKey(mass)}>
              {formatWhen(mass.at)} · {mass.title}
            </option>
          ))}
          <option value="other">{t('massIntentions.otherDate')}</option>
        </select>
      </label>
      {choice.key === 'other' && (
        <>
          <label>
            {t('massIntentions.otherAtLabel')}
            <input
              type="datetime-local"
              value={choice.otherAt}
              onChange={(e) => onChange({ ...choice, otherAt: e.target.value })}
            />
          </label>
          <label>
            {t('massIntentions.otherTitleLabel')}
            <input
              value={choice.otherTitle}
              onChange={(e) => onChange({ ...choice, otherTitle: e.target.value })}
              placeholder={t('massIntentions.otherTitlePlaceholder')}
            />
          </label>
        </>
      )}
    </>
  );
}

type Group = { key: string; celebrationAt: string | null; celebrationTitle: string | null; items: MassIntention[] };

// One group per celebration (its date and its title), in the order the
// server sends them: undated first, then soonest.
function groupByCelebration(items: MassIntention[]): Group[] {
  const groups: Group[] = [];
  for (const item of items) {
    const key = `${item.celebrationAt ?? ''}|${item.celebrationTitle ?? ''}`;
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, celebrationAt: item.celebrationAt, celebrationTitle: item.celebrationTitle, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

export function MassIntentionsPage() {
  const poiId = usePoiId();
  const { user } = useAuth();
  const { t, language } = useI18n();
  const [filter, setFilter] = useState<IntentionFilter>('upcoming');
  const [items, setItems] = useState<MassIntention[] | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [intention, setIntention] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [requesterContact, setRequesterContact] = useState('');
  const [choice, setChoice] = useState<Choice>(NO_CHOICE);
  const [offering, setOffering] = useState('');
  const [adding, setAdding] = useState(false);

  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveChoice, setMoveChoice] = useState<Choice>(NO_CHOICE);

  const [settingsOffering, setSettingsOffering] = useState<number | null | undefined>(undefined);
  const [offeringInput, setOfferingInput] = useState('');
  const [savingOffering, setSavingOffering] = useState(false);
  const [offeringSaved, setOfferingSaved] = useState(false);
  // No payment account yet: offerings can't be paid in the app.
  const [paymentsReady, setPaymentsReady] = useState(true);

  const masses = useMemo(() => upcomingMasses(events), [events]);
  const poiName = user?.adminPois.find((p) => p.id === poiId)?.name ?? '';

  useEffect(() => {
    getIntentions(poiId, filter)
      .then(setItems)
      .catch(() => setError(t('massIntentions.loadError')));
  }, [poiId, filter]);

  useEffect(() => {
    getEvents(poiId)
      .then(setEvents)
      // The picker then only offers "no date" and "another date".
      .catch(() => setEvents([]));
    getIntentionSettings(poiId)
      .then(({ offeringAmount, paymentsReady: ready }) => {
        setPaymentsReady(ready !== false);
        setSettingsOffering(offeringAmount);
        setOfferingInput(offeringAmount === null ? '' : String(offeringAmount));
        setOffering(offeringAmount === null ? '' : String(offeringAmount));
      })
      .catch(() => setError(t('massIntentions.loadError')));
  }, [poiId]);

  const formatWhen = (iso: string) =>
    new Date(iso).toLocaleString(intlLocale(language), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });

  function replace(updated: MassIntention) {
    setItems((current) => {
      if (!current) return current;
      // The default view is what is still to be said: anything no longer
      // confirmed leaves it.
      if (filter === 'upcoming' && updated.status !== 'confirmed') {
        return current.filter((i) => i.id !== updated.id);
      }
      return current.map((i) => (i.id === updated.id ? updated : i));
    });
  }

  async function setStatus(id: string, status: MassIntentionStatus) {
    setError(null);
    try {
      replace(await updateIntention(poiId, id, { status }));
    } catch {
      setError(t('massIntentions.saveError'));
    }
  }

  async function markGroupCelebrated(group: Group) {
    setError(null);
    try {
      for (const item of group.items.filter((i) => i.status === 'confirmed')) {
        replace(await updateIntention(poiId, item.id, { status: 'celebrated' }));
      }
    } catch {
      setError(t('massIntentions.saveError'));
    }
  }

  function startMove(item: MassIntention) {
    setMovingId(item.id);
    const match = masses.find((m) => m.at === item.celebrationAt && m.title === item.celebrationTitle);
    setMoveChoice(match ? { ...NO_CHOICE, key: celebrationKey(match) } : NO_CHOICE);
  }

  async function saveMove(id: string) {
    setError(null);
    try {
      // Moved to another celebration: fetch again so it lands in its new group.
      await updateIntention(poiId, id, resolveChoice(moveChoice, masses));
      setItems(await getIntentions(poiId, filter));
      setMovingId(null);
    } catch {
      setError(t('massIntentions.saveError'));
    }
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!intention.trim() || !requesterName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const amount = offering.trim() === '' ? null : Number(offering);
      await addOfficeIntention(poiId, {
        intention: intention.trim(),
        requesterName: requesterName.trim(),
        requesterContact: requesterContact.trim() || undefined,
        ...resolveChoice(choice, masses),
        offeringAmount: amount !== null && Number.isFinite(amount) ? amount : null,
      });
      setItems(await getIntentions(poiId, filter));
      setIntention('');
      setRequesterName('');
      setRequesterContact('');
      setChoice(NO_CHOICE);
      setOffering(settingsOffering == null ? '' : String(settingsOffering));
    } catch {
      setError(t('massIntentions.addError'));
    } finally {
      setAdding(false);
    }
  }

  async function saveOffering() {
    setSavingOffering(true);
    setOfferingSaved(false);
    setError(null);
    try {
      const value = offeringInput.trim() === '' ? null : Number(offeringInput);
      const result = await updateIntentionSettings(poiId, value !== null && Number.isFinite(value) ? value : null);
      setSettingsOffering(result.offeringAmount);
      setOfferingInput(result.offeringAmount === null ? '' : String(result.offeringAmount));
      setOfferingSaved(true);
    } catch {
      setError(t('massIntentions.offeringError'));
    } finally {
      setSavingOffering(false);
    }
  }

  const groups = items ? groupByCelebration(items) : [];
  const offeringDirty =
    settingsOffering !== undefined && offeringInput.trim() !== (settingsOffering === null ? '' : String(settingsOffering));

  function statusWord(status: MassIntentionStatus): string | null {
    if (status === 'celebrated') return t('massIntentions.statusCelebrated');
    if (status === 'cancelled') return t('massIntentions.statusCancelled');
    return null;
  }

  return (
    <div>
      <h2 className="no-print">{t('massIntentions.title')}</h2>
      <p className="muted no-print">{t('massIntentions.subtitle')}</p>

      <div className="no-print">

        <form className="form card" onSubmit={handleAdd}>
          <p className="card-title" style={{ margin: '12px 0 0' }}>
            {t('massIntentions.addTitle')}
          </p>
          <label>
            {t('massIntentions.intentionLabel')}
            <textarea
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              placeholder={t('massIntentions.intentionPlaceholder')}
              required
            />
          </label>
          <label>
            {t('massIntentions.requesterNameLabel')}
            <input value={requesterName} onChange={(e) => setRequesterName(e.target.value)} required />
          </label>
          <label>
            {t('massIntentions.requesterContactLabel')}
            <input value={requesterContact} onChange={(e) => setRequesterContact(e.target.value)} />
          </label>
          <CelebrationFields masses={masses} choice={choice} onChange={setChoice} formatWhen={formatWhen} />
          <label>
            {t('massIntentions.offeringReceivedLabel', { currency: CURRENCY })}
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={offering}
              onChange={(e) => setOffering(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={adding || !intention.trim() || !requesterName.trim()}
          >
            {adding ? t('massIntentions.adding') : t('massIntentions.add')}
          </button>
        </form>

        <h3>{t('massIntentions.registerTitle')}</h3>
        <div className="card-actions" style={{ marginTop: 0, marginBottom: 16, justifyContent: 'space-between' }}>
          <label>
            {t('massIntentions.filterLabel')}{' '}
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value as IntentionFilter);
                setItems(null);
                setError(null);
              }}
            >
              <option value="upcoming">{t('massIntentions.filterUpcoming')}</option>
              <option value="all">{t('massIntentions.filterAll')}</option>
            </select>
          </label>
          <button type="button" className="btn" onClick={() => window.print()} disabled={!items?.length}>
            {t('massIntentions.print')}
          </button>
        </div>

        {error && <p className="error-text">{error}</p>}
        {items === null && !error && <p className="muted">{t('massIntentions.loading')}</p>}
        {items?.length === 0 && <p className="muted">{t('massIntentions.empty')}</p>}
      </div>

      {/* What the print button prints: just the register, for the celebrant. */}
      <div className="print-area">
        <div className="print-only">
          <h2>{t('massIntentions.printTitle')}</h2>
          <p>
            {poiName}
            {poiName ? ' · ' : ''}
            {new Date().toLocaleDateString(intlLocale(language), { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {groups.map((group) => {
          const confirmed = group.items.filter((i) => i.status === 'confirmed');
          return (
            <section key={group.key} className="card" aria-label={group.celebrationTitle ?? undefined}>
              <p className="card-title">
                {group.celebrationAt ? formatWhen(group.celebrationAt) : t('massIntentions.noDateHeading')}
                {group.celebrationTitle ? ` · ${group.celebrationTitle}` : ''}
              </p>
              <ul className="card-rows" style={{ marginTop: 4 }}>
                {group.items.map((item) =>
                  movingId === item.id ? (
                    <li key={item.id} className="card-row no-print" style={{ display: 'block' }}>
                      <p style={{ margin: 0, fontWeight: 700 }}>{item.intention}</p>
                      <div className="form">
                        <CelebrationFields
                          masses={masses}
                          choice={moveChoice}
                          onChange={setMoveChoice}
                          formatWhen={formatWhen}
                        />
                      </div>
                      <div className="card-actions" style={{ marginTop: 8 }}>
                        <button type="button" className="btn btn-primary" onClick={() => saveMove(item.id)}>
                          {t('massIntentions.saveMove')}
                        </button>
                        <button type="button" className="btn" onClick={() => setMovingId(null)}>
                          {t('common.cancel')}
                        </button>
                      </div>
                    </li>
                  ) : (
                    <li key={item.id} className="card-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 280px' }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 19 }}>{item.intention}</p>
                        <p className="card-meta">
                          {[
                            t('massIntentions.askedBy', { name: item.requesterName }),
                            item.requesterContact,
                            item.offeringAmount !== null ? formatMoney(item.offeringAmount) : null,
                            item.fromOffice ? t('massIntentions.fromOffice') : t('massIntentions.fromApp'),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        {statusWord(item.status) && (
                          <span className={`badge ${item.status === 'celebrated' ? 'badge-active' : ''}`}>
                            {statusWord(item.status)}
                          </span>
                        )}
                      </div>
                      <div className="card-actions no-print" style={{ marginTop: 0 }}>
                        {item.status === 'confirmed' ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => setStatus(item.id, 'celebrated')}
                            >
                              {t('massIntentions.markCelebrated')}
                            </button>
                            <button type="button" className="btn" onClick={() => startMove(item)}>
                              {t('massIntentions.move')}
                            </button>
                            <DestructiveButton
                              label={t('massIntentions.cancelIntention')}
                              onConfirm={() => setStatus(item.id, 'cancelled')}
                            />
                          </>
                        ) : (
                          <button type="button" className="btn" onClick={() => setStatus(item.id, 'confirmed')}>
                            {t('massIntentions.putBack')}
                          </button>
                        )}
                      </div>
                    </li>
                  ),
                )}
              </ul>
              {confirmed.length > 1 && (
                <div className="card-actions no-print">
                  <button type="button" className="btn btn-primary" onClick={() => markGroupCelebrated(group)}>
                    {t('massIntentions.markAllCelebrated', { n: confirmed.length })}
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {settingsOffering !== undefined && (
        <div className="card form no-print" style={{ marginTop: 24 }}>
          <p className="card-title" style={{ margin: '12px 0 0' }}>
            {t('massIntentions.offeringTitle')}
          </p>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {t('massIntentions.offeringHint')}
          </p>
          {!paymentsReady && (
            <p className="payouts-inline-note">
              {t('payouts.massNote')}{' '}
              <NavLink to={`/poi/${poiId}/donations`}>{t('payouts.setUp')}</NavLink>
            </p>
          )}
          <label>
            {t('massIntentions.offeringLabel', { currency: CURRENCY })}
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={offeringInput}
              onChange={(e) => {
                setOfferingInput(e.target.value);
                setOfferingSaved(false);
              }}
              placeholder={t('massIntentions.offeringPlaceholder')}
            />
          </label>
          <div className="card-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={savingOffering || !offeringDirty}
              onClick={saveOffering}
            >
              {savingOffering ? t('massIntentions.saving') : t('massIntentions.saveOffering')}
            </button>
            {offeringSaved && !offeringDirty && <span className="muted">{t('massIntentions.saved')}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

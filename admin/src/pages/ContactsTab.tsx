import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { intlLocale } from '../i18n/translations';
import { Dialog } from '../components/Dialog';
import {
  addContact,
  deleteContact,
  exportContact,
  sendOutreach,
  updateContact,
  whatsappInvite,
  type ContactRow,
} from '../api/contacts';

type T = ReturnType<typeof useI18n>['t'];
type Filter = 'all' | 'notInvited' | 'invited' | 'stopped';

/** Seven days before the same person can be invited again (the server's rule too). */
const REINVITE_MS = 7 * 24 * 3600 * 1000;

function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function contactName(c: Pick<ContactRow, 'firstName' | 'lastName' | 'email' | 'phone'>, t: T): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || c.phone || t('members.unnamed');
}

function initials(c: Pick<ContactRow, 'firstName' | 'lastName'>): string {
  return [c.firstName, c.lastName].map((p) => p?.trim()[0] ?? '').join('').toUpperCase() || '·';
}

function matches(c: ContactRow, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const text = fold([c.firstName, c.lastName, c.email, c.telegram, ...c.groups].filter(Boolean).join(' '));
  const digits = `${c.phone ?? ''} ${c.whatsapp ?? ''}`.replace(/\D/g, '');
  return words.every((w) => text.includes(w) || (/\d/.test(w) && digits.includes(w.replace(/\D/g, ''))));
}

function canInvite(c: ContactRow): boolean {
  return !c.userId && !!c.email && c.status !== 'stopped' && (!c.invitedAt || Date.now() - new Date(c.invitedAt).getTime() > REINVITE_MS);
}

/**
 * "Not in the app yet" on the Members page (Seb, 9 Nov 2026): the people
 * on the community's own list who haven't signed in to the app, with
 * where each one stands and a quick invitation by email or WhatsApp.
 */
export function ContactsTab({
  poiId,
  contacts,
  onChange,
}: {
  poiId: string;
  contacts: ContactRow[];
  onChange: (next: ContactRow[]) => void;
}) {
  const { t, language } = useI18n();
  const [filter, setFilter] = useState<Filter>('all');
  const [group, setGroup] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<ContactRow | 'new' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const waiting = contacts.filter((c) => !c.userId);
  const groups = [...new Set(waiting.flatMap((c) => c.groups))].sort((a, b) => a.localeCompare(b));
  const count = (f: Filter) =>
    waiting.filter((c) => (f === 'all' ? true : f === 'notInvited' ? c.status === 'notInApp' : c.status === f)).length;
  const shown = waiting.filter(
    (c) =>
      (filter === 'all' || (filter === 'notInvited' ? c.status === 'notInApp' : c.status === filter)) &&
      (!group || c.groups.includes(group)) &&
      (!query.trim() || matches(c, query)),
  );
  const date = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(language), { day: 'numeric', month: 'short' });

  function replace(row: ContactRow) {
    onChange(contacts.some((c) => c.id === row.id) ? contacts.map((c) => (c.id === row.id ? row : c)) : [row, ...contacts]);
  }

  async function invite(c: ContactRow) {
    setBusy(c.id);
    setError(null);
    setNotice(null);
    try {
      await sendOutreach(poiId, {
        kind: 'invitation',
        audience: 'contacts',
        contactIds: [c.id],
        subject: t('contacts.inviteSubjectDefault'),
        body: t('contacts.inviteBodyDefault'),
      });
      replace({ ...c, status: 'invited', invitedAt: new Date().toISOString() });
      setNotice(t('contacts.invitedOne', { name: contactName(c, t) }));
    } catch (err) {
      setError((err as Error).message === 'allowance_exceeded' ? t('contacts.allowanceExceeded') : t('contacts.sendError'));
    } finally {
      setBusy(null);
    }
  }

  async function whatsapp(c: ContactRow) {
    // Opened first, filled once the link is ready: a window opened after
    // an await is blocked as a pop-up.
    const tab = window.open('', '_blank');
    setError(null);
    try {
      const { url } = await whatsappInvite(poiId, c.id);
      if (tab) tab.location.href = url;
      else window.location.href = url;
      replace({ ...c, status: c.status === 'stopped' ? 'stopped' : 'invited', invitedAt: new Date().toISOString() });
    } catch {
      tab?.close();
      setError(t('contacts.sendError'));
    }
  }

  async function download(c: ContactRow) {
    try {
      const data = await exportContact(poiId, c.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fold(contactName(c, t)).replace(/[^a-z0-9]+/g, '-')}-data.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      setError(t('members.dataError'));
    }
  }

  async function remove(c: ContactRow) {
    if (!window.confirm(t('contacts.removeConfirm', { name: contactName(c, t) }))) return;
    try {
      await deleteContact(poiId, c.id);
      onChange(contacts.filter((x) => x.id !== c.id));
      setEditing(null);
    } catch {
      setError(t('members.dataError'));
    }
  }

  function statusLine(c: ContactRow): { text: string; tone: string } {
    if (c.status === 'stopped') return { text: t('contacts.statusStopped'), tone: 'contact-status-stopped' };
    if (c.status === 'invited' && c.invitedAt) {
      return {
        text: `${t('contacts.statusInvited', { date: date(c.invitedAt) })}${c.invitationClicked ? ` · ${t('contacts.opened')}` : ''}`,
        tone: 'contact-status-invited',
      };
    }
    return { text: t('contacts.statusNotInApp'), tone: 'contact-status-waiting' };
  }

  if (waiting.length === 0) {
    return (
      <div className="card">
        <p className="card-title">{t('contacts.emptyTitle')}</p>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          {t('contacts.emptyText')}
        </p>
        <div className="card-actions">
          <Link to="import" className="btn btn-primary">
            {t('contacts.import')}
          </Link>
          <button type="button" className="btn" onClick={() => setEditing('new')}>
            {t('contacts.addOne')}
          </button>
        </div>
        <ContactDialog poiId={poiId} editing={editing} onClose={() => setEditing(null)} onSaved={replace} onRemove={remove} />
      </div>
    );
  }

  return (
    <div>
      <div className="chips" role="group" aria-label={t('contacts.filterLabel')}>
        {(['all', 'notInvited', 'invited', 'stopped'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            className={`chip${filter === f ? ' chip-selected' : ''}`}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {t(`contacts.filter_${f}`)} {count(f)}
          </button>
        ))}
        {groups.length > 0 && (
          <select className="chip" value={group} onChange={(e) => setGroup(e.target.value)} aria-label={t('contacts.groupLabel')}>
            <option value="">{t('contacts.allGroups')}</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="card form">
        <label>
          {t('members.search')}
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {error && <p className="error-text">{error}</p>}
      {notice && <p className="muted">{notice}</p>}
      {shown.length === 0 && <p className="muted">{t('members.noMatch')}</p>}
      {shown.length > 0 && (
        <div className="card card-list" role="list">
          {shown.slice(0, 300).map((c) => {
            const status = statusLine(c);
            const phone = c.whatsapp || c.phone;
            return (
              <div key={c.id} className="card-row" role="listitem">
                <span className="member-initials member-initials-waiting" aria-hidden="true">
                  {initials(c)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="card-title" style={{ margin: 0, fontSize: 17 }}>
                    {contactName(c, t)}
                  </p>
                  <p className="card-meta member-preview">
                    {[c.email, phone, c.telegram, c.groups.join(', ')].filter(Boolean).join(' · ')}
                  </p>
                  <p className={`card-meta contact-status ${status.tone}`}>{status.text}</p>
                </div>
                <button type="button" className="text-action" onClick={() => setEditing(c)}>
                  {t('contacts.edit')}
                </button>
                {phone && c.status !== 'stopped' && (
                  <button type="button" className="text-action" onClick={() => void whatsapp(c)}>
                    {t('contacts.whatsapp')}
                  </button>
                )}
                {canInvite(c) && (
                  <button type="button" className="btn" disabled={busy === c.id} onClick={() => void invite(c)}>
                    {c.invitedAt ? t('contacts.remind') : t('contacts.invite')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {shown.length > 300 && <p className="muted">{t('contacts.moreRows', { count: shown.length - 300 })}</p>}
      <p className="muted" style={{ fontSize: 15 }}>
        {t('contacts.linkHint')}
      </p>
      <div className="card-actions">
        <button type="button" className="btn" onClick={() => setEditing('new')}>
          {t('contacts.addOne')}
        </button>
      </div>
      <ContactDialog
        poiId={poiId}
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={replace}
        onRemove={remove}
        onExport={download}
      />
    </div>
  );
}

function ContactDialog({
  poiId,
  editing,
  onClose,
  onSaved,
  onRemove,
  onExport,
}: {
  poiId: string;
  editing: ContactRow | 'new' | null;
  onClose: () => void;
  onSaved: (row: ContactRow) => void;
  onRemove: (row: ContactRow) => void;
  onExport?: (row: ContactRow) => void;
}) {
  const { t } = useI18n();
  const current = editing && editing !== 'new' ? editing : null;
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', whatsapp: '', telegram: '', groups: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setError(null);
    setForm({
      firstName: current?.firstName ?? '',
      lastName: current?.lastName ?? '',
      email: current?.email ?? '',
      phone: current?.phone ?? '',
      whatsapp: current?.whatsapp ?? '',
      telegram: current?.telegram ?? '',
      groups: current?.groups.join(', ') ?? '',
    });
  }, [editing]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fields = {
      ...form,
      groups: form.groups.split(',').map((g) => g.trim()).filter(Boolean),
    };
    try {
      onSaved(current ? await updateContact(poiId, current.id, fields) : await addContact(poiId, fields));
      onClose();
    } catch (err) {
      const message = (err as Error).message;
      setError(
        message === 'already_on_list'
          ? t('contacts.alreadyOnList')
          : ['unreachable', 'badEmail', 'badPhone'].includes(message)
            ? t(`contacts.problem_${message as 'unreachable' | 'badEmail' | 'badPhone'}`)
            : t('contacts.saveError'),
      );
    } finally {
      setSaving(false);
    }
  }

  const field = (key: keyof typeof form, label: string, type = 'text') => (
    <label>
      {label}
      <input type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </label>
  );

  return (
    <Dialog
      open={editing !== null}
      onClose={onClose}
      title={current ? t('contacts.editTitle') : t('contacts.addTitle')}
      closeLabel={t('contacts.close')}
    >
      <form className="card form" onSubmit={save}>
        {field('firstName', t('contacts.field_firstName'))}
        {field('lastName', t('contacts.field_lastName'))}
        {field('email', t('contacts.field_email'), 'email')}
        {field('phone', t('contacts.field_phone'), 'tel')}
        {field('whatsapp', t('contacts.field_whatsapp'), 'tel')}
        {field('telegram', t('contacts.field_telegram'))}
        {field('groups', t('contacts.groupsHint'))}
        {error && <p className="error-text">{error}</p>}
        <div className="card-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {t('contacts.save')}
          </button>
          {current && onExport && (
            <button type="button" className="text-action" onClick={() => onExport(current)}>
              {t('members.dataExport')}
            </button>
          )}
          {current && (
            <button type="button" className="text-action text-action-destructive" onClick={() => onRemove(current)}>
              {t('contacts.remove')}
            </button>
          )}
        </div>
      </form>
    </Dialog>
  );
}

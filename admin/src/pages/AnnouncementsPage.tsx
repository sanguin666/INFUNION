import { useEffect, useState, type FormEvent } from 'react';
import { usePoiId } from '../layout/usePoiId';
import { useI18n } from '../i18n/I18nContext';
import { intlLocale } from '../i18n/translations';
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  removeAnnouncementImage,
  updateAnnouncement,
  uploadAnnouncementImage,
} from '../api/announcements';
import { API_BASE_URL } from '../api/client';
import type { Announcement } from '../api/types';
import { DestructiveButton } from '../components/DestructiveButton';

// `notify` is null until somebody picks: it then follows `important`.
type Draft = { title: string; body: string; important: boolean; notify: boolean | null; photo: File | null };

const EMPTY_DRAFT: Draft = { title: '', body: '', important: false, notify: null, photo: null };

function imageSrc(url: string) {
  return /^https?:\/\//.test(url) ? url : `${API_BASE_URL}${url}`;
}

function PostFields({
  draft,
  onChange,
  currentPhoto,
  onRemovePhoto,
  showNotify = false,
}: {
  showNotify?: boolean;
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  currentPhoto?: string | null;
  onRemovePhoto?: () => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <label>
        {t('announcements.titleLabel')}
        <input value={draft.title} onChange={(e) => onChange({ title: e.target.value })} required />
      </label>
      <label>
        {t('announcements.bodyLabel')}
        <textarea value={draft.body} onChange={(e) => onChange({ body: e.target.value })} />
      </label>
      <div className="form-row">
        <span>{t('announcements.styleLabel')}</span>
        <div className="chips" role="radiogroup" aria-label={t('announcements.styleLabel')}>
          {[false, true].map((important) => (
            <button
              key={String(important)}
              type="button"
              role="radio"
              aria-checked={draft.important === important}
              className={`chip ${draft.important === important ? 'chip-selected' : ''}`}
              onClick={() => onChange({ important })}
            >
              {important ? t('announcements.styleImportant') : t('announcements.styleNormal')}
            </button>
          ))}
        </div>
      </div>
      {showNotify && (
        <div className="form-row">
          <span>{t('announcements.notifyLabel')}</span>
          <div className="chips" role="radiogroup" aria-label={t('announcements.notifyLabel')}>
            {[false, true].map((notify) => {
              const selected = (draft.notify ?? draft.important) === notify;
              return (
                <button
                  key={String(notify)}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`chip ${selected ? 'chip-selected' : ''}`}
                  onClick={() => onChange({ notify })}
                >
                  {notify ? t('announcements.notifyYes') : t('announcements.notifyNo')}
                </button>
              );
            })}
          </div>
          <span className="field-hint">{t('announcements.notifyHint')}</span>
        </div>
      )}
      <label>
        {currentPhoto ? t('announcements.photoChange') : t('announcements.photoLabel')}
        <input type="file" accept="image/*" onChange={(e) => onChange({ photo: e.target.files?.[0] ?? null })} />
        <span className="field-hint">{t('announcements.photoHint')}</span>
      </label>
      {currentPhoto && (
        <div className="form-row">
          <img className="campaign-photo" src={imageSrc(currentPhoto)} alt="" />
          {onRemovePhoto && (
            <button type="button" className="link-button" onClick={onRemovePhoto}>
              {t('announcements.photoRemove')}
            </button>
          )}
        </div>
      )}
    </>
  );
}

/**
 * News posts for the app's News tab: a title, text, an optional photo and
 * an "Important" label. The newest one opens the tab, big, with its photo.
 */
export function AnnouncementsPage() {
  const poiId = usePoiId();
  const { t, language } = useI18n();
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);
  // Remounts the new-post form after a save, which is the only way to
  // empty its file picker.
  const [formKey, setFormKey] = useState(0);

  function load() {
    getAnnouncements(poiId)
      .then(setItems)
      .catch(() => setError(t('announcements.loadError')));
  }

  useEffect(load, [poiId]);

  function replace(updated: Announcement) {
    setItems((current) => current?.map((a) => (a.id === updated.id ? updated : a)) ?? null);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      let created = await createAnnouncement(poiId, {
        title: draft.title.trim(),
        body: draft.body.trim() || undefined,
        important: draft.important,
        notify: draft.notify ?? draft.important,
      });
      if (draft.photo) {
        created = await uploadAnnouncementImage(poiId, created.id, draft.photo).catch(() => {
          setError(t('announcements.photoError'));
          return created;
        });
      }
      setItems((current) => [created, ...(current ?? [])]);
      setDraft(EMPTY_DRAFT);
      setFormKey((key) => key + 1);
    } catch {
      setError(t('announcements.createError'));
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(item: Announcement) {
    setEditingId(item.id);
    setEditDraft({ title: item.title, body: item.body ?? '', important: item.important, notify: null, photo: null });
  }

  async function saveEdit(id: string) {
    setError(null);
    try {
      let updated = await updateAnnouncement(poiId, id, {
        title: editDraft.title.trim(),
        body: editDraft.body.trim() || undefined,
        important: editDraft.important,
      });
      if (editDraft.photo) updated = await uploadAnnouncementImage(poiId, id, editDraft.photo);
      replace(updated);
      setEditingId(null);
    } catch {
      setError(t('announcements.saveError'));
    }
  }

  async function removePhoto(id: string) {
    setError(null);
    try {
      replace(await removeAnnouncementImage(poiId, id));
    } catch {
      setError(t('announcements.photoError'));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAnnouncement(poiId, id);
      setItems((current) => current?.filter((a) => a.id !== id) ?? null);
    } catch {
      setError(t('announcements.deleteError'));
    }
  }

  return (
    <div>
      <h2>{t('announcements.title')}</h2>
      <p className="muted">{t('announcements.subtitle')}</p>

      <form key={formKey} className="form card" onSubmit={handleCreate}>
        <PostFields showNotify draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
        <button type="submit" className="btn btn-primary" disabled={submitting || !draft.title.trim()}>
          {submitting ? t('announcements.publishing') : t('announcements.publish')}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}
      {items === null && !error && <p className="muted">{t('announcements.loading')}</p>}

      <div className="card-grid">
      {items?.map((item) =>
        editingId === item.id ? (
          <div key={item.id} className="card form">
            <PostFields
              draft={editDraft}
              onChange={(patch) => setEditDraft((d) => ({ ...d, ...patch }))}
              currentPhoto={item.imageUrl}
              onRemovePhoto={() => removePhoto(item.id)}
            />
            <div className="card-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!editDraft.title.trim()}
                onClick={() => saveEdit(item.id)}
              >
                {t('announcements.save')}
              </button>
              <button type="button" className="btn" onClick={() => setEditingId(null)}>
                {t('announcements.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div key={item.id} className="card">
            {item.imageUrl && <img className="campaign-photo" src={imageSrc(item.imageUrl)} alt={item.title} />}
            {item.important && <span className="badge badge-active">{t('announcements.styleImportant')}</span>}
            <p className="card-title">{item.title}</p>
            {item.body && <p>{item.body}</p>}
            {item.audioUrl && <p className="muted">{t('announcements.includesVoice')}</p>}
            <p className="card-meta">
              {new Date(item.createdAt).toLocaleString(intlLocale(language), { dateStyle: 'long', timeStyle: 'short' })}
            </p>
            <div className="card-actions">
              <button type="button" className="btn" onClick={() => startEdit(item)}>
                {t('announcements.edit')}
              </button>
              <DestructiveButton label={t('announcements.delete')} onConfirm={() => handleDelete(item.id)} />
            </div>
          </div>
        ),
      )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import {
  deleteHomeVersion,
  getHomeVersions,
  renameHomeVersion,
  saveHomeVersion,
  switchHomeVersion,
  type HomeVersion,
} from '../api/homeVersions';
import { intlLocale } from '../i18n/translations';
import { useI18n } from '../i18n/I18nContext';
import { DestructiveButton } from './DestructiveButton';

/**
 * Home page versions (Seb, 9 Nov 2026, #194): save the page under a name
 * and put an older one back live in one click, up to five per community.
 * The button sits under the Home page title; the list opens on the right.
 */
export function HomeVersionsButton({
  poiId,
  onSwitched,
  beforeChange,
}: {
  poiId: string;
  /** The page was replaced by a version: reload what the editor shows. */
  onSwitched: (message: string) => void;
  /** Sends anything still waiting (an Undo bar) before the page is copied. */
  beforeChange: () => Promise<void>;
}) {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<HomeVersion[] | null>(null);
  const [max, setMax] = useState(5);
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function load() {
    getHomeVersions(poiId)
      .then((res) => {
        setVersions(res.versions);
        setMax(res.max);
      })
      .catch(() => setError(t('homeVersions.loadError')));
  }

  useEffect(load, [poiId]); // eslint-disable-line react-hooks/exhaustive-deps

  const live = versions?.find((v) => v.live) ?? null;
  const full = (versions?.length ?? 0) >= max && !versions?.some((v) => v.auto && !v.live);
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(intlLocale(language), { day: 'numeric', month: 'short', year: 'numeric' });

  async function run(key: string, action: () => Promise<unknown>, done?: string, switched = false) {
    // Switching reloads the whole editor (this panel too): the message is shown on the page.
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await beforeChange();
      await action();
      if (switched && done) {
        onSwitched(done);
        return;
      }
      if (done) setNotice(done);
      load();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? t('homeVersions.full', { n: max }) : t('homeVersions.error'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button type="button" className="versions-pick" onClick={() => setOpen(true)} aria-haspopup="dialog">
        {live ? (
          <>
            <span className="versions-dot" aria-hidden="true" />
            {t('homeVersions.liveNamed', { name: live.name })}
          </>
        ) : (
          t('homeVersions.open')
        )}
        <span aria-hidden="true"> ▾</span>
      </button>

      {open && (
        <div className="versions-scrim" onClick={() => setOpen(false)}>
          <aside
            className="versions-panel"
            role="dialog"
            aria-label={t('homeVersions.title')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="versions-head">
              <h3>{t('homeVersions.title')}</h3>
              <button type="button" className="versions-close" aria-label={t('undo.close')} onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
            <p className="muted">{t('homeVersions.intro')}</p>
            {versions && (
              <div className="versions-meter">
                <span>{t('homeVersions.count', { n: versions.length, max })}</span>
                <span className="versions-meter-bar">
                  <span style={{ width: `${(versions.length / max) * 100}%` }} />
                </span>
              </div>
            )}
            {notice && <p className="versions-notice">{notice}</p>}
            {error && <p className="error-text">{error}</p>}

            <div className="versions-list">
              {versions?.map((version) => (
                <div key={version.id} className={`versions-item${version.live ? ' is-live' : ''}`}>
                  <span className={`versions-thumb${version.important ? ' is-important' : ''}`} aria-hidden="true">
                    <i />
                    {version.sections.slice(0, 4).map((_, index) => (
                      <u key={index} />
                    ))}
                  </span>
                  <div className="versions-text">
                    {renaming?.id === version.id ? (
                      <form
                        className="versions-rename"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const next = renaming.name.trim();
                          if (!next) return;
                          void run(version.id, () => renameHomeVersion(poiId, version.id, next)).then(() => setRenaming(null));
                        }}
                      >
                        <input
                          value={renaming.name}
                          maxLength={60}
                          autoFocus
                          aria-label={t('homeVersions.nameLabel')}
                          onChange={(event) => setRenaming({ id: version.id, name: event.target.value })}
                        />
                        <button type="submit" className="btn btn-primary btn-small">
                          {t('homeVersions.renameSave')}
                        </button>
                      </form>
                    ) : (
                      <b>{version.name}</b>
                    )}
                    <small>
                      {t('homeVersions.summary', { sections: version.sections.length, badges: version.badges })}
                    </small>
                    <small>
                      {version.auto
                        ? t('homeVersions.autoSaved', { date: date(version.createdAt) })
                        : t('homeVersions.saved', { date: date(version.updatedAt) })}
                    </small>
                    {version.live && <span className="versions-pill is-live">● {t('homeVersions.liveNow')}</span>}
                    {version.auto && !version.live && <span className="versions-pill">{t('homeVersions.auto')}</span>}
                  </div>
                  <div className="versions-actions">
                    {!version.live && (
                      <button
                        type="button"
                        className="btn btn-primary btn-small"
                        disabled={busy !== null}
                        onClick={() =>
                          void run(
                            version.id,
                            () => switchHomeVersion(poiId, version.id),
                            t('homeVersions.switched', { name: version.name }),
                            true,
                          )
                        }
                      >
                        {t('homeVersions.use')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-action"
                      onClick={() => setRenaming({ id: version.id, name: version.name })}
                    >
                      {t('homeVersions.rename')}
                    </button>
                    <DestructiveButton
                      quiet
                      label={t('homeVersions.delete')}
                      disabled={busy !== null}
                      onConfirm={() => void run(version.id, () => deleteHomeVersion(poiId, version.id))}
                    />
                  </div>
                </div>
              ))}
              {versions?.length === 0 && <p className="muted">{t('homeVersions.empty')}</p>}
            </div>

            <form
              className="versions-save"
              onSubmit={(event) => {
                event.preventDefault();
                const next = name.trim();
                if (!next) return;
                void run('save', () => saveHomeVersion(poiId, next), t('homeVersions.savedNotice', { name: next })).then(() =>
                  setName(''),
                );
              }}
            >
              <label htmlFor="version-name">{t('homeVersions.saveLabel')}</label>
              <div className="versions-save-row">
                <input
                  id="version-name"
                  value={name}
                  maxLength={60}
                  placeholder={t('homeVersions.namePlaceholder')}
                  onChange={(event) => setName(event.target.value)}
                />
                <button type="submit" className="btn btn-primary" disabled={!name.trim() || busy !== null || full}>
                  {t('homeVersions.save')}
                </button>
              </div>
              {full && <p className="muted">{t('homeVersions.full', { n: max })}</p>}
            </form>
          </aside>
        </div>
      )}
    </>
  );
}

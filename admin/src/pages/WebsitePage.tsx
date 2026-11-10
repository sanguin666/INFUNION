import { useEffect, useState } from 'react';
import { usePoiId } from '../layout/usePoiId';
import { useI18n } from '../i18n/I18nContext';
import { ApiError } from '../api/client';
import { getSite, updateSite, SITE_PARTS, type SiteSettings, type SitePart } from '../api/site';

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/**
 * The community's public website (Seb, 9 Nov 2026, #195): put it online,
 * choose its address and what it shows. The page itself is built by the
 * API from what the team already keeps up to date.
 */
export function WebsitePage() {
  const poiId = usePoiId();
  const { t } = useI18n();
  const [site, setSite] = useState<SiteSettings | null>(null);
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getSite(poiId)
      .then((result) => {
        setSite(result);
        setSlug(result.slug);
      })
      .catch(() => setError(t('site.error')));
  }, [poiId, t]);

  async function save(patch: Parameters<typeof updateSite>[1]) {
    if (!site) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updateSite(poiId, patch);
      setSite(result);
      setSlug(result.slug);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError(t('site.slugTaken'));
      else if (err instanceof ApiError && err.status === 400) setError(t('site.slugInvalid'));
      else setError(t('site.error'));
    } finally {
      setSaving(false);
    }
  }

  function toggle(part: SitePart) {
    if (!site) return;
    const hidden = site.hidden.includes(part) ? site.hidden.filter((p) => p !== part) : [...site.hidden, part];
    setSite({ ...site, hidden });
    void save({ hidden });
  }

  async function copy() {
    if (!site) return;
    try {
      await navigator.clipboard.writeText(site.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the link is on screen to copy by hand */
    }
  }

  if (!site) return error ? <p className="error-text">{error}</p> : null;

  const prefix = site.url.slice(0, site.url.length - site.slug.length);
  const cleanSlug = slug.trim().toLowerCase();
  const slugChanged = cleanSlug !== site.slug;
  const slugOk = SLUG.test(cleanSlug);

  return (
    <div>
      <h2>{t('site.title')}</h2>
      <p className="muted">{t('site.subtitle')}</p>

      <div className="card form site-card">
        <div className="site-online">
          <div>
            <p className="card-title">{t('site.published')}</p>
            <p className="muted">{site.published ? t('site.publishedOn') : t('site.publishedOff')}</p>
          </div>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={site.published}
            disabled={saving}
            onChange={() => void save({ published: !site.published })}
            aria-label={t('site.published')}
          />
        </div>

        <div className="site-link">
          <a href={site.url} target="_blank" rel="noopener noreferrer" className="site-url">
            {site.url}
          </a>
          <div className="card-actions">
            <button type="button" className="btn" onClick={() => void copy()}>
              {copied ? t('site.copied') : t('site.copy')}
            </button>
            <a className="btn" href={site.url} target="_blank" rel="noopener noreferrer">
              {t('site.open')}
            </a>
          </div>
        </div>

        <label>
          {t('site.addressLabel')}
          <div className="site-slug">
            <span className="site-slug-prefix">{prefix}</span>
            <input value={slug} maxLength={40} onChange={(e) => setSlug(e.target.value)} spellCheck={false} />
          </div>
          <small className="muted">{t('site.slugHint')}</small>
        </label>
        {slugChanged && (
          <div className="card-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving || !slugOk}
              onClick={() => void save({ slug: cleanSlug })}
            >
              {t('site.slugSave')}
            </button>
          </div>
        )}
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="card form" style={{ marginTop: 20 }}>
        <p className="card-title">{t('site.showTitle')}</p>
        <p className="muted">{t('site.showHint')}</p>
        <div className="chips">
          {SITE_PARTS.map((part) => {
            const shown = !site.hidden.includes(part);
            return (
              <button
                key={part}
                type="button"
                className={`chip${shown ? ' chip-selected' : ''}`}
                aria-pressed={shown}
                onClick={() => toggle(part)}
              >
                {shown ? '✓ ' : ''}
                {t(`site.part_${part}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <p className="card-title">{t('site.shareTitle')}</p>
        <p className="muted">{t('site.shareHint')}</p>
      </div>
    </div>
  );
}

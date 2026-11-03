import { useMemo, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { updatePoiBranding } from '../api/poiSettings';
import type { ActiveModule, ModuleType, Poi, PoiThemeName } from '../api/types';
import { PLACE_THEMES, placeTheme } from '../placeThemes';
import { initialMenuOrder, menuLayout, moduleName } from './MenuOrder';
import { PlaceMark } from './LogoField';

/**
 * Settings > Personalise (Seb, 29 Oct 2026): how the community's app
 * looks, with a phone beside it that shows each change before it is
 * saved. Today the colour; later options get a card of their own here.
 * The bottom menu's order moved to Home page > Bottom menu (Seb, 3 Nov
 * 2026); the phone here still draws the saved one.
 */
export function PersonalisePanel({
  poi,
  modules,
  onSaved,
}: {
  poi: Poi;
  modules: ActiveModule[];
  onSaved: (poi: Poi) => void;
}) {
  const { t } = useI18n();
  const savedTheme = poi.theme ?? 'purple';
  const order = useMemo(() => initialMenuOrder(poi, modules), [poi, modules]);

  const [theme, setTheme] = useState<PoiThemeName>(savedTheme);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const themeDirty = theme !== savedTheme;

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      if (themeDirty) onSaved(await updatePoiBranding(poi.id, theme));
      setSaved(true);
    } catch {
      setError(t('branding.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="personalise-layout">
      <div className="personalise-editor">
        <div className="card">
          <p className="card-title">{t('branding.themeLabel')}</p>
          <p className="muted" style={{ marginTop: 4 }}>
            {t('branding.themeHint')}
          </p>
          <div className="chips" role="radiogroup" aria-label={t('branding.themeLabel')} style={{ marginTop: 12 }}>
            {PLACE_THEMES.map((option) => (
              <button
                key={option.name}
                type="button"
                role="radio"
                aria-checked={theme === option.name}
                className={`chip ${theme === option.name ? 'chip-selected' : ''}`}
                onClick={() => {
                  setTheme(option.name);
                  setSaved(false);
                }}
              >
                <span className="theme-swatch" style={{ background: option.primary }} aria-hidden="true" />
                {t(`branding.${option.name}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="card-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || !themeDirty}
            onClick={save}
          >
            {saving ? t('tabs.saving') : t('tabs.save')}
          </button>
          {saved && !themeDirty && <span className="muted">{t('branding.saved')}</span>}
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>

      <AppPreview poi={poi} theme={theme} order={order} />
    </div>
  );
}

/**
 * A drawing of the community's app, in the colour and with the bottom
 * menu being picked: the header with the logo and a button, a notice
 * banner, and the bar (Home, up to three modules, More). Decorative: the
 * lists beside it say the same in words.
 */
function AppPreview({ poi, theme, order }: { poi: Poi; theme: PoiThemeName; order: ModuleType[] }) {
  const { t } = useI18n();
  const colours = placeTheme(theme);
  const { bar } = menuLayout(order);
  const items = [t('tabs.previewHome'), ...bar.map((type) => moduleName(type, t)), t('tabs.previewMore')];

  return (
    <aside className="app-preview" aria-hidden="true">
      <p className="app-preview-label">{t('tabs.previewLabel')}</p>
      <div className="app-preview-phone">
        <div className="app-preview-head">
          <PlaceMark poi={poi} size={30} />
          <strong>{poi.name}</strong>
          <span className="app-preview-button" style={{ background: colours.primary }}>
            {t('branding.sampleButton')}
          </span>
        </div>
        <div className="app-preview-body">
          <div className="app-preview-banner" style={{ background: colours.primary }}>
            {t('tabs.previewBanner')}
          </div>
          <div className="app-preview-tile" />
          <div className="app-preview-tile" />
          <div className="app-preview-tile app-preview-tile-tall" />
        </div>
        <div className="app-preview-bar" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
          {items.map((label, index) => (
            <span key={label} style={index === 0 ? { color: colours.strong, fontWeight: 800 } : undefined}>
              <i style={{ background: index === 0 ? colours.primary : undefined }} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { updatePoiBranding, updatePoiMenuOrder } from '../api/poiSettings';
import type { ActiveModule, ModuleType, Poi, PoiThemeName } from '../api/types';
import { PLACE_THEMES, placeTheme } from '../placeThemes';
import { initialMenuOrder, menuLayout, MenuOrderRows, moduleName } from './MenuOrder';
import { PlaceMark } from './LogoField';

/**
 * Settings > Personalise (Seb, 29 Oct 2026): how the community's app
 * looks and is laid out, with a phone beside it that shows each change
 * before it is saved. Today the colour and the bottom menu; later options
 * get a card of their own here. One Save stores both.
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
  const savedOrder = useMemo(() => initialMenuOrder(poi, modules), [poi, modules]);

  const [theme, setTheme] = useState<PoiThemeName>(savedTheme);
  const [order, setOrder] = useState<ModuleType[]>(savedOrder);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A module switched on or off elsewhere changes the list.
  useEffect(() => setOrder(savedOrder), [savedOrder]);

  const themeDirty = theme !== savedTheme;
  const orderDirty = order.join(',') !== savedOrder.join(',');

  function move(index: number, delta: number) {
    setSaved(false);
    setOrder((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      if (themeDirty) onSaved(await updatePoiBranding(poi.id, theme));
      if (orderDirty) onSaved(await updatePoiMenuOrder(poi.id, order));
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

        <div className="card">
          <p className="card-title">{t('menuOrder.title')}</p>
          <p className="muted" style={{ marginTop: 4 }}>
            {t('menuOrder.subtitle')}
          </p>
          <MenuOrderRows order={order} onMove={move} />
        </div>

        <div className="card-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || (!themeDirty && !orderDirty)}
            onClick={save}
          >
            {saving ? t('tabs.saving') : t('tabs.save')}
          </button>
          {saved && !themeDirty && !orderDirty && <span className="muted">{t('branding.saved')}</span>}
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

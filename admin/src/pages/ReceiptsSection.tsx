import { useEffect, useState } from 'react';
import { MoreMenu } from '../components/Reorder';
import { useI18n } from '../i18n/I18nContext';
import { API_BASE_URL } from '../api/client';
import { getModelo182Check, getReceipts } from '../api/donations';
import { getPoi } from '../api/pois';
import { updateReceiptSettings } from '../api/poiSettings';
import type { Modelo182Check, ReceiptList, TaxScheme } from '../api/types';
import { formatMoney } from '../format';

// Receipts are for a calendar year; the office mostly wants last year's
// in January and this year's for someone asking mid-year.
const YEARS_BACK = 5;

type Legal = {
  legalName: string;
  legalTaxId: string;
  legalAddress: string;
  receiptSignatory: string;
  legalPhone: string;
  taxScheme: TaxScheme;
};

const EMPTY_LEGAL: Legal = {
  legalName: '',
  legalTaxId: '',
  legalAddress: '',
  receiptSignatory: '',
  legalPhone: '',
  taxScheme: 'none',
};

const TAX_SCHEMES: { value: TaxScheme; label: 'receipts.taxNone' | 'receipts.taxLey49' | 'receipts.taxArt68' }[] = [
  { value: 'none', label: 'receipts.taxNone' },
  { value: 'es_ley49', label: 'receipts.taxLey49' },
  { value: 'es_art68', label: 'receipts.taxArt68' },
];

const SKIP_REASON = {
  no_tax_id: 'receipts.m182NoTaxId',
  bad_tax_id: 'receipts.m182BadTaxId',
  no_province: 'receipts.m182NoProvince',
} as const;

function legalFrom(poi: {
  legalName: string | null;
  legalTaxId: string | null;
  legalAddress: string | null;
  receiptSignatory: string | null;
  legalPhone: string | null;
  taxScheme: TaxScheme;
}): Legal {
  return {
    legalName: poi.legalName ?? '',
    legalTaxId: poi.legalTaxId ?? '',
    legalAddress: poi.legalAddress ?? '',
    receiptSignatory: poi.receiptSignatory ?? '',
    legalPhone: poi.legalPhone ?? '',
    taxScheme: poi.taxScheme ?? 'none',
  };
}

/**
 * Yearly tax receipts, on the Donations page: who issues them and what a
 * gift is worth on the giver's tax return, one receipt per giver who
 * asked for one, the year's lists as CSVs for the treasurer, and in Spain
 * the modelo 182 file. The links are signed and last an hour, so they are
 * fetched again whenever the year changes.
 */
export function ReceiptsSection({ poiId }: { poiId: string }) {
  const { t } = useI18n();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [list, setList] = useState<ReceiptList | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [legal, setLegal] = useState<Legal | null>(null);
  const [savedLegal, setSavedLegal] = useState<Legal>(EMPTY_LEGAL);
  const [savingLegal, setSavingLegal] = useState(false);
  const [legalSaved, setLegalSaved] = useState(false);
  const [legalError, setLegalError] = useState<string | null>(null);
  const [check, setCheck] = useState<Modelo182Check | null>(null);

  useEffect(() => {
    getReceipts(poiId, year)
      .then(setList)
      .catch(() => setError(t('receipts.loadError')));
  }, [poiId, year]);

  useEffect(() => {
    getPoi(poiId)
      .then((poi) => {
        const loaded = legalFrom(poi);
        setLegal(loaded);
        setSavedLegal(loaded);
      })
      .catch(() => setLegalError(t('receipts.legalLoadError')));
  }, [poiId]);

  async function saveLegal() {
    if (!legal) return;
    setSavingLegal(true);
    setLegalSaved(false);
    setLegalError(null);
    try {
      const poi = await updateReceiptSettings(poiId, {
        legalName: legal.legalName.trim(),
        legalTaxId: legal.legalTaxId.trim(),
        legalAddress: legal.legalAddress.trim(),
        receiptSignatory: legal.receiptSignatory.trim(),
        legalPhone: legal.legalPhone.trim(),
        taxScheme: legal.taxScheme,
      });
      const saved = legalFrom(poi);
      setLegal(saved);
      setSavedLegal(saved);
      setLegalSaved(true);
      if (saved.legalName) setEditingLegal(false);
    } catch {
      setLegalError(t('receipts.legalSaveError'));
    } finally {
      setSavingLegal(false);
    }
  }

  // The modelo 182 summary follows the saved settings, not the ones
  // being typed, since the file is built from what is saved.
  const canFile = savedLegal.taxScheme !== 'none' && !!savedLegal.legalName && !!savedLegal.legalTaxId;
  useEffect(() => {
    setCheck(null);
    if (!canFile) return;
    getModelo182Check(poiId, year)
      .then(setCheck)
      .catch(() => setCheck(null));
  }, [poiId, year, canFile, savedLegal]);

  // The form shows by itself until the community's legal name is saved.
  const [editingLegal, setEditingLegal] = useState(false);
  useEffect(() => {
    if (legal && !savedLegal.legalName) setEditingLegal(true);
  }, [legal === null, savedLegal.legalName]);

  const legalDirty =
    !!legal && (Object.keys(EMPTY_LEGAL) as (keyof Legal)[]).some((k) => legal[k].trim() !== savedLegal[k]);
  const years = Array.from({ length: YEARS_BACK + 1 }, (_, i) => thisYear - i);

  return (
    <section aria-label={t('receipts.title')}>
      <p className="muted" style={{ marginTop: 0 }}>{t('receipts.subtitle')}</p>

      {/* Filled in once, then one line with Edit (Seb, 21 Nov 2026). */}
      {legal && !editingLegal && (
        <div className="card">
          <div className="card-row" style={{ borderBottom: 'none' }}>
            <div>
              <p className="card-title" style={{ margin: 0 }}>
                {t('receipts.legalTitle')}
              </p>
              <p className="card-meta" style={{ margin: 0 }}>
                {[savedLegal.legalName, savedLegal.legalTaxId, savedLegal.receiptSignatory].filter(Boolean).join(' · ')}
              </p>
            </div>
            <button type="button" className="text-action" onClick={() => setEditingLegal(true)}>
              {t('receipts.legalEdit')}
            </button>
          </div>
        </div>
      )}
      {legal && editingLegal && (
        <div className="card form">
          <p className="card-title" style={{ margin: '12px 0 0' }}>
            {t('receipts.legalTitle')}
          </p>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {t('receipts.legalHint')}
          </p>
          <label>
            {t('receipts.legalNameLabel')}
            <input value={legal.legalName} onChange={(e) => setLegal({ ...legal, legalName: e.target.value })} />
          </label>
          <label>
            {t('receipts.legalTaxIdLabel')}
            <input value={legal.legalTaxId} onChange={(e) => setLegal({ ...legal, legalTaxId: e.target.value })} />
          </label>
          <label>
            {t('receipts.legalAddressLabel')}
            <textarea
              rows={3}
              value={legal.legalAddress}
              onChange={(e) => setLegal({ ...legal, legalAddress: e.target.value })}
            />
          </label>
          <label>
            {t('receipts.signatoryLabel')}
            <input
              value={legal.receiptSignatory}
              onChange={(e) => setLegal({ ...legal, receiptSignatory: e.target.value })}
              placeholder={t('receipts.signatoryPlaceholder')}
            />
          </label>
          <label>
            {t('receipts.taxSchemeLabel')}
            <select
              value={legal.taxScheme}
              onChange={(e) => setLegal({ ...legal, taxScheme: e.target.value as TaxScheme })}
            >
              {TAX_SCHEMES.map((scheme) => (
                <option key={scheme.value} value={scheme.value}>
                  {t(scheme.label)}
                </option>
              ))}
            </select>
            <span className="field-hint">{t('receipts.taxSchemeHint')}</span>
          </label>
          {legal.taxScheme !== 'none' && (
            <label>
              {t('receipts.phoneLabel')}
              <input
                type="tel"
                value={legal.legalPhone}
                onChange={(e) => setLegal({ ...legal, legalPhone: e.target.value })}
              />
            </label>
          )}
          <div className="card-actions">
            <button type="button" className="btn btn-primary" disabled={savingLegal || !legalDirty} onClick={saveLegal}>
              {savingLegal ? t('receipts.saving') : t('receipts.save')}
            </button>
            {legalSaved && !legalDirty && <span className="muted">{t('receipts.saved')}</span>}
            {!!savedLegal.legalName && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setLegal(savedLegal);
                  setEditingLegal(false);
                }}
              >
                {legalDirty ? t('common.cancel') : t('receipts.legalClose')}
              </button>
            )}
          </div>
        </div>
      )}
      {legalError && <p className="error-text">{legalError}</p>}

      <div className="card-actions" style={{ marginTop: 0, marginBottom: 16, justifyContent: 'space-between' }}>
        <label>
          {t('receipts.yearLabel')}{' '}
          <select
            value={year}
            onChange={(e) => {
              setYear(Number(e.target.value));
              setList(null);
              setError(null);
            }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        {list && (
          <MoreMenu
            buttonLabel={`${t('receipts.download')} ▾`}
            label={t('receipts.download')}
            items={[
              { label: t('receipts.giftsCsv'), onSelect: () => download(`${API_BASE_URL}${list.giftsUrl}`, `gifts-${list.year}.csv`) },
              {
                label: t('receipts.exportCsv'),
                hidden: list.donors.length === 0,
                onSelect: () => download(`${API_BASE_URL}${list.exportUrl}`, `donors-${list.year}.csv`),
              },
            ]}
          />
        )}
      </div>

      {/* Spain's yearly return of gifts, for a community whose gifts
          give a deduction. */}
      {savedLegal.taxScheme !== 'none' && (
        <div className="card">
          <p className="card-title" style={{ margin: 0 }}>
            {t('receipts.m182Title')} · {year}
          </p>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {t('receipts.m182Hint')}
          </p>
          {!canFile && <p className="muted">{t('receipts.m182NeedsLegal')}</p>}
          {canFile && check && (
            <>
              <p style={{ margin: '8px 0 0' }}>
                {t(check.included === 1 ? 'receipts.m182SummaryOne' : 'receipts.m182Summary', { n: check.included, total: formatMoney(check.total) })}
              </p>
              {check.skipped.length > 0 && (
                <>
                  <p className="muted" style={{ margin: '8px 0 0' }}>
                    {t('receipts.m182Skipped')}
                  </p>
                  <ul style={{ margin: '4px 0 0' }}>
                    {check.skipped.map((skip, i) => (
                      <li key={i}>
                        {skip.name || t('receipts.noName')} · {t(SKIP_REASON[skip.reason])}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {list && check.included > 0 && (
                <div className="card-actions">
                  <a className="btn btn-primary" href={`${API_BASE_URL}${list.modelo182Url}`} download={`modelo182-${year}.txt`}>
                    {t('receipts.m182Download')}
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
      {list === null && !error && <p className="muted">{t('receipts.loading')}</p>}
      {list?.donors.length === 0 && <p className="muted">{t('receipts.empty', { year: list.year })}</p>}

      {/* One white card, one row per giver. */}
      {list && list.donors.length > 0 && (
        <div className="card card-list">
          {list.donors.map((donor) => (
            <div key={donor.key} className="card-row">
              <div>
                <p className="card-title" style={{ margin: 0 }}>
                  {donor.name || t('receipts.noName')}
                </p>
                <p className="card-meta">
                  {[
                    donor.taxId,
                    [donor.postalCode, donor.city].filter(Boolean).join(' '),
                    donor.count === 1 ? t('receipts.giftCountOne') : t('receipts.giftCountMany', { n: donor.count }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="card-actions" style={{ marginTop: 0, flexShrink: 0 }}>
                <span className="donation-amount">{formatMoney(donor.total)}</span>
                <a
                  className="text-action"
                  href={`${API_BASE_URL}${donor.url}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${t('receipts.openReceipt')}: ${donor.name}`}
                >
                  {t('receipts.openReceipt')}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Saves a file from the API the way a download link would. */
function download(href: string, name: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
}

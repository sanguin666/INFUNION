import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { intlLocale } from '../i18n/translations';
import {
  createCampaign,
  deleteCampaign,
  getCampaigns,
  removeCampaignImage,
  updateCampaign,
  uploadCampaignImage,
  type CampaignInput,
} from '../api/donations';
import { API_BASE_URL } from '../api/client';
import type { Campaign, CampaignAllocationLine } from '../api/types';
import { DestructiveButton } from '../components/DestructiveButton';
import { SidePanel } from '../components/SidePanel';
import { CURRENCY, endOfDayFromDateInput, formatMoney, toDateInputValue } from '../format';

// `photo` is a picture picked but not sent yet: it goes up once the
// project exists, since it is stored against the project.
type AllocationDraft = { label: string; percent: string };

type Draft = {
  title: string;
  description: string;
  goal: string;
  endsOn: string;
  photo: File | null;
  allocation: AllocationDraft[];
};

const EMPTY_DRAFT: Draft = { title: '', description: '', goal: '', endsOn: '', photo: null, allocation: [] };

const MAX_ALLOCATION_LINES = 8;

// The lines worth keeping: a label and a share above zero.
function allocationLines(draft: Draft): CampaignAllocationLine[] {
  return draft.allocation
    .map((line) => ({ label: line.label.trim(), percent: Number(line.percent.replace(',', '.')) }))
    .filter((line) => line.label && Number.isFinite(line.percent) && line.percent > 0);
}

function allocationTotal(draft: Draft): number {
  return Math.round(allocationLines(draft).reduce((sum, line) => sum + line.percent, 0) * 10) / 10;
}

// No split at all is fine; a split is only fine when it makes 100 %.
function allocationValid(draft: Draft): boolean {
  return allocationLines(draft).length === 0 || Math.abs(allocationTotal(draft) - 100) < 0.05;
}

function draftFrom(campaign: Campaign): Draft {
  return {
    title: campaign.title,
    description: campaign.description ?? '',
    goal: campaign.goalAmount === null ? '' : String(campaign.goalAmount),
    endsOn: campaign.endsAt ? toDateInputValue(campaign.endsAt) : '',
    photo: null,
    allocation: (campaign.allocation ?? []).map((line) => ({ label: line.label, percent: String(line.percent) })),
  };
}

// Empty fields go as null, which clears them on an edit.
function inputFrom(draft: Draft): CampaignInput {
  const goal = Number(draft.goal);
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    goalAmount: draft.goal.trim() && Number.isFinite(goal) && goal > 0 ? goal : null,
    endsAt: draft.endsOn ? endOfDayFromDateInput(draft.endsOn) : null,
    allocation: allocationLines(draft).length > 0 ? allocationLines(draft) : null,
  };
}

function CampaignFields({ draft, onChange }: { draft: Draft; onChange: (patch: Partial<Draft>) => void }) {
  const { t } = useI18n();
  return (
    <>
      <label>
        {t('campaigns.titleLabel')}
        <input
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder={t('campaigns.titlePlaceholder')}
          required
        />
      </label>
      <label>
        {t('campaigns.descriptionLabel')}
        <textarea value={draft.description} onChange={(e) => onChange({ description: e.target.value })} />
      </label>
      <label>
        {t('campaigns.goalLabel', { currency: CURRENCY })}
        <input
          type="number"
          min={1}
          step="1"
          inputMode="decimal"
          value={draft.goal}
          onChange={(e) => onChange({ goal: e.target.value })}
        />
      </label>
      <label>
        {t('campaigns.endsOnLabel')}
        <input type="date" value={draft.endsOn} onChange={(e) => onChange({ endsOn: e.target.value })} />
      </label>
      <label>
        {t('campaigns.photoLabel')}
        <input type="file" accept="image/*" onChange={(e) => onChange({ photo: e.target.files?.[0] ?? null })} />
        <span className="field-hint">{t('campaigns.photoHint')}</span>
      </label>
      <AllocationFields draft={draft} onChange={onChange} />
    </>
  );
}

/**
 * Where the money goes: a few lines of "what for" and a share each. The
 * total shows as the office types, and turns into a warning until it
 * makes 100 %.
 */
function AllocationFields({ draft, onChange }: { draft: Draft; onChange: (patch: Partial<Draft>) => void }) {
  const { t } = useI18n();
  const lines = draft.allocation;
  const setLine = (index: number, patch: Partial<AllocationDraft>) =>
    onChange({ allocation: lines.map((line, i) => (i === index ? { ...line, ...patch } : line)) });
  const total = allocationTotal(draft);
  return (
    <fieldset className="allocation">
      <legend>{t('campaigns.allocationTitle')}</legend>
      <span className="field-hint">{t('campaigns.allocationHint')}</span>
      {lines.map((line, index) => (
        <div key={index} className="allocation-row">
          <input
            aria-label={t('campaigns.allocationLabel')}
            placeholder={t('campaigns.allocationLabel')}
            maxLength={60}
            value={line.label}
            onChange={(e) => setLine(index, { label: e.target.value })}
          />
          <input
            aria-label="%"
            className="allocation-percent"
            type="number"
            min={0}
            max={100}
            step="1"
            inputMode="decimal"
            value={line.percent}
            onChange={(e) => setLine(index, { percent: e.target.value })}
          />
          <span aria-hidden="true">%</span>
          <button
            type="button"
            className="link-button"
            onClick={() => onChange({ allocation: lines.filter((_, i) => i !== index) })}
          >
            {t('campaigns.allocationRemove')}
          </button>
        </div>
      ))}
      <div className="allocation-footer">
        {lines.length < MAX_ALLOCATION_LINES && (
          <button
            type="button"
            className="link-button"
            onClick={() => onChange({ allocation: [...lines, { label: '', percent: '' }] })}
          >
            {t('campaigns.allocationAdd')}
          </button>
        )}
        {allocationLines(draft).length > 0 && (
          <span className={allocationValid(draft) ? 'muted' : 'error-text'} role="status">
            {allocationValid(draft) ? t('campaigns.allocationTotal', { n: total }) : `${t('campaigns.allocationTotal', { n: total })} · ${t('campaigns.allocationMustBe100')}`}
          </span>
        )}
      </div>
    </fieldset>
  );
}

/**
 * The projects a community raises money for, on the Donations page: what
 * each has raised against its goal, and whether the app shows it.
 */
export function CampaignsSection({ poiId }: { poiId: string }) {
  const { t, language } = useI18n();
  const [items, setItems] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Remounts the new-project form after a save, which is the only way to
  // empty its file picker.
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    getCampaigns(poiId)
      .then(setItems)
      .catch(() => setError(t('campaigns.loadError')));
  }, [poiId]);

  function replace(updated: Campaign) {
    setItems((current) => current?.map((c) => (c.id === updated.id ? updated : c)) ?? null);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      let created = await createCampaign(poiId, inputFrom(draft));
      if (draft.photo) created = await uploadCampaignImage(poiId, created.id, draft.photo).catch(() => {
        setError(t('campaigns.photoError'));
        return created;
      });
      setItems((current) => [created, ...(current ?? [])]);
      setDraft(EMPTY_DRAFT);
      setFormKey((key) => key + 1);
      setCreating(false);
    } catch {
      setError(t('campaigns.createError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit(id: string) {
    if (!editDraft.title.trim()) return;
    setError(null);
    try {
      let updated = await updateCampaign(poiId, id, inputFrom(editDraft));
      if (editDraft.photo) updated = await uploadCampaignImage(poiId, id, editDraft.photo);
      replace(updated);
      setEditingId(null);
    } catch {
      setError(t('campaigns.saveError'));
    }
  }

  async function toggleActive(campaign: Campaign) {
    setError(null);
    try {
      replace(await updateCampaign(poiId, campaign.id, { active: !campaign.active }));
    } catch {
      setError(t('campaigns.saveError'));
    }
  }

  async function pickImage(campaign: Campaign, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    setUploadingId(campaign.id);
    try {
      replace(await uploadCampaignImage(poiId, campaign.id, file));
    } catch {
      setError(t('campaigns.photoError'));
    } finally {
      setUploadingId(null);
    }
  }

  async function removeImage(campaign: Campaign) {
    setError(null);
    try {
      replace(await removeCampaignImage(poiId, campaign.id));
    } catch {
      setError(t('campaigns.photoError'));
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteCampaign(poiId, id);
      setItems((current) => current?.filter((c) => c.id !== id) ?? null);
    } catch {
      setError(t('campaigns.deleteError'));
    }
  }

  return (
    <section aria-label={t('campaigns.title')}>
      <div className="page-head">
        <p className="muted" style={{ marginTop: 0, maxWidth: '60ch' }}>
          {t('campaigns.subtitle')}
        </p>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          {t('tabs.newCampaign')}
        </button>
      </div>

      <SidePanel
        open={creating}
        onClose={() => setCreating(false)}
        title={t('tabs.newCampaign')}
        closeLabel={t('tabs.close')}
      >
        <form key={formKey} className="form card" onSubmit={handleCreate}>
          <CampaignFields draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
          <button type="submit" className="btn btn-primary" disabled={submitting || !draft.title.trim() || !allocationValid(draft)}>
            {submitting ? t('campaigns.creating') : t('campaigns.create')}
          </button>
          {error && <p className="error-text">{error}</p>}
        </form>
      </SidePanel>

      {error && <p className="error-text">{error}</p>}
      {items === null && !error && <p className="muted">{t('campaigns.loading')}</p>}
      {items?.length === 0 && <p className="muted">{t('campaigns.empty')}</p>}

      {items?.map((campaign) => {
        if (editingId === campaign.id) {
          return (
            <div key={campaign.id} className="card form">
              {campaign.imageUrl && (
                <img className="campaign-photo" src={`${API_BASE_URL}${campaign.imageUrl}`} alt={campaign.title} />
              )}
              <CampaignFields draft={editDraft} onChange={(patch) => setEditDraft((d) => ({ ...d, ...patch }))} />
              <div className="card-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!editDraft.title.trim() || !allocationValid(editDraft)}
                  onClick={() => saveEdit(campaign.id)}
                >
                  {t('campaigns.save')}
                </button>
                <button type="button" className="btn" onClick={() => setEditingId(null)}>
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          );
        }

        const percent =
          campaign.goalAmount && campaign.goalAmount > 0
            ? Math.min(100, Math.round((campaign.raised / campaign.goalAmount) * 100))
            : null;
        return (
          <div key={campaign.id} className="card">
            {campaign.imageUrl && (
              <img className="campaign-photo" src={`${API_BASE_URL}${campaign.imageUrl}`} alt={campaign.title} />
            )}
            <p className="card-title">{campaign.title}</p>
            <span className={`badge ${campaign.active ? 'badge-active' : ''}`}>
              {campaign.active ? t('campaigns.shown') : t('campaigns.hidden')}
            </span>
            {campaign.description && <p>{campaign.description}</p>}
            <p style={{ margin: '8px 0 0' }}>
              <span className="donation-amount">{formatMoney(campaign.raised)}</span>{' '}
              {campaign.goalAmount !== null
                ? t('campaigns.raisedOfGoal', { goal: formatMoney(campaign.goalAmount) })
                : t('campaigns.raised')}
              <span className="muted">
                {' · '}
                {campaign.giftCount === 1
                  ? t('campaigns.giftCountOne')
                  : t('campaigns.giftCountMany', { n: campaign.giftCount })}
              </span>
            </p>
            {percent !== null && (
              <div
                className="progress"
                role="progressbar"
                aria-label={t('campaigns.progressLabel', { title: campaign.title })}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-valuetext={`${percent}%`}
              >
                <span style={{ width: `${percent}%` }} />
              </div>
            )}
            {campaign.allocation && (
              <p className="card-meta">
                {t('campaigns.allocationTitle')}:{' '}
                {campaign.allocation.map((line) => `${line.label} ${line.percent} %`).join(' · ')}
              </p>
            )}
            {campaign.endsAt && (
              <p className="card-meta">
                {t('campaigns.endsOn', {
                  date: new Date(campaign.endsAt).toLocaleDateString(intlLocale(language), {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }),
                })}
              </p>
            )}
            <div className="campaign-photo-actions">
              <label className="link-button">
                {uploadingId === campaign.id
                  ? t('campaigns.photoUploading')
                  : campaign.imageUrl
                    ? t('campaigns.photoChange')
                    : t('campaigns.photoAdd')}
                <input
                  type="file"
                  accept="image/*"
                  className="visually-hidden"
                  disabled={uploadingId === campaign.id}
                  onChange={(e) => pickImage(campaign, e)}
                />
              </label>
              {campaign.imageUrl && (
                <button type="button" className="link-button" onClick={() => removeImage(campaign)}>
                  {t('campaigns.photoRemove')}
                </button>
              )}
            </div>
            <div className="card-actions">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setEditingId(campaign.id);
                  setEditDraft(draftFrom(campaign));
                }}
              >
                {t('campaigns.edit')}
              </button>
              <button type="button" className="btn" onClick={() => toggleActive(campaign)}>
                {campaign.active ? t('campaigns.hide') : t('campaigns.show')}
              </button>
              <DestructiveButton label={t('campaigns.delete')} onConfirm={() => handleDelete(campaign.id)} />
            </div>
          </div>
        );
      })}
    </section>
  );
}

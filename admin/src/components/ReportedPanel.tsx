import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import {
  getOpenReports,
  getPostingBans,
  liftPostingBan,
  resolveReport,
  type OpenReport,
  type PostingBan,
  type ReportReason,
  type ResolveAction,
} from '../api/moderation';
import { DestructiveButton } from './DestructiveButton';

const REASON_KEYS: Record<ReportReason, `moderation.${'reasonSpam' | 'reasonHateful' | 'reasonHarassment' | 'reasonInappropriate' | 'reasonOther'}`> = {
  spam: 'moderation.reasonSpam',
  hateful: 'moderation.reasonHateful',
  harassment: 'moderation.reasonHarassment',
  inappropriate: 'moderation.reasonInappropriate',
  other: 'moderation.reasonOther',
};

const KIND_KEYS = {
  post: 'moderation.kindPost',
  comment: 'moderation.kindComment',
  prayer: 'moderation.kindPrayer',
} as const;

/**
 * The Reported tab of Our group and of prayer requests (Apple guideline
 * 1.2): what members reported, to remove, keep, or remove and block the
 * author from posting; then the members blocked from posting, to allow
 * again.
 */
export function ReportedPanel({
  poiId,
  area,
  onChanged,
}: {
  poiId: string;
  area: 'community' | 'prayer';
  // Something was decided: the page refreshes its count and its list.
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [reports, setReports] = useState<OpenReport[] | null>(null);
  const [bans, setBans] = useState<PostingBan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    getOpenReports(poiId, area)
      .then(setReports)
      .catch(() => setError(t('moderation.loadError')));
    getPostingBans(poiId)
      .then(setBans)
      .catch(() => setBans([]));
  }

  useEffect(load, [poiId, area]);

  async function decide(report: OpenReport, action: ResolveAction) {
    setBusy(report.targetId);
    setError(null);
    try {
      await resolveReport(poiId, { kind: report.kind, targetId: report.targetId, action });
      setReports((current) => current?.filter((r) => r.targetId !== report.targetId) ?? null);
      if (action === 'remove_and_ban') getPostingBans(poiId).then(setBans).catch(() => undefined);
      onChanged();
    } catch {
      setError(t('moderation.error'));
    } finally {
      setBusy(null);
    }
  }

  async function allow(ban: PostingBan) {
    try {
      await liftPostingBan(poiId, ban.id);
      setBans((current) => current.filter((b) => b.id !== ban.id));
    } catch {
      setError(t('moderation.error'));
    }
  }

  return (
    <div>
      <p className="muted">{t('moderation.hint')}</p>
      {error && <p className="error-text">{error}</p>}
      {reports === null && !error && <p className="muted">{t('moderation.loading')}</p>}
      {reports?.length === 0 && <p className="muted">{t('moderation.empty')}</p>}

      {reports?.map((report) => {
        const reason = t(REASON_KEYS[report.reason]);
        const name = report.authorName ?? t('moderation.anonymous');
        return (
          <div key={`${report.kind}:${report.targetId}`} className="card">
            <p className="badge badge-active" style={{ margin: 0 }}>
              {report.count === 1
                ? t('moderation.reportedByOne', { reason })
                : t('moderation.reportedBy', { reason, n: report.count })}
            </p>
            <p className="card-meta">
              {[
                t(KIND_KEYS[report.kind]),
                name,
                report.contentCreatedAt ? new Date(report.contentCreatedAt).toLocaleString() : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="report-excerpt">{report.excerpt}</p>
            <div className="card-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy === report.targetId}
                onClick={() => void decide(report, 'remove')}
              >
                {t('moderation.remove')}
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy === report.targetId}
                onClick={() => void decide(report, 'keep')}
              >
                {t('moderation.keep')}
              </button>
              {report.canBan && (
                <DestructiveButton
                  quiet
                  disabled={busy === report.targetId}
                  label={
                    report.authorName
                      ? t('moderation.removeBan', { name: report.authorName })
                      : t('moderation.removeBanAnonymous')
                  }
                  onConfirm={() => void decide(report, 'remove_and_ban')}
                />
              )}
            </div>
          </div>
        );
      })}

      {bans.length > 0 && (
        <>
          <h3 className="section-title">{t('moderation.bansTitle')}</h3>
          <p className="muted">{t('moderation.bansHint')}</p>
          <div className="card card-list">
            {bans.map((ban) => (
              <div key={ban.id} className="comment-item">
                <p style={{ margin: 0 }}>{ban.name}</p>
                <button type="button" className="link-button" onClick={() => void allow(ban)}>
                  {t('moderation.allow')}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

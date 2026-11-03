import { useEffect, useState } from 'react';
import { usePoiId } from '../layout/usePoiId';
import { useI18n } from '../i18n/I18nContext';
import { deleteComment, deletePost, getComments, getCommunityPosts } from '../api/community';
import type { CommunityComment, CommunityPost } from '../api/types';
import { DestructiveButton } from '../components/DestructiveButton';
import { TabBar, TabPanel, useTab } from '../components/Tabs';
import { ReportedPanel } from '../components/ReportedPanel';
import { getReportCount } from '../api/moderation';

const TABS = ['posts', 'reported'] as const;

export function CommunityPage() {
  const poiId = usePoiId();
  const { t } = useI18n();
  const [posts, setPosts] = useState<CommunityPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommunityComment[] | null>(null);
  const [tab, setTab] = useTab(TABS);
  const [reported, setReported] = useState<number | null>(null);

  function load() {
    getCommunityPosts(poiId)
      .then(setPosts)
      .catch(() => setError(t('community.loadError')));
    getReportCount(poiId)
      .then((c) => setReported(c.community))
      .catch(() => setReported(null));
  }

  useEffect(load, [poiId]);

  async function toggleExpand(post: CommunityPost) {
    if (expandedId === post.id) {
      setExpandedId(null);
      setComments(null);
      return;
    }
    setExpandedId(post.id);
    setComments(null);
    try {
      setComments(await getComments(poiId, post.id));
    } catch {
      setError(t('community.repliesLoadError'));
    }
  }

  async function handleDeletePost(id: string) {
    try {
      await deletePost(poiId, id);
      setPosts((current) => current?.filter((p) => p.id !== id) ?? null);
      if (expandedId === id) {
        setExpandedId(null);
        setComments(null);
      }
    } catch {
      setError(t('community.removePostError'));
    }
  }

  async function handleDeleteComment(postId: string, commentId: string) {
    try {
      await deleteComment(poiId, postId, commentId);
      setComments((current) => current?.filter((c) => c.id !== commentId) ?? null);
      setPosts(
        (current) =>
          current?.map((p) =>
            p.id === postId ? { ...p, commentCount: p.commentCount - 1 } : p,
          ) ?? null,
      );
    } catch {
      setError(t('community.removeReplyError'));
    }
  }

  return (
    <div>
      <h2>{t('community.title')}</h2>
      <p className="muted">{t('community.subtitle')}</p>

      <TabBar
        idPrefix="community"
        label={t('tabs.label')}
        current={tab}
        onChange={setTab}
        tabs={[
          { key: 'posts', label: t('moderation.tabPosts') },
          { key: 'reported', label: t('moderation.tabReported'), count: reported },
        ]}
      />

      <TabPanel idPrefix="community" tabKey="reported" current={tab}>
        <ReportedPanel poiId={poiId} area="community" onChanged={load} />
      </TabPanel>

      <TabPanel idPrefix="community" tabKey="posts" current={tab}>
      {error && <p className="error-text">{error}</p>}
      {posts === null && !error && <p className="muted">{t('community.loading')}</p>}
      {posts?.length === 0 && <p className="muted">{t('community.empty')}</p>}

      {posts?.map((post) => (
        <div key={post.id} className="card">
          <p>{post.message}</p>
          <p className="card-meta">
            — {post.authorName ?? t('community.anonymous')} · {new Date(post.createdAt).toLocaleString()}
          </p>
          <div className="card-actions">
            <button type="button" className="btn" onClick={() => toggleExpand(post)}>
              {expandedId === post.id ? t('community.hideReplies') : `${t('community.replies')} (${post.commentCount})`}
            </button>
            <DestructiveButton label={t('community.removePost')} onConfirm={() => handleDeletePost(post.id)} />
          </div>

          {expandedId === post.id && (
            <div className="comment-list">
              {comments === null && <p className="muted">{t('community.loadingReplies')}</p>}
              {comments?.length === 0 && <p className="muted">{t('community.noReplies')}</p>}
              {comments?.map((comment) => (
                <div key={comment.id} className="comment-item">
                  <div>
                    <p style={{ margin: 0 }}>{comment.message}</p>
                    <p className="card-meta">— {comment.authorName ?? t('community.anonymous')}</p>
                  </div>
                  <div className="card-actions" style={{ marginTop: 0, flexShrink: 0 }}>
                    <DestructiveButton
                      label={t('community.removeReply')}
                      onConfirm={() => handleDeleteComment(post.id, comment.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      </TabPanel>
    </div>
  );
}

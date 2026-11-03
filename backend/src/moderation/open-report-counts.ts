/**
 * Open reports per kind for one community, one per reported item however
 * many people reported it, and only for items still there (one removed
 * from the posts list meanwhile no longer waits on the team).
 */
export const OPEN_REPORT_COUNTS_SQL = `
  SELECT r.kind, count(DISTINCT r.target_id)::int AS n
    FROM content_reports r
   WHERE r.poi_id = $1 AND r.status = 'open'
     AND (
       (r.kind = 'post' AND EXISTS (SELECT 1 FROM community_posts x WHERE x.id = r.target_id))
       OR (r.kind = 'comment' AND EXISTS (SELECT 1 FROM community_comments x WHERE x.id = r.target_id))
       OR (r.kind = 'prayer' AND EXISTS (SELECT 1 FROM prayer_requests x WHERE x.id = r.target_id))
     )
   GROUP BY r.kind`;

export function countsFrom(rows: { kind: string; n: number }[]): { community: number; prayer: number } {
  const of = (kind: string) => rows.find((r) => r.kind === kind)?.n ?? 0;
  return { community: of('post') + of('comment'), prayer: of('prayer') };
}

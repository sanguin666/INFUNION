import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAssistantQuestions, type AssistantQuestions } from '../api/superadmin';
import { useSa } from './format';

const PERIODS = [7, 30, 90] as const;

/**
 * What members ask the AI assistant (Seb, 5 Nov 2026): the topics asked
 * most, what it could not answer, and the questions themselves, rewritten
 * by the AI without anything personal and never linked to a member.
 */
export function SuperadminQuestionsPage() {
  const sa = useSa();
  const { s, dateTime, error: describe } = sa;
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [poiId, setPoiId] = useState('');
  const [audience, setAudience] = useState<'member' | 'admin'>('member');
  const [onlyUnanswered, setOnlyUnanswered] = useState(false);
  const [limit, setLimit] = useState(20);
  const [data, setData] = useState<AssistantQuestions | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    getAssistantQuestions(days, poiId || undefined, audience)
      .then(setData)
      .catch((err) => setError(describe(err)));
  }, [days, poiId, audience, describe]);

  const topic = (key: string) => s(`${audience === 'admin' ? 'adminTopics' : 'questionTopics'}.${key}`);
  const max = Math.max(1, ...(data?.topics ?? []).map((t) => t.total));
  const shown = (data?.questions ?? []).filter((q) => !onlyUnanswered || !q.answered);
  const unanswered = data ? data.total - data.answered : 0;

  return (
    <div className="dashboard">
      <h2>{s('questions.title')}</h2>
      <p className="muted">{s('questions.intro')}</p>

      <div className="chips" role="group" aria-label={s('questions.audience')}>
        {(['member', 'admin'] as const).map((a) => (
          <button
            key={a}
            type="button"
            className={`chip${audience === a ? ' chip-selected' : ''}`}
            aria-pressed={audience === a}
            onClick={() => {
              setAudience(a);
              setPoiId('');
            }}
          >
            {s(a === 'member' ? 'questions.fromMembers' : 'questions.fromTeams')}
          </button>
        ))}
      </div>

      <div className="sa-questions-filters">
        <div className="chips" role="group" aria-label={s('common.filter')}>
          {PERIODS.map((n) => (
            <button
              key={n}
              type="button"
              className={`chip${days === n ? ' chip-selected' : ''}`}
              aria-pressed={days === n}
              onClick={() => setDays(n)}
            >
              {s('questions.lastDays', { n })}
            </button>
          ))}
        </div>
        <select aria-label={s('questions.community')} value={poiId} onChange={(e) => setPoiId(e.target.value)}>
          <option value="">{s('questions.allCommunities')}</option>
          {data?.communityOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error-text">{error}</p>}
      {!data && !error && <p className="muted">{s('common.loading')}</p>}
      {data && (
        <>
          <div className="kpi-row">
            <div className="stat-tile">
              <p className="stat-label">{s('questions.asked')}</p>
              <p className="stat-value">{data.total}</p>
              <p className="stat-delta stat-delta-neutral">{s('questions.inCommunities', { n: data.communities })}</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">{s('questions.answered')}</p>
              <p className="stat-value">{data.total ? `${Math.round((100 * data.answered) / data.total)} %` : '—'}</p>
              <p className="stat-delta stat-delta-neutral">{s('questions.answeredCount', { n: data.answered })}</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label">{s('questions.notAnswered')}</p>
              <p className="stat-value">{unanswered}</p>
              <p className={`stat-delta ${unanswered ? 'stat-delta-down' : 'stat-delta-neutral'}`}>{s('questions.notAnsweredHint')}</p>
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-card-header">
              <h3>{s('questions.topicsTitle')}</h3>
              <span className="sa-questions-legend">
                <span className="sa-questions-key sa-questions-key-answered" aria-hidden="true" />
                {s('questions.legendAnswered')}
                <span className="sa-questions-key sa-questions-key-unanswered" aria-hidden="true" />
                {s('questions.legendUnanswered')}
              </span>
            </div>
            {data.topics.length === 0 && <p className="muted">{s('questions.none')}</p>}
            <ul className="sa-topics">
              {data.topics.map((t) => (
                <li key={t.topic} className="sa-topic">
                  <span className="sa-topic-label">{topic(t.topic)}</span>
                  <span className="sa-topic-track" title={s('questions.barTitle', { n: t.total, u: t.unanswered })}>
                    <span className="sa-topic-answered" style={{ width: `${(100 * (t.total - t.unanswered)) / max}%` }} />
                    <span className="sa-topic-unanswered" style={{ width: `${(100 * t.unanswered) / max}%` }} />
                  </span>
                  <span className="sa-topic-count">
                    {t.total}
                    {t.unanswered > 0 && <span className="sa-sub sa-topic-missed">{s('questions.unansweredShort', { n: t.unanswered })}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <h3 className="section-title">{s('questions.listTitle')}</h3>
          <div className="chips" role="group" aria-label={s('common.filter')}>
            {[false, true].map((only) => (
              <button
                key={String(only)}
                type="button"
                className={`chip${onlyUnanswered === only ? ' chip-selected' : ''}`}
                aria-pressed={onlyUnanswered === only}
                onClick={() => {
                  setOnlyUnanswered(only);
                  setLimit(20);
                }}
              >
                {s(only ? 'questions.onlyUnanswered' : 'questions.all')}
              </button>
            ))}
          </div>
          <div className="card card-list sa-gap">
            {shown.length === 0 && <p className="todo-done">{s('questions.none')}</p>}
            {shown.slice(0, limit).map((q, i) => (
              <div className="card-row" key={i}>
                <span>
                  <span className="card-title">
                    {!q.answered && <span className="sa-questions-key sa-questions-key-unanswered" title={s('questions.legendUnanswered')} />}
                    {q.question}
                  </span>
                  <span className="sa-sub">
                    {topic(q.topic)} · <Link to={`../communities/${q.poiId}`}>{q.poiName}</Link> · {q.language.toUpperCase()}
                  </span>
                </span>
                <span className="sa-sub sa-nowrap">{dateTime(q.createdAt)}</span>
              </div>
            ))}
          </div>
          {shown.length > limit && (
            <button type="button" className="btn sa-gap" onClick={() => setLimit((n) => n + 40)}>
              {s('questions.more', { n: shown.length - limit })}
            </button>
          )}
          <p className="muted sa-gap">{s('questions.privacy')}</p>
        </>
      )}
    </div>
  );
}

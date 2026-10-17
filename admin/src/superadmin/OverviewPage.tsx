import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOverview, type Overview } from '../api/superadmin';
import { errorText, eur, monthShort } from './format';

/** Twelve months of module revenue, this month in orange. */
function RevenueChart({ data }: { data: Overview['revenue']['byMonth'] }) {
  const width = 720;
  const height = 220;
  const top = 24;
  const bottom = 28;
  const max = Math.max(10, ...data.map((d) => d.total));
  const slot = width / data.length;
  const bar = Math.min(36, slot * 0.6);
  const scale = (value: number) => ((height - top - bottom) * value) / max;
  return (
    <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Chiffre d'affaires des douze derniers mois">
      <line x1={0} x2={width} y1={height - bottom} y2={height - bottom} stroke="var(--chart-axis)" strokeWidth={1} />
      <line x1={0} x2={width} y1={top} y2={top} stroke="var(--chart-grid)" strokeWidth={1} strokeDasharray="3 4" />
      <text x={0} y={top - 6} className="chart-axis-label">{eur(max)}</text>
      {data.map((d, i) => {
        const h = scale(d.total);
        const x = i * slot + (slot - bar) / 2;
        const current = i === data.length - 1;
        return (
          <g key={d.month}>
            <title>{`${monthShort(d.month)} : ${eur(d.total)}`}</title>
            <rect
              x={x}
              y={height - bottom - h}
              width={bar}
              height={Math.max(h, d.total > 0 ? 2 : 0)}
              rx={4}
              fill={current ? 'var(--series-1)' : 'var(--color-primary-soft)'}
            />
            {d.total > 0 && (
              <text x={x + bar / 2} y={height - bottom - h - 6} textAnchor="middle" className="chart-axis-label">
                {eur(d.total)}
              </text>
            )}
            <text x={x + bar / 2} y={height - 8} textAnchor="middle" className="chart-axis-label">
              {monthShort(d.month)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return <p className="stat-delta stat-delta-neutral">{now ? 'premier mois facturé' : 'rien le mois dernier'}</p>;
  const pct = Math.round(((now - before) / before) * 100);
  return (
    <p className={`stat-delta ${pct >= 0 ? 'stat-delta-up' : 'stat-delta-down'}`}>
      {pct >= 0 ? '+' : ''}
      {pct} % vs mois dernier ({eur(before)})
    </p>
  );
}

export function SuperadminOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOverview()
      .then(setData)
      .catch((err) => setError(errorText(err)));
  }, []);

  if (error) return <div><h2>Vue d'ensemble</h2><p className="error-text">{error}</p></div>;
  if (!data) return <div><h2>Vue d'ensemble</h2><p className="muted">Chargement…</p></div>;

  const { revenue } = data;
  const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date());

  return (
    <div className="dashboard">
      <h2>Vue d'ensemble</h2>
      <p className="muted">
        Environnement : {data.environment}. Les montants sont ceux que les modules factureraient : rien n’est encore
        prélevé tant que le paiement n’est pas branché.
      </p>

      <div className="kpi-row">
        <div className="stat-tile">
          <p className="stat-label">CA de {monthName}</p>
          <p className="stat-value">{eur(revenue.thisMonth)}</p>
          <Delta now={revenue.thisMonth} before={revenue.lastMonth} />
        </div>
        <div className="stat-tile">
          <p className="stat-label">Revenu mensuel récurrent</p>
          <p className="stat-value">{eur(revenue.monthlyRecurring)}</p>
          <p className="stat-delta stat-delta-neutral">
            {revenue.paidModules} module{revenue.paidModules > 1 ? 's' : ''} payant{revenue.paidModules > 1 ? 's' : ''}
          </p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Communautés</p>
          <p className="stat-value">{data.communities.total}</p>
          <p className="stat-delta stat-delta-neutral">
            {data.communities.paying} payante{data.communities.paying > 1 ? 's' : ''} · {data.communities.comped} offerte
            {data.communities.comped > 1 ? 's' : ''}
          </p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Membres</p>
          <p className="stat-value">{data.members.total}</p>
          <p className={`stat-delta ${data.members.newThisMonth ? 'stat-delta-up' : 'stat-delta-neutral'}`}>
            +{data.members.newThisMonth} ce mois · {data.members.active30Days} actifs sur 30 jours
          </p>
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-card-header">
          <h3>Chiffre d’affaires des modules, 12 derniers mois</h3>
        </div>
        <RevenueChart data={revenue.byMonth} />
      </div>

      <div className="kpi-row">
        <div className="stat-tile">
          <p className="stat-label">Modules en essai</p>
          <p className="stat-value">{revenue.trialModules}</p>
          <p className="stat-delta stat-delta-neutral">soit {eur(revenue.trialPotential)} / mois s’ils continuent</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Modules offerts</p>
          <p className="stat-value">{revenue.offeredModules}</p>
          <p className="stat-delta stat-delta-neutral">hors communautés offertes</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Dons reçus par les communautés</p>
          <p className="stat-value">{eur(data.donations.thisMonth)}</p>
          <p className="stat-delta stat-delta-neutral">{data.donations.count} dons ce mois</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Demandes ouvertes</p>
          <p className="stat-value">{data.requests.open}</p>
          <p className={`stat-delta ${data.requests.waitingOverAWeek ? 'stat-delta-down' : 'stat-delta-neutral'}`}>
            {data.requests.waitingOverAWeek} sans réponse depuis plus de 7 jours
          </p>
        </div>
      </div>

      <h3 className="section-title">À surveiller</h3>
      <div className="card card-list">
        {data.watch.map((item, i) => {
          const body = (
            <>
              <span className={`sa-dot sa-dot-${item.level}`} aria-hidden="true" />
              <span className="todo-text">
                <span className="todo-title">{item.title}</span>
                <span className="todo-meta">{item.detail}</span>
              </span>
              {item.poiId ? <span className="todo-go">Ouvrir</span> : <span />}
            </>
          );
          return item.poiId ? (
            <Link key={i} className="todo-row sa-watch-row" to={`../communities/${item.poiId}`}>
              {body}
            </Link>
          ) : (
            <div key={i} className="todo-row sa-watch-row">
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}

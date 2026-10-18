import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  addAdmin,
  deleteCommunity,
  getCommunity,
  moduleAction,
  removeAdmin,
  resetAdminPassword,
  setSuspended,
  updateCommunity,
  type CommunityDetail,
  type ModuleAction,
} from '../api/superadmin';
import type { ActiveModule, ModuleType, SupportedLanguage } from '../api/types';
import { DestructiveButton } from '../components/DestructiveButton';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from '../i18n/translations';
import { ago, dateFr, errorText, eur, explain, moduleLabel } from './format';
import { PasswordReveal } from './PasswordReveal';

const LIVE = new Set(['trial', 'active']);

function moduleState(row: ActiveModule | undefined, comped: boolean, free: boolean): string {
  if (!row || !LIVE.has(row.status)) {
    if (row?.status === 'expired') return 'En pause (essai ou paiement terminé)';
    if (row?.status === 'cancelled') return 'Arrêté';
    return 'Inactif';
  }
  if (row.offered) return 'Offert par ANSAE';
  if (free) return 'Gratuit';
  if (comped) return 'Inclus (communauté offerte)';
  if (row.status === 'trial') return `Essai gratuit jusqu’au ${dateFr(row.trialEndsAt)}`;
  if (row.cancelAtPeriodEnd) return `S’arrête le ${dateFr(row.paidUntil)}`;
  return `Payé jusqu’au ${dateFr(row.paidUntil)}`;
}

export function SuperadminCommunityPage() {
  const { poiId } = useParams<{ poiId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<CommunityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ email: string; password: string } | null>(null);

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [address, setAddress] = useState('');
  const [language, setLanguage] = useState<SupportedLanguage>('es');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [confirmName, setConfirmName] = useState('');

  function show(detail: CommunityDetail) {
    setData(detail);
    setName(detail.poi.name);
    setCity(detail.poi.city ?? '');
    setPostalCode(detail.poi.postalCode ?? '');
    setAddress(detail.poi.address ?? '');
    setLanguage(detail.poi.language);
  }

  useEffect(() => {
    if (!poiId) return;
    getCommunity(poiId)
      .then(show)
      .catch((err) => setError(errorText(err)));
  }, [poiId]);

  async function run(key: string, action: () => Promise<CommunityDetail | void>, done?: string) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      if (result) show(result);
      if (done) setNotice(done);
    } catch (err) {
      setError(explain(errorText(err)));
    } finally {
      setBusy(null);
    }
  }

  if (!data) {
    return (
      <div>
        <Link to="..">‹ Communautés</Link>
        {error ? <p className="error-text">{error}</p> : <p className="muted">Chargement…</p>}
      </div>
    );
  }

  const { poi, billing } = data;
  const id = poi.id;
  const rowFor = (type: ModuleType) => billing.modules.find((m) => m.moduleType === type);
  const isFree = (type: ModuleType) => billing.freeModules.includes(type);
  const act = (type: ModuleType, action: ModuleAction, done: string) =>
    run(`${type}:${action}`, () => moduleAction(id, type, action), done);

  function saveInfo(event: FormEvent) {
    event.preventDefault();
    run('info', () => updateCommunity(id, { name, city, postalCode, address, language }), 'Informations enregistrées.');
  }

  function submitAdmin(event: FormEvent) {
    event.preventDefault();
    run('admin', async () => {
      const result = await addAdmin(id, adminEmail, adminFirstName || undefined);
      setAdminEmail('');
      setAdminFirstName('');
      if (result.admin.temporaryPassword) setReveal({ email: result.admin.email, password: result.admin.temporaryPassword });
      return result.community;
    }, 'Admin ajouté.');
  }

  function moduleActions(type: ModuleType) {
    const row = rowFor(type);
    const live = !!row && LIVE.has(row.status);
    const free = isFree(type);
    const pending = busy?.startsWith(`${type}:`) ?? false;
    const buttons = [];
    if (live && row.offered) {
      buttons.push(
        <DestructiveButton key="unoffer" quiet label="Reprendre l’offre" disabled={pending} onConfirm={() => act(type, 'unoffer', `${moduleLabel(type)} n’est plus offert.`)} />,
      );
    } else if (!free && !billing.comped) {
      buttons.push(
        <button key="offer" type="button" className="text-action" disabled={pending} onClick={() => act(type, 'offer', `${moduleLabel(type)} est offert.`)}>
          Offrir
        </button>,
      );
    }
    if (!free && !billing.comped && (!live || row.status === 'trial') && !row?.offered) {
      buttons.push(
        <button key="trial" type="button" className="text-action" disabled={pending} onClick={() => act(type, 'extend-trial', `Un mois d’essai de plus pour ${moduleLabel(type)}.`)}>
          {live ? '+1 mois d’essai' : 'Essai 1 mois'}
        </button>,
      );
    }
    if (!live && (free || billing.comped)) {
      buttons.push(
        <button key="start" type="button" className="text-action" disabled={pending} onClick={() => act(type, 'start', `${moduleLabel(type)} est activé.`)}>
          Activer
        </button>,
      );
    }
    if (live && !row.offered && !row.cancelAtPeriodEnd) {
      buttons.push(
        <DestructiveButton key="stop" quiet label="Arrêter" disabled={pending} onConfirm={() => act(type, 'stop', `${moduleLabel(type)} est arrêté.`)} />,
      );
    }
    return buttons;
  }

  return (
    <div className="sa-detail">
      <Link to="..">‹ Communautés</Link>
      <div className="sa-heading">
        <h2>{poi.name}</h2>
        <button type="button" className="btn" onClick={() => navigate(`/poi/${id}/dashboard`)}>
          Ouvrir son admin
        </button>
      </div>
      <p className="muted">
        {data.memberCount} membre{data.memberCount > 1 ? 's' : ''} · créée le {dateFr(poi.createdAt)} · QR {poi.qrCodeToken}
        {poi.suspendedAt && <strong className="sa-status sa-status-suspended"> · Suspendue depuis le {dateFr(poi.suspendedAt)}</strong>}
      </p>

      {error && <p className="error-text" role="alert">{error}</p>}
      {notice && <p className="sa-notice" role="status">{notice}</p>}
      {reveal && <PasswordReveal email={reveal.email} password={reveal.password} onClose={() => setReveal(null)} />}

      <h3>Informations</h3>
      <form onSubmit={saveInfo}>
        <div className="card form">
          <label>
            Nom
            <input id="sa-poi-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
          </label>
          <label>
            Adresse
            <input id="sa-poi-address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} />
          </label>
          <label>
            Code postal
            <input id="sa-poi-postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} maxLength={20} />
          </label>
          <label>
            Ville
            <input id="sa-poi-city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={120} />
          </label>
          <label>
            Langue
            <select id="sa-poi-language" value={language} onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}>
              {SUPPORTED_LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {LANGUAGE_NAMES[code]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="card-actions sa-actions">
          <button type="submit" className="btn btn-primary" disabled={busy === 'info'}>
            Enregistrer
          </button>
        </div>
      </form>

      <h3>Modules</h3>
      <div className="card card-list">
        <div className="card-row">
          <span>
            <span className="card-title">Communauté offerte</span>
            <span className="sa-sub">Tous les modules gratuits, sans facture</span>
          </span>
          <input
            id="sa-poi-comped"
            type="checkbox"
            role="switch"
            className="switch"
            checked={billing.comped}
            disabled={busy === 'comped'}
            onChange={(e) =>
              run('comped', () => updateCommunity(id, { billingComped: e.target.checked }), e.target.checked ? 'Communauté offerte.' : 'La communauté repasse en payant.')
            }
            aria-label="Communauté offerte"
          />
        </div>
        {data.allModules.map((type) => (
          <div className="card-row" key={type}>
            <span>
              <span className="card-title">{moduleLabel(type)}</span>
              <span className="sa-sub">{moduleState(rowFor(type), billing.comped, isFree(type))}</span>
            </span>
            <span className="sa-row-actions">{moduleActions(type)}</span>
          </div>
        ))}
      </div>
      <p className="muted sa-hint">
        {billing.comped
          ? 'Rien n’est facturé à cette communauté.'
          : `Paiement : ${billing.paymentMethod ?? 'aucun moyen enregistré'} · ${billing.interval === 'yearly' ? 'annuel' : 'mensuel'}${billing.renewsAt ? ` · prochaine échéance le ${dateFr(billing.renewsAt)}` : ''}`}
      </p>

      {billing.invoices.length > 0 && (
        <>
          <h3>Factures</h3>
          <div className="card card-list">
            {billing.invoices.map((invoice) => (
              <div className="card-row" key={invoice.id}>
                <span>
                  <span className="card-title">{dateFr(invoice.issuedAt)}</span>
                  <span className="sa-sub">{invoice.lines.map((line) => moduleLabel(line.moduleType)).join(', ')}</span>
                </span>
                <strong>{eur(invoice.amount)}</strong>
              </div>
            ))}
          </div>
        </>
      )}

      <h3>Admins</h3>
      <div className="card card-list">
        {data.admins.length === 0 && <p className="todo-done">Aucun admin : ajoutez-en un ci-dessous.</p>}
        {data.admins.map((admin) => (
          <div className="card-row" key={admin.id}>
            <span>
              <span className="card-title">{[admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.email}</span>
              <span className="sa-sub">
                {admin.email} · dernière connexion {ago(admin.lastLoginAt)}
              </span>
            </span>
            <span className="sa-row-actions">
              <DestructiveButton
                quiet
                label="Nouveau mot de passe"
                disabled={busy === `admin:${admin.id}`}
                onConfirm={() =>
                  run(`admin:${admin.id}`, async () => {
                    const reset = await resetAdminPassword(id, admin.id);
                    setReveal({ email: reset.email, password: reset.temporaryPassword });
                  })
                }
              />
              <DestructiveButton
                quiet
                label="Retirer"
                disabled={busy === `admin:${admin.id}`}
                onConfirm={() => run(`admin:${admin.id}`, () => removeAdmin(id, admin.id), 'Admin retiré.')}
              />
            </span>
          </div>
        ))}
      </div>
      <form onSubmit={submitAdmin} aria-label="Ajouter un admin">
        <div className="card form sa-gap">
          <label>
            E-mail du nouvel admin
            <input id="sa-add-admin-email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
          </label>
          <label>
            Prénom
            <input id="sa-add-admin-name" value={adminFirstName} onChange={(e) => setAdminFirstName(e.target.value)} maxLength={100} />
          </label>
        </div>
        <div className="card-actions sa-actions">
          <button type="submit" className="btn btn-primary" disabled={busy === 'admin'}>
            Ajouter un admin
          </button>
        </div>
      </form>

      <h3>Zone sensible</h3>
      <div className="card card-list">
        <div className="card-row">
          <span>
            <span className="card-title">{poi.suspendedAt ? 'Réactiver' : 'Suspendre'}</span>
            <span className="sa-sub">
              Suspendue, la communauté disparaît de l’annuaire, son QR code ne fonctionne plus et ses admins ne peuvent plus
              entrer. Rien n’est effacé.
            </span>
          </span>
          {poi.suspendedAt ? (
            <button type="button" className="btn btn-primary" disabled={busy === 'suspend'} onClick={() => run('suspend', () => setSuspended(id, false), 'Communauté réactivée.')}>
              Réactiver
            </button>
          ) : (
            <DestructiveButton label="Suspendre" disabled={busy === 'suspend'} onConfirm={() => run('suspend', () => setSuspended(id, true), 'Communauté suspendue.')} />
          )}
        </div>
        <div className="card-row sa-delete-row">
          <span>
            <span className="card-title">Supprimer la communauté et toutes ses données</span>
            <span className="sa-sub">Définitif. Tapez son nom exact pour confirmer : {poi.name}</span>
            <input
              id="sa-delete-confirm"
              className="sa-inline-input"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={poi.name}
              aria-label="Nom de la communauté, pour confirmer"
            />
          </span>
          <DestructiveButton
            label="Supprimer"
            disabled={confirmName.trim() !== poi.name.trim() || busy === 'delete'}
            onConfirm={() =>
              run('delete', async () => {
                await deleteCommunity(id, confirmName);
                navigate('..', { replace: true });
              })
            }
          />
        </div>
      </div>
    </div>
  );
}

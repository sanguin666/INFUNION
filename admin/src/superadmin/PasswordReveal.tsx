import { useState } from 'react';

/** A temporary password, shown once: to read out or copy, never stored. */
export function PasswordReveal({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="card sa-reveal" role="status">
      <p className="card-title">Mot de passe provisoire de {email}</p>
      <p className="sa-password">{password}</p>
      <p className="muted">Il ne sera plus affiché. Donnez-le à la personne : elle se connecte avec son e-mail et ce mot de passe.</p>
      <div className="card-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() =>
            navigator.clipboard
              .writeText(password)
              .then(() => setCopied(true))
              .catch(() => setCopied(false))
          }
        >
          {copied ? 'Copié' : 'Copier'}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          C’est noté
        </button>
      </div>
    </div>
  );
}

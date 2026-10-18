import { useState } from 'react';
import { useSa } from './format';

/** A temporary password, shown once: to read out or copy, never stored. */
export function PasswordReveal({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const { s } = useSa();
  return (
    <div className="card sa-reveal" role="status">
      <p className="card-title">{s('reveal.title', { email })}</p>
      <p className="sa-password">{password}</p>
      <p className="muted">{s('reveal.note')}</p>
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
          {copied ? s('reveal.copied') : s('reveal.copy')}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          {s('reveal.done')}
        </button>
      </div>
    </div>
  );
}

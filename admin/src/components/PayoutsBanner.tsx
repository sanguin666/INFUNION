import { useEffect, useState } from "react";
import {
  getPayoutsAccount,
  startPayoutsOnboarding,
  type PayoutsAccount,
} from "../api/payouts";
import { useI18n } from "../i18n/I18nContext";

/**
 * Contributions are paid straight to the community's own payment account
 * (Seb, 9 Nov 2026). Until it is set up, a large banner says what is
 * missing with one button to fix it, and the page underneath is greyed
 * out (the caller wraps it in <PayoutsLock>).
 */
export function usePayoutsAccount(poiId: string) {
  const [account, setAccount] = useState<PayoutsAccount | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setAccount(null);
    setError(false);
    getPayoutsAccount(poiId)
      .then(setAccount)
      .catch(() => setError(true));
  }, [poiId]);

  return { account, setAccount, error };
}

export function PayoutsBanner({
  poiId,
  account,
  onChange,
}: {
  poiId: string;
  account: PayoutsAccount;
  onChange: (account: PayoutsAccount) => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (account.ready) return null;

  const start = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const result = await startPayoutsOnboarding(poiId);
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      onChange(result.status);
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };

  const linked = account.state !== "not_linked";
  return (
    <section
      className="payouts-banner"
      role="alert"
      aria-labelledby="payouts-banner-title"
    >
      <div className="payouts-banner-icon" aria-hidden="true">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
          <path d="M6 15h4" />
        </svg>
      </div>
      <div className="payouts-banner-body">
        <h3 id="payouts-banner-title">{t("payouts.title")}</h3>
        <p>{t("payouts.intro", { fee: String(account.feePercent) })}</p>
        <p className="payouts-banner-missing">
          <strong>{t("payouts.missingLabel")}</strong>{" "}
          {t(`payouts.state_${account.state}`)}
        </p>
        {account.demo && (
          <p className="payouts-banner-demo">{t("payouts.demoNote")}</p>
        )}
        {failed && <p className="error-text">{t("payouts.error")}</p>}
        {account.state !== "pending" && (
          <button
            type="button"
            className="btn btn-primary payouts-banner-cta"
            onClick={start}
            disabled={busy}
          >
            {busy
              ? t("payouts.opening")
              : linked
                ? t("payouts.finishSetUp")
                : t("payouts.setUp")}
          </button>
        )}
      </div>
    </section>
  );
}

/** The module's own page, greyed out and unusable while payments can't land. */
export function PayoutsLock({
  locked,
  children,
}: {
  locked: boolean;
  children: React.ReactNode;
}) {
  if (!locked) return <>{children}</>;
  return (
    <div className="payouts-locked" aria-disabled="true" inert>
      {children}
    </div>
  );
}

/** One quiet line once everything works: where the money goes. */
export function PayoutsReadyNote({ account }: { account: PayoutsAccount }) {
  const { t } = useI18n();
  if (!account.ready || account.demo) return null;
  return (
    <p className="muted payouts-ready-note">
      {t("payouts.readyNote", { fee: String(account.feePercent) })}{" "}
      <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer">
        {t("payouts.openStripe")}
      </a>
    </p>
  );
}

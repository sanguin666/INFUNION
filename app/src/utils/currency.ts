const SYMBOLS: Record<string, string> = { eur: '€', usd: '$', gbp: '£' };

const LOCALES: Record<string, string> = { en: 'en-IE', es: 'es-ES', va: 'ca-ES', ca: 'ca-ES', gl: 'gl-ES', pt: 'pt-PT', fr: 'fr-FR' };

export function currencySymbol(currency: string): string {
  return SYMBOLS[currency.toLowerCase()] ?? currency.toUpperCase();
}

/**
 * "€50" / "50 €" depending on the language, with cents only when the amount
 * has them — round numbers are what people pick, and "€50.00" reads heavier
 * at the large text sizes this app uses.
 */
export function formatAmount(amount: number, currency: string, language: string): string {
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  try {
    return new Intl.NumberFormat(LOCALES[language] ?? language, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    // Intl can be missing or reject a currency code on older engines.
    return `${currencySymbol(currency)}${amount.toFixed(fractionDigits)}`;
  }
}

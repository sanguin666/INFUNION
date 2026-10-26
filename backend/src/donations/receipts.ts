import { createHash } from 'node:crypto';
import type { Donation } from './entities/donation.entity.js';
import type { Poi } from '../pois/entities/poi.entity.js';
import { intlLocale, Language } from '../common/enums/language.enum.js';

/**
 * Yearly tax receipts. A community owes each giver who asked for one a
 * single receipt per calendar year, adding up everything they gave. These
 * are pure functions over the year's gifts, so they are easy to test and
 * the controllers only fetch and serve.
 *
 * The wording is a sound starting point, not legal advice: France's
 * receipts follow the Cerfa 11580 model and Spain's certificates the Ley
 * 49/2002. The diocese's accountant should read the template once before
 * a community sends real receipts.
 */

export type ReceiptDonor = {
  // Stable within a year: see donorKey.
  key: string;
  name: string;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  taxId: string | null;
  total: number;
  count: number;
  // The first and last gift of the year.
  firstGiftAt: Date;
  lastGiftAt: Date;
};

function normalise(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Who a gift belongs to, for adding gifts up. The tax number is the
 * legal identity where there is one; otherwise the account that gave it;
 * otherwise the name and postcode as written.
 */
export function donorKey(donation: Donation): string {
  const taxId = normalise(donation.donorTaxId).replace(/[\s-]/g, '');
  if (taxId) return `t:${taxId}`;
  if (donation.donor?.id) return `u:${donation.donor.id}`;
  return `n:${normalise(donation.donorName)}|${normalise(donation.donorPostalCode)}`;
}

/** Keys travel in URLs; this keeps them to URL-safe characters. */
export function encodeDonorKey(key: string): string {
  return Buffer.from(key, 'utf8').toString('base64url');
}

export function decodeDonorKey(encoded: string): string {
  return Buffer.from(encoded, 'base64url').toString('utf8');
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The year's receipt-worthy gifts, one entry per giver. The details on a
 * receipt are the ones given most recently, so a giver who moved during
 * the year gets their new address.
 */
export function groupDonors(donations: Donation[]): ReceiptDonor[] {
  const byKey = new Map<string, ReceiptDonor>();
  const sorted = [...donations].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const donation of sorted) {
    const key = donorKey(donation);
    const existing = byKey.get(key);
    const details = {
      name: donation.donorName?.trim() || existing?.name || '',
      address: donation.donorAddress ?? existing?.address ?? null,
      postalCode: donation.donorPostalCode ?? existing?.postalCode ?? null,
      city: donation.donorCity ?? existing?.city ?? null,
      taxId: donation.donorTaxId ?? existing?.taxId ?? null,
    };
    byKey.set(key, {
      key,
      ...details,
      total: round2((existing?.total ?? 0) + donation.amount),
      count: (existing?.count ?? 0) + 1,
      firstGiftAt: existing?.firstGiftAt ?? donation.createdAt,
      lastGiftAt: donation.createdAt,
    });
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** A receipt number that stays the same however often it is printed. */
export function receiptNumber(year: number, key: string): string {
  return `${year}-${createHash('sha256').update(key).digest('hex').slice(0, 8).toUpperCase()}`;
}

function csvCell(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The year's givers as a spreadsheet — for the treasurer, and in Spain
 * the starting point of the modelo 182 the community files each January
 * (the province is the first two digits of a Spanish postcode). It is a
 * working file for whoever files, not the official format itself.
 */
export function donorsCsv(donors: ReceiptDonor[]): string {
  const header = ['NIF', 'Nombre / Name', 'Dirección / Address', 'CP', 'Ciudad / City', 'Provincia', 'Importe / Amount', 'Donativos / Gifts'];
  const rows = donors.map((d) => [
    d.taxId,
    d.name,
    d.address,
    d.postalCode,
    d.city,
    d.postalCode && /^\d{5}$/.test(d.postalCode) ? d.postalCode.slice(0, 2) : null,
    d.total.toFixed(2),
    d.count,
  ]);
  // A BOM so Excel opens the accents right.
  return '\uFEFF' + [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

function escapeHtml(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type Wording = {
  title: string;
  legalBasis: string;
  issuer: string;
  donor: string;
  taxIdLabel: string;
  amountLine: (amount: string, year: number) => string;
  giftsLine: (count: number) => string;
  // A receipt for one gift rather than a year's.
  giftTitle: string;
  giftAmountLine: (amount: string, date: string) => string;
  giftLine: string;
  nature: string;
  signed: (place: string, date: string) => string;
  number: string;
  missingIssuer: string;
  print: string;
};

const WORDING: Record<Language, Wording> = {
  [Language.FR]: {
    title: 'Reçu au titre des dons',
    legalBasis:
      'Articles 200, 238 bis et 978 du code général des impôts. Le bénéficiaire certifie sur l’honneur que les dons et versements qu’il reçoit ouvrent droit à la réduction d’impôt prévue.',
    issuer: 'Bénéficiaire des versements',
    donor: 'Donateur',
    taxIdLabel: 'N° fiscal',
    amountLine: (amount, year) => `Somme totale reçue au titre de l’année ${year} : <strong>${amount}</strong>`,
    giftsLine: (count) => `${count} versement${count > 1 ? 's' : ''} effectué${count > 1 ? 's' : ''} en ligne, par carte bancaire.`,
    giftTitle: 'Reçu au titre d’un don',
    giftAmountLine: (amount, date) => `Somme reçue le ${date} : <strong>${amount}</strong>`,
    giftLine: 'Versement effectué en ligne, par carte bancaire.',
    nature: 'Nature du don : numéraire. Forme : don manuel.',
    signed: (place, date) => `Fait ${place ? `à ${place}, ` : ''}le ${date}`,
    number: 'Reçu n°',
    missingIssuer: 'Les informations légales de la communauté ne sont pas encore renseignées dans le tableau de bord.',
    print: 'Imprimer ou enregistrer en PDF',
  },
  [Language.ES]: {
    title: 'Certificado de donativos',
    legalBasis:
      'A los efectos de lo previsto en la Ley 49/2002, de 23 de diciembre, de régimen fiscal de las entidades sin fines lucrativos y de los incentivos fiscales al mecenazgo. El donativo tiene carácter irrevocable.',
    issuer: 'Entidad perceptora',
    donor: 'Donante',
    taxIdLabel: 'NIF',
    amountLine: (amount, year) => `Importe total recibido durante el año ${year}: <strong>${amount}</strong>`,
    giftsLine: (count) => `${count} donativo${count > 1 ? 's' : ''} realizado${count > 1 ? 's' : ''} en línea, con tarjeta.`,
    giftTitle: 'Certificado de donativo',
    giftAmountLine: (amount, date) => `Importe recibido el ${date}: <strong>${amount}</strong>`,
    giftLine: 'Donativo realizado en línea, con tarjeta.',
    nature: 'Naturaleza del donativo: dinerario.',
    signed: (place, date) => `En ${place ? `${place}, a ` : ''}${date}`,
    number: 'Certificado n.º',
    missingIssuer: 'Los datos legales de la comunidad aún no se han completado en el panel de administración.',
    print: 'Imprimir o guardar en PDF',
  },
  [Language.VA]: {
    title: 'Certificat de donatius',
    legalBasis:
      'Als efectes del que preveu la Llei 49/2002, de 23 de desembre, de règim fiscal de les entitats sense finalitats lucratives i dels incentius fiscals al mecenatge. El donatiu té caràcter irrevocable.',
    issuer: 'Entitat perceptora',
    donor: 'Donant',
    taxIdLabel: 'NIF',
    amountLine: (amount, year) => `Import total rebut durant l’any ${year}: <strong>${amount}</strong>`,
    giftsLine: (count) => `${count} donatiu${count > 1 ? 's' : ''} fet${count > 1 ? 's' : ''} en línia, amb targeta.`,
    giftTitle: 'Certificat de donatiu',
    giftAmountLine: (amount, date) => `Import rebut el ${date}: <strong>${amount}</strong>`,
    giftLine: 'Donatiu fet en línia, amb targeta.',
    nature: 'Naturalesa del donatiu: dinerari.',
    signed: (place, date) => `${place ? `${place}, ` : ''}${date}`,
    number: 'Certificat núm.',
    missingIssuer: 'Les dades legals de la comunitat encara no s’han completat en el panell d’administració.',
    print: 'Imprimir o guardar en PDF',
  },
  [Language.GL]: {
    title: 'Certificado de doazóns',
    legalBasis:
      'Para os efectos do previsto na Lei 49/2002, do 23 de decembro, de réxime fiscal das entidades sen fins lucrativos e dos incentivos fiscais ao mecenado. A doazón ten carácter irrevogable.',
    issuer: 'Entidade perceptora',
    donor: 'Doador',
    taxIdLabel: 'NIF',
    amountLine: (amount, year) => `Importe total recibido durante o ano ${year}: <strong>${amount}</strong>`,
    giftsLine: (count) => `${count} ${count > 1 ? 'doazóns feitas' : 'doazón feita'} en liña, con tarxeta.`,
    giftTitle: 'Certificado de doazón',
    giftAmountLine: (amount, date) => `Importe recibido o ${date}: <strong>${amount}</strong>`,
    giftLine: 'Doazón feita en liña, con tarxeta.',
    nature: 'Natureza da doazón: diñeiro.',
    signed: (place, date) => `${place ? `${place}, ` : ''}${date}`,
    number: 'Certificado n.º',
    missingIssuer: 'Os datos legais da comunidade aínda non se completaron no panel de administración.',
    print: 'Imprimir ou gardar en PDF',
  },
  // Portugal's rules for gift receipts differ from Spain's, so this stays a
  // plain receipt, like the English one, rather than citing a law.
  [Language.PT]: {
    title: 'Recibo de donativos',
    legalBasis: 'Recibo dos donativos recebidos, para efeitos fiscais do doador.',
    issuer: 'Entidade beneficiária',
    donor: 'Doador',
    taxIdLabel: 'NIF',
    amountLine: (amount, year) => `Montante total recebido no ano de ${year}: <strong>${amount}</strong>`,
    giftsLine: (count) => `${count} donativo${count > 1 ? 's' : ''} feito${count > 1 ? 's' : ''} online, com cartão.`,
    giftTitle: 'Recibo de donativo',
    giftAmountLine: (amount, date) => `Montante recebido a ${date}: <strong>${amount}</strong>`,
    giftLine: 'Donativo feito online, com cartão.',
    nature: 'Natureza do donativo: em dinheiro.',
    signed: (place, date) => `${place ? `${place}, ` : ''}${date}`,
    number: 'Recibo n.º',
    missingIssuer: 'Os dados legais da comunidade ainda não foram preenchidos no painel de administração.',
    print: 'Imprimir ou guardar em PDF',
  },
  [Language.EN]: {
    title: 'Donation receipt',
    legalBasis: 'Receipt for gifts received, for the donor’s tax records.',
    issuer: 'Received by',
    donor: 'Donor',
    taxIdLabel: 'Tax number',
    amountLine: (amount, year) => `Total received in ${year}: <strong>${amount}</strong>`,
    giftsLine: (count) => `${count} gift${count > 1 ? 's' : ''} made online, by card.`,
    giftTitle: 'Donation receipt',
    giftAmountLine: (amount, date) => `Received on ${date}: <strong>${amount}</strong>`,
    giftLine: 'Gift made online, by card.',
    nature: 'Nature of the gift: money.',
    signed: (place, date) => `${place ? `${place}, ` : ''}${date}`,
    number: 'Receipt no.',
    missingIssuer: 'The community’s legal details have not been filled in on the dashboard yet.',
    print: 'Print or save as PDF',
  },
};

/**
 * One giver's receipt for one year, as a page to print or save as a PDF.
 * With `gift`, the receipt is for that single gift instead, the one a
 * giver downloads from their list of gifts in the app.
 */
export function receiptHtml(
  poi: Poi,
  donor: ReceiptDonor,
  year: number,
  currency: string,
  gift?: { id: string; at: Date },
): string {
  const w = WORDING[poi.language] ?? WORDING[Language.EN];
  const locale = poi.language === Language.EN ? 'en-GB' : intlLocale(poi.language);
  const amount = new Intl.NumberFormat(locale, { style: 'currency', currency: currency.toUpperCase() }).format(donor.total);
  const today = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date());
  const title = gift ? w.giftTitle : `${w.title} ${year}`;
  const number = gift ? receiptNumber(year, `g:${gift.id}`) : receiptNumber(year, donor.key);
  const amountLine = gift
    ? w.giftAmountLine(escapeHtml(amount), escapeHtml(new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(gift.at)))
    : w.amountLine(escapeHtml(amount), year);
  const giftsLine = gift ? w.giftLine : w.giftsLine(donor.count);
  const issuerName = poi.legalName || poi.name;
  const hasIssuer = !!(poi.legalName && poi.legalAddress);
  const donorAddress = [donor.address, [donor.postalCode, donor.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .map(escapeHtml)
    .join('<br />');

  return `<!doctype html>
<html lang="${poi.language}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} — ${escapeHtml(donor.name)}</title>
    <style>
      body { margin: 0; background: #F6F5F9; color: #111; font: 16px/1.5 system-ui, -apple-system, sans-serif; padding: 24px 16px; }
      main { max-width: 42rem; margin: 0 auto; background: #fff; border: 1px solid rgba(45,30,110,0.14); border-radius: 16px; padding: 32px; }
      h1 { font-size: 1.6rem; margin: 0 0 4px; }
      .number { color: #4A4760; margin: 0 0 24px; }
      .legal { font-size: 0.85rem; color: #4A4760; margin: 0 0 24px; }
      section { padding: 16px 0; border-top: 1px solid rgba(45,30,110,0.14); }
      section h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: #4A4760; margin: 0 0 6px; }
      .amount { font-size: 1.2rem; }
      .warning { color: #B3261E; font-weight: 700; }
      .signature { margin-top: 32px; }
      button { font: inherit; font-weight: 700; color: #fff; background: #6C4FD9; border: 2px solid #6C4FD9; border-radius: 16px; padding: 14px 24px; cursor: pointer; margin-top: 24px; width: 100%; }
      @media print { body { background: #fff; padding: 0; } main { border: 0; } button { display: none; } }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p class="number">${escapeHtml(w.number)} ${number}</p>
      <p class="legal">${escapeHtml(w.legalBasis)}</p>
      <section>
        <h2>${escapeHtml(w.issuer)}</h2>
        <p><strong>${escapeHtml(issuerName)}</strong><br />
        ${poi.legalAddress ? escapeHtml(poi.legalAddress).replace(/\n/g, '<br />') + '<br />' : ''}
        ${poi.legalTaxId ? `${escapeHtml(w.taxIdLabel)} : ${escapeHtml(poi.legalTaxId)}` : ''}</p>
        ${hasIssuer ? '' : `<p class="warning">${escapeHtml(w.missingIssuer)}</p>`}
      </section>
      <section>
        <h2>${escapeHtml(w.donor)}</h2>
        <p><strong>${escapeHtml(donor.name)}</strong><br />
        ${donorAddress}${donor.taxId ? `<br />${escapeHtml(w.taxIdLabel)} : ${escapeHtml(donor.taxId)}` : ''}</p>
      </section>
      <section>
        <p class="amount">${amountLine}</p>
        <p>${escapeHtml(giftsLine)}<br />${escapeHtml(w.nature)}</p>
      </section>
      <section class="signature">
        <p>${escapeHtml(w.signed(poi.city ?? '', today))}</p>
        <p>${escapeHtml(poi.receiptSignatory ?? '')}</p>
      </section>
      <button type="button" onclick="window.print()">${escapeHtml(w.print)}</button>
    </main>
  </body>
</html>`;
}

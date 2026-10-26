/**
 * What a place's QR code actually contains, and how to get the token back
 * out of it.
 *
 * The flyer the admin dashboard prints encodes a link to the landing site —
 * `https://infunion.app/?token=<qrCodeToken>#join` (see admin's MyQrPage) —
 * rather than the bare token, so that someone scanning it with their
 * phone's built-in camera app lands on a page explaining what infunion is
 * instead of a meaningless string.
 *
 * That means the in-app scanner has to pull the token back out. Bare tokens
 * are accepted too: the flyer prints the code underneath for anyone whose
 * camera won't focus, and it's what gets typed in by hand.
 */
export function extractPoiToken(scanned: string): string | null {
  const trimmed = scanned.trim();
  if (!trimmed) return null;

  const fromQuery = readTokenParam(trimmed);
  if (fromQuery) return fromQuery;

  // Not a link we recognize. Treat it as a token only if it looks like one
  // (the seeded tokens are "DEMO-STMARYS"; real ones are UUIDs), so that
  // scanning an unrelated QR code — a payment code, a website — reports
  // "not one of ours" instead of being sent to the backend as a lookup.
  return /^[A-Za-z0-9-]{4,64}$/.test(trimmed) ? trimmed : null;
}

/**
 * Hand-rolled rather than `new URL(...)`: React Native's URL polyfill
 * doesn't implement `searchParams`, so reading it would work in the browser
 * and quietly return undefined on a phone.
 */
function readTokenParam(value: string): string | null {
  const queryStart = value.indexOf('?');
  if (queryStart === -1) return null;

  // Anything after '#' is the fragment, not the query.
  const query = value.slice(queryStart + 1).split('#')[0];
  for (const pair of query.split('&')) {
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    if (pair.slice(0, separator) !== 'token') continue;
    try {
      const decoded = decodeURIComponent(pair.slice(separator + 1)).trim();
      return decoded || null;
    } catch {
      // A malformed percent-escape is not our token.
      return null;
    }
  }
  return null;
}

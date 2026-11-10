import { escapeHtml } from '../common/email/email-layout.js';
import { outreachText } from './outreach-texts.js';

// infunion's mark (brand/svg/infunion-mark.svg), for "Made with ⚭ infunion".
const MARK = '<svg viewBox="0 0 512 512" width="18" height="18" aria-hidden="true"><defs><clipPath id="mk"><rect x="147.38" y="256" width="217.24" height="143.48"/></clipPath></defs><circle cx="177.25" cy="256" r="108.62" fill="none" stroke="#6C4FD9" stroke-width="34.87"/><circle cx="334.75" cy="256" r="108.62" fill="none" stroke="#F9B800" stroke-width="34.87"/><circle cx="177.25" cy="256" r="108.62" fill="none" stroke="#6C4FD9" stroke-width="34.87" clip-path="url(#mk)"/></svg>';

/**
 * The few web pages a member reaches from an email, outside the app: the
 * contribution page and "stop these emails". One white box on the light
 * page, the purple button, the community's name on top.
 */
export function publicPage(options: { lang: string; title: string; community?: string; logoUrl?: string | null; body: string }): string {
  const { lang, title, community, logoUrl, body } = options;
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:#f6f5f9;color:#1D1A2D;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:17px;line-height:1.5;display:flex;justify-content:center;padding:32px 16px}
main{width:100%;max-width:440px}
.top{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.top img{width:44px;height:44px;border-radius:12px;object-fit:cover}
.top b{font-size:18px}
.card{background:#fff;border:1px solid rgba(45,30,110,.14);border-radius:16px;padding:24px}
h1{font-size:24px;line-height:1.25;margin:0 0 8px}
p{margin:0 0 16px;color:#4a4760}
label{display:block;font-weight:600;margin:16px 0 6px}
input{width:100%;font:inherit;padding:12px 14px;border:1.5px solid rgba(45,30,110,.25);border-radius:12px;background:#fff;color:inherit}
input:focus{outline:none;border-color:#6c4fd9}
.fixed{font-size:40px;font-weight:800;line-height:1.1;margin:8px 0 4px;color:#1D1A2D}
.amounts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.amounts label{margin:0;font-weight:600;text-align:center;border:1.5px solid rgba(45,30,110,.25);border-radius:999px;padding:8px 18px;cursor:pointer}
.amounts input[type=radio]{position:absolute;opacity:0;width:1px;height:1px}
.amounts label:has(input:checked){background:#ece8fc;border-color:#6c4fd9;color:#5638c7}
button{margin-top:24px;width:100%;font:inherit;font-weight:700;color:#fff;background:#6c4fd9;border:0;border-radius:999px;padding:14px 20px;cursor:pointer}
.small{font-size:14px;color:#6b6880;margin:16px 0 0}
.foot{text-align:center;font-size:13px;color:#8b87a0;margin-top:20px}
.foot a{display:inline-flex;align-items:center;gap:6px;color:#8b87a0;text-decoration:none}
.foot b{color:#1D1A2D}
.amounts .other{grid-column:span 2;width:100%;min-width:0;margin:0;border-radius:999px;padding:8px 18px;font-weight:600;text-align:center}
.amounts .other::placeholder{color:#5638c7;opacity:.8}
.amounts .other:not(:placeholder-shown){background:#ece8fc;border-color:#6c4fd9;color:#5638c7}
</style>
</head>
<body>
<main>
${community ? `<div class="top">${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="">` : ''}<b>${escapeHtml(community)}</b></div>` : ''}
<div class="card">
<h1>${escapeHtml(title)}</h1>
${body}
</div>
<p class="foot"><a href="https://www.infunion.app">${escapeHtml(outreachText(lang).madeWith)} ${MARK}<b>infunion</b></a></p>
</main>
</body>
</html>`;
}

export { escapeHtml };

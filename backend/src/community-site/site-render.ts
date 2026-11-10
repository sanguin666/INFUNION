import QRCode from 'qrcode';
import { localTime } from '../events/occurrences.js';
import type { SiteData, SiteSlot } from './community-site.service.js';
import { fill, siteLocale, siteStrings, type SiteStrings } from './site-strings.js';

/** The community's colour, as in the app (app/src/theme/theme.ts). */
const ACCENTS: Record<string, { primary: string; strong: string; soft: string }> = {
  purple: { primary: '#6C4FD9', strong: '#5638C7', soft: '#ECE8FC' },
  ocean: { primary: '#1F6FD1', strong: '#1557A8', soft: '#E3EEFB' },
  forest: { primary: '#2E8B57', strong: '#1E6B41', soft: '#E2F3E9' },
  terracotta: { primary: '#D2602E', strong: '#A8461C', soft: '#FBEAE1' },
  ruby: { primary: '#C2185B', strong: '#A0124A', soft: '#FBE4EE' },
  teal: { primary: '#0F8A8A', strong: '#0B6B6B', soft: '#DDF3F2' },
  graphite: { primary: '#4A5263', strong: '#2F3542', soft: '#E8EAEE' },
};

export function esc(text: string | null | undefined): string {
  return (text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function paragraphs(text: string | null | undefined): string {
  return (text ?? '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => w.length > 2 || /^[A-ZÁÉÍÓÚ]/.test(w));
  return (words.length ? words : name.split(/\s+/))
    .slice(0, 3)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** The join address the QR flyer uses: the landing reveals the community code. */
export function joinUrl(code: string): string {
  return `https://infunion.app/?token=${encodeURIComponent(code)}#join`;
}

export async function renderSite(data: SiteData, siteUrl: string): Promise<string> {
  const { poi, hidden } = data;
  const s = siteStrings(poi.language);
  const locale = siteLocale(poi.language);
  const accent = ACCENTS[poi.theme] ?? ACCENTS.purple;
  const tz = data.timeZone;
  const time = (d: Date) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(d);
  const dayKey = (d: Date) => {
    const t = localTime(d, tz);
    return `${t.year}-${t.month}-${t.day}`;
  };
  const todayKey = dayKey(data.now);
  const tomorrowKey = dayKey(new Date(data.now.getTime() + 24 * 3600 * 1000));
  const weekday = (d: Date) => new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: tz }).format(d);
  const dayName = (d: Date) => {
    const key = dayKey(d);
    if (key === todayKey) return s.today;
    if (key === tomorrowKey) return s.tomorrow;
    const name = weekday(d);
    return name.charAt(0).toUpperCase() + name.slice(1);
  };
  const when = (d: Date) => `${dayName(d)} ${time(d)}`;
  const date = (d: Date) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: tz }).format(d);
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: data.currency, maximumFractionDigits: 0 }).format(n);

  const join = joinUrl(poi.qrCodeToken);
  const qr = await QRCode.toString(join, { type: 'svg', margin: 0, color: { dark: '#1D1A2D', light: '#FFFFFF' } });
  const place = poi.city ?? '';
  const address = [poi.address, [poi.postalCode, poi.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  // The intro is the community's description; without one, the first text section.
  const welcome = poi.description?.trim() ? undefined : data.blocks.find((b) => b.type === 'text');
  const picture = data.blocks.find((b) => b.type === 'image' && b.imageUrl)?.imageUrl ?? null;
  const intro = poi.description?.trim() || welcome?.body || '';
  const restBlocks = data.blocks.filter((b) => b !== welcome);

  // Chips: next Mass and open / closed, like the app's badges.
  const chips: string[] = [];
  if (!hidden.has('badges')) {
    if (data.nextMass) chips.push(`<div class="chip"><span>${esc(s.nextMass)}</span><b>${esc(when(data.nextMass))}</b></div>`);
    if (data.open?.now) {
      chips.push(
        `<div class="chip is-open"><span>${esc(s.openNow)}</span><b>${esc(data.open.until ? fill(s.until, { time: time(data.open.until) }) : '')}</b></div>`,
      );
    } else if (data.open && !data.open.now && data.open.next) {
      chips.push(`<div class="chip"><span>${esc(s.closed)}</span><b>${esc(fill(s.opens, { when: when(data.open.next) }))}</b></div>`);
    }
  }
  const alerts = hidden.has('badges')
    ? ''
    : data.messages
        .map((m) => `<p class="alert${m.important ? ' is-important' : ''}">${esc(m.text)}</p>`)
        .join('');

  // The week, day by day.
  const days = new Map<string, { label: string; slots: SiteSlot[] }>();
  for (const slot of data.week) {
    const key = dayKey(slot.start);
    if (!days.has(key)) days.set(key, { label: dayName(slot.start), slots: [] });
    days.get(key)!.slots.push(slot);
  }
  const timetable =
    hidden.has('timetable') || days.size === 0
      ? ''
      : `<section class="box" id="timetable"><h2>${esc(s.timetable)}</h2>${[...days.values()]
          .map(
            (day) =>
              `<div class="day"><h3>${esc(day.label)}</h3><ul>${day.slots
                .map(
                  (slot) =>
                    `<li><span>${esc(slot.title)}</span><b>${esc(time(slot.start))}${slot.end && slot.category === 'office_hours' ? `–${esc(time(slot.end))}` : ''}</b></li>`,
                )
                .join('')}</ul></div>`,
          )
          .join('')}</section>`;

  const events =
    hidden.has('events') || data.upcoming.length === 0
      ? ''
      : `<section class="box" id="events"><h2>${esc(s.events)}</h2><ul class="list">${data.upcoming
          .map(
            (e) =>
              `<li><span class="date">${esc(date(e.start))}</span><div><b>${esc(e.title)}</b><small>${esc(time(e.start))}${e.location ? ` · ${esc(e.location)}` : ''}</small></div></li>`,
          )
          .join('')}</ul></section>`;

  const news =
    hidden.has('news') || data.news.length === 0
      ? ''
      : `<section class="box" id="news"><h2>${esc(s.news)}</h2><ul class="list">${data.news
          .map(
            (n) =>
              `<li>${n.imageUrl ? `<img class="thumb" src="${esc(n.imageUrl)}" alt="" loading="lazy">` : ''}<div><b>${esc(n.title)}</b><small>${esc(date(new Date(n.createdAt)))}${n.important ? ` · ${esc(s.important)}` : ''}</small></div></li>`,
          )
          .join('')}</ul><a class="more" href="${esc(join)}">${esc(s.moreInApp)} ›</a></section>`;

  const campaign =
    hidden.has('campaign') || !data.campaign
      ? ''
      : (() => {
          const c = data.campaign!;
          const share = c.goal ? Math.min(100, Math.round((c.raised / c.goal) * 100)) : null;
          return `<section class="box" id="campaign"><h2>${esc(c.title)}</h2>${c.description ? `<p class="muted">${esc(c.description.slice(0, 220))}</p>` : ''}<p class="muted">${esc(
            c.goal ? fill(s.raisedOf, { amount: money(c.raised), goal: money(c.goal) }) : fill(s.raised, { amount: money(c.raised) }),
          )}</p>${share !== null ? `<div class="bar" role="progressbar" aria-valuenow="${share}" aria-valuemin="0" aria-valuemax="100"><span style="width:${share}%"></span></div>` : ''}<a class="btn" href="${esc(join)}">${esc(s.contribute)}</a></section>`;
        })();

  const hasMap = !hidden.has('map') && (address || (poi.latitude && poi.longitude));
  const lat = Number(poi.latitude);
  const lng = Number(poi.longitude);
  const map = !hasMap
    ? ''
    : `<section class="box" id="visit"><h2>${esc(s.visit)}</h2>${
        Number.isFinite(lat) && Number.isFinite(lng) && poi.latitude
          ? `<iframe class="map" title="${esc(s.visit)}" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.004}%2C${lat - 0.0025}%2C${lng + 0.004}%2C${lat + 0.0025}&amp;layer=mapnik&amp;marker=${lat}%2C${lng}"></iframe>`
          : ''
      }${address ? `<p>${esc(address)}</p>` : ''}<a class="more" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(
        Number.isFinite(lat) && poi.latitude ? `${lat},${lng}` : address,
      )}" rel="noopener">${esc(s.directions)} ›</a></section>`;

  const more = hidden.has('home')
    ? ''
    : restBlocks
        .map((b) =>
          b.type === 'image' && b.imageUrl
            ? `<figure class="box"><img src="${esc(b.imageUrl)}" alt="${esc(b.title)}" loading="lazy">${b.title ? `<figcaption>${esc(b.title)}</figcaption>` : ''}</figure>`
            : b.type === 'text'
              ? `<section class="box">${b.title ? `<h2>${esc(b.title)}</h2>` : ''}${paragraphs(b.body)}</section>`
              : '',
        )
        .join('');

  const logo = poi.logoUrl
    ? `<img class="logo" src="${esc(poi.logoUrl)}" alt="">`
    : `<span class="logo" aria-hidden="true">${esc(initials(poi.name))}</span>`;
  const description = (intro || poi.description || '').replace(/\s+/g, ' ').slice(0, 160);
  const canonical = `${siteUrl}/c/${poi.siteSlug}`;
  const structured = {
    '@context': 'https://schema.org',
    '@type': poi.type === 'church' ? 'Church' : 'Organization',
    name: poi.name,
    url: canonical,
    description: description || undefined,
    address: address
      ? { '@type': 'PostalAddress', streetAddress: poi.address ?? undefined, postalCode: poi.postalCode ?? undefined, addressLocality: poi.city ?? undefined, addressCountry: 'ES' }
      : undefined,
    geo: poi.latitude ? { '@type': 'GeoCoordinates', latitude: lat, longitude: lng } : undefined,
  };

  return `<!doctype html>
<html lang="${esc(poi.language === 'va' ? 'ca' : poi.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(poi.name)}${place ? ` · ${esc(place)}` : ''}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(poi.name)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
${picture ? `<meta property="og:image" content="${esc(picture.startsWith('http') ? picture : siteUrl + picture)}">` : ''}
<meta name="theme-color" content="${accent.primary}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(structured).replace(/</g, '\\u003c')}</script>
<style>
:root{--c:${accent.primary};--cs:${accent.strong};--soft:${accent.soft};--ink:#1D1A2D;--muted:#5d5a70;--line:rgba(45,30,110,.14);--bg:#fff;--page:#f7f6fa}
*{box-sizing:border-box}
body{margin:0;background:var(--page);color:var(--ink);font:16px/1.5 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--cs)}
.top{background:var(--bg);border-bottom:1px solid var(--line)}
.top .in{max-width:1080px;margin:0 auto;padding:14px 20px;display:flex;align-items:center;gap:14px}
.logo{width:46px;height:46px;border-radius:50%;object-fit:cover;flex:none;background:var(--c);color:#fff;display:grid;place-items:center;font-weight:800;font-size:15px}
.name{font-weight:800;font-size:18px;line-height:1.15}
.name small{display:block;font-weight:500;font-size:13px;color:var(--muted)}
.nav{margin-left:auto;display:flex;gap:20px;align-items:center}
.nav a{color:var(--muted);text-decoration:none;font-weight:500}
.nav a.btn{color:#fff}
.btn{display:inline-block;white-space:nowrap;background:var(--c);color:#fff;text-decoration:none;font-weight:700;border-radius:999px;padding:10px 20px}
main{max-width:1080px;margin:0 auto;padding:28px 20px 40px}
.hero{display:grid;grid-template-columns:minmax(0,640px);gap:28px;align-items:center;margin-bottom:28px}
.hero.has-photo{grid-template-columns:1.2fr 1fr}
.hero h1{font-size:clamp(28px,4vw,40px);line-height:1.1;margin:0 0 12px}
.hero .intro{color:var(--muted);margin:0 0 18px}
.hero .intro p{margin:0 0 10px}
.photo{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:20px;display:block;background:var(--soft)}
.alert{margin:0 0 10px;padding:10px 14px;border-radius:12px;background:var(--soft);font-weight:600}
.alert.is-important{background:var(--c);color:#fff}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}
.chip{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:8px 12px;font-size:13px;color:var(--muted)}
.chip b{display:block;color:var(--ink);font-size:15px}
.chip.is-open b{color:#1f7a3a}
.join{display:flex;gap:16px;align-items:center;background:var(--soft);border-radius:18px;padding:16px}
.join .qr{width:104px;height:104px;flex:none;background:#fff;border-radius:10px;padding:8px}
.join .qr svg{width:100%;height:100%;display:block}
.join b{display:block;font-size:18px}
.join p{margin:4px 0 8px;color:var(--muted);font-size:14px}
.stores{display:flex;gap:8px;flex-wrap:wrap}
.store{background:var(--ink);color:#fff;text-decoration:none;border-radius:9px;padding:6px 12px;font-size:11px;line-height:1.15}
.store b{font-size:14px;display:block}
.phone-only{display:none}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;align-items:start}
.box{background:var(--bg);border:1px solid var(--line);border-radius:18px;padding:18px 20px;margin:0}
.box h2{font-size:18px;margin:0 0 12px}
.box p{margin:0 0 10px}
.muted{color:var(--muted)}
.day h3{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--cs);margin:12px 0 4px}
.day:first-of-type h3{margin-top:0}
.day ul,.list{list-style:none;margin:0;padding:0}
.day li{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px dashed var(--line);font-size:15px}
.day li:last-child{border-bottom:0}
.day li span{color:var(--muted)}
.list li{display:flex;gap:12px;align-items:center;margin-bottom:12px}
.list b{display:block;line-height:1.25}
.list small{color:var(--muted)}
.thumb{width:56px;height:56px;border-radius:12px;object-fit:cover;flex:none;background:var(--soft)}
.date{width:56px;flex:none;text-align:center;font-weight:700;color:var(--cs);background:var(--soft);border-radius:12px;padding:8px 4px;font-size:13px}
.more{font-weight:600;text-decoration:none}
.bar{height:10px;border-radius:5px;background:var(--soft);margin:4px 0 14px;overflow:hidden}
.bar span{display:block;height:100%;background:var(--c);border-radius:5px}
.map{width:100%;height:170px;border:0;border-radius:12px;margin-bottom:10px;background:var(--soft)}
figure.box{padding:0;overflow:hidden}
figure.box img{width:100%;display:block}
figcaption{padding:12px 16px;color:var(--muted)}
.extra{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin-top:18px}
footer{max-width:1080px;margin:0 auto;padding:18px 20px 40px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;color:var(--muted);font-size:13px}
footer a{color:var(--muted)}
@media (max-width:860px){
  .hero,.grid,.extra{grid-template-columns:1fr}
  .nav a.link{display:none}
  .photo{aspect-ratio:16/9}
  .join .qr,.join .desk{display:none}
  .phone-only{display:block}
  .join{flex-direction:column;align-items:stretch;text-align:center}
  .join .btn{display:block;padding:14px}
}
</style>
</head>
<body>
<header class="top"><div class="in">${logo}<div class="name">${esc(poi.name)}${place ? `<small>${esc(place)}</small>` : ''}</div>
<nav class="nav">${timetable ? `<a class="link" href="#timetable">${esc(s.timetable)}</a>` : ''}${news ? `<a class="link" href="#news">${esc(s.news)}</a>` : ''}${map ? `<a class="link" href="#visit">${esc(s.visit)}</a>` : ''}<a class="btn" href="${esc(join)}">${esc(s.join)}</a></nav></div></header>
<main>
<div class="hero${picture && !hidden.has('home') ? ' has-photo' : ''}"><div>
${alerts}
<h1>${esc(poi.name)}</h1>
${!hidden.has('home') && intro ? `<div class="intro">${paragraphs(intro)}</div>` : ''}
${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}
${joinBox(s, join, qr, poi.name)}
</div>${picture && !hidden.has('home') ? `<img class="photo" src="${esc(picture)}" alt="">` : ''}</div>
<div class="grid">${timetable}${news || events}${campaign || map}</div>
${news && events ? `<div class="extra">${events}${campaign && map ? map : ''}</div>` : campaign && map ? `<div class="extra">${map}</div>` : ''}
${more ? `<div class="extra">${more}</div>` : ''}
</main>
<footer><span>© ${esc(poi.name)}</span><a href="https://infunion.app" rel="noopener">${esc(s.madeWith)}</a></footer>
</body>
</html>`;
}

function joinBox(s: SiteStrings, join: string, qr: string, name: string): string {
  return `<div class="join"><div class="qr" aria-hidden="true">${qr}</div><div><b>${esc(s.joinTitle)}</b><p class="desk">${esc(s.joinBody)}</p><a class="btn phone-only" href="${esc(join)}">${esc(s.openApp)}</a><p class="phone-only">${esc(fill(s.openAppNote, { name }))}</p><div class="stores desk"><a class="store" href="${esc(join)}">${esc(s.appStore)}<b>App Store</b></a><a class="store" href="${esc(join)}">${esc(s.googlePlay)}<b>Google Play</b></a></div></div></div>`;
}

export function renderNotFound(language: string | null | undefined): string {
  const s = siteStrings(language);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(s.notFoundTitle)}</title><style>body{margin:0;font:16px/1.5 system-ui,sans-serif;color:#1D1A2D;background:#f7f6fa;display:grid;place-items:center;min-height:100vh;padding:20px}main{max-width:420px;text-align:center}a{color:#5638C7}</style></head><body><main><h1>${esc(s.notFoundTitle)}</h1><p>${esc(s.notFoundBody)}</p><p><a href="https://infunion.app">infunion</a></p></main></body></html>`;
}

// Builds the landing's language pages (SEO):
//   landing/index.html                      Spanish home (the root)
//   landing/<lang>/index.html               home page in English, French, Catalan, Valencian, Galician, Portuguese
//   landing/<place page>/index.html         one page per type of place (church, mosque, synagogue) in each language
// Each page has its text in the HTML itself, its own title and description,
// a canonical link, hreflang links, and JSON-LD. Place pages use the
// worship texts plus their own title, description and headline.
// It also writes landing/sitemap.xml and landing/robots.txt.
//
// Source: landing/tools/template.html (the layout), the translations in
// landing/assets/i18n.js and the place texts below. After changing any of
// them, run from the repo root:
//   node landing/tools/build-languages.js
// Then commit the generated files with the change. No dependencies.

const fs = require('fs');
const path = require('path');

const LANDING = path.resolve(__dirname, '..');
const BASE = 'https://www.infunion.app';
const ASSET_VERSION = '20261110-shots4';
const LANGS = ['es', 'en', 'fr', 'ca', 'va', 'gl', 'pt'];
const LEGAL = ['privacy.html', 'terms.html', 'dpa.html', 'delete-account.html'];
// Screenshots of the worship variant come from the worship folder.
const WORSHIP_SHOTS = ['home', 'calendar', 'donate', 'requests', 'admin', 'admin-requests', 'admin-home'];

// The two kinds of place pages: religious places (churches, mosques, synagogues)
// and associations and other communities. Each has a localized path per language
// (Spanish at the root level, e.g. /religion/ or /asociaciones/; others /<lang>/<slug>/),
// and uses one of the landing's audience variants for its texts.
const PLACE_SLUGS = {
  religious: { es: 'religion', en: 'faith', fr: 'religion', ca: 'religio', va: 'religio', gl: 'relixion', pt: 'religiao' },
  associations: { es: 'asociaciones', en: 'associations', fr: 'associations', ca: 'associacions', va: 'associacions', gl: 'asociacions', pt: 'associacoes' },
};
const PLACE_VARIANT = { religious: 'worship', associations: 'ngo' };

// Search titles, descriptions and headlines per language.
const SEO = {
  es: {
    title: 'infunion — La aplicación de tu comunidad, operativa en un día',
    description: 'infunion es la app de tu comunidad: tus miembros tienen horarios, solicitudes y donativos en el bolsillo, y tu equipo lo gestiona todo desde un solo panel. Plan base gratuito y módulos de pago a la carta.',
    ogLocale: 'es_ES',
  },
  en: {
    title: 'infunion — The app for your community, up and running in a day',
    description: 'infunion is the app for your community: members have schedules, requests and contributions in their pocket, and your team runs everything from one dashboard. Free Basic plan, paid modules à la carte.',
    ogLocale: 'en_GB',
  },
  fr: {
    title: 'infunion — L’application de votre communauté, opérationnelle en un jour',
    description: 'infunion est l’application de votre communauté : vos membres ont horaires, demandes et contributions dans la poche, et votre équipe gère tout depuis un seul tableau de bord. Forfait Basic gratuit, modules payants à la carte.',
    ogLocale: 'fr_FR',
  },
  ca: {
    title: 'infunion — L’aplicació de la teva comunitat, en marxa en un dia',
    description: 'infunion és l’aplicació de la teva comunitat: els membres tenen horaris, sol·licituds i aportacions al mòbil, i l’equip ho gestiona tot des d’un sol panell. Pla Basic gratuït i mòduls de pagament a la carta.',
    ogLocale: 'ca_ES',
  },
  va: {
    title: 'infunion — L’aplicació de la teua comunitat, operativa en un dia',
    description: 'infunion és l’aplicació de la teua comunitat: els membres tenen horaris, sol·licituds i aportacions al mòbil, i l’equip ho gestiona tot des d’un únic panell. Pla Basic gratuït i mòduls de pagament a la carta.',
    ogLocale: 'ca_ES',
  },
  gl: {
    title: 'infunion — A aplicación da túa comunidade, operativa nun día',
    description: 'infunion é a aplicación da túa comunidade: os membros teñen horarios, solicitudes e achegas no móbil, e o equipo xestiónao todo desde un único panel. Plan Basic gratuíto e módulos de pago á carta.',
    ogLocale: 'gl_ES',
  },
  pt: {
    title: 'infunion — A aplicação da sua comunidade, operacional num dia',
    description: 'infunion é a aplicação da sua comunidade: os membros têm horários, pedidos e contribuições no telemóvel, e a equipa gere tudo a partir de um painel único. Plano Basic gratuito e módulos pagos à la carte.',
    ogLocale: 'pt_PT',
  },
};

const PLACE = {
  religious: {
    es: { title: 'infunion — La app para iglesias, mezquitas y sinagogas', description: 'Horarios, avisos, peticiones de oración, lecturas del día y aportaciones para tus miembros, con un panel sencillo para tu equipo. Plan Basic gratuito.', h1: 'La app de tu comunidad religiosa, operativa en un día' },
    en: { title: 'infunion — The app for churches, mosques and synagogues', description: 'Schedules, announcements, prayer requests, daily readings and contributions for your members, with a simple dashboard for your team. Free Basic plan.', h1: 'The app for your faith community, up and running in a day' },
    fr: { title: 'infunion — L’application pour églises, mosquées et synagogues', description: 'Horaires, annonces, demandes de prière, lectures du jour et contributions pour vos membres, avec un tableau de bord simple pour votre équipe. Forfait Basic gratuit.', h1: 'L’application de votre communauté religieuse, opérationnelle en un jour' },
    ca: { title: 'infunion — L’aplicació per a esglésies, mesquites i sinagogues', description: 'Horaris, avisos, peticions de pregària, lectures del dia i aportacions per als membres, amb un panell senzill per a l’equip. Pla Basic gratuït.', h1: 'L’aplicació de la teva comunitat religiosa, en marxa en un dia' },
    va: { title: 'infunion — L’aplicació per a esglésies, mesquites i sinagogues', description: 'Horaris, avisos, peticions de pregària, lectures del dia i aportacions per als membres, amb un panell senzill per a l’equip. Pla Basic gratuït.', h1: 'L’aplicació de la teua comunitat religiosa, operativa en un dia' },
    gl: { title: 'infunion — A aplicación para igrexas, mesquitas e sinagogas', description: 'Horarios, avisos, peticións de oración, lecturas do día e achegas para os membros, cun panel sinxelo para o equipo. Plan Basic gratuíto.', h1: 'A aplicación da túa comunidade relixiosa, operativa nun día' },
    pt: { title: 'infunion — A aplicação para igrejas, mesquitas e sinagogas', description: 'Horários, avisos, pedidos de oração, leituras do dia e contribuições para os membros, com um painel simples para a equipa. Plano Basic gratuito.', h1: 'A aplicação da sua comunidade religiosa, operacional num dia' },
  },
  associations: {
    es: { title: 'infunion — La app para asociaciones y ONG', description: 'Socios, cuotas, actividades, avisos y donativos en un solo sitio, con un panel sencillo para tu equipo. Plan Basic gratuito.', h1: 'La app de tu asociación, operativa en un día' },
    en: { title: 'infunion — The app for associations and NGOs', description: 'Members, fees, activities, announcements and donations in one place, with a simple dashboard for your team. Free Basic plan.', h1: 'The app for your association, up and running in a day' },
    fr: { title: 'infunion — L’application pour associations et ONG', description: 'Adhérents, cotisations, activités, annonces et dons en un seul endroit, avec un tableau de bord simple pour votre équipe. Forfait Basic gratuit.', h1: 'L’application de votre association, opérationnelle en un jour' },
    ca: { title: 'infunion — L’aplicació per a associacions i ONG', description: 'Socis, quotes, activitats, avisos i donatius en un sol lloc, amb un panell senzill per a l’equip. Pla Basic gratuït.', h1: 'L’aplicació de la teva associació, en marxa en un dia' },
    va: { title: 'infunion — L’aplicació per a associacions i ONG', description: 'Socis, quotes, activitats, avisos i donatius en un sol lloc, amb un panell senzill per a l’equip. Pla Basic gratuït.', h1: 'L’aplicació de la teua associació, operativa en un dia' },
    gl: { title: 'infunion — A aplicación para asociacións e ONG', description: 'Socios, cotas, actividades, avisos e doazóns nun só lugar, cun panel sinxelo para o equipo. Plan Basic gratuíto.', h1: 'A aplicación da túa asociación, operativa nun día' },
    pt: { title: 'infunion — A aplicação para associações e ONG', description: 'Sócios, quotas, atividades, avisos e donativos num só lugar, com um painel simples para a equipa. Plano Basic gratuito.', h1: 'A aplicação da sua associação, operacional num dia' },
  },
};

function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Read a `var NAME = { ... };` object out of assets/i18n.js without running it (it is a browser script).
function loadObject(src, name, nextMarker) {
  const start = src.indexOf(`var ${name} = `);
  if (start < 0) throw new Error(`i18n.js layout changed: ${name} not found`);
  const from = start + `var ${name} = `.length;
  const close = src.indexOf(nextMarker, from);
  if (close < 0) throw new Error(`i18n.js layout changed: end of ${name} not found`);
  return new Function(`return (${src.slice(from, close + nextMarker.indexOf('}') + 1)});`)();
}

function loadTranslations() {
  const src = fs.readFileSync(path.join(LANDING, 'assets', 'i18n.js'), 'utf8');
  const T = loadObject(src, 'TRANSLATIONS', '\n  };');
  const V = loadObject(src, 'VARIANTS', '\n  };');
  return { T, V };
}

function pageUrl(lang) {
  return lang === 'es' ? `${BASE}/` : `${BASE}/${lang}/`;
}

function homePath(lang) {
  return lang === 'es' ? '/' : `/${lang}/`;
}

function placePath(type, lang) {
  const slug = PLACE_SLUGS[type][lang];
  return lang === 'es' ? `/${slug}/` : `/${lang}/${slug}/`;
}

function placeUrl(type, lang) {
  return `${BASE}${placePath(type, lang)}`;
}

// `place` is a place type (church, mosque, synagogue) for a place page, or null for a home page.
function build(template, T, V, lang, place) {
  const seo = place ? PLACE[place][lang] : SEO[lang];
  const dict = Object.assign({}, T.es, T[lang] || {});
  if (place) {
    const variant = V[PLACE_VARIANT[place]];
    Object.assign(dict, variant.es, variant[lang] || {});
    dict.heroHeadline = seo.h1;
  }
  const url = place ? placeUrl(place, lang) : pageUrl(lang);
  let html = template;

  html = html.replace('<!doctype html>', '<!doctype html>\n<!-- Generated by landing/tools/build-languages.js from tools/template.html, assets/i18n.js and the place texts in that script. Do not edit this file by hand. -->');
  // Place pages carry their audience variant and keep their own texts (data-static-text),
  // so the script does not replace the headline with the variant's wording.
  html = html.replace('<html lang="es">', `<html lang="${lang}"${place ? ` data-for="${PLACE_VARIANT[place]}" data-static-text` : ''}>`);

  // Text inside elements: <tag ... data-i18n="key" ...>text</tag>
  let missing = 0;
  html = html.replace(/(<(\w+)\b[^>]*?\sdata-i18n="(\w+)"[^>]*>)([^<]*)(<\/\2>)/g, (all, open, tag, key, old, close) => {
    if (dict[key] === undefined) { missing++; return all; }
    return `${open}${esc(dict[key])}${close}`;
  });

  // Image alt text: data-i18n-alt="key" ... alt=""
  html = html.replace(/<img\b[^>]*?data-i18n-alt="(\w+)"[^>]*>/g, (tag, key) => {
    if (dict[key] === undefined) return tag;
    return tag.replace(/\salt=""/, ` alt="${esc(dict[key])}"`);
  });

  // Labels: data-i18n-label="key" (aria-label)
  html = html.replace(/<(\w+)\b[^>]*?data-i18n-label="(\w+)"[^>]*>/g, (tag, _t, key) => {
    if (dict[key] === undefined) return tag;
    return tag.replace(/\saria-label="[^"]*"/, '').replace(/>$/, ` aria-label="${esc(dict[key])}">`);
  });

  // Real app screenshots in this language (the worship ones in a place page).
  html = html.replace(/src="assets\/screens\/es\/([\w-]+)\.webp\?v=[\w-]+"/g, (m, file) => {
    const folder = place === 'religious' && WORSHIP_SHOTS.includes(file) ? 'worship/' : '';
    return `src="/assets/screens/${lang}/${folder}${file}.webp?v=${ASSET_VERSION}"`;
  });

  // Root-absolute links and assets, so the pages work at any depth.
  html = html.replace(/(href|src)="assets\//g, '$1="/assets/');
  html = html.replace(/\?v=20261105-wording/g, `?v=${ASSET_VERSION}`);
  html = html.replace(/href="index\.html"/g, `href="${homePath(lang)}"`);
  html = html.replace(/href="((?:privacy|terms|dpa|delete-account|register|withdraw)\.html)(["?])/g, 'href="/$1$2');

  // Search and social metadata.
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(seo.title)}</title>`);
  html = html.replace(/(<meta\s+name="description"\s+content=")[\s\S]*?(")/, `$1${esc(seo.description)}$2`);
  html = html.replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(seo.title)}" />`);
  html = html.replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`);
  html = html.replace('<meta property="og:type" content="website" />',
    `<meta property="og:type" content="website" />\n  <meta property="og:description" content="${esc(seo.description)}" />\n  <meta property="og:locale" content="${SEO[lang].ogLocale}" />`);

  // Canonical and hreflang: the home pages link to each other; each place type links to its own pages.
  const siblings = place
    ? LANGS.map((l) => ({ lang: l, href: placeUrl(place, l) }))
    : LANGS.map((l) => ({ lang: l, href: pageUrl(l) }));
  const defaultHref = place ? placeUrl(place, 'es') : pageUrl('es');
  const alternates = siblings.map((s) => `  <link rel="alternate" hreflang="${s.lang}" href="${s.href}" />`).join('\n');
  const head = `  <link rel="canonical" href="${url}" />\n${alternates}\n  <link rel="alternate" hreflang="x-default" href="${defaultHref}" />\n`;
  html = html.replace('  <meta name="theme-color"', head + '  <meta name="theme-color"');

  const structured = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${BASE}/#organization`, name: 'infunion', url: `${BASE}/`,
        logo: `${BASE}/assets/apple-touch-icon.png`, email: 'hello@infunion.app' },
      { '@type': 'WebSite', '@id': `${BASE}/#website`, name: 'infunion', url: `${BASE}/`, inLanguage: lang,
        publisher: { '@id': `${BASE}/#organization` } },
      { '@type': 'SoftwareApplication', name: 'infunion', applicationCategory: 'BusinessApplication',
        operatingSystem: 'Android, iOS, Web', description: seo.description, url,
        offers: [
          { '@type': 'Offer', name: 'Basic', price: '0', priceCurrency: 'EUR' },
          { '@type': 'Offer', name: 'Essentials', price: '39', priceCurrency: 'EUR', description: '39 € per month or 390 € per year' },
          { '@type': 'Offer', name: 'Complete', price: '59', priceCurrency: 'EUR', description: '59 € per month or 590 € per year' },
        ] },
    ],
  };
  const ld = `  <script type="application/ld+json">${JSON.stringify(structured).replace(/</g, '\\u003c')}</script>\n`;
  html = html.replace('  <link rel="stylesheet" href="/assets/style.css', ld + '  <link rel="stylesheet" href="/assets/style.css');

  return { html, missing, url };
}

function writePage(relDir, html) {
  const dir = path.join(LANDING, relDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  return path.posix.join(relDir.split(path.sep).join('/'), 'index.html');
}

function main() {
  const template = fs.readFileSync(path.join(LANDING, 'tools', 'template.html'), 'utf8');
  const { T, V } = loadTranslations();
  const sitemapEntries = [];

  for (const lang of LANGS) {
    const { html, missing } = build(template, T, V, lang, null);
    if (missing) console.warn(`${lang} home: ${missing} data-i18n element(s) without a text`);
    const rel = lang === 'es' ? '' : lang;
    console.log(`wrote ${writePage(rel, html)}`);
    sitemapEntries.push({ url: pageUrl(lang), alternates: LANGS.map((l) => ({ lang: l, href: pageUrl(l) })) });
  }

  for (const type of Object.keys(PLACE_SLUGS)) {
    for (const lang of LANGS) {
      const { html, missing } = build(template, T, V, lang, type);
      if (missing) console.warn(`${lang} ${type}: ${missing} data-i18n element(s) without a text`);
      const rel = lang === 'es' ? PLACE_SLUGS[type][lang] : path.join(lang, PLACE_SLUGS[type][lang]);
      console.log(`wrote ${writePage(rel, html)}`);
      sitemapEntries.push({ url: placeUrl(type, lang), alternates: LANGS.map((l) => ({ lang: l, href: placeUrl(type, l) })) });
    }
  }

  const alt = (entry) => entry.alternates
    .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.lang}" href="${a.href}"/>`)
    .concat([`    <xhtml:link rel="alternate" hreflang="x-default" href="${entry.alternates[0].href}"/>`]).join('\n');
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    sitemapEntries.map((e) => `  <url>\n    <loc>${e.url}</loc>\n${alt(e)}\n  </url>`).join('\n') +
    LEGAL.map((p) => `\n  <url>\n    <loc>${BASE}/${p}</loc>\n  </url>`).join('') +
    `\n</urlset>\n`;
  fs.writeFileSync(path.join(LANDING, 'sitemap.xml'), sitemap);
  fs.writeFileSync(path.join(LANDING, 'robots.txt'),
    `User-agent: *\nDisallow: /tools/\nDisallow: /register.html\nDisallow: /withdraw.html\n\nSitemap: ${BASE}/sitemap.xml\nSitemap: https://api.infunion.app/c/sitemap.xml\n`);
  console.log(`wrote sitemap.xml (${sitemapEntries.length} pages) and robots.txt`);
}

main();

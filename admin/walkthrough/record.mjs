// Records the admin's how-to clips, one per page, from the real admin
// running locally on the demo community (Nuestra Señora del Carmen).
//
//   node record.mjs es                 every clip in Spanish
//   node record.mjs es events members  only these clips
//
// Needs the API (3000), the admin (5173) and the app's web preview (8081)
// running, the seeded demo data, ffmpeg, and a Chromium-based browser
// (BROWSER=/path/to/chrome, default Brave). Writes
// ../public/walkthrough/<lang>/<clip>.mp4 and .jpg, and the durations to
// ../public/walkthrough/manifest.json, which the admin reads.
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Recorder, VIEWPORT, SCALE } from './recorder.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ADMIN = process.env.ADMIN_URL ?? 'http://localhost:5173';
const EMAIL = process.env.WALKTHROUGH_EMAIL ?? 'admin@carmen.example';
const PASSWORD = process.env.WALKTHROUGH_PASSWORD ?? 'demo1234'; // the demo seed's password
const BROWSER = process.env.BROWSER ?? '/opt/brave.com/brave/brave';

const [lang = 'es', ...only] = process.argv.slice(2);
const captions = JSON.parse(readFileSync(join(here, 'captions', `${lang}.json`), 'utf8'));

const nav = (path) => `.sidebar a[href$="/${path}"]`;

// One function per clip, in the order the library plays them. Selectors
// avoid on-screen words so the same script records every language.
// Nothing here saves: forms are opened and filled, never sent.
const CLIPS = {
  async dashboard(r, c) {
    await r.say(c.intro);
    await r.hold(1.6);
    await r.move('.todo-row', 1.1);
    await r.say(c.todo);
    await r.move('.todo-row >> nth=1', 0.6);
    await r.move('.todo-row >> nth=2', 0.6);
    await r.hold(0.8);
    await r.move('.todo-row .todo-go', 0.8);
    await r.say(c.open);
    await r.hold(1.4);
    await r.move('.kpi-row .stat-tile', 1);
    await r.say(c.figures);
    await r.move('.kpi-row .stat-tile >> nth=1', 0.7);
    await r.move('.kpi-row .stat-tile >> nth=2', 0.7);
    await r.hold(0.8);
    await r.scroll(360, 1.4);
    await r.say(c.week);
    await r.move({ x: 640, y: 420 }, 0.9);
    await r.hold(2);
  },

  async 'home-page'(r, c) {
    await r.say(c.intro);
    await r.hold(1.8);
    await r.move('iframe', 1.2);
    await r.say(c.phone);
    await r.hold(2.2);
    await r.move('main .grip:visible >> nth=3', 1);
    await r.say(c.order);
    await r.hold(1.8);
    await r.move('main input.switch:visible >> nth=1', 1);
    await r.say(c.toggle);
    await r.hold(2);
    await r.click('[role=tab] >> nth=1');
    await r.say(c.sections);
    await r.hold(2.4);
  },

  async members(r, c) {
    await r.say(c.intro);
    await r.hold(1.6);
    await r.move('.card-row[role=listitem]', 1);
    await r.say(c.member);
    await r.hold(1.6);
    await r.say(c.private);
    await r.click('.card-row[role=listitem] .btn >> nth=-1', { settle: 1500 });
    await r.move('main textarea', 1);
    await r.hold(2);
    await r.say(c.all);
    await r.click(nav('members'), { settle: 1500 });
    await r.move('main a.btn-primary', 1.1);
    await r.hold(2.2);
  },

  async requests(r, c) {
    await r.say(c.intro);
    await r.hold(1.6);
    await r.move('.request-row-waiting', 1);
    await r.say(c.waiting);
    await r.move('.request-row-waiting >> nth=1', 0.6);
    await r.move('.request-row-waiting >> nth=2', 0.6);
    await r.hold(0.8);
    await r.say(c.open);
    await r.click('.request-row-waiting a.btn', { settle: 1800 });
    await r.say(c.detail);
    await r.hold(1.2);
    await r.scroll(260, 1.4);
    await r.hold(2.2);
  },

  async events(r, c) {
    await r.say(c.intro);
    await r.hold(1);
    await r.move('.week-event >> nth=3', 1.1);
    await r.hold(1.4);
    await r.say(c.new);
    await r.click('main button.btn-primary', { settle: 1000 });
    await r.click('main input >> nth=0', { settle: 300 });
    await r.say(c.type);
    await r.type(c.sample);
    await r.hold(1.2);
    await r.say(c.repeat);
    await r.select('main select >> nth=1', 'days');
    await r.move('.day-chips', 1);
    await r.click('.day-chip >> nth=5', { settle: 200, seconds: 0.6 });
    await r.hold(2.2);
  },

  async donations(r, c) {
    await r.say(c.intro);
    await r.hold(1.4);
    await r.say(c.figures);
    await r.move('main .stat-tile >> nth=1', 1);
    await r.hold(1.8);
    // How to pay is the last tab since 21 Nov 2026.
    await r.say(c.bizum);
    await r.click('[role=tab] >> nth=-1', { settle: 1200 });
    await r.move('main [role=tabpanel]:visible input >> nth=0', 1);
    await r.hold(1.8);
    await r.say(c.campaigns);
    await r.click('[role=tab] >> nth=2', { settle: 1200 });
    await r.scroll('[role=tablist]', 1.4);
    await r.move('main [role=tabpanel]:visible .btn-primary >> nth=0', 1);
    await r.hold(2.4);
  },

  async website(r, c) {
    await r.say(c.intro);
    await r.hold(1.6);
    await r.move('main [role=switch]', 1.1);
    await r.say(c.online);
    await r.hold(1.8);
    await r.move('main [aria-pressed] >> nth=2', 1);
    await r.say(c.parts);
    await r.hold(1.8);
    await r.say(c.qr);
    await r.click(nav('my-qr'), { settle: 1500 });
    await r.hold(1.4);
    await r.move('main button.btn-primary', 1);
    await r.say(c.print);
    await r.hold(2.4);
  },
};

const outDir = join(here, '..', 'public', 'walkthrough', lang);
mkdirSync(outDir, { recursive: true });
const manifestFile = join(here, '..', 'public', 'walkthrough', 'manifest.json');
const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};
manifest[lang] ??= {};

const browser = await chromium.launch({ executablePath: BROWSER, headless: true });
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE, locale: lang });
const page = await context.newPage();

// Show what a community sees in production: its pictures (served by the
// API) and its public address instead of localhost.
const API = process.env.API_URL ?? 'http://localhost:3000';
const SITE = process.env.SITE_URL ?? 'https://www.infunion.app';
await context.route(`${ADMIN}/uploads/**`, (route) => route.continue({ url: route.request().url().replace(ADMIN, API) }));
await context.route(`${API}/**`, async (route) => {
  const response = await route.fetch();
  const type = response.headers()['content-type'] ?? '';
  if (!type.includes('json')) return route.fulfill({ response });
  // Clips always show the plain "Versions" button, whatever versions
  // the local database holds (tests and other work save some).
  if (/\/page-versions$/.test(new URL(route.request().url()).pathname) && route.request().method() === 'GET') {
    return route.fulfill({ response, body: JSON.stringify({ versions: [], max: 5 }) });
  }
  const body = (await response.text()).replaceAll(`${API}/c/`, `${SITE}/c/`);
  return route.fulfill({ response, body });
});

// Sign in once, in the clip's language.
await page.goto(ADMIN);
await page.evaluate((l) => localStorage.setItem('infunion-admin-language', l), lang);
await page.goto(ADMIN);
await page.fill('input[type=email]', EMAIL);
await page.fill('input[type=password]', PASSWORD);
await page.keyboard.press('Enter');
await page.waitForURL(/\/poi\/[^/]+\/dashboard/, { timeout: 20000 });
const base = page.url().replace(/\/dashboard$/, '');

for (const [id, script] of Object.entries(CLIPS)) {
  if (only.length && !only.includes(id)) continue;
  const c = captions[id];
  await page.goto(`${base}/${id}`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(id === 'home-page' ? 6000 : 2000);
  const file = join(outDir, `${id}.mp4`);
  const r = new Recorder(page, file);
  await r.install();
  await r.fadeIn();
  writeFileSync(join(outDir, `${id}.jpg`), r.poster());
  try {
    await script(r, c);
  } catch (error) {
    await page.screenshot({ path: join(here, `failed-${id}.png`) });
    throw error;
  }
  await r.hold(0.6);
  await r.fadeOut();
  const seconds = await r.finish();
  manifest[lang][id] = { title: c.title, duration: Math.round(seconds * 10) / 10 };
  console.log(`${lang}/${id}.mp4  ${seconds.toFixed(1)} s`);
}

// Keep the library's order whatever was re-recorded.
manifest[lang] = Object.fromEntries(Object.keys(CLIPS).filter((k) => manifest[lang][k]).map((k) => [k, manifest[lang][k]]));
writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
await browser.close();

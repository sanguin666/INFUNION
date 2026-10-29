// Retakes the "Learn more" screenshots of the Modules page (public/modules/).
// Retake them whenever a module's app screen or admin page changes.
//
// Needs, on the Carmen demo database: the API with DEMO_LOGIN=on, the admin
// (vite) and the app's web build (npx expo export -p web, served as a SPA),
// with the admin account's language set to English.
//   APP_URL=http://localhost:8082 ADMIN_URL=http://localhost:5199 node scripts/module-screenshots.cjs
// Python 3 with Pillow turns the PNGs into the JPGs.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const APP = process.env.APP_URL || 'http://localhost:8082';
const ADMIN = process.env.ADMIN_URL || 'http://localhost:5199';
const POI = process.env.POI_ID || '5a557fe2-6088-446b-85b0-e61f13027a0c'; // Nuestra Señora del Carmen
const OUT = path.join(__dirname, '..', 'public', 'modules');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'module-shots-'));

// Module type -> how to reach it in the app (tab or row under More).
const APP_ROUTES = {
  events: { tab: 'Events' },
  announcements: { tab: 'News' },
  donations: { tab: 'Donate' },
  livestreams: { tab: 'Events', then: 'Watch live' },
  requests: { more: 'Requests' },
  messages: { more: 'Messages' },
  mass_intentions: { more: 'Mass intentions' },
  daily_readings: { more: 'Daily readings' },
  prayer_requests: { more: 'Prayer requests' },
  community: { more: 'Our group' },
};
const ADMIN_ROUTES = {
  events: 'events', donations: 'donations', announcements: 'announcements', requests: 'requests',
  messages: 'members', livestreams: 'livestreams', community: 'community',
  prayer_requests: 'prayer-requests', daily_readings: 'readings', mass_intentions: 'mass-intentions',
};

(async () => {
  const browser = await chromium.launch();

  const app = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await app.newPage();
  await p.goto(APP); await p.waitForTimeout(3000);
  await p.getByText('Demo sign-in').click(); await p.waitForTimeout(3000);
  for (const label of ['I am 14 or older', 'I accept the terms']) {
    if (await p.getByText(label).count()) await p.getByText(label).click();
  }
  if (await p.getByText('Continue', { exact: true }).count()) { await p.getByText('Continue', { exact: true }).click(); await p.waitForTimeout(2500); }
  if (await p.getByText('I agree, join').count()) { await p.getByText('I agree, join').click(); await p.waitForTimeout(2000); }
  for (const [type, r] of Object.entries(APP_ROUTES)) {
    await p.goto(APP); await p.waitForTimeout(3000);
    if (r.tab) await p.getByText(r.tab, { exact: true }).last().click();
    if (r.more) {
      await p.getByText('More', { exact: true }).last().click(); await p.waitForTimeout(1200);
      await p.getByText(r.more, { exact: true }).first().click();
    }
    await p.waitForTimeout(2000);
    if (r.then) { await p.getByText(r.then).click(); await p.waitForTimeout(2000); }
    await p.screenshot({ path: path.join(tmp, `${type}-app.png`) });
  }

  const admin = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const q = await admin.newPage();
  await q.goto(`${ADMIN}/login`); await q.waitForTimeout(2000);
  await q.fill('input[type=email]', 'admin@carmen.example');
  await q.fill('input[type=password]', 'demo1234');
  await q.keyboard.press('Enter'); await q.waitForTimeout(3000);
  for (const [type, route] of Object.entries(ADMIN_ROUTES)) {
    await q.goto(`${ADMIN}/poi/${POI}/${route}`); await q.waitForTimeout(2500);
    if (type === 'messages') { await q.getByRole('button', { name: 'Open' }).first().click(); await q.waitForTimeout(2000); }
    const x = await q.evaluate(() => (document.querySelector('main') || document.body).getBoundingClientRect().x);
    await q.screenshot({ path: path.join(tmp, `${type}-admin.png`), clip: { x, y: 0, width: Math.min(900, 1280 - x), height: 640 } });
  }
  await browser.close();

  execFileSync('python3', ['-c', `
import glob, os, sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
for f in glob.glob(os.path.join(src, '*.png')):
    im = Image.open(f).convert('RGB')
    w = 1200 if f.endswith('-admin.png') else 585
    im = im.resize((w, int(im.height * w / im.width)))
    im.save(os.path.join(out, os.path.basename(f)[:-4] + '.jpg'), quality=80, optimize=True)
`, tmp, OUT], { stdio: 'inherit' });
  console.log(`Saved to ${OUT}`);
})();

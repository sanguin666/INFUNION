// Sends the landing's and the community pages' addresses to IndexNow (Bing, Yandex and others).
// Run after a release has reached production, from the repo root:
//   node landing/tools/indexnow.js            (sends the landing sitemap's pages)
//   node landing/tools/indexnow.js --dry-run  (prints the request without sending it)
// The key file is served at the site root (landing/indexnow-key.txt), so IndexNow can check it.
// No dependencies; needs Node 18+ (fetch).

const fs = require('fs');
const path = require('path');

const HOST = 'www.infunion.app';
const LANDING = path.resolve(__dirname, '..');
const KEY = fs.readFileSync(path.join(LANDING, 'indexnow-key.txt'), 'utf8').trim();
const KEY_LOCATION = `https://${HOST}/indexnow-key.txt`;

function landingUrls() {
  const xml = fs.readFileSync(path.join(LANDING, 'sitemap.xml'), 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => u.startsWith(`https://${HOST}/`));
}

async function main() {
  const urlList = landingUrls();
  const body = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList };
  if (process.argv.includes('--dry-run')) {
    console.log(JSON.stringify(body, null, 2));
    return;
  }
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  console.log(`IndexNow answered ${res.status} for ${urlList.length} addresses`);
  if (res.status >= 300) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

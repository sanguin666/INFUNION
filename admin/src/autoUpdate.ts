import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Picks up a new admin release without Ctrl + F5 (Seb, 3 Nov 2026).
 *
 * Railway serves index.html with no cache rule, so a browser may keep
 * showing the old page, and with it the old build's script, long after a
 * deploy. The build's files have a hash in their name; index.html names
 * the current one. So we ask the server for the page itself, past the
 * browser's cache (`cache: 'reload'`, which also refreshes that cache),
 * and compare the script it names with the one this page is running.
 *
 * When they differ: straight after the page has opened, reload at once
 * (nothing has been typed yet); later on (checked every few minutes and
 * whenever the tab comes back to the front), reload on the next move to
 * another page of the admin, so a form being filled in is never lost.
 */

const CHECK_EVERY_MS = 5 * 60 * 1000;

let newVersionWaiting = false;

function runningScript(): string | null {
  return document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')?.getAttribute('src') ?? null;
}

async function serverScript(): Promise<string | null> {
  try {
    const response = await fetch(window.location.href, { cache: 'reload', headers: { Accept: 'text/html' } });
    if (!response.ok) return null;
    const html = await response.text();
    return /<script[^>]+type="module"[^>]+src="([^"]*\/assets\/[^"]+)"/.exec(html)?.[1] ?? null;
  } catch {
    return null;
  }
}

async function check(): Promise<boolean> {
  const running = runningScript();
  if (!running) return false;
  const latest = await serverScript();
  if (latest && latest !== running) newVersionWaiting = true;
  return newVersionWaiting;
}

/** Started once from main.tsx, in a production build only. */
export function startUpdateChecks(): void {
  if (!import.meta.env.PROD) return;
  void check().then((waiting) => {
    if (waiting) window.location.reload();
  });
  window.setInterval(() => void check(), CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });
}

/** Reloads into the new version on the next move to another page. */
export function UpdateOnNavigate(): null {
  const { pathname } = useLocation();
  useEffect(() => {
    if (newVersionWaiting) window.location.reload();
  }, [pathname]);
  return null;
}

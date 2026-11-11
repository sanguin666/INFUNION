// The app's previous name prefixed every key this dashboard keeps in the
// browser. Moves them to the current prefix once, before anything reads
// them, so nobody is signed out or loses their settings by the rename
// (November 2026). Imported first in main.tsx. Remove after a while.
const LEGACY_PREFIX = 'ansae-';
const PREFIX = 'infunion-';

function migrate(storage: Storage): void {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(LEGACY_PREFIX)) keys.push(key);
  }
  for (const key of keys) {
    const value = storage.getItem(key);
    const next = PREFIX + key.slice(LEGACY_PREFIX.length);
    if (value !== null && storage.getItem(next) === null) storage.setItem(next, value);
    storage.removeItem(key);
  }
}

try {
  migrate(localStorage);
  migrate(sessionStorage);
} catch {
  // Storage blocked (private mode, site data off): nothing to move.
}

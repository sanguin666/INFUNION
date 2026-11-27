// Run with `npm test` (Node's own test runner; Node 22 strips the types).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commitDelete } from '../src/components/deleteCommit.ts';

function item(commit: () => Promise<unknown>) {
  let restored = 0;
  return { commit, restore: () => void restored++, restored: () => restored };
}

test('a delete the server accepts stays deleted', async () => {
  const it = item(async () => undefined);
  assert.equal(await commitDelete(it), 'deleted');
  assert.equal(it.restored(), 0);
});

// The "cerrado hoy" badge (27 Nov 2026): an earlier delete had already gone
// through, so the server answered 404 and the admin was told it failed.
test('an item already gone on the server counts as deleted', async () => {
  const it = item(async () => {
    throw Object.assign(new Error('Badge not found'), { status: 404 });
  });
  assert.equal(await commitDelete(it), 'deleted');
  assert.equal(it.restored(), 0);
});

test('any other failure puts the item back', async () => {
  for (const status of [400, 403, 500, undefined]) {
    const it = item(async () => {
      throw Object.assign(new Error('no'), { status });
    });
    assert.equal(await commitDelete(it), 'restored');
    assert.equal(it.restored(), 1);
  }
});

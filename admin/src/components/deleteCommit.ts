/**
 * Sends a delete that was waiting behind the Undo bar. A 404 means the
 * item is already gone on the server (an earlier delete went through
 * while the page still showed it), which is what the admin wanted: it
 * counts as deleted, and nothing is put back. Any other failure puts the
 * item back.
 *
 * Kept free of React and of the API client so it can be tested on its own.
 */
export async function commitDelete(item: {
  commit: () => Promise<unknown>;
  restore: () => void;
}): Promise<'deleted' | 'restored'> {
  try {
    await item.commit();
    return 'deleted';
  } catch (error) {
    if ((error as { status?: unknown } | null)?.status === 404) return 'deleted';
    item.restore();
    return 'restored';
  }
}

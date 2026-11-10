import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { markLeaving } from '../api/client';
import { useI18n } from '../i18n/I18nContext';

/**
 * Undo after a delete (Seb, 9 Nov 2026, #193): many admins will make
 * mistakes and need a way back. A delete hides the item at once and shows
 * a bar with "Undo" for a few seconds; the server is only asked to delete
 * when the bar goes (time up, closed, another delete, or the page closing).
 * Undo puts the item back where it was, and nothing was ever deleted.
 */
const UNDO_SECONDS = 10;

type Pending = {
  key: number;
  message: string;
  restore: () => void;
  commit: () => Promise<unknown>;
  onError?: () => void;
};

type UndoApi = {
  /**
   * Hides something now and deletes it on the server once the Undo bar
   * has gone. `name` is shown in the bar when given.
   */
  deleteLater: (options: {
    name?: string;
    hide: () => () => void;
    commit: () => Promise<unknown>;
    onError?: () => void;
  }) => void;
  /** Sends any delete still waiting, e.g. before saving an order that must list every item. */
  flush: () => Promise<void>;
};

const UndoContext = createContext<UndoApi | null>(null);

export function useUndo(): UndoApi {
  const api = useContext(UndoContext);
  if (!api) throw new Error('useUndo outside UndoProvider');
  return api;
}

/**
 * Takes an item out of a list kept in state and gives back the function
 * that puts it back at the same place.
 */
export function hideFromList<T extends { id: string }>(
  setList: Dispatch<SetStateAction<T[] | null>>,
  id: string,
): () => void {
  let index = -1;
  let item: T | undefined;
  setList((current) => {
    if (!current) return current;
    const at = current.findIndex((entry) => entry.id === id);
    if (at >= 0) {
      index = at;
      item = current[at];
    }
    return current.filter((entry) => entry.id !== id);
  });
  return () => {
    const back = item;
    if (!back) return;
    setList((current) => {
      if (!current || current.some((entry) => entry.id === back.id)) return current;
      const next = [...current];
      next.splice(Math.min(index, next.length), 0, back);
      return next;
    });
  };
}

export function UndoProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [pending, setPending] = useState<Pending | null>(null);
  const [failed, setFailed] = useState(false);
  const pendingRef = useRef<Pending | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const counter = useRef(0);

  const send = useCallback(async (item: Pending) => {
    try {
      await item.commit();
    } catch {
      item.restore();
      item.onError?.();
      setFailed(true);
      window.setTimeout(() => setFailed(false), 6000);
    }
  }, []);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const item = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    if (item) await send(item);
  }, [send]);

  const deleteLater = useCallback<UndoApi['deleteLater']>(
    ({ name, hide, commit, onError }) => {
      // One bar at a time: the previous delete goes through now.
      void flush();
      const restore = hide();
      const item: Pending = {
        key: ++counter.current,
        message: name ? t('undo.deleted', { name }) : t('undo.deletedItem'),
        restore,
        commit,
        onError,
      };
      pendingRef.current = item;
      setFailed(false);
      setPending(item);
      timer.current = window.setTimeout(() => void flush(), UNDO_SECONDS * 1000);
    },
    [flush, t],
  );

  function undo() {
    window.clearTimeout(timer.current);
    const item = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    item?.restore();
  }

  // Closing or reloading the page sends the waiting delete (keepalive).
  useEffect(() => {
    function onLeave() {
      if (!pendingRef.current) return;
      markLeaving();
      void flush();
    }
    window.addEventListener('pagehide', onLeave);
    return () => {
      window.removeEventListener('pagehide', onLeave);
      // Leaving the dashboard (sign out, superadmin): send it too.
      onLeave();
    };
  }, [flush]);

  return (
    <UndoContext.Provider value={{ deleteLater, flush }}>
      {children}
      {pending && (
        <div className="undo-bar" role="status" key={pending.key}>
          <span className="undo-bar-message">{pending.message}</span>
          <button type="button" className="undo-bar-undo" onClick={undo}>
            {t('undo.undo')}
          </button>
          <button type="button" className="undo-bar-close" aria-label={t('undo.close')} onClick={() => void flush()}>
            ×
          </button>
          <span className="undo-bar-time" style={{ animationDuration: `${UNDO_SECONDS}s` }} />
        </div>
      )}
      {!pending && failed && (
        <div className="undo-bar" role="alert">
          <span className="undo-bar-message">{t('undo.failed')}</span>
        </div>
      )}
    </UndoContext.Provider>
  );
}

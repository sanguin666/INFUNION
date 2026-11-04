import { useCallback, useEffect, useMemo, useState } from 'react';
import { getContentLanguages, translateContent, type TranslatableKind } from '../api/translations';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import type { Poi } from '../api/types';

export type TranslationsHandle = {
  // Whether this item is in another language than the reader's.
  foreign: (id: string) => boolean;
  // Showing the translation rather than the original.
  showing: (id: string) => boolean;
  busy: (id: string) => boolean;
  sourceLanguage: (id: string) => string | null;
  // The field to show: translated when showing, the original otherwise.
  text: (id: string, field: string, original: string | null | undefined) => string;
  translate: (id: string) => void;
  showOriginal: (id: string) => void;
};

// The app's Valencian and Catalan read each other: no translation between them.
function readerCode(language: string): string {
  return language === 'va' ? 'ca' : language;
}

/** Only on the Complete plan, and for signed-in members (Seb, 4 Nov 2026). */
export function translationAvailable(poi: Poi, signedIn: boolean): boolean {
  return signedIn && (poi.plan === 'complete' || !!poi.billingComped);
}

/**
 * Automatic translation for one list of texts: which are in another
 * language, the translation on a tap (or straight away with "Translate
 * automatically" on), and the way back to the original. Each text is
 * translated once per language on the server, so a second reader pays
 * nothing.
 */
export function useTranslations(poi: Poi, kind: TranslatableKind, ids: string[]): TranslationsHandle {
  const { me } = useAuth();
  const { language, autoTranslate } = useI18n();
  const available = translationAvailable(poi, !!me);
  const [languages, setLanguages] = useState<Record<string, string>>({});
  // By `${language}:${id}`, so switching language never shows an old one.
  const [translated, setTranslated] = useState<Record<string, Record<string, string>>>({});
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const key = ids.join(',');
  const reader = readerCode(language);

  useEffect(() => {
    if (!available || ids.length === 0) return;
    const unknown = ids.filter((id) => !(id in languages));
    if (unknown.length === 0) return;
    let live = true;
    getContentLanguages(poi.id, { kind, ids: unknown.slice(0, 50) })
      .then((found) => {
        if (live) setLanguages((current) => ({ ...current, ...found }));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, poi.id, kind, key]);

  const foreign = useCallback(
    (id: string) => {
      const source = languages[id];
      return available && !!source && source !== 'und' && source !== reader;
    },
    [available, languages, reader],
  );

  const request = useCallback(
    (wanted: string[]) => {
      const todo = wanted.filter((id) => !translated[`${language}:${id}`] && !pending[id]);
      if (todo.length === 0) {
        setShown((current) => ({ ...current, ...Object.fromEntries(wanted.map((id) => [id, true])) }));
        return;
      }
      setPending((current) => ({ ...current, ...Object.fromEntries(todo.map((id) => [id, true])) }));
      translateContent(poi.id, { kind, ids: todo.slice(0, 30), language })
        .then((results) => {
          setTranslated((current) => {
            const next = { ...current };
            for (const r of results) if (!r.alreadyInTarget) next[`${language}:${r.id}`] = r.fields;
            return next;
          });
          setShown((current) => ({ ...current, ...Object.fromEntries(results.map((r) => [r.id, !r.alreadyInTarget])) }));
        })
        .catch(() => undefined)
        .finally(() =>
          setPending((current) => {
            const next = { ...current };
            for (const id of todo) delete next[id];
            return next;
          }),
        );
    },
    [poi.id, kind, language, translated, pending],
  );

  // "Translate automatically": every text in another language, at once.
  const foreignKey = useMemo(() => ids.filter(foreign).join(','), [ids, foreign]);
  useEffect(() => {
    if (!autoTranslate || !foreignKey) return;
    request(foreignKey.split(','));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTranslate, foreignKey, language]);

  return {
    foreign,
    showing: (id) => !!shown[id] && !!translated[`${language}:${id}`],
    busy: (id) => !!pending[id],
    sourceLanguage: (id) => languages[id] ?? null,
    text: (id, field, original) => {
      const fields = shown[id] ? translated[`${language}:${id}`] : undefined;
      return fields?.[field] ?? original ?? '';
    },
    translate: (id) => request([id]),
    showOriginal: (id) => setShown((current) => ({ ...current, [id]: false })),
  };
}

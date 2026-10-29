import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

export type TabItem<K extends string> = { key: K; label: string; count?: number | null };

/**
 * The tab a page is on, kept in the address (?tab=…) so a reload or a
 * shared link lands on the same part of the page. An unknown or missing
 * value falls back to the first tab.
 */
export function useTab<K extends string>(keys: readonly K[]): [K, (key: K) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const current = keys.find((k) => k === raw) ?? keys[0];
  function setTab(key: K) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (key === keys[0]) next.delete('tab');
        else next.set('tab', key);
        return next;
      },
      { replace: true },
    );
  }
  return [current, setTab];
}

/**
 * One row of tabs under a page's title (Seb, 29 Oct 2026), so a long page
 * shows one part at a time instead of everything stacked. Arrow keys move
 * between tabs, as screen readers expect of a tab list.
 */
export function TabBar<K extends string>({
  tabs,
  current,
  onChange,
  label,
  idPrefix,
}: {
  tabs: TabItem<K>[];
  current: K;
  onChange: (key: K) => void;
  label: string;
  idPrefix: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent, index: number) {
    let target = -1;
    if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') target = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') target = 0;
    if (event.key === 'End') target = tabs.length - 1;
    if (target < 0) return;
    event.preventDefault();
    onChange(tabs[target].key);
    refs.current[target]?.focus();
  }

  return (
    <div className="tab-bar" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => {
        const selected = tab.key === current;
        return (
          <button
            key={tab.key}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.key}`}
            aria-controls={`${idPrefix}-panel-${tab.key}`}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={`tab ${selected ? 'tab-selected' : ''}`}
            onClick={() => onChange(tab.key)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && <span className="tab-count">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The content of one tab. A panel is first drawn when its tab is opened
 * (a map needs to be visible to size itself), then stays mounted and is
 * only hidden, so switching tabs never loses something half typed.
 * `eager` draws it from the start, for a panel that feeds something
 * shown on every tab (the home page's phone preview).
 */
export function TabPanel({
  idPrefix,
  tabKey,
  current,
  eager = false,
  children,
}: {
  idPrefix: string;
  tabKey: string;
  current: string;
  eager?: boolean;
  children: ReactNode;
}) {
  const [visited, setVisited] = useState(eager || tabKey === current);
  if (!visited && tabKey === current) setVisited(true);
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${tabKey}`}
      aria-labelledby={`${idPrefix}-tab-${tabKey}`}
      hidden={tabKey !== current}
      className="tab-panel"
    >
      {visited && children}
    </div>
  );
}

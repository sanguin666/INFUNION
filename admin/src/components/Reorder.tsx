import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { useI18n } from '../i18n/I18nContext';

/**
 * Drag to reorder (Seb, 21 Nov 2026: fewer buttons per page). Each row
 * gets one grip instead of a ↑ and a ↓ button. The grip is a real button:
 * with the keyboard, the arrow keys move the row up or down, so nobody
 * needs a mouse to change the order.
 *
 *   const drag = useReorder(list.length, (from, to) => …);
 *   <li {...drag.row(index)}><Grip {...drag.grip(index)} /> …</li>
 */
export function useReorder(count: number, onMove: (from: number, to: number) => void) {
  const [armed, setArmed] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const grips = useRef<(HTMLButtonElement | null)[]>([]);
  const focusAfterMove = useRef<number | null>(null);

  // After a move with the keyboard, the grip of the moved row keeps focus.
  useEffect(() => {
    if (focusAfterMove.current === null) return;
    grips.current[focusAfterMove.current]?.focus();
    focusAfterMove.current = null;
  });

  function move(from: number, to: number) {
    if (to < 0 || to >= count || from === to) return;
    onMove(from, to);
  }

  return {
    row: (index: number) => ({
      draggable: armed === index,
      'data-dragging': dragging === index || undefined,
      'data-drop': over === index && dragging !== null && dragging !== index ? (dragging < index ? 'after' : 'before') : undefined,
      onDragStart: (event: DragEvent) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
        setDragging(index);
      },
      onDragOver: (event: DragEvent) => {
        if (dragging === null) return;
        event.preventDefault();
        if (over !== index) setOver(index);
      },
      onDrop: (event: DragEvent) => {
        event.preventDefault();
        if (dragging !== null) move(dragging, index);
        setDragging(null);
        setOver(null);
        setArmed(null);
      },
      onDragEnd: () => {
        setDragging(null);
        setOver(null);
        setArmed(null);
      },
    }),
    grip: (index: number) => ({
      index,
      count,
      ref: (el: HTMLButtonElement | null) => {
        grips.current[index] = el;
      },
      onArm: () => setArmed(index),
      onDisarm: () => setArmed((current) => (current === index && dragging === null ? null : current)),
      onKeyMove: (delta: number) => {
        const to = index + delta;
        if (to < 0 || to >= count) return;
        focusAfterMove.current = to;
        move(index, to);
      },
    }),
  };
}

export function Grip({
  index,
  count,
  ref,
  onArm,
  onDisarm,
  onKeyMove,
  name,
}: {
  index: number;
  count: number;
  ref: (el: HTMLButtonElement | null) => void;
  onArm: () => void;
  onDisarm: () => void;
  onKeyMove: (delta: number) => void;
  /** What the row is, for screen readers: "Move Events". */
  name: string;
}) {
  const { t } = useI18n();
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      onKeyMove(-1);
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      onKeyMove(1);
    }
  }
  return (
    <button
      type="button"
      ref={ref}
      className="grip"
      aria-label={t('reorder.grip', { name, n: index + 1, total: count })}
      title={t('reorder.hint')}
      onMouseDown={onArm}
      onTouchStart={onArm}
      onMouseUp={onDisarm}
      onKeyDown={onKeyDown}
    >
      <svg viewBox="0 0 12 20" width="12" height="20" aria-hidden="true">
        {[3, 10, 17].map((y) => (
          <g key={y}>
            <circle cx="3" cy={y} r="1.7" />
            <circle cx="9" cy={y} r="1.7" />
          </g>
        ))}
      </svg>
    </button>
  );
}

/** Moves one item of a list from one place to another. */
export function moved<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * The "⋯" button of a row (Seb, 21 Nov 2026): the actions a row needs
 * now and then (move, remove, unpublish) wait behind it, so the row shows
 * only the one action people take every time.
 */
export function MoreMenu({
  label,
  items,
  buttonLabel,
}: {
  /** Words on the button ("Share ▾") instead of "⋯". */
  buttonLabel?: string;
  /** For screen readers: "More actions for Por las almas…". */
  label: string;
  /** A destructive item asks "Yes, …?" inside the menu first, unless an undo follows anyway (`undoable`). */
  items: { label: string; onSelect: () => void; destructive?: boolean; undoable?: boolean; disabled?: boolean; hidden?: boolean }[];
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const shown = items.filter((item) => !item.hidden);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  if (shown.length === 0) return null;
  return (
    <div className="more-menu" ref={box}>
      <button
        type="button"
        className={buttonLabel ? 'btn' : 'more-menu-button'}
        aria-label={buttonLabel ? undefined : label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setAsking(null);
          setOpen((v) => !v);
        }}
      >
        {buttonLabel ?? '⋯'}
      </button>
      {open && asking !== null && (
        <div className="more-menu-list" role="menu">
          <button
            type="button"
            role="menuitem"
            autoFocus
            className="more-menu-item more-menu-item-destructive"
            onClick={() => {
              const item = shown.find((i) => i.label === asking);
              setOpen(false);
              setAsking(null);
              item?.onSelect();
            }}
          >
            {t('common.yes')}, {asking.charAt(0).toLowerCase() + asking.slice(1)}
          </button>
          <button type="button" role="menuitem" className="more-menu-item" onClick={() => setAsking(null)}>
            {t('common.cancel')}
          </button>
        </div>
      )}
      {open && asking === null && (
        <div className="more-menu-list" role="menu">
          {shown.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={item.destructive ? 'more-menu-item more-menu-item-destructive' : 'more-menu-item'}
              onClick={() => {
                if (item.destructive && !item.undoable) {
                  setAsking(item.label);
                  return;
                }
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

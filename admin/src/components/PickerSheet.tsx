import { useEffect, useRef, type ReactNode } from 'react';

export type PickerOption = {
  key: string;
  label: string;
  // Set when the label is written in a language of its own (a language's
  // name in itself), so screen readers pronounce it right.
  lang?: string;
  // The place switcher shows each place's mark before its name, and a
  // count of what waits there after it.
  icon?: ReactNode;
  badge?: ReactNode;
};

/**
 * The app's choosing sheet, brought to the web: a white sheet of rows
 * split by orange lines, the one in use named by its colour and a tick,
 * and a white Close button as the way out. The language picker and the
 * place picker both open this, so they read as one thing.
 */
export function PickerSheet({
  open,
  onClose,
  title,
  options,
  selectedKey,
  onChoose,
  closeLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  options: PickerOption[];
  selectedKey: string;
  onChoose: (key: string) => void;
  closeLabel: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // A native <dialog> opened with showModal() gets the focus trap and the
  // Escape key for free; Escape fires `close`, which is kept in step here.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-label={title}
      onClose={onClose}
      // A click on the dimmed backdrop lands on the dialog element
      // itself, never on anything inside it.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet-body">
        <h2 className="sheet-title">{title}</h2>
        <div>
          {options.map((option) => {
            const selected = option.key === selectedKey;
            return (
              <button
                key={option.key}
                type="button"
                className={`sheet-option ${selected ? 'sheet-option-selected' : ''}`}
                aria-pressed={selected}
                onClick={() => {
                  onChoose(option.key);
                  onClose();
                }}
              >
                {option.icon ? (
                  <span className="sheet-option-main">
                    {option.icon}
                    <span lang={option.lang}>{option.label}</span>
                  </span>
                ) : (
                  <span lang={option.lang}>{option.label}</span>
                )}
                {option.badge}
                {/* A tick as well as the colour, so the choice is not
                    carried by colour alone. */}
                {selected && <CheckIcon />}
              </button>
            );
          })}
        </div>
        <button type="button" className="btn btn-block" onClick={onClose}>
          {closeLabel}
        </button>
      </div>
    </dialog>
  );
}

/**
 * The row that opens a sheet: an icon, what it is, what it is set to,
 * and a chevron saying there is a list behind it.
 */
export function PickerRow({
  icon,
  label,
  value,
  ariaLabel,
  onClick,
}: {
  icon: ReactNode;
  label?: string;
  value: string;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="picker-row" aria-label={ariaLabel} onClick={onClick}>
      {icon}
      {label ? (
        <>
          <span className="picker-row-label">{label}</span>
          <span className="picker-row-value">{value}</span>
        </>
      ) : (
        <span className="picker-row-label">{value}</span>
      )}
      <ChevronRightIcon />
    </button>
  );
}

// The same icons the app draws, at the size a pointer needs.

// Light / dark mode: a circle half filled.
export function ContrastIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx={12} cy={12} r={9} stroke="currentColor" strokeWidth={2} />
      <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" />
    </svg>
  );
}

export function GlobeIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx={12} cy={12} r={9} stroke="currentColor" strokeWidth={2} />
      <path d="M3 12h18" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <path
        d="M12 3c2.6 2.4 4 5.4 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.4-4-9s1.4-6.6 4-9Z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PinIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <circle cx={12} cy={9.5} r={2.5} stroke="currentColor" strokeWidth={2} />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

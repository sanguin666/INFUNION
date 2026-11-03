import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A window in the middle of the screen over the dimmed page, for a "new …"
 * or edit form. It replaced the panel that slid in from the right, which
 * Seb did not like (3 Nov 2026). A native <dialog> gives the focus trap
 * and the Escape key; a click on the dimmed page closes it too. The title
 * can be the label of the button that opened it; its leading "+" is
 * dropped.
 */
export function Dialog({
  open,
  onClose,
  title,
  closeLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const heading = title.replace(/^\+\s*/, '');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-label={heading}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-body">
        <div className="dialog-head">
          <h2 className="dialog-title">{heading}</h2>
          <button type="button" className="btn" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
        {open && children}
      </div>
    </dialog>
  );
}

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A panel that slides in from the right over the page, for a "new …"
 * form that used to sit at the top of the page (Seb, 29 Oct 2026). A
 * native <dialog> gives the focus trap and the Escape key; a click on the
 * dimmed page closes it too. The title can be the label of the button
 * that opened it; its leading "+" is dropped.
 */
export function SidePanel({
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
      className="side-panel"
      aria-label={heading}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="side-panel-body">
        <div className="side-panel-head">
          <h2 className="side-panel-title">{heading}</h2>
          <button type="button" className="btn" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
        {open && children}
      </div>
    </dialog>
  );
}

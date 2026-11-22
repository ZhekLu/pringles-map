import { useEffect, useRef } from "react";
import type { ReactNode, MouseEvent } from "react";

export default function Dialog({
  open,
  onClose,
  className,
  label,
  labelledBy,
  children,
  closeLabel = "Close",
}: {
  open: boolean;
  onClose: () => void;
  className: string;
  label?: string;
  labelledBy?: string;
  children: ReactNode;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  function backdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== ref.current) return;
    const r = ref.current.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      onClose();
  }
  return (
    <dialog
      ref={ref}
      className={className}
      onClose={onClose}
      onClick={backdrop}
      aria-label={label}
      aria-labelledby={labelledBy}
    >
      {!className.includes("zoom-dialog") && (
        <button
          className="icon-button close-dialog"
          onClick={onClose}
          aria-label={closeLabel}
        >
          ×
        </button>
      )}
      {children}
    </dialog>
  );
}

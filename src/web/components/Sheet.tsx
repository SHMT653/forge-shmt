'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Bottom sheet — the primary mobile input surface (§36).
 * Locks background scroll and closes on Escape.
 */
export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} aria-hidden />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grip" aria-hidden />
        <div className="sheet-header">
          <p className="h3">{title}</p>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Schließen">
            <X size={18} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && (
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', flex: '0 0 auto' }}>{footer}</div>
        )}
      </div>
    </>
  );
}

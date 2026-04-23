import { useEffect } from 'react';
import './ConfirmDialog.css';

/**
 * Reusable confirmation modal. Use declaratively via `open`, or imperatively via
 * the `useConfirm` hook below for alert-style "are you sure?" prompts.
 */
function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary', // 'primary' | 'danger' | 'warning' | 'success'
  icon,
  loading = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !loading && onCancel) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  const resolvedIcon = icon ?? (variant === 'danger' ? '⚠️' : variant === 'warning' ? '🔔' : variant === 'success' ? '✅' : '❓');

  return (
    <div className="confirm-dialog-overlay" onClick={() => !loading && onCancel && onCancel()}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`confirm-dialog-header confirm-dialog-header-${variant}`}>
          <span className="confirm-dialog-icon" aria-hidden="true">{resolvedIcon}</span>
          <h2 id="confirm-dialog-title">{title}</h2>
        </div>

        <div className="confirm-dialog-body">
          {message && <p className="confirm-dialog-message">{message}</p>}
          {children}
        </div>

        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn-${variant}`}
            onClick={onConfirm}
            disabled={loading}
            autoFocus
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;

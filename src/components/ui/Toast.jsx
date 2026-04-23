import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import './Toast.css';

const ToastContext = createContext(null);

let idCounter = 0;

/**
 * App-wide toast provider. Wrap the app once and call `useToast()` anywhere.
 *
 *   const toast = useToast();
 *   toast.success('Saved');
 *   toast.error('Something went wrong');
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback((toast) => {
    idCounter += 1;
    const id = `toast-${idCounter}`;
    const withId = { id, duration: 3500, ...toast };
    setToasts((list) => [...list, withId]);
    if (withId.duration && withId.duration > 0) {
      const t = setTimeout(() => dismiss(id), withId.duration);
      timers.current.set(id, t);
    }
    return id;
  }, [dismiss]);

  const api = useMemo(() => ({
    show: (message, opts = {}) => push({ message, variant: 'info', ...opts }),
    info: (message, opts = {}) => push({ message, variant: 'info', ...opts }),
    success: (message, opts = {}) => push({ message, variant: 'success', ...opts }),
    error: (message, opts = {}) => push({ message, variant: 'error', duration: 5000, ...opts }),
    warning: (message, opts = {}) => push({ message, variant: 'warning', ...opts }),
    dismiss,
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.variant}`} role="status">
            <span className="toast-icon" aria-hidden="true">{iconFor(t.variant)}</span>
            <span className="toast-message">{t.message}</span>
            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function iconFor(variant) {
  switch (variant) {
    case 'success': return '✅';
    case 'error':   return '⛔';
    case 'warning': return '⚠️';
    default:        return 'ℹ️';
  }
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Graceful fallback: if a component outside the provider calls toast,
    // log to console instead of crashing.
    return {
      show: (m) => console.log('[toast]', m),
      info: (m) => console.log('[toast/info]', m),
      success: (m) => console.log('[toast/success]', m),
      error: (m) => console.error('[toast/error]', m),
      warning: (m) => console.warn('[toast/warning]', m),
      dismiss: () => {},
    };
  }
  return ctx;
}

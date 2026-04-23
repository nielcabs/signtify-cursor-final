import { useEffect, useRef, useState } from 'react';
import './ActionMenu.css';

/**
 * Compact "Options ▾" dropdown for row/card actions.
 *
 * Usage:
 *   <ActionMenu
 *     label="Options"
 *     items={[
 *       { label: 'Edit', onClick: ... },
 *       { label: 'Archive', onClick: ..., variant: 'warning' },
 *       { label: 'Delete', onClick: ..., variant: 'danger', disabled: true, title: 'Reason' },
 *       { divider: true },
 *       { label: 'Make Admin', onClick: ... }
 *     ]}
 *   />
 */
function ActionMenu({ label = 'Options', items = [], align = 'right', buttonClassName = '' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const handleItemClick = (item) => {
    if (item.disabled) return;
    setOpen(false);
    if (typeof item.onClick === 'function') item.onClick();
  };

  return (
    <div className="action-menu" ref={rootRef}>
      <button
        type="button"
        className={`action-menu-trigger ${buttonClassName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <span className="action-menu-arrow" aria-hidden="true">▾</span>
      </button>

      {open && (
        <ul
          className={`action-menu-list action-menu-align-${align}`}
          role="menu"
        >
          {items.map((item, idx) => {
            if (item.divider) {
              return <li key={`div-${idx}`} className="action-menu-divider" role="separator" />;
            }
            return (
              <li key={item.label + idx} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={`action-menu-item ${item.variant ? `action-menu-item-${item.variant}` : ''}`}
                  disabled={!!item.disabled}
                  title={item.title}
                  onClick={() => handleItemClick(item)}
                >
                  {item.icon && <span className="action-menu-icon">{item.icon}</span>}
                  <span className="action-menu-label">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default ActionMenu;

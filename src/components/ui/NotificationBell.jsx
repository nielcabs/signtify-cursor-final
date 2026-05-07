import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import {
  subscribeToUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../../notifications/notifications';
import './NotificationBell.css';

function timeAgo(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return date.toLocaleDateString();
}

function iconFor(type) {
  switch (type) {
    case 'achievement':        return '🏆';
    case 'lesson_completed':   return '✅';
    case 'quiz_result':        return '📝';
    case 'exam_result':        return '🎓';
    case 'admin_announcement': return '📣';
    case 'account':            return '👤';
    default:                   return '🔔';
  }
}

function NotificationBell() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!currentUser?.uid) {
      setItems([]);
      return undefined;
    }
    const unsub = subscribeToUserNotifications(currentUser.uid, setItems, { limit: 30 });
    return () => unsub && unsub();
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const unreadCount = items.filter((n) => !n.read).length;

  const handleItemClick = async (n) => {
    if (!n.read) {
      markNotificationAsRead(n.id); // fire and forget
    }
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  const handleMarkAll = async () => {
    if (!currentUser?.uid) return;
    await markAllNotificationsAsRead(currentUser.uid);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    await deleteNotification(id);
  };

  if (!currentUser) return null;

  return (
    <div className="notification-bell" ref={rootRef}>
      <button
        type="button"
        className="notification-bell-trigger"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 && (
          <span className="notification-badge" aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-panel" role="dialog" aria-label="Notifications">
          <div className="notification-panel-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                className="notification-link-button"
                onClick={handleMarkAll}
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="notification-panel-body">
            {items.length === 0 ? (
              <div className="notification-empty">
                <span className="notification-empty-icon" aria-hidden="true">📭</span>
                <p>You're all caught up.</p>
              </div>
            ) : (
              <ul className="notification-list">
                {items.map((n) => (
                  <li
                    key={n.id}
                    className={`notification-item ${n.read ? '' : 'notification-item-unread'} ${n.link ? 'notification-item-linked' : ''}`}
                    onClick={() => handleItemClick(n)}
                  >
                    <span className="notification-item-icon" aria-hidden="true">{iconFor(n.type)}</span>
                    <div className="notification-item-content">
                      {n.title && <div className="notification-item-title">{n.title}</div>}
                      {n.message && <div className="notification-item-message">{n.message}</div>}
                      <div className="notification-item-time">{timeAgo(n.createdAt)}</div>
                    </div>
                    <button
                      type="button"
                      className="notification-item-dismiss"
                      aria-label="Dismiss notification"
                      onClick={(e) => handleDelete(e, n.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;

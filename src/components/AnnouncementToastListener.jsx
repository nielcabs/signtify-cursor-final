import { useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from './ui/Toast';
import { NOTIFICATION_TYPES, subscribeToUserNotifications } from '../notifications/notifications';

/**
 * Shows a toast when a new admin announcement arrives (in addition to the bell list).
 */
function AnnouncementToastListener() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const seenIdsRef = useRef(new Set());
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (!currentUser?.uid) return undefined;

    seenIdsRef.current = new Set();
    bootstrappedRef.current = false;

    const unsub = subscribeToUserNotifications(currentUser.uid, (items) => {
      if (!items?.length) {
        return;
      }

      if (!bootstrappedRef.current) {
        items.forEach((n) => seenIdsRef.current.add(n.id));
        bootstrappedRef.current = true;
        return;
      }

      const newestFirst = [...items].sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds ?? 0;
        return tb - ta;
      });

      for (const n of newestFirst) {
        if (seenIdsRef.current.has(n.id)) continue;
        seenIdsRef.current.add(n.id);

        if (n.type === NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT && !n.read) {
          const title = (n.title || 'Announcement').trim();
          const body = (n.message || '').trim();
          const msg = body ? `${title}\n${body}` : title;
          toast.info(msg, { duration: 9000 });
        }
      }
    }, { limit: 30 });

    return () => {
      unsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast from ToastProvider is stable
  }, [currentUser?.uid]);

  return null;
}

export default AnnouncementToastListener;

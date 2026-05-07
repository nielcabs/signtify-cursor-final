import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../auth/firebase';

/**
 * Schema for a notification document (stored in "notifications" collection):
 * {
 *   userId:    string  // uid of the recipient (or "*" for broadcast)
 *   type:      string  // 'achievement' | 'lesson_completed' | 'exam_result' |
 *                        'admin_announcement' | 'account' | 'info'
 *   title:     string
 *   message:   string
 *   link?:     string  // optional in-app route, e.g. "/profile"
 *   read:      boolean
 *   createdAt: timestamp
 *   createdBy?:string  // admin uid if applicable
 *   meta?:     object  // freeform extra data
 * }
 */

const COLLECTION = 'notifications';

export const NOTIFICATION_TYPES = {
  ACHIEVEMENT: 'achievement',
  LESSON_COMPLETED: 'lesson_completed',
  QUIZ_RESULT: 'quiz_result',
  EXAM_RESULT: 'exam_result',
  ADMIN_ANNOUNCEMENT: 'admin_announcement',
  ACCOUNT: 'account',
  INFO: 'info',
};

/**
 * Create a notification for a single user.
 */
export const createNotification = async ({
  userId,
  type = NOTIFICATION_TYPES.INFO,
  title,
  message,
  link = null,
  createdBy = null,
  meta = null,
}) => {
  if (!userId) {
    console.warn('createNotification: missing userId');
    return null;
  }
  try {
    const ref = await addDoc(collection(db, COLLECTION), {
      userId,
      type,
      title: title || '',
      message: message || '',
      link,
      read: false,
      createdBy,
      meta: meta || {},
      createdAt: serverTimestamp(),
    });
    return ref.id;
  } catch (err) {
    // Notifications should never break the main flow.
    console.warn('createNotification failed:', err?.message || err);
    return null;
  }
};

/**
 * Broadcast a notification to many users (e.g., all non-archived users).
 * Caller provides the list of uids.
 */
export const broadcastNotification = async (uids, payload) => {
  if (!Array.isArray(uids) || uids.length === 0) {
    throw new Error('No recipients (uids) provided');
  }
  const batch = writeBatch(db);
  uids.forEach((uid) => {
    const ref = doc(collection(db, COLLECTION));
    batch.set(ref, {
      userId: uid,
      type: payload.type || NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT,
      title: payload.title || '',
      message: payload.message || '',
      link: payload.link || null,
      read: false,
      createdBy: payload.createdBy || null,
      meta: payload.meta || {},
      createdAt: serverTimestamp(),
    });
  });
  try {
    await batch.commit();
    return uids.length;
  } catch (err) {
    console.warn('broadcastNotification failed:', err?.message || err);
    throw err;
  }
};

/**
 * One-shot fetch of a user's notifications (newest first).
 */
export const getUserNotifications = async (uid, { limit = 30 } = {}) => {
  if (!uid) return [];
  try {
    const q = query(
      collection(db, COLLECTION),
      where('userId', '==', uid),
      firestoreLimit(limit),
    );
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const toMillis = (ts) => ts?.toMillis?.() ?? (ts?.seconds ? ts.seconds * 1000 : 0);
    list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    return list;
  } catch (err) {
    console.warn('getUserNotifications failed:', err?.message || err);
    return [];
  }
};

/**
 * Real-time subscription. Returns an unsubscribe function.
 */
export const subscribeToUserNotifications = (uid, callback, { limit = 30 } = {}) => {
  if (!uid || typeof callback !== 'function') return () => {};
  try {
    const q = query(
      collection(db, COLLECTION),
      where('userId', '==', uid),
      firestoreLimit(limit),
    );
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const toMillis = (ts) => ts?.toMillis?.() ?? (ts?.seconds ? ts.seconds * 1000 : 0);
        list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        callback(list);
      },
      (err) => {
        // Handle permission/index errors gracefully so the UI does not break.
        console.warn('notifications snapshot error:', err?.message || err);
        callback([]);
      },
    );
  } catch (err) {
    console.warn('subscribeToUserNotifications failed:', err?.message || err);
    return () => {};
  }
};

export const markNotificationAsRead = async (notificationId) => {
  if (!notificationId) return;
  try {
    await updateDoc(doc(db, COLLECTION, notificationId), { read: true, readAt: serverTimestamp() });
  } catch (err) {
    console.warn('markNotificationAsRead failed:', err?.message || err);
  }
};

export const markAllNotificationsAsRead = async (uid) => {
  if (!uid) return 0;
  try {
    const q = query(
      collection(db, COLLECTION),
      where('userId', '==', uid),
      where('read', '==', false),
    );
    const snap = await getDocs(q);
    if (snap.empty) return 0;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      batch.update(doc(db, COLLECTION, d.id), { read: true, readAt: serverTimestamp() });
    });
    await batch.commit();
    return snap.size;
  } catch (err) {
    console.warn('markAllNotificationsAsRead failed:', err?.message || err);
    return 0;
  }
};

export const deleteNotification = async (notificationId) => {
  if (!notificationId) return;
  try {
    await deleteDoc(doc(db, COLLECTION, notificationId));
  } catch (err) {
    console.warn('deleteNotification failed:', err?.message || err);
  }
};

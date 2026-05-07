import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  limit as firestoreLimit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../auth/firebase';

const COLLECTION = 'announcements';

export async function createAnnouncement({ title, message, link = null, createdBy = null, meta = null }) {
  const t = String(title || '').trim();
  const m = String(message || '').trim();
  if (!t || !m) throw new Error('Announcement requires title + message');
  const ref = await addDoc(collection(db, COLLECTION), {
    title: t,
    message: m,
    link: link || null,
    createdBy: createdBy || null,
    meta: meta || {},
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export function subscribeToAnnouncements(callback, { limit = 20 } = {}) {
  if (typeof callback !== 'function') return () => {};
  const q = query(
    collection(db, COLLECTION),
    orderBy('createdAt', 'desc'),
    firestoreLimit(limit),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(list);
    },
    (err) => {
      console.warn('announcements snapshot error:', err?.message || err);
      callback([]);
    },
  );
}


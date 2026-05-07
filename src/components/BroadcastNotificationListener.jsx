import { useEffect, useRef } from 'react';
import { collection, onSnapshot, orderBy, query, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '../auth/firebase';
import { useAuth } from '../auth/AuthContext';
import { createNotification, NOTIFICATION_TYPES } from '../notifications/notifications';
import { subscribeToAnnouncements } from '../notifications/announcements';

const lsKey = (uid, channel) => `signtify_seen_${channel}_${uid}`;
const loadSeen = (uid, channel) => {
  try {
    const raw = localStorage.getItem(lsKey(uid, channel));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
};
const saveSeen = (uid, channel, set) => {
  try {
    localStorage.setItem(lsKey(uid, channel), JSON.stringify(Array.from(set).slice(-200)));
  } catch {
    // ignore
  }
};

function BroadcastNotificationListener() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;

  const bootRef = useRef({ exams: false, quizzes: false, announcements: false });
  const seenRef = useRef({ exams: new Set(), quizzes: new Set(), announcements: new Set() });

  useEffect(() => {
    if (!uid) return undefined;
    bootRef.current = { exams: false, quizzes: false, announcements: false };
    seenRef.current = {
      exams: loadSeen(uid, 'exams'),
      quizzes: loadSeen(uid, 'quizzes'),
      announcements: loadSeen(uid, 'announcements'),
    };

    const subs = [];

    // ---- Announcements: single shared collection ----
    subs.push(subscribeToAnnouncements((items) => {
      if (!items?.length) return;
      if (!bootRef.current.announcements) {
        items.forEach((a) => seenRef.current.announcements.add(a.id));
        saveSeen(uid, 'announcements', seenRef.current.announcements);
        bootRef.current.announcements = true;
        return;
      }
      for (const a of items) {
        if (seenRef.current.announcements.has(a.id)) continue;
        seenRef.current.announcements.add(a.id);
        saveSeen(uid, 'announcements', seenRef.current.announcements);
        createNotification({
          userId: uid,
          type: NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT,
          title: a.title || 'Announcement',
          message: a.message || '',
          link: a.link || null,
          createdBy: a.createdBy || null,
          meta: { announcementId: a.id },
        });
      }
    }));

    // ---- New exams/quizzes: detect newly created docs, then create a per-user notification ----
    const subscribeCreatedDocs = (channel, colName, makeNotif) => {
      const q = query(collection(db, colName), orderBy('createdAt', 'desc'), firestoreLimit(25));
      return onSnapshot(
        q,
        (snap) => {
          const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          if (!docs.length) return;

          if (!bootRef.current[channel]) {
            docs.forEach((d) => seenRef.current[channel].add(d.id));
            saveSeen(uid, channel, seenRef.current[channel]);
            bootRef.current[channel] = true;
            return;
          }

          for (const d of docs) {
            if (seenRef.current[channel].has(d.id)) continue;
            seenRef.current[channel].add(d.id);
            saveSeen(uid, channel, seenRef.current[channel]);
            makeNotif(d);
          }
        },
        (err) => console.warn(`${channel} snapshot error:`, err?.message || err),
      );
    };

    subs.push(subscribeCreatedDocs('exams', 'exams', (d) => {
      const title = String(d.title || 'New exam available').trim();
      createNotification({
        userId: uid,
        type: NOTIFICATION_TYPES.INFO,
        title: `🎓 ${title}`,
        message: 'A new proficiency exam was added.',
        link: '/proficiency-exams',
        meta: { examId: d.id, category: d.category || null },
      });
    }));

    subs.push(subscribeCreatedDocs('quizzes', 'quizzes', (d) => {
      const title = String(d.title || 'New quiz available').trim();
      createNotification({
        userId: uid,
        type: NOTIFICATION_TYPES.INFO,
        title: `📝 ${title}`,
        message: 'A new quiz was added.',
        link: '/quizzes',
        meta: { quizId: d.id, category: d.category || null, difficulty: d.difficulty || null },
      });
    }));

    return () => subs.forEach((u) => u && u());
  }, [uid]);

  return null;
}

export default BroadcastNotificationListener;


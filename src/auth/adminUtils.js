import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, app } from './firebase';
import { logAdminAction } from './auditLogger';

// Hardcoded admin credentials for development
const HARDCODED_ADMIN_EMAIL = 'signtifydev@dev.com';

// Canonical role values
export const USER_ROLES = {
  STUDENT: 'student',
  TEACHER: 'teacher',
  ADMIN: 'admin',
};

export const ROLE_LABELS = {
  student: 'Student',
  teacher: 'Teacher',
  admin: 'Admin',
};

/**
 * Derive a canonical role for a user document, with backwards-compat for older
 * profiles that only had isAdmin=true but no `role` field.
 */
export const deriveUserRole = (userData) => {
  if (!userData) return USER_ROLES.STUDENT;
  if (userData.role === USER_ROLES.ADMIN || userData.role === USER_ROLES.TEACHER || userData.role === USER_ROLES.STUDENT) {
    return userData.role;
  }
  if (userData.isAdmin === true) return USER_ROLES.ADMIN;
  if (userData.email === HARDCODED_ADMIN_EMAIL) return USER_ROLES.ADMIN;
  return USER_ROLES.STUDENT;
};

/**
 * Check if user is an admin
 */
export const checkIsAdmin = async (uid) => {
  try {
    // Validate uid exists
    if (!uid) {
      return false;
    }

    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      // Check for hardcoded admin email
      if (userData.email === HARDCODED_ADMIN_EMAIL) {
        return true;
      }
      
      // role === 'admin' takes precedence but isAdmin=true still works for legacy users
      return deriveUserRole(userData) === USER_ROLES.ADMIN;
    }
    return false;
  } catch (error) {
    // Handle specific Firestore errors
    if (error.code === 'permission-denied') {
      console.warn('Firestore permission denied. Check security rules.');
    } else if (error.code === 'unavailable') {
      console.warn('Firestore is unavailable. Check your connection and Firebase configuration.');
    } else if (error.code === 'failed-precondition') {
      console.warn('Firestore database may not be initialized. Check Firebase Console.');
    } else {
      console.error('Error checking admin status:', error.code, error.message);
    }
    // Return false on any error to prevent blocking the app
    return false;
  }
};

/**
 * Get all users. By default archived users are excluded — pass { includeArchived: true }
 * or { onlyArchived: true } to adjust.
 */
export const getAllUsers = async ({ includeArchived = false, onlyArchived = false } = {}) => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    const users = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // normalize derived fields so callers don't need to do it themselves
      users.push({
        id: doc.id,
        ...data,
        role: deriveUserRole(data),
        isArchived: data.isArchived === true,
      });
    });

    if (onlyArchived) return users.filter((u) => u.isArchived);
    if (includeArchived) return users;
    return users.filter((u) => !u.isArchived);
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

/**
 * Fetch the current user's role (defaults to 'student').
 */
export const getUserRole = async (uid) => {
  try {
    if (!uid) return USER_ROLES.STUDENT;
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) return USER_ROLES.STUDENT;
    return deriveUserRole(userDoc.data());
  } catch (error) {
    console.error('Error fetching user role:', error);
    return USER_ROLES.STUDENT;
  }
};

/**
 * Assign a role (student | teacher | admin) to a user. Keeps `isAdmin` in sync
 * for any legacy code paths still checking that flag.
 */
export const setUserRole = async (uid, newRole, adminId = null, adminEmail = null) => {
  if (!uid) throw new Error('User ID is required');
  if (!Object.values(USER_ROLES).includes(newRole)) {
    throw new Error(`Invalid role: ${newRole}`);
  }

  const userRef = doc(db, 'users', uid);

  let targetUserName = uid;
  let targetUserEmail = '';
  let previousRole = USER_ROLES.STUDENT;
  try {
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const userData = userDoc.data();
      targetUserName = userData.displayName || userData.email || uid;
      targetUserEmail = userData.email || '';
      previousRole = deriveUserRole(userData);
    }
  } catch (e) {
    // non-fatal: we still attempt the update
  }

  await updateDoc(userRef, {
    role: newRole,
    isAdmin: newRole === USER_ROLES.ADMIN,
    updatedAt: serverTimestamp(),
  });

  if (adminId && adminEmail) {
    await logAdminAction(
      adminId,
      adminEmail,
      'set_role',
      'user',
      uid,
      targetUserName,
      { previousRole, newRole, targetUserEmail },
    );
  }

  return { previousRole, newRole };
};

/**
 * Archive (soft-delete) a user — keeps all their data but blocks login and hides
 * them from default lists. Pair with `restoreUser` to undo.
 */
export const archiveUser = async (uid, adminId = null, adminEmail = null) => {
  if (!uid) throw new Error('User ID is required');

  const userRef = doc(db, 'users', uid);
  const userDoc = await getDoc(userRef);
  if (!userDoc.exists()) throw new Error(`User ${uid} does not exist`);

  const data = userDoc.data();
  const targetUserName = data.displayName || data.email || uid;
  const targetUserEmail = data.email || '';

  await updateDoc(userRef, {
    isArchived: true,
    archivedAt: serverTimestamp(),
    archivedBy: adminId || null,
    updatedAt: serverTimestamp(),
  });

  if (adminId && adminEmail) {
    await logAdminAction(
      adminId,
      adminEmail,
      'archive',
      'user',
      uid,
      targetUserName,
      { targetUserEmail },
    );
  }
};

export const restoreUser = async (uid, adminId = null, adminEmail = null) => {
  if (!uid) throw new Error('User ID is required');

  const userRef = doc(db, 'users', uid);
  const userDoc = await getDoc(userRef);
  if (!userDoc.exists()) throw new Error(`User ${uid} does not exist`);

  const data = userDoc.data();
  const targetUserName = data.displayName || data.email || uid;
  const targetUserEmail = data.email || '';

  await updateDoc(userRef, {
    isArchived: false,
    archivedAt: null,
    archivedBy: null,
    updatedAt: serverTimestamp(),
  });

  if (adminId && adminEmail) {
    await logAdminAction(
      adminId,
      adminEmail,
      'restore',
      'user',
      uid,
      targetUserName,
      { targetUserEmail },
    );
  }
};

/**
 * Update user admin status
 */
export const updateUserAdminStatus = async (uid, isAdmin, adminId = null, adminEmail = null) => {
  try {
    const userRef = doc(db, 'users', uid);
    
    // Get user info for logging
    let targetUserName = uid;
    let targetUserEmail = '';
    try {
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        targetUserName = userData.displayName || userData.email || uid;
        targetUserEmail = userData.email || '';
      }
    } catch (e) {
      // Continue with uid if we can't get user info
    }
    
    await updateDoc(userRef, {
      isAdmin,
      updatedAt: serverTimestamp()
    });
    
    // Log admin action
    if (adminId && adminEmail) {
      await logAdminAction(
        adminId,
        adminEmail,
        isAdmin ? 'grant_admin' : 'revoke_admin',
        'user',
        uid,
        targetUserName,
        { 
          targetUserEmail,
          action: isAdmin ? 'granted admin access' : 'revoked admin access'
        }
      );
    }
  } catch (error) {
    console.error('Error updating admin status:', error);
    throw error;
  }
};

/**
 * Update user details (displayName, email, etc.)
 */
export const updateUserDetails = async (uid, updates) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating user details:', error);
    throw error;
  }
};

/**
 * Delete user from both Firebase Auth and Firestore so they cannot log in again.
 * Uses the Cloud Function "adminDeleteUser" (deploy with: firebase deploy --only functions).
 */
export const deleteUser = async (uid) => {
  try {
    const functions = getFunctions(app);
    const adminDeleteUserFn = httpsCallable(functions, 'adminDeleteUser');
    await adminDeleteUserFn({ uid });
  } catch (error) {
    console.error('Error deleting user:', error);
    const msg = error?.message || (error?.code === 'functions/unavailable'
      ? 'Cloud Function not deployed. Run: firebase deploy --only functions'
      : 'Failed to delete user.');
    throw new Error(msg);
  }
};

/**
 * Get all quizzes
 */
export const getAllQuizzes = async () => {
  try {
    const quizzesRef = collection(db, 'quizzes');
    const querySnapshot = await getDocs(quizzesRef);
    
    const quizzes = [];
    querySnapshot.forEach((doc) => {
      quizzes.push({ id: doc.id, ...doc.data() });
    });
    
    return quizzes;
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    throw error;
  }
};

/**
 * Create or update quiz
 */
export const saveQuiz = async (quizId, quizData, adminId = null, adminEmail = null) => {
  try {
    const quizRef = doc(db, 'quizzes', quizId);
    const isUpdate = await getDoc(quizRef).then(doc => doc.exists());
    
    await setDoc(quizRef, {
      ...quizData,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // Log admin action
    if (adminId && adminEmail) {
      await logAdminAction(
        adminId,
        adminEmail,
        isUpdate ? 'update' : 'create',
        'quiz',
        quizId,
        quizData.title || 'Untitled Quiz',
        isUpdate ? { updatedFields: Object.keys(quizData) } : null
      );
    }
  } catch (error) {
    console.error('Error saving quiz:', error);
    throw error;
  }
};

/**
 * Delete quiz
 */
export const deleteQuiz = async (quizId, adminId = null, adminEmail = null, quizTitle = null) => {
  try {
    const quizRef = doc(db, 'quizzes', quizId);
    
    // Get quiz title before deleting if not provided
    let title = quizTitle;
    if (!title) {
      const quizDoc = await getDoc(quizRef);
      if (quizDoc.exists()) {
        title = quizDoc.data().title || 'Untitled Quiz';
      }
    }
    
    await deleteDoc(quizRef);
    
    // Log admin action
    if (adminId && adminEmail) {
      await logAdminAction(
        adminId,
        adminEmail,
        'delete',
        'quiz',
        quizId,
        title || 'Untitled Quiz'
      );
    }
  } catch (error) {
    console.error('Error deleting quiz:', error);
    throw error;
  }
};

/**
 * Get all exams
 */
export const getAllExams = async () => {
  try {
    const examsRef = collection(db, 'exams');
    const querySnapshot = await getDocs(examsRef);
    
    const exams = [];
    querySnapshot.forEach((doc) => {
      exams.push({ id: doc.id, ...doc.data() });
    });
    
    return exams;
  } catch (error) {
    console.error('Error fetching exams:', error);
    throw error;
  }
};

/**
 * Create or update exam
 */
export const saveExam = async (examId, examData, adminId = null, adminEmail = null) => {
  try {
    const examRef = doc(db, 'exams', examId);
    const isUpdate = await getDoc(examRef).then(doc => doc.exists());
    
    await setDoc(examRef, {
      ...examData,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // Log admin action
    if (adminId && adminEmail) {
      await logAdminAction(
        adminId,
        adminEmail,
        isUpdate ? 'update' : 'create',
        'exam',
        examId,
        examData.title || 'Untitled Exam',
        isUpdate ? { updatedFields: Object.keys(examData) } : null
      );
    }
  } catch (error) {
    console.error('Error saving exam:', error);
    throw error;
  }
};

/**
 * Delete exam
 */
export const deleteExam = async (examId, adminId = null, adminEmail = null, examTitle = null) => {
  try {
    const examRef = doc(db, 'exams', examId);
    
    // Get exam title before deleting if not provided
    let title = examTitle;
    if (!title) {
      const examDoc = await getDoc(examRef);
      if (examDoc.exists()) {
        title = examDoc.data().title || 'Untitled Exam';
      }
    }
    
    await deleteDoc(examRef);
    
    // Log admin action
    if (adminId && adminEmail) {
      await logAdminAction(
        adminId,
        adminEmail,
        'delete',
        'exam',
        examId,
        title || 'Untitled Exam'
      );
    }
  } catch (error) {
    console.error('Error deleting exam:', error);
    throw error;
  }
};

/**
 * Get all dictionary entries
 */
export const getAllDictionaryEntries = async () => {
  try {
    const dictionaryRef = collection(db, 'dictionary');
    const q = query(dictionaryRef, orderBy('word', 'asc'));
    const querySnapshot = await getDocs(q);
    
    const entries = [];
    querySnapshot.forEach((doc) => {
      entries.push({ id: doc.id, ...doc.data() });
    });
    
    return entries;
  } catch (error) {
    console.error('Error fetching dictionary entries:', error);
    throw error;
  }
};

/**
 * Create or update dictionary entry
 */
export const saveDictionaryEntry = async (entryId, entryData, adminId = null, adminEmail = null) => {
  try {
    const entryRef = doc(db, 'dictionary', entryId);
    const isUpdate = await getDoc(entryRef).then(doc => doc.exists());
    
    await setDoc(entryRef, {
      ...entryData,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // Log admin action
    if (adminId && adminEmail) {
      await logAdminAction(
        adminId,
        adminEmail,
        isUpdate ? 'update' : 'create',
        'dictionary',
        entryId,
        entryData.word || 'Untitled Entry',
        isUpdate ? { updatedFields: Object.keys(entryData) } : null
      );
    }
  } catch (error) {
    console.error('Error saving dictionary entry:', error);
    throw error;
  }
};

/**
 * Reset user progress to zero
 */
export const resetUserProgress = async (uid) => {
  try {
    if (!uid) {
      throw new Error('User ID is required');
    }

    const userRef = doc(db, 'users', uid);
    
    // Verify user exists before attempting to update
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      throw new Error(`User with ID ${uid} does not exist`);
    }

    console.log(`Resetting progress for user: ${uid}`);
    
    await updateDoc(userRef, {
      'progress.lessonsCompleted': [],
      // Reset per-lesson tile/sign progress (e.g. Alphabet 20/26 -> 0/26)
      'progress.lessonProgress': {},
      'progress.quizzesCompleted': [],
      'progress.examsPassed': [],
      'progress.totalPoints': 0,
      'progress.currentStreak': 0,
      'progress.longestStreak': 0,
      'progress.lastActivityDate': null,
      'stats.totalQuizzes': 0,
      'stats.totalExams': 0,
      'stats.averageQuizScore': 0,
      'stats.averageExamScore': 0,
      'stats.perfectScores': 0,
      'stats.totalTimeSpent': 0,
      'achievements': [],
      updatedAt: serverTimestamp()
    });

    console.log(`Successfully reset progress for user: ${uid}`);
  } catch (error) {
    console.error('Error resetting user progress:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      uid: uid
    });
    throw error;
  }
};
export const deleteDictionaryEntry = async (entryId, adminId = null, adminEmail = null, entryWord = null) => {
  try {
    const entryRef = doc(db, 'dictionary', entryId);
    
    // Get entry word before deleting if not provided
    let word = entryWord;
    if (!word) {
      const entryDoc = await getDoc(entryRef);
      if (entryDoc.exists()) {
        word = entryDoc.data().word || 'Untitled Entry';
      }
    }
    
    await deleteDoc(entryRef);
    
    // Log admin action
    if (adminId && adminEmail) {
      await logAdminAction(
        adminId,
        adminEmail,
        'delete',
        'dictionary',
        entryId,
        word || 'Untitled Entry'
      );
    }
  } catch (error) {
    console.error('Error deleting dictionary entry:', error);
    throw error;
  }
};

/**
 * Get all lessons
 */
export const getAllLessons = async () => {
  try {
    const lessonsRef = collection(db, 'lessons');
    const querySnapshot = await getDocs(lessonsRef);
    
    const lessons = [];
    querySnapshot.forEach((doc) => {
      lessons.push({ id: doc.id, ...doc.data() });
    });
    
    return lessons;
  } catch (error) {
    console.error('Error fetching lessons:', error);
    throw error;
  }
};

/**
 * Create or update lesson
 */
export const saveLesson = async (lessonId, lessonData, adminId = null, adminEmail = null) => {
  try {
    const lessonRef = doc(db, 'lessons', lessonId);
    const isUpdate = await getDoc(lessonRef).then(doc => doc.exists());
    
    await setDoc(lessonRef, {
      ...lessonData,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // Log admin action
    if (adminId && adminEmail) {
      await logAdminAction(
        adminId,
        adminEmail,
        isUpdate ? 'update' : 'create',
        'lesson',
        lessonId,
        lessonData.title || 'Untitled Lesson',
        isUpdate ? { updatedFields: Object.keys(lessonData) } : null
      );
    }
  } catch (error) {
    console.error('Error saving lesson:', error);
    throw error;
  }
};

/**
 * Delete lesson
 */
export const deleteLesson = async (lessonId, adminId = null, adminEmail = null, lessonTitle = null) => {
  try {
    const lessonRef = doc(db, 'lessons', lessonId);
    
    // Get lesson title before deleting if not provided
    let title = lessonTitle;
    if (!title) {
      const lessonDoc = await getDoc(lessonRef);
      if (lessonDoc.exists()) {
        title = lessonDoc.data().title || 'Untitled Lesson';
      }
    }
    
    await deleteDoc(lessonRef);
    
    // Log admin action
    if (adminId && adminEmail) {
      await logAdminAction(
        adminId,
        adminEmail,
        'delete',
        'lesson',
        lessonId,
        title || 'Untitled Lesson'
      );
    }
  } catch (error) {
    console.error('Error deleting lesson:', error);
    throw error;
  }
};

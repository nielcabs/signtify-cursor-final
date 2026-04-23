import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Log admin actions for audit trail
 * @param {string} adminId - Admin user ID
 * @param {string} adminEmail - Admin email
 * @param {string} action - Action type (create, update, delete)
 * @param {string} resourceType - Type of resource (lesson, quiz, exam)
 * @param {string} resourceId - ID of the resource
 * @param {string} resourceTitle - Title/name of the resource
 * @param {object} changes - Object describing what changed (optional)
 */
export const logAdminAction = async (adminId, adminEmail, action, resourceType, resourceId, resourceTitle, changes = null) => {
  try {
    const auditLogRef = collection(db, 'activityLogs');
    
    // Get admin display name if available
    let adminName = adminEmail;
    try {
      const adminDoc = await getDoc(doc(db, 'users', adminId));
      if (adminDoc.exists()) {
        const adminData = adminDoc.data();
        adminName = adminData.displayName || adminData.email || adminEmail;
      }
    } catch (e) {
      // Use email if we can't get display name
    }
    
    const logEntry = {
      type: 'admin_action',
      userId: adminId,
      userName: adminName,
      userEmail: adminEmail,
      action, // 'create', 'update', 'delete'
      resourceType, // 'lesson', 'quiz', 'exam', 'dictionary', 'user'
      resourceId,
      resourceTitle,
      changes, // Optional: object with before/after values
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent
    };
    
    await addDoc(auditLogRef, logEntry);
    console.log(`📝 Activity log: Admin ${adminName} ${action} ${resourceType} "${resourceTitle}"`);
  } catch (error) {
    // Don't throw error - logging failure shouldn't break the app
    console.error('Error logging admin action:', error);
  }
};

/**
 * Log user activity (quiz taken, exam taken, lesson completed, etc.)
 * @param {string} userId - User ID
 * @param {string} userEmail - User email
 * @param {string} action - Action type (quiz_taken, exam_taken, lesson_completed, etc.)
 * @param {string} resourceType - Type of resource (quiz, exam, lesson)
 * @param {string} resourceId - ID of the resource
 * @param {string} resourceTitle - Title/name of the resource
 * @param {object} details - Additional details (score, percentage, etc.)
 */
export const logUserActivity = async (userId, userEmail, action, resourceType, resourceId, resourceTitle, details = null) => {
  try {
    const activityLogRef = collection(db, 'activityLogs');
    
    // Get user display name if available
    let userName = userEmail;
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        userName = userData.displayName || userData.email || userEmail;
      }
    } catch (e) {
      // Use email if we can't get display name
    }
    
    const logEntry = {
      type: 'user_activity',
      userId,
      userName,
      userEmail,
      action, // 'quiz_taken', 'exam_taken', 'lesson_completed', etc.
      resourceType, // 'quiz', 'exam', 'lesson'
      resourceId,
      resourceTitle,
      details, // Optional: score, percentage, etc.
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent
    };
    
    await addDoc(activityLogRef, logEntry);
    console.log(`📝 Activity log: User ${userName} ${action} ${resourceType} "${resourceTitle}"`);
  } catch (error) {
    // Don't throw error - logging failure shouldn't break the app
    console.error('Error logging user activity:', error);
  }
};

/**
 * Get all activity logs (admin and user activities) for admin dashboard viewing
 */
export const getActivityLogs = async (limitCount = 100) => {
  try {
    const activityLogsRef = collection(db, 'activityLogs');
    const q = query(activityLogsRef, orderBy('timestamp', 'desc'), limit(limitCount));
    const querySnapshot = await getDocs(q);
    
    const logs = [];
    querySnapshot.forEach((doc) => {
      logs.push({ id: doc.id, ...doc.data() });
    });
    
    return logs;
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    throw error;
  }
};

/**
 * Get audit logs (for admin dashboard viewing) - Legacy function for backward compatibility
 */
export const getAuditLogs = async (limitCount = 100) => {
  return getActivityLogs(limitCount);
};


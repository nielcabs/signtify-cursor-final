import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp, increment, query, where, getDocs, collection } from 'firebase/firestore';
import { db } from './firebase';
import { logUserActivity } from './auditLogger';
import { createNotification, NOTIFICATION_TYPES } from '../notifications/notifications';

/**
 * Track lesson item progress (for sequential completion requirement)
 * @param {string} uid - User ID
 * @param {string} lessonId - Lesson ID or category
 * @param {string} itemId - Item identifier (e.g., 'A', 'Hello', etc.)
 * @param {number} itemIndex - Sequential index of the item
 * @param {number} totalItems - Total number of items in the lesson
 */
export const trackLessonItemProgress = async (uid, lessonId, itemId, itemIndex, totalItems) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.log('User document not found');
      return;
    }

    const userData = userDoc.data();
    const lessonProgress = userData.progress?.lessonProgress || {};
    const lessonKey = `lesson_${lessonId}`;
    
    // Get current progress for this lesson
    const currentProgress = lessonProgress[lessonKey] || {
      viewedItems: [],
      lastViewedIndex: -1,
      totalItems: totalItems
    };
    
    // Check if this item can be viewed (must be sequential)
    // Allow if it's the next item or if it's already been viewed
    const canView = itemIndex === currentProgress.lastViewedIndex + 1 || 
                    currentProgress.viewedItems.includes(itemId);
    
    if (!canView) {
      // Item is locked - user must view items in order
      return {
        success: false,
        message: `Please view items in order. Next item is at position ${currentProgress.lastViewedIndex + 2}`,
        canView: false
      };
    }
    
    // Update progress
    const updatedViewedItems = currentProgress.viewedItems.includes(itemId)
      ? currentProgress.viewedItems
      : [...currentProgress.viewedItems, itemId];
    
    const updatedLastViewedIndex = Math.max(currentProgress.lastViewedIndex, itemIndex);
    
    await updateDoc(userRef, {
      [`progress.lessonProgress.${lessonKey}`]: {
        viewedItems: updatedViewedItems,
        lastViewedIndex: updatedLastViewedIndex,
        totalItems: totalItems,
        updatedAt: serverTimestamp()
      },
      updatedAt: serverTimestamp()
    });
    
    return {
      success: true,
      canView: true,
      viewedItems: updatedViewedItems,
      lastViewedIndex: updatedLastViewedIndex,
      allItemsViewed: updatedViewedItems.length === totalItems
    };
  } catch (error) {
    console.error('Error tracking lesson item progress:', error);
    return {
      success: false,
      message: 'Error tracking progress',
      canView: false
    };
  }
};

/**
 * Get lesson progress for a user
 * @param {string} uid - User ID
 * @param {string} lessonId - Lesson ID or category
 */
export const getLessonProgress = async (uid, lessonId) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return null;
    }

    const userData = userDoc.data();
    const lessonProgress = userData.progress?.lessonProgress || {};
    const lessonKey = `lesson_${lessonId}`;
    
    return lessonProgress[lessonKey] || {
      viewedItems: [],
      lastViewedIndex: -1,
      totalItems: 0
    };
  } catch (error) {
    console.error('Error getting lesson progress:', error);
    return null;
  }
};

/**
 * Check if all lesson items have been viewed (required for completion)
 * @param {string} uid - User ID
 * @param {string} lessonId - Lesson ID or category
 * @param {number} totalItems - Total number of items in the lesson
 */
export const canCompleteLesson = async (uid, lessonId, totalItems) => {
  try {
    const progress = await getLessonProgress(uid, lessonId);
    
    if (!progress) {
      return false;
    }
    
    // Check if all items have been viewed
    return progress.viewedItems.length === totalItems && 
           progress.totalItems === totalItems;
  } catch (error) {
    console.error('Error checking lesson completion eligibility:', error);
    return false;
  }
};

/**
 * Initialize user profile when they first register
 */
export const initializeUserProfile = async (uid, email, displayName = '', { role = 'student' } = {}) => {
  try {
    const userRef = doc(db, 'users', uid);
    const initialProfile = {
      uid,
      email,
      displayName: displayName || email.split('@')[0],
      nickname: '',
      bio: '',
      avatarUrl: '',
      role,
      isAdmin: role === 'admin',
      isArchived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      progress: {
        lessonsCompleted: [],
        quizzesCompleted: [],
        examsPassed: [],
        totalPoints: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null
      },
      achievements: [],
      stats: {
        totalQuizzes: 0,
        totalExams: 0,
        averageQuizScore: 0,
        averageExamScore: 0,
        perfectScores: 0,
        totalTimeSpent: 0
      }
    };
    await setDoc(userRef, initialProfile);
    return initialProfile;
  } catch (error) {
    console.error('Error initializing user profile:', error);
    throw error;
  }
};

/**
 * Get user profile data from Firestore
 */
export const getUserProfile = async (uid) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      return userDoc.data();
    } else {
      console.log('No user profile found');
      return null;
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
};

/**
 * Check if user has passed at least one proficiency exam (`passed` on the stored result).
 * Used to unlock Dictionary access.
 */
export const hasPassedAnyProficiencyExam = async (uid) => {
  try {
    const profile = await getUserProfile(uid);
    const examsPassed = profile?.progress?.examsPassed || [];
    return examsPassed.some(e => e.passed === true);
  } catch (error) {
    console.error('Error checking passed exams:', error);
    return false;
  }
};

/**
 * Get dictionary category names unlocked by passed proficiency exams.
 * Maps lessonCategory (e.g. 'alphabet', 'greetings') to dictionary display name (e.g. 'Alphabet', 'Greetings').
 */
export const getPassedExamDictionaryCategories = async (uid) => {
  try {
    const profile = await getUserProfile(uid);
    const examsPassed = profile?.progress?.examsPassed || [];
    const passed = examsPassed.filter(e => e.passed === true);
    const categories = [...new Set(passed.map(e => e.lessonCategory).filter(Boolean))];
    return categories.map(cat => (cat && cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()) || cat);
  } catch (error) {
    console.error('Error getting passed exam categories:', error);
    return [];
  }
};

/**
 * Update user progress - Add completed lesson
 */
export const addCompletedLesson = async (uid, lessonId) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      'progress.lessonsCompleted': arrayUnion(lessonId)
    });
  } catch (error) {
    console.error('Error adding completed lesson:', error);
    throw error;
  }
};

/**
 * Update user progress - Add completed quiz
 */
export const addCompletedQuiz = async (uid, quizId, score, lessonCategory) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      'progress.quizzesCompleted': arrayUnion({
        quizId,
        score,
        lessonCategory,
        completedAt: new Date().toISOString()
      })
    });

    // Check if user should complete the lesson based on quiz score
    if (score >= 80) {
      await checkAndCompleteLesson(uid, lessonCategory, 'quiz', quizId, score);
    }
  } catch (error) {
    console.error('Error adding completed quiz:', error);
    throw error;
  }
};

/**
 * Update user progress - Add passed exam
 */
export const addPassedExam = async (uid, examId, score, lessonCategory) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      'progress.examsPassed': arrayUnion({
        examId,
        score,
        lessonCategory,
        passedAt: new Date().toISOString()
      })
    });

    // Check if user should complete the lesson based on exam score
    if (score >= 80) {
      await checkAndCompleteLesson(uid, lessonCategory, 'exam', examId, score);
    }
  } catch (error) {
    console.error('Error adding passed exam:', error);
    throw error;
  }
};

/**
 * Update user profile information
 */
export const updateUserProfile = async (uid, updates) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

/**
 * Save quiz result to Firestore
 */
export const saveQuizResult = async (uid, quizId, score, totalQuestions, lessonCategory) => {
  try {
    const userRef = doc(db, 'users', uid);
    const percentage = Math.round((score / totalQuestions) * 100);
    
    // Get quiz title for activity log
    let quizTitle = 'Quiz';
    try {
      const quizRef = doc(db, 'quizzes', quizId);
      const quizDoc = await getDoc(quizRef);
      if (quizDoc.exists()) {
        quizTitle = quizDoc.data().title || quizId;
      }
    } catch (e) {
      // Use quizId if we can't get title
      quizTitle = quizId;
    }
    
    // Get user email for activity log
    let userEmail = '';
    try {
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        userEmail = userDoc.data().email || '';
      }
    } catch (e) {
      // Continue without email
    }
    
    const quizResult = {
      quizId,
      score,
      totalQuestions,
      percentage,
      lessonCategory,
      completedAt: new Date().toISOString(),
      timestamp: Date.now()
    };

    // Update quiz completion
    await updateDoc(userRef, {
      'progress.quizzesCompleted': arrayUnion(quizResult),
      'stats.totalQuizzes': increment(1),
      'progress.totalPoints': increment(score * 10),
      updatedAt: serverTimestamp()
    });

    // Log user activity
    if (userEmail) {
      await logUserActivity(
        uid,
        userEmail,
        'quiz_taken',
        'quiz',
        quizId,
        quizTitle,
        { score, totalQuestions, percentage, lessonCategory }
      );
    }

    // Check if user should complete the lesson based on quiz score
    // Note: Quiz just needs to be taken, no score requirement
    await checkAndCompleteLesson(uid, lessonCategory, 'quiz', quizId, percentage);

    // Notify the user (non-blocking) — in-app bell notification
    createNotification({
      userId: uid,
      type: NOTIFICATION_TYPES.QUIZ_RESULT,
      title: `📝 Quiz completed: ${quizTitle}`,
      message: `You scored ${percentage}%.`,
      link: '/quizzes',
      meta: { quizId, lessonCategory, percentage },
    });

    // Calculate and update average quiz score
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const quizzes = userData.progress?.quizzesCompleted || [];
      const totalScore = quizzes.reduce((sum, q) => sum + q.percentage, 0);
      const avgScore = Math.round(totalScore / quizzes.length);
      
      await updateDoc(userRef, {
        'stats.averageQuizScore': avgScore
      });

      // Check for perfect score achievement
      if (percentage === 100) {
        await updateDoc(userRef, {
          'stats.perfectScores': increment(1)
        });
        await checkAndAwardAchievement(uid, 'perfect_quiz');
      }

      // Check for quiz milestones
      if (quizzes.length === 1) await checkAndAwardAchievement(uid, 'first_quiz');
      if (quizzes.length === 10) await checkAndAwardAchievement(uid, 'quiz_master');
    }

    return quizResult;
  } catch (error) {
    console.error('Error saving quiz result:', error);
    throw error;
  }
};

/**
 * Save exam result to Firestore
 */
export const saveExamResult = async (uid, examId, score, totalQuestions, lessonCategory) => {
  try {
    const userRef = doc(db, 'users', uid);
    const percentage = Math.round((score / totalQuestions) * 100);

    let examTitle = 'Exam';
    let passingScore = 80;
    try {
      const examRef = doc(db, 'exams', examId);
      const examDoc = await getDoc(examRef);
      if (examDoc.exists()) {
        const examData = examDoc.data();
        examTitle = examData.title || examId;
        if (Number.isFinite(examData.passingScore)) {
          passingScore = examData.passingScore;
        }
      }
    } catch (e) {
      examTitle = examId;
    }

    const passed = percentage >= passingScore;
    
    // Check if user has already passed this exam before
    const userDoc = await getDoc(userRef);
    let hasAlreadyPassed = false;
    let pointsToAward = score * 20;
    let userEmail = '';
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      userEmail = userData.email || '';
      const previousExams = userData.progress?.examsPassed || [];
      
      // Already passed if we stored a passing result for this exam id
      hasAlreadyPassed = previousExams.some((exam) =>
        String(exam.examId) === String(examId) && exam.passed === true
      );
      
      // If user has already passed, don't award points for retake
      if (hasAlreadyPassed && passed) {
        pointsToAward = 0;
        console.log(`User has already passed exam ${examId}. No points awarded for retake.`);
      }
    }
    
    const examResult = {
      examId,
      score,
      totalQuestions,
      percentage,
      passed,
      lessonCategory,
      completedAt: new Date().toISOString(),
      timestamp: Date.now(),
      pointsAwarded: pointsToAward,
      isRetake: hasAlreadyPassed && passed
    };

    // Log user activity
    if (userEmail) {
      await logUserActivity(
        uid,
        userEmail,
        'exam_taken',
        'exam',
        examId,
        examTitle,
        { score, totalQuestions, percentage, passed, lessonCategory }
      );
    }

    // Update exam completion
    if (passed) {
      await updateDoc(userRef, {
        'progress.examsPassed': arrayUnion(examResult),
        'stats.totalExams': increment(1),
        ...(pointsToAward > 0 ? { 'progress.totalPoints': increment(pointsToAward) } : {}),
        updatedAt: serverTimestamp()
      });

      // Check if user should complete the lesson based on exam score (only on first pass)
      if (passed && !hasAlreadyPassed) {
        await checkAndCompleteLesson(uid, lessonCategory, 'exam', examId, percentage);
      }
    } else {
      await updateDoc(userRef, {
        'stats.totalExams': increment(1),
        updatedAt: serverTimestamp()
      });
    }

    // Notify the user of the result (non-blocking)
    createNotification({
      userId: uid,
      type: NOTIFICATION_TYPES.EXAM_RESULT,
      title: passed ? `🎓 Exam passed: ${examTitle}` : `Exam result: ${examTitle}`,
      message: passed
        ? `You scored ${percentage}%. ${hasAlreadyPassed ? 'Nice retake!' : 'Congratulations!'}`
        : `You scored ${percentage}%. ${passingScore}% is required to pass — try again when you're ready.`,
      link: '/proficiency-exams',
    });

    // Calculate and update average exam score (reuse userDoc from earlier)
    if (userDoc.exists()) {
      const userData = userDoc.data();
      // Get updated exams list including the new result
      const exams = [...(userData.progress?.examsPassed || []), examResult];
      
      if (exams.length > 0) {
        const totalScore = exams.reduce((sum, e) => sum + e.percentage, 0);
        const avgScore = Math.round(totalScore / exams.length);
        
        await updateDoc(userRef, {
          'stats.averageExamScore': avgScore
        });
      }

      // Check for perfect score achievement (only on first pass)
      if (percentage === 100 && !hasAlreadyPassed) {
        await updateDoc(userRef, {
          'stats.perfectScores': increment(1)
        });
        await checkAndAwardAchievement(uid, 'perfect_exam');
      }

      // Check for exam milestones (only on first pass)
      if (passed && !hasAlreadyPassed) {
        const previousPassedExams = userData.progress?.examsPassed || [];
        const totalPassedExams = previousPassedExams.filter(e => e.passed).length + 1;
        if (totalPassedExams === 1) await checkAndAwardAchievement(uid, 'first_exam');
        if (totalPassedExams === 5) await checkAndAwardAchievement(uid, 'exam_expert');
      }
    }

    return examResult;
  } catch (error) {
    console.error('Error saving exam result:', error);
    throw error;
  }
};

/**
 * Check and award achievement
 */
export const checkAndAwardAchievement = async (uid, achievementId) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const achievements = userData.achievements || [];
      
      // Check if achievement already exists
      if (!achievements.find(a => a.id === achievementId)) {
        const achievement = ACHIEVEMENTS[achievementId];
        if (achievement) {
          const newAchievement = {
            ...achievement,
            unlockedAt: new Date().toISOString(),
            timestamp: Date.now()
          };
          
          await updateDoc(userRef, {
            achievements: arrayUnion(newAchievement),
            'progress.totalPoints': increment(achievement.points)
          });

          // Non-blocking notification
          createNotification({
            userId: uid,
            type: NOTIFICATION_TYPES.ACHIEVEMENT,
            title: `Achievement unlocked: ${achievement.title}`,
            message: `${achievement.icon} ${achievement.description} (+${achievement.points} pts)`,
            link: '/profile',
          });
        }
      }
    }
  } catch (error) {
    console.error('Error awarding achievement:', error);
    throw error;
  }
};

/**
 * Check and complete lesson if user has taken quiz (quiz alone is sufficient)
 * Passing exam (80%+) is optional but provides additional validation
 */
export const checkAndCompleteLesson = async (uid, lessonCategory, assessmentType, assessmentId, score) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.log('User document not found');
      return;
    }

    const userData = userDoc.data();
    const lessonsCompleted = userData.progress?.lessonsCompleted || [];
    
    // Get lessons for this category to find the lesson ID
    const lessonsRef = collection(db, 'lessons');
    const lessonsQuery = query(lessonsRef, where('category', '==', lessonCategory));
    const lessonsSnapshot = await getDocs(lessonsQuery);
    
    console.log(`Looking for lessons with category: ${lessonCategory}`);
    console.log(`Found ${lessonsSnapshot.size} lessons`);
    
    let lessonId;
    
    if (lessonsSnapshot.empty) {
      console.log('No lessons found for category:', lessonCategory);
      // Create a fallback lesson if none exists
      console.log('Creating fallback lesson for category:', lessonCategory);
      lessonId = `lesson_${lessonCategory}`;
      const lessonRef = doc(db, 'lessons', lessonId);
      await setDoc(lessonRef, {
        title: lessonCategory.charAt(0).toUpperCase() + lessonCategory.slice(1) + ' Lesson',
        category: lessonCategory,
        description: `Learn ${lessonCategory} sign language`,
        order: 1,
        createdAt: serverTimestamp()
      });
      console.log(`Created fallback lesson with ID: ${lessonId}`);
    } else {
      // Get the first lesson ID for this category (assuming one lesson per category)
      lessonId = lessonsSnapshot.docs[0].id;
    }
    
    console.log(`Using lessonId: ${lessonId}`);
    
    // Check if lesson is already completed
    if (lessonsCompleted.includes(lessonId)) {
      console.log('Lesson already completed:', lessonId);
      return;
    }

    // Check user's quiz and exam performance for this category
    const quizzesCompleted = userData.progress?.quizzesCompleted || [];
    const examsPassed = userData.progress?.examsPassed || [];
    
    // Check if quiz has been taken (any score, just needs to exist)
    const hasTakenQuiz = quizzesCompleted.some(quiz => 
      quiz.lessonCategory === lessonCategory
    );
    
    // Check if exam has been passed for this category (stored `passed` flag)
    const hasPassedExam = examsPassed.some(exam =>
      exam.lessonCategory === lessonCategory && exam.passed === true
    );

    console.log(`Checking lesson completion for ${lessonCategory}:`);
    console.log(`- Has taken quiz: ${hasTakenQuiz}`);
    console.log(`- Has passed exam: ${hasPassedExam}`);
    console.log(`- Quiz results:`, quizzesCompleted.filter(q => q.lessonCategory === lessonCategory));
    console.log(`- Exam results:`, examsPassed.filter(e => e.lessonCategory === lessonCategory));

    // Complete lesson if quiz is taken (quiz alone is sufficient for completion)
    // Passing exam (80%+) is optional but provides additional validation
    if (hasTakenQuiz) {
      // Get lesson title for activity log
      let lessonTitle = 'Lesson';
      try {
        const lessonRef = doc(db, 'lessons', lessonId);
        const lessonDoc = await getDoc(lessonRef);
        if (lessonDoc.exists()) {
          lessonTitle = lessonDoc.data().title || lessonId;
        }
      } catch (e) {
        lessonTitle = lessonId;
      }
      
      const userEmail = userData.email || '';
      
      await updateDoc(userRef, {
        'progress.lessonsCompleted': arrayUnion(lessonId),
        'progress.totalPoints': increment(50),
        updatedAt: serverTimestamp()
      });

      // Notify the user (non-blocking) — in-app bell notification
      createNotification({
        userId: uid,
        type: NOTIFICATION_TYPES.LESSON_COMPLETED,
        title: `${lessonTitle || 'Lesson'} completed`,
        message: hasPassedExam
          ? 'Great job — you finished the lesson and passed the proficiency exam.'
          : 'Great job — you finished the lesson.',
        link: '/quizzes',
        meta: { lessonId, lessonCategory, assessmentType, assessmentId },
      });

      // Log user activity
      if (userEmail) {
        await logUserActivity(
          uid,
          userEmail,
          'lesson_completed',
          'lesson',
          lessonId,
          lessonTitle
        );
      }

      if (hasPassedExam) {
        console.log(`Lesson ${lessonId} (${lessonCategory}) completed! Quiz taken and proficiency exam passed.`);
      } else {
        console.log(`Lesson ${lessonId} (${lessonCategory}) completed! Quiz taken.`);
      }

      // Check for lesson milestones
      if (lessonsCompleted.length === 0) {
        await checkAndAwardAchievement(uid, 'first_lesson');
      }
    } else {
      console.log(`Lesson ${lessonId} not yet completed. Quiz taken: ${hasTakenQuiz}`);
    }
  } catch (error) {
    console.error('Error checking lesson completion:', error);
  }
};
export const markLessonCompleted = async (uid, lessonId) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const lessonsCompleted = userData.progress?.lessonsCompleted || [];
      const userEmail = userData.email || '';
      
      if (!lessonsCompleted.includes(lessonId)) {
        // Get lesson title for activity log
        let lessonTitle = 'Lesson';
        try {
          const lessonRef = doc(db, 'lessons', lessonId);
          const lessonDoc = await getDoc(lessonRef);
          if (lessonDoc.exists()) {
            lessonTitle = lessonDoc.data().title || lessonId;
          }
        } catch (e) {
          lessonTitle = lessonId;
        }
        
        await updateDoc(userRef, {
          'progress.lessonsCompleted': arrayUnion(lessonId),
          'progress.totalPoints': increment(50),
          updatedAt: serverTimestamp()
        });

        // Log user activity
        if (userEmail) {
          await logUserActivity(
            uid,
            userEmail,
            'lesson_completed',
            'lesson',
            lessonId,
            lessonTitle
          );
        }

        // Check for lesson milestones
        if (lessonsCompleted.length === 0) {
          await checkAndAwardAchievement(uid, 'first_lesson');
        }
      }
    }
  } catch (error) {
    console.error('Error marking lesson as completed:', error);
    throw error;
  }
};

/**
 * Mark lesson as completed by category (finds or creates lesson document)
 */
export const markLessonCompletedByCategory = async (uid, lessonCategory) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.log('User document not found');
      return;
    }

    const userData = userDoc.data();
    const lessonsCompleted = userData.progress?.lessonsCompleted || [];
    
    // Get lessons for this category to find the lesson ID
    const lessonsRef = collection(db, 'lessons');
    const lessonsQuery = query(lessonsRef, where('category', '==', lessonCategory));
    const lessonsSnapshot = await getDocs(lessonsQuery);
    
    let lessonId;
    
    if (lessonsSnapshot.empty) {
      // Create a lesson document if none exists
      lessonId = `lesson_${lessonCategory}`;
      const lessonRef = doc(db, 'lessons', lessonId);
      await setDoc(lessonRef, {
        title: lessonCategory.charAt(0).toUpperCase() + lessonCategory.slice(1) + ' Lesson',
        category: lessonCategory,
        description: `Learn ${lessonCategory} sign language`,
        order: 1,
        createdAt: serverTimestamp()
      });
    } else {
      // Use the first lesson ID for this category
      lessonId = lessonsSnapshot.docs[0].id;
    }
    
    // Check if lesson is already completed
    if (lessonsCompleted.includes(lessonId)) {
      console.log('Lesson already completed:', lessonId);
      return;
    }
    
    // Mark lesson as completed
    await updateDoc(userRef, {
      'progress.lessonsCompleted': arrayUnion(lessonId),
      'progress.totalPoints': increment(50),
      updatedAt: serverTimestamp()
    });

    console.log(`Lesson ${lessonId} (${lessonCategory}) marked as completed!`);

    // Check for lesson milestones
    if (lessonsCompleted.length === 0) {
      await checkAndAwardAchievement(uid, 'first_lesson');
    }
  } catch (error) {
    console.error('Error marking lesson as completed by category:', error);
    throw error;
  }
};

// Achievement definitions
const ACHIEVEMENTS = {
  first_lesson: {
    id: 'first_lesson',
    title: 'First Steps',
    description: 'Complete your first lesson',
    icon: '📚',
    points: 50
  },
  first_quiz: {
    id: 'first_quiz',
    title: 'Quiz Beginner',
    description: 'Complete your first quiz',
    icon: '📝',
    points: 50
  },
  first_exam: {
    id: 'first_exam',
    title: 'Certified',
    description: 'Pass your first proficiency exam',
    icon: '🎓',
    points: 100
  },
  perfect_quiz: {
    id: 'perfect_quiz',
    title: 'Perfect Score',
    description: 'Get 100% on a quiz',
    icon: '⭐',
    points: 75
  },
  perfect_exam: {
    id: 'perfect_exam',
    title: 'Flawless Victory',
    description: 'Get 100% on an exam',
    icon: '🏆',
    points: 150
  },
  quiz_master: {
    id: 'quiz_master',
    title: 'Quiz Master',
    description: 'Complete 10 quizzes',
    icon: '🎯',
    points: 200
  },
  exam_expert: {
    id: 'exam_expert',
    title: 'Exam Expert',
    description: 'Pass 5 proficiency exams',
    icon: '👑',
    points: 300
  },
  dedicated_learner: {
    id: 'dedicated_learner',
    title: 'Dedicated Learner',
    description: 'Maintain a 7-day learning streak',
    icon: '🔥',
    points: 150
  }
};

export { ACHIEVEMENTS };

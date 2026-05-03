import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../auth/firebase';
import { useAuth } from '../auth/AuthContext';
import { getUserProfile } from '../auth/firestoreUtils';
import '../styles/pages/ProficiencyExams.css';

const CATEGORY_ICONS = {
  alphabet:             '🔤',
  greetings:            '👋',
  numbers:              '🔢',
  'daily-conversation': '💬',
  common:               '📘',
  phrases:              '🗣️',
  comprehensive:        '🏆',
};

const categoryIcon = (category) => CATEGORY_ICONS[category] || '🎓';

function ProficiencyExams() {
  const { currentUser } = useAuth();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [hasAnyLessonCompleted, setHasAnyLessonCompleted] = useState(false);

  useEffect(() => {
    loadExams();
    // Refresh when page becomes visible (user might have completed a lesson)
    const handleVisibilityChange = () => {
      if (!document.hidden && currentUser) {
        loadExams();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Also refresh periodically (every 5 seconds) when page is visible
    const interval = setInterval(() => {
      if (!document.hidden && currentUser) {
        loadExams();
      }
    }, 12000);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [currentUser]);

  const loadExams = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      
      // Load all exams
      const examsRef = collection(db, 'exams');
      const querySnapshot = await getDocs(examsRef);
      
      const examsData = [];
      querySnapshot.forEach((doc) => {
        examsData.push({ id: doc.id, ...doc.data() });
      });
      
      // Assign default order to exams without one (use creation order)
      examsData.forEach((exam, idx) => {
        if (exam.order === undefined || exam.order === null) {
          exam.order = idx + 1;
        }
      });
      
      // Sort exams by order field
      examsData.sort((a, b) => {
        return (a.order || 999) - (b.order || 999);
      });
      
      // Load user profile to check which exams are passed
      let passedExams = [];
      let hasCompletedLesson = false;
      if (currentUser) {
        const profile = await getUserProfile(currentUser.uid);
        const completedLessons = profile?.progress?.lessonsCompleted || [];
        hasCompletedLesson = completedLessons.length > 0;
        setHasAnyLessonCompleted(hasCompletedLesson);
        passedExams = profile?.progress?.examsPassed || [];
      }
      
      // Create a Set of passed exam IDs for O(1) lookups
      const passedExamIds = new Set(
        passedExams
          .filter(e => e.passed)
          .map(e => e.examId)
      );
      
      // Create a Map for quick exam result lookup
      const examResultsMap = new Map(
        passedExams.map(e => [e.examId, e])
      );
      
      // Determine which exams are unlocked
      // Track if previous exam in sequence was passed (for efficient sequential checking)
      let previousExamPassed = true;
      
      const examsWithStatus = examsData.map((exam, index) => {
        // Check if current exam is passed
        const isPassed = passedExamIds.has(exam.id);
        const currentExamResult = examResultsMap.get(exam.id);
        
        // Determine if exam is unlocked
        let isUnlocked = false;
        
        if (!hasCompletedLesson) {
          // Global lock until user has completed at least one lesson
          isUnlocked = false;
        } else if (index === 0) {
          // First exam unlocked once a lesson exists & is completed
          isUnlocked = true;
        } else if (isPassed) {
          // If already passed, always unlocked
          isUnlocked = true;
        } else {
          // Unlock if all previous exams in sequence are passed
          // We track this efficiently by checking if the immediate previous is unlocked AND passed
          isUnlocked = previousExamPassed;
        }
        
        // Update tracking for next iteration
        // The next exam can only be unlocked if this one is passed
        previousExamPassed = isPassed;
        
        return {
          ...exam,
          isUnlocked,
          isPassed,
          userScore: currentExamResult?.percentage || null
        };
      });
      
      setExams(examsWithStatus);
    } catch (error) {
      console.error('Error loading exams:', error);
      setLoadError(error?.message || 'Could not load exams. Check your connection and Firestore rules.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="proficiency-page">
        <div className="loading-container">
          <p>Loading exams...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="proficiency-page">
      <div className="proficiency-header">
        <h1>Proficiency Exams</h1>
        <p>Progressive path — pass each exam (usually 80%+) to unlock the next. Retakes stay available after you pass.</p>
      </div>

      {loadError && (
        <div className="exam-requirements card" style={{ borderColor: '#e74c3c' }}>
          <h2>Could not refresh exams</h2>
          <p>{loadError}</p>
          <button type="button" className="btn-primary" style={{ marginTop: '0.75rem' }} onClick={() => loadExams()}>
            Try again
          </button>
        </div>
      )}
      
      {!hasAnyLessonCompleted && (
        <div className="exam-requirements card">
          <h2>🔐 Locked for New Learners</h2>
          <p>Proficiency Exams unlock only after you complete your first lesson.</p>
          <p style={{ marginTop: '0.5rem', color: '#555' }}>
            Start with the <strong>Alphabet</strong> lesson, finish all tiles A–Z, and mark it complete to unlock your first Mini Quiz and Proficiency Exam.
          </p>
        </div>
      )}
      
      {/* 
      <div className="exam-requirements card">
        <h2>About Proficiency Exams</h2>
        <p>Proficiency exams are comprehensive tests designed to certify your sign language knowledge in specific areas.</p>
        <p style={{ marginTop: '1rem', fontWeight: '500' }}>
          <strong>Sequential Progression:</strong> You must pass each exam in order. 
          Complete Exam 1 with 80%+ to unlock Exam 2, and so on. Already passed exams remain accessible for retakes.
        </p>
      </div>
      */}

      {exams.length === 0 && !loadError ? (
        <div className="no-exams card">
          <h2>📭 No exams in Firestore yet</h2>
          <p>Ask a teacher to add exams in <strong>Teacher Dashboard → Exams</strong>, or run the repo seed script <code>scripts/seedExams.cjs</code> if you use the default exam set.</p>
        </div>
      ) : exams.length > 0 ? (
        <div className="exams-grid">
          {exams.map((exam) => (
            <div key={exam.id} className={`exam-card card ${!exam.isUnlocked ? 'locked' : ''} ${exam.isPassed ? 'passed' : ''}`}>
              <div className="exam-status-badges">
                {!exam.isUnlocked && <span className="lock-badge">🔒 Locked</span>}
                {exam.isPassed && <span className="pass-badge">✅ Passed</span>}
              </div>
              
              <div className="exam-icon">
                {!exam.isUnlocked ? '🔒' : categoryIcon(exam.category)}
              </div>
              <h2>{exam.title || 'Proficiency Exam'}</h2>
              <p>{exam.description || 'Test your proficiency'}</p>
              
              {exam.isPassed && exam.userScore && (
                <div className="user-score-display">
                  <strong>Your Score: {exam.userScore}%</strong>
                </div>
              )}
              
              <div className="exam-stats">
                {exam.category && (
                  <div className="stat">
                    <span className="stat-label">Category:</span>
                    <span className="stat-value">{exam.category}</span>
                  </div>
                )}
                {exam.passingScore && (
                  <div className="stat">
                    <span className="stat-label">Passing Score:</span>
                    <span className="stat-value">{exam.passingScore}%</span>
                  </div>
                )}
                <div className="stat">
                  <span className="stat-label">Questions:</span>
                  <span className="stat-value">
                    {exam.questions?.length || 0}
                  </span>
                </div>
                {exam.timeLimit && (
                  <div className="stat">
                    <span className="stat-label">Time Limit:</span>
                    <span className="stat-value">{exam.timeLimit} min</span>
                  </div>
                )}
              </div>

              {!exam.isUnlocked ? (
                <div className="locked-message">
                  <p>{!hasAnyLessonCompleted 
                    ? '🔒 Complete your first lesson to unlock Proficiency Exams'
                    : '🔒 Complete the previous exam with 80%+ to unlock'}</p>
                  <button disabled className="btn-locked">Locked</button>
                </div>
              ) : (
                <Link to={`/exam/${exam.id}`}>
                  <button className={exam.isPassed ? 'btn-retake' : ''}>
                    {exam.isPassed ? 'Retake Exam' : 'Take Exam'}
                  </button>
                </Link>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default ProficiencyExams;

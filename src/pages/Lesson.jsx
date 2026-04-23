import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { getLessonById, getAllLessons } from '../auth/adminUtils';
import { useAuth } from '../auth/AuthContext';
import { 
  markLessonCompleted, 
  getUserProfile, 
  trackLessonItemProgress, 
  getLessonProgress,
  canCompleteLesson 
} from '../auth/firestoreUtils';
import { useToast } from '../components/ui/Toast';
import { createNotification, NOTIFICATION_TYPES } from '../notifications/notifications';
import '../styles/pages/Lesson.css';

function Lesson() {
  const toast = useToast();
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [lesson, setLesson] = useState(null);
  const [allLessons, setAllLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(null); // null=checking, true=allow, false=redirecting
  const [selectedSignIndex, setSelectedSignIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [lessonProgress, setLessonProgress] = useState(null);
  const [canComplete, setCanComplete] = useState(false);

  useEffect(() => {
    loadLesson();
  }, [lessonId]);

  const loadLesson = async () => {
    try {
      setLoading(true);
      setAccessAllowed(null);
      const [lessonData, allLessonsData] = await Promise.all([
        getLessonById(lessonId),
        getAllLessons()
      ]);
      
      if (!lessonData) {
        navigate('/');
        return;
      }

      // Sort all lessons by order (needed for prerequisite checks + next/prev)
      allLessonsData.sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 999;
        const orderB = b.order !== undefined ? b.order : 999;
        return orderA - orderB;
      });

      // Check if lesson is already completed
      if (currentUser) {
        const userProfile = await getUserProfile(currentUser.uid);
        const completedLessons = userProfile?.progress?.lessonsCompleted || [];
        setCompleted(completedLessons.includes(lessonId));

        // Sequential lesson access: user must complete previous lesson first
        const currentIdx = allLessonsData.findIndex(l => l.id === lessonId);
        if (currentIdx > 0) {
          const prev = allLessonsData[currentIdx - 1];
          const prevCompleted = prev?.id ? completedLessons.includes(prev.id) : true;
          if (!prevCompleted) {
            setAccessAllowed(false);
            // Redirect user to the required previous lesson
            navigate(`/lesson/${prev.id}`);
            return;
          }
        }
        
        // Load lesson progress for sequential completion
        if (lessonData && lessonData.signs) {
          const progress = await getLessonProgress(currentUser.uid, lessonId);
          setLessonProgress(progress);
          
          // Check if can complete
          const canCompleteCheck = await canCompleteLesson(
            currentUser.uid, 
            lessonId, 
            lessonData.signs.length
          );
          setCanComplete(canCompleteCheck);
        }
        setAccessAllowed(true);
      } else {
        // Not logged in: allow viewing content but progression/quiz locks are handled elsewhere
        setAccessAllowed(true);
      }

      setLesson(lessonData);
      setAllLessons(allLessonsData);
      setSelectedSignIndex(0);
    } catch (error) {
      console.error('Error loading lesson:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleNextSign = async () => {
    if (lesson && selectedSignIndex < (lesson.signs?.length || 0) - 1) {
      const nextIndex = selectedSignIndex + 1;
      const nextSign = lesson.signs[nextIndex];
      
      // Track progress if user is logged in
      if (currentUser && nextSign) {
        const result = await trackLessonItemProgress(
          currentUser.uid,
          lesson.id,
          nextSign.id || nextSign.word || `sign_${nextIndex}`,
          nextIndex,
          lesson.signs.length
        );
        
        if (result.success && result.canView) {
          setSelectedSignIndex(nextIndex);
          // Reload progress
          const progress = await getLessonProgress(currentUser.uid, lesson.id);
          setLessonProgress(progress);
          // Auto-complete lesson when all signs have been viewed
          if (result.allItemsViewed && !completed) {
            try {
              await markLessonCompleted(currentUser.uid, lesson.id);
              setCompleted(true);
              toast.success('🎉 Lesson completed! +50 points earned.', { duration: 5000 });
              createNotification({
                userId: currentUser.uid,
                type: NOTIFICATION_TYPES.LESSON_COMPLETED,
                title: `${lesson.title || 'Lesson'} completed`,
                message: 'Great job finishing this lesson.',
                link: '/quizzes',
              });
            } catch (err) {
              console.error('Error auto-completing lesson:', err);
            }
          }
        } else if (!result.canView) {
          toast.warning(result.message || 'Please view signs in sequential order.');
          return;
        }
      } else {
        setSelectedSignIndex(nextIndex);
      }
    }
  };

  const handlePrevSign = () => {
    if (selectedSignIndex > 0) {
      setSelectedSignIndex(selectedSignIndex - 1);
    }
  };

  const handleSignView = async (signIndex) => {
    if (!currentUser || !lesson || !lesson.signs) return;
    
    const sign = lesson.signs[signIndex];
    if (!sign) return;
    
    // Track progress
    const result = await trackLessonItemProgress(
      currentUser.uid,
      lesson.id,
      sign.id || sign.word || `sign_${signIndex}`,
      signIndex,
      lesson.signs.length
    );
    
    if (result.success && result.canView) {
      setSelectedSignIndex(signIndex);
      // Reload progress
      const progress = await getLessonProgress(currentUser.uid, lesson.id);
      setLessonProgress(progress);
      // Auto-complete lesson when all signs have been viewed
      if (result.allItemsViewed && !completed) {
        try {
          await markLessonCompleted(currentUser.uid, lesson.id);
          setCompleted(true);
          toast.success('🎉 Lesson completed! +50 points earned.', { duration: 5000 });
          createNotification({
            userId: currentUser.uid,
            type: NOTIFICATION_TYPES.LESSON_COMPLETED,
            title: `${lesson.title || 'Lesson'} completed`,
            message: 'Great job finishing this lesson.',
            link: '/quizzes',
          });
        } catch (err) {
          console.error('Error auto-completing lesson:', err);
        }
      }
    } else if (!result.canView) {
      toast.warning(result.message || 'Please view signs in sequential order.');
    }
  };

  // Find next and previous lessons
  const currentLessonIndex = allLessons.findIndex(l => l.id === lessonId);
  const prevLesson = currentLessonIndex > 0 ? allLessons[currentLessonIndex - 1] : null;
  const nextLesson = currentLessonIndex < allLessons.length - 1 ? allLessons[currentLessonIndex + 1] : null;

  if (loading) {
    return (
      <div className="lesson-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading lesson...</p>
        </div>
      </div>
    );
  }

  if (accessAllowed === false) {
    return null; // redirecting to prerequisite lesson
  }

  if (!lesson) {
    return (
      <div className="lesson-page">
        <div className="error-container card">
          <h2>Lesson Not Found</h2>
          <p>The lesson you're looking for doesn't exist.</p>
          <Link to="/">
            <button>Back to Lessons</button>
          </Link>
        </div>
      </div>
    );
  }

  const currentSign = lesson.signs?.[selectedSignIndex];
  const isLastSign = selectedSignIndex === (lesson.signs?.length || 0) - 1;

  return (
    <div className="lesson-page">
      <div className="lesson-header">
        <Link to="/" className="back-link">← Back to Lessons</Link>
        <div className="lesson-title-section">
          <span className="lesson-icon-large">{lesson.icon || '✋'}</span>
          <div>
            <h1>{lesson.title}</h1>
            <p className="lesson-description">{lesson.description}</p>
          </div>
        </div>
        <div className="lesson-progress">
          <span>Sign {selectedSignIndex + 1} of {lesson.signs?.length || 0}</span>
          {lessonProgress && (
            <span style={{ marginLeft: '1rem', color: '#666', fontSize: '0.9rem' }}>
              ({lessonProgress.viewedItems?.length || 0} / {lesson.signs?.length || 0} viewed)
            </span>
          )}
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${((selectedSignIndex + 1) / (lesson.signs?.length || 1)) * 100}%` }}
            ></div>
          </div>
          {!canComplete && lesson.signs && lesson.signs.length > 0 && (
            <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9rem', textAlign: 'center' }}>
              View all signs in order to complete this lesson
            </p>
          )}
        </div>
      </div>

      <div className="lesson-content">
        {/* Sign Selection Grid */}
        <div className="sign-grid">
          {lesson.signs?.map((sign, index) => {
            const isLocked = lessonProgress && index > (lessonProgress.lastViewedIndex ?? -1) + 1;
            const isViewed = lessonProgress?.viewedItems?.includes(sign.id || sign.word || `sign_${index}`);
            return (
              <button
                key={index}
                className={`sign-button ${selectedSignIndex === index ? 'active' : ''} ${isLocked ? 'locked' : ''} ${isViewed ? 'viewed' : ''}`}
                onClick={() => handleSignView(index)}
                disabled={isLocked}
                title={isLocked ? 'View signs in order' : ''}
              >
                <span className="sign-icon">{sign.handIcon || '✋'}</span>
                <span className="sign-name">{sign.name}</span>
                {isLocked && <span className="lock-icon">🔒</span>}
                {isViewed && !isLocked && <span className="check-icon">✓</span>}
              </button>
            );
          })}
        </div>

        {/* Current Sign Display */}
        {currentSign && (
          <div className="sign-display card">
            <div className="sign-header">
              <h2>
                <span className="sign-hand-icon">{currentSign.handIcon || '✋'}</span>
                {currentSign.name}
              </h2>
            </div>

            <div className="sign-visual">
              {currentSign.imageUrl ? (
                <img 
                  src={currentSign.imageUrl} 
                  alt={`Sign for ${currentSign.name}`}
                  className="sign-image"
                />
              ) : (
                <div className="sign-placeholder">
                  <span className="placeholder-icon">{currentSign.handIcon || '✋'}</span>
                  <p>Sign for "{currentSign.name}"</p>
                </div>
              )}
            </div>

            {currentSign.videoUrl && (
              <div className="sign-video">
                <a 
                  href={currentSign.videoUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="video-link"
                >
                  🎥 Watch Video Tutorial
                </a>
              </div>
            )}

            <div className="sign-description">
              <h3>How to sign "{currentSign.name}"</h3>
              <p>{currentSign.description || `This is the sign for "${currentSign.name}". Practice this gesture slowly and carefully to build muscle memory.`}</p>
              
              {currentSign.tips && (
                <div className="sign-tips">
                  <h4>💡 Tips</h4>
                  <p>{currentSign.tips}</p>
                </div>
              )}
            </div>

            <div className="sign-navigation">
              <button 
                className="nav-btn prev"
                onClick={handlePrevSign}
                disabled={selectedSignIndex === 0}
              >
                ← Previous
              </button>
              <button 
                className="nav-btn next"
                onClick={handleNextSign}
                disabled={isLastSign}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lesson Actions */}
      <div className="lesson-actions">
        <div className="lesson-nav-buttons">
          {prevLesson && (
            <Link to={`/lesson/${prevLesson.id}`}>
              <button className="secondary">← {prevLesson.title}</button>
            </Link>
          )}
        </div>
        
        <div className="lesson-complete-section">
          {completed && (
            <div className="completed-message">
              <span>🎉 Lesson Completed! +50 points</span>
            </div>
          )}
          {!completed && lesson?.signs && lesson.signs.length > 0 && (
            <p style={{ marginBottom: '10px', color: '#666', fontSize: '0.9rem' }}>
              View all signs in order — the lesson will complete automatically.
            </p>
          )}
          
          <Link to={`/practice/${lesson.id}`}>
            <button className="practice-btn">Practice This Lesson 🎯</button>
          </Link>
        </div>

        <div className="lesson-nav-buttons">
          {nextLesson && (completed ? (
            <Link to={`/lesson/${nextLesson.id}`}>
              <button className="secondary">Next: {nextLesson.title} →</button>
            </Link>
          ) : (
            <button
              className="secondary"
              disabled
              style={{ opacity: 0.7, cursor: 'not-allowed' }}
              title="Complete this lesson to unlock the next one"
            >
              🔒 Next: {nextLesson.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Lesson;


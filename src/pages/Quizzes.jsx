import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../auth/firebase';
import { useAuth } from '../auth/AuthContext';
import { getAllLessons } from '../auth/adminUtils';
import { getUserProfile } from '../auth/firestoreUtils';
import '../styles/pages/ProficiencyExams.css';

function Quizzes() {
  const { currentUser } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [lessonLoading, setLessonLoading] = useState(true);
  const [lessonError, setLessonError] = useState('');
  const [orderedCategories, setOrderedCategories] = useState([]);
  const [categoryLessons, setCategoryLessons] = useState({});
  const [completedLessons, setCompletedLessons] = useState([]);

  useEffect(() => {
    loadQuizzes();
  }, []);

  useEffect(() => {
    loadLessonProgress();
    // Refresh when page becomes visible (user might have completed a lesson)
    const handleVisibilityChange = () => {
      if (!document.hidden && currentUser) {
        loadLessonProgress();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Also refresh periodically (every 5 seconds) when page is visible
    const interval = setInterval(() => {
      if (!document.hidden && currentUser) {
        loadLessonProgress();
      }
    }, 5000);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [currentUser]);

  const loadQuizzes = async () => {
    try {
      setLoading(true);
      const quizzesRef = collection(db, 'quizzes');
      const querySnapshot = await getDocs(quizzesRef);
      
      const quizzesData = [];
      querySnapshot.forEach((doc) => {
        quizzesData.push({ id: doc.id, ...doc.data() });
      });
      
      setQuizzes(quizzesData);
    } catch (error) {
      console.error('Error loading quizzes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLessonProgress = async () => {
    try {
      setLessonLoading(true);
      setLessonError('');

      const lessons = await getAllLessons();
      lessons.sort((a, b) => {
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        return orderA - orderB;
      });

      const categoryOrder = [];
      const catLessonsMap = {};

      lessons.forEach((lesson) => {
        if (!lesson.category) return;
        if (!catLessonsMap[lesson.category]) {
          catLessonsMap[lesson.category] = [];
          categoryOrder.push(lesson.category);
        }
        catLessonsMap[lesson.category].push(lesson.id);
      });

      setOrderedCategories(categoryOrder);
      setCategoryLessons(catLessonsMap);

      if (!currentUser) {
        setCompletedLessons([]);
        return;
      }

      const profile = await getUserProfile(currentUser.uid);
      const completed = profile?.progress?.lessonsCompleted || [];
      setCompletedLessons(completed);
    } catch (error) {
      console.error('Error loading lesson progress:', error);
      setLessonError('Unable to verify lesson progress. Quizzes may be locked.');
      setOrderedCategories([]);
      setCategoryLessons({});
    } finally {
      setLessonLoading(false);
    }
  };

  const categories = ['All', ...new Set(quizzes.map(q => q.category).filter(Boolean))];
  
  const filteredQuizzes = selectedCategory === 'All' 
    ? quizzes 
    : quizzes.filter(q => q.category === selectedCategory);

  const completedCategorySet = useMemo(() => {
    const set = new Set();
    Object.entries(categoryLessons).forEach(([category, lessonIds]) => {
      if (lessonIds.every(id => completedLessons.includes(id))) {
        set.add(category);
      }
    });
    return set;
  }, [categoryLessons, completedLessons]);

  const isCategoryUnlocked = (category) => {
    // Global lock: first-time users must complete at least one lesson
    if (!completedLessons.length) return false;
    if (!category) return true;
    if (!orderedCategories.length) {
      // default: only alphabet before lessons load
      return category === 'alphabet';
    }
    const idx = orderedCategories.indexOf(category);
    if (idx === -1) return true; // Category not in ordered list, allow access
    
    // First category (alphabet) is always unlocked
    if (idx === 0) return true;
    
    // For subsequent categories, ALL previous categories must be completed
    // Check that all categories before this one are completed
    for (let i = 0; i < idx; i++) {
      const prevCategory = orderedCategories[i];
      if (!completedCategorySet.has(prevCategory)) {
        return false; // Previous category not completed, lock this quiz
      }
    }
    
    return true; // All previous categories completed, unlock this quiz
  };

  const formatCategoryLabel = (category) => {
    if (!category) return 'previous lesson';
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  const getRequiredCategoryForUnlock = (category) => {
    if (!category || !orderedCategories.length) return null;
    const idx = orderedCategories.indexOf(category);
    if (idx <= 0) return null; // First category or not found
    
    // Find the first incomplete category before this one
    for (let i = 0; i < idx; i++) {
      const prevCategory = orderedCategories[i];
      if (!completedCategorySet.has(prevCategory)) {
        return prevCategory;
      }
    }
    return null; // All previous categories completed
  };

  if (loading) {
    return (
      <div className="proficiency-page">
        <div className="loading-container">
          <p>Loading quizzes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="proficiency-page">
      <div className="proficiency-header">
        <h1>Mini Quizzes</h1>
        <p>Test your knowledge with our collection of quizzes</p>
      </div>

      {categories.length > 1 && (
        <div className="category-filters card">
          {categories.map(category => (
            <button
              key={category}
              className={`filter-button ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: '20px', background: '#f5f7fb' }}>
        <h3 style={{ marginTop: 0 }}>🔐 Lesson-locked Quizzes</h3>
        <p style={{ marginBottom: '10px', color: '#555' }}>
          {completedLessons.length === 0
            ? 'Mini quizzes are locked until you complete your first lesson. Finish Alphabet (or any lesson) to unlock your first Mini Quiz and Proficiency Exam.'
            : 'Mini quizzes unlock sequentially. Finish Alphabet first, then complete each category lesson to access the next quiz.'}
        </p>
        {!currentUser && (
          <p style={{ color: '#c0392b', marginBottom: 0 }}>
            Sign in and study the lessons to unlock more quizzes.
          </p>
        )}
        {lessonLoading && (
          <p style={{ color: '#7f8c8d', marginBottom: 0 }}>Checking your lesson progress...</p>
        )}
        {lessonError && (
          <p style={{ color: '#e67e22', marginBottom: 0 }}>{lessonError}</p>
        )}
      </div>

      {filteredQuizzes.length === 0 ? (
        <div className="no-quizzes card">
          <h2>📭 No Quizzes Available</h2>
          <p>There are no quizzes available yet. Check back later or contact an administrator to add quizzes.</p>
        </div>
      ) : (
        <div className="exams-grid">
          {filteredQuizzes.map((quiz, index) => {
            const unlocked = isCategoryUnlocked(quiz.category);
            return (
            <div 
              key={quiz.id} 
              className={`exam-card card ${unlocked ? '' : 'locked-quiz'}`}
              style={{ opacity: unlocked ? 1 : 0.55 }}
            >
              <div className="exam-icon" style={{ marginBottom: '1.5rem' }}>
                {quiz.category === 'alphabet' ? (
                  <img 
                    src="/images/Alphabet_thumbail2.png"
                    alt="Alphabet Quiz"
                    style={{ 
                      width: '100%', 
                      maxWidth: '300px',
                      height: 'auto',
                      maxHeight: '200px',
                      objectFit: 'contain', 
                      borderRadius: '8px',
                      display: 'block',
                      margin: '0 auto'
                    }}
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    maxWidth: '300px',
                    height: '200px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '5rem',
                    background: 'linear-gradient(135deg, #2ecc71, #27ae60)',
                    borderRadius: '8px',
                    margin: '0 auto'
                  }}>
                    👋
                  </div>
                )}
              </div>
              <h2>{quiz.title || 'Quiz'}</h2>
              <p>{quiz.description || 'Test your knowledge'}</p>
              
              <div className="exam-stats">
                {quiz.category && (
                  <div className="stat">
                    <span className="stat-label">Category:</span>
                    <span className="stat-value">{quiz.category}</span>
                  </div>
                )}
                {quiz.difficulty && (
                  <div className="stat">
                    <span className="stat-label">Difficulty:</span>
                    <span className={`stat-value ${quiz.difficulty}`}>
                      {quiz.difficulty}
                    </span>
                  </div>
                )}
                <div className="stat">
                  <span className="stat-label">Questions:</span>
                  <span className="stat-value">
                    {quiz.questions?.length || 0}
                  </span>
                </div>
              </div>

              {unlocked ? (
                <Link to={`/quiz/${quiz.id}`}>
                  <button>Take Quiz</button>
                </Link>
              ) : (
                <button
                  disabled
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px dashed #bdc3c7',
                    background: '#f0f3fa',
                    color: '#7f8c8d',
                    cursor: 'not-allowed'
                  }}
                >
                  {(() => {
                    if (!completedLessons.length) {
                      return '🔒 Complete your first lesson to unlock Mini Quizzes';
                    }
                    const requiredCategory = getRequiredCategoryForUnlock(quiz.category);
                    if (requiredCategory) {
                      return `🔒 Complete the ${formatCategoryLabel(requiredCategory)} lesson first`;
                    }
                    return `🔒 Complete previous lessons to unlock`;
                  })()}
                </button>
              )}
            </div>
          )})}
        </div>
      )}
    </div>
  );
}

export default Quizzes;

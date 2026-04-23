import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllLessons } from '../auth/adminUtils';
import { useAuth } from '../auth/AuthContext';
import { getUserProfile } from '../auth/firestoreUtils';
import '../styles/pages/Lesson.css';

function Lessons() {
  const { currentUser } = useAuth();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completedLessons, setCompletedLessons] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categoryOptions = [
    { value: 'all', label: 'All Lessons' },
    { value: 'alphabet', label: 'Alphabet' },
    { value: 'greetings', label: 'Greetings' },
    { value: 'daily-conversation', label: 'Daily Conversation Signs' },
    { value: 'numbers', label: 'Numbers' },
    { value: 'common', label: 'Common Words' },
    { value: 'phrases', label: 'Phrases' },
    { value: 'emotions', label: 'Emotions' },
    { value: 'family', label: 'Family' },
    { value: 'food', label: 'Food & Drinks' },
    { value: 'colors', label: 'Colors' },
    { value: 'animals', label: 'Animals' }
  ];

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load lessons
      const lessonsData = await getAllLessons();
      lessonsData.sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 999;
        const orderB = b.order !== undefined ? b.order : 999;
        return orderA - orderB;
      });
      setLessons(lessonsData);

      // Load user progress
      if (currentUser) {
        const profile = await getUserProfile(currentUser.uid);
        if (profile?.progress?.lessonsCompleted) {
          setCompletedLessons(profile.progress.lessonsCompleted);
        }
      }
    } catch (error) {
      console.error('Error loading lessons:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLessons = selectedCategory === 'all' 
    ? lessons 
    : lessons.filter(lesson => lesson.category === selectedCategory);

  const completedCount = lessons.filter(lesson => completedLessons.includes(lesson.id)).length;
  const progressPercentage = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  if (loading) {
    return (
      <div className="lessons-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading lessons...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lessons-page">
      <div className="lessons-header">
        <h1>📚 Learn Sign Language</h1>
        <p>Master sign language step by step with our interactive lessons</p>
        
        <div className="progress-overview card">
          <div className="progress-stats">
            <div className="progress-stat">
              <span className="stat-number">{completedCount}</span>
              <span className="stat-label">Completed</span>
            </div>
            <div className="progress-stat">
              <span className="stat-number">{lessons.length}</span>
              <span className="stat-label">Total Lessons</span>
            </div>
            <div className="progress-stat">
              <span className="stat-number">{progressPercentage}%</span>
              <span className="stat-label">Progress</span>
            </div>
          </div>
          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="lessons-filter">
        <label>Filter by Category:</label>
        <select 
          value={selectedCategory} 
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          {categoryOptions.map((cat) => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {filteredLessons.length === 0 ? (
        <div className="no-lessons card">
          <div className="empty-icon">📭</div>
          <h3>No lessons available</h3>
          <p>
            {selectedCategory === 'all' 
              ? 'Check back soon for new lessons!' 
              : `No lessons found in the ${categoryOptions.find(c => c.value === selectedCategory)?.label} category.`}
          </p>
        </div>
      ) : (
        <div className="lessons-grid">
          {filteredLessons.map((lesson, index) => {
            const isCompleted = completedLessons.includes(lesson.id);
            return (
              <Link 
                to={`/lesson/${lesson.id}`} 
                key={lesson.id} 
                className={`lesson-card card ${isCompleted ? 'completed' : ''}`}
              >
                <div className="lesson-card-header">
                  <span className="lesson-number">#{lesson.order || index + 1}</span>
                  {isCompleted && <span className="completed-badge">✓ Completed</span>}
                </div>
                <div className="lesson-card-icon">
                  {lesson.icon || '✋'}
                </div>
                <h3 className="lesson-card-title">{lesson.title}</h3>
                <p className="lesson-card-description">{lesson.description}</p>
                <div className="lesson-card-meta">
                  <span className="lesson-category">
                    {categoryOptions.find(c => c.value === lesson.category)?.label || lesson.category}
                  </span>
                  <span className="lesson-signs-count">
                    {lesson.signs?.length || 0} signs
                  </span>
                </div>
                <div className="lesson-card-action">
                  <span className="start-lesson-btn">
                    {isCompleted ? 'Review Lesson →' : 'Start Lesson →'}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Lessons;


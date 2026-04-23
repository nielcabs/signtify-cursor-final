import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { getLessonById, getAllLessons } from '../auth/adminUtils';
import { useAuth } from '../auth/AuthContext';
import '../styles/pages/Quiz.css';

function Practice() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [lesson, setLesson] = useState(null);
  const [allLessons, setAllLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [practiceMode, setPracticeMode] = useState('select'); // 'select', 'practice', 'results'

  useEffect(() => {
    if (lessonId) {
      loadLesson();
    } else {
      loadAllLessons();
    }
  }, [lessonId]);

  const loadLesson = async () => {
    try {
      setLoading(true);
      const lessonData = await getLessonById(lessonId);
      
      if (!lessonData || !lessonData.signs || lessonData.signs.length === 0) {
        navigate('/practice');
        return;
      }

      setLesson(lessonData);
      generateQuestions(lessonData);
    } catch (error) {
      console.error('Error loading lesson:', error);
      navigate('/practice');
    } finally {
      setLoading(false);
    }
  };

  const loadAllLessons = async () => {
    try {
      setLoading(true);
      const lessonsData = await getAllLessons();
      lessonsData.sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 999;
        const orderB = b.order !== undefined ? b.order : 999;
        return orderA - orderB;
      });
      setAllLessons(lessonsData.filter(l => l.signs && l.signs.length > 0));
    } catch (error) {
      console.error('Error loading lessons:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateQuestions = (lessonData) => {
    const signs = lessonData.signs || [];
    if (signs.length < 2) return;

    // Generate questions from signs
    const generatedQuestions = signs.map((sign, index) => {
      // Get wrong options from other signs
      const otherSigns = signs.filter((_, i) => i !== index);
      const shuffledOthers = otherSigns.sort(() => Math.random() - 0.5);
      const wrongOptions = shuffledOthers.slice(0, 3).map(s => s.name);
      
      // Create options array with correct answer
      const options = [...wrongOptions, sign.name].sort(() => Math.random() - 0.5);
      
      return {
        question: `What sign is this?`,
        sign: sign,
        answer: sign.name,
        options: options.length >= 2 ? options : [sign.name, ...wrongOptions.slice(0, 1)]
      };
    });

    // Shuffle questions
    setQuestions(generatedQuestions.sort(() => Math.random() - 0.5));
    setPracticeMode('practice');
  };

  const handleAnswer = (answer) => {
    setSelectedAnswer(answer);
  };

  const handleSubmit = () => {
    const correct = selectedAnswer === questions[currentQuestion].answer;
    setIsCorrect(correct);
    setShowFeedback(true);
    
    if (correct) {
      setScore(score + 1);
    }
  };

  const handleNext = () => {
    setShowFeedback(false);
    setSelectedAnswer('');
    
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setShowResult(true);
      setAttempts(attempts + 1);
    }
  };

  const handleRetry = () => {
    // Reshuffle questions
    setQuestions(questions.sort(() => Math.random() - 0.5));
    setCurrentQuestion(0);
    setSelectedAnswer('');
    setScore(0);
    setShowResult(false);
    setShowFeedback(false);
    setIsCorrect(false);
  };

  const handleSelectLesson = (selectedLesson) => {
    navigate(`/practice/${selectedLesson.id}`);
  };

  const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  if (loading) {
    return (
      <div className="quiz-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading practice...</p>
        </div>
      </div>
    );
  }

  // Lesson selection mode
  if (!lessonId || practiceMode === 'select') {
    return (
      <div className="quiz-page">
        <div className="practice-header">
          <h1>🎯 Practice Mode</h1>
          <p>Select a lesson to practice. Take as many attempts as you want!</p>
        </div>

        {allLessons.length === 0 ? (
          <div className="no-lessons card">
            <div className="empty-icon">📭</div>
            <h3>No lessons available for practice</h3>
            <p>Complete some lessons first, then come back to practice!</p>
            <Link to="/lessons">
              <button>Go to Lessons</button>
            </Link>
          </div>
        ) : (
          <div className="practice-lessons-grid">
            {allLessons.map((lesson) => (
              <div 
                key={lesson.id} 
                className="practice-lesson-card card"
                onClick={() => handleSelectLesson(lesson)}
              >
                <div className="practice-lesson-icon">{lesson.icon || '✋'}</div>
                <h3>{lesson.title}</h3>
                <p>{lesson.description}</p>
                <div className="practice-lesson-meta">
                  <span>{lesson.signs?.length || 0} signs</span>
                </div>
                <button className="start-practice-btn">Start Practice →</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Results screen
  if (showResult) {
    return (
      <div className="quiz-page">
        <div className="quiz-result card">
          <h1>Practice Complete!</h1>
          <div className="practice-badge">
            <span className="attempt-number">Attempt #{attempts}</span>
          </div>
          
          <div className={`score-display ${percentage >= 80 ? 'pass' : percentage >= 60 ? 'good' : 'fail'}`}>
            <div className="score-circle">
              <span className="score-number">{percentage}%</span>
            </div>
            <p className="score-text">{score} out of {questions.length} correct</p>
          </div>
          
          {percentage === 100 ? (
            <div className="result-message success">
              <h2>🌟 Perfect Score!</h2>
              <p>Amazing! You've mastered this lesson!</p>
            </div>
          ) : percentage >= 80 ? (
            <div className="result-message success">
              <h2>🎉 Great Job!</h2>
              <p>You're doing excellent! Keep practicing to reach 100%!</p>
            </div>
          ) : percentage >= 60 ? (
            <div className="result-message">
              <h2>👍 Good Progress!</h2>
              <p>You're getting there! Practice makes perfect!</p>
            </div>
          ) : (
            <div className="result-message">
              <h2>💪 Keep Practicing!</h2>
              <p>Review the lesson and try again. You've got this!</p>
            </div>
          )}

          <div className="practice-info">
            <p className="unlimited-text">✨ Practice as many times as you want!</p>
          </div>

          <div className="result-actions">
            <button onClick={handleRetry} className="primary">
              🔄 Practice Again
            </button>
            <Link to={`/lesson/${lessonId}`}>
              <button className="secondary">📖 Review Lesson</button>
            </Link>
            <Link to="/practice">
              <button className="secondary">🎯 Choose Another Lesson</button>
            </Link>
            <Link to="/lessons">
              <button className="secondary">📚 All Lessons</button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Practice mode
  const currentQ = questions[currentQuestion];

  return (
    <div className="quiz-page">
      <div className="quiz-header">
        <div className="practice-title">
          <Link to="/practice" className="back-link">← Back</Link>
          <h1>Practice: {lesson?.title}</h1>
        </div>
        <div className="quiz-progress">
          <span>Question {currentQuestion + 1} of {questions.length}</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>
        <div className="practice-score">
          Score: {score}/{currentQuestion + (showFeedback ? 1 : 0)}
        </div>
      </div>

      <div className="quiz-content card">
        <div className="question-display">
          <div className="sign-visual">
            {currentQ.sign.imageUrl ? (
              <img 
                src={currentQ.sign.imageUrl} 
                alt="Sign to identify"
                className="practice-sign-image"
              />
            ) : (
              <div className="sign-placeholder large">
                <span className="placeholder-icon">{currentQ.sign.handIcon || '✋'}</span>
                <p>Identify this sign</p>
              </div>
            )}
          </div>
          <h2>{currentQ.question}</h2>
        </div>

        {!showFeedback ? (
          <>
            <div className="options-grid">
              {currentQ.options.map((option) => (
                <button
                  key={option}
                  className={`option-button ${selectedAnswer === option ? 'selected' : ''}`}
                  onClick={() => handleAnswer(option)}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="quiz-actions">
              <button 
                onClick={handleSubmit} 
                disabled={!selectedAnswer}
                className="submit-btn"
              >
                Check Answer
              </button>
            </div>
          </>
        ) : (
          <div className="feedback-section">
            <div className={`feedback-message ${isCorrect ? 'correct' : 'incorrect'}`}>
              {isCorrect ? (
                <>
                  <span className="feedback-icon">✅</span>
                  <h3>Correct!</h3>
                  <p>Great job! That's the right answer.</p>
                </>
              ) : (
                <>
                  <span className="feedback-icon">❌</span>
                  <h3>Not quite!</h3>
                  <p>The correct answer is: <strong>{currentQ.answer}</strong></p>
                </>
              )}
            </div>

            {currentQ.sign.description && (
              <div className="feedback-description">
                <h4>About this sign:</h4>
                <p>{currentQ.sign.description}</p>
              </div>
            )}

            <div className="quiz-actions">
              <button onClick={handleNext} className="next-btn">
                {currentQuestion < questions.length - 1 ? 'Next Question →' : 'See Results'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Practice;


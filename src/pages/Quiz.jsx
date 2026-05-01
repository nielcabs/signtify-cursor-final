import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../auth/firebase';
import { useAuth } from '../auth/AuthContext';
import { saveQuizResult, getUserProfile } from '../auth/firestoreUtils';
import { resolveSignImageUrl } from '../assets/signImageMap';
import '../styles/pages/Quiz.css';

function Quiz() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bestScore, setBestScore] = useState(null);
  
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadQuiz();
    if (currentUser) {
      loadBestScore();
    }
  }, [quizId, currentUser]);

  const loadQuiz = async () => {
    try {
      setLoading(true);
      const quizRef = doc(db, 'quizzes', quizId);
      const quizDoc = await getDoc(quizRef);
      
      if (quizDoc.exists()) {
        setQuiz({ id: quizDoc.id, ...quizDoc.data() });
      } else {
        setError('Quiz not found');
      }
    } catch (err) {
      console.error('Error loading quiz:', err);
      setError('Failed to load quiz');
    } finally {
      setLoading(false);
    }
  };

  const loadBestScore = async () => {
    try {
      const profile = await getUserProfile(currentUser.uid);
      if (profile?.progress?.quizzesCompleted) {
        // Find all attempts for this quiz
        const quizAttempts = profile.progress.quizzesCompleted.filter(
          q => q.quizId === quizId
        );
        
        if (quizAttempts.length > 0) {
          // Get the highest percentage
          const highestScore = Math.max(...quizAttempts.map(q => q.percentage));
          setBestScore(highestScore);
        }
      }
    } catch (error) {
      console.error('Error loading best score:', error);
    }
  };

  const handleAnswer = (answer) => {
    setSelectedAnswer(answer);
  };

  const handleNext = async () => {
    if (!quiz || !quiz.questions) return;
    
    const isCorrect = selectedAnswer === quiz.questions[currentQuestion].answer;
    const newAnswers = [...answers, { question: currentQuestion, correct: isCorrect }];
    setAnswers(newAnswers);
    
    const newScore = isCorrect ? score + 1 : score;
    if (isCorrect) {
      setScore(newScore);
    }

    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer('');
    } else {
      setShowResult(true);
      // Save quiz result to Firestore
      if (currentUser) {
        setSaving(true);
        try {
          await saveQuizResult(currentUser.uid, quizId, newScore, quiz.questions.length, quiz.category);
          // Reload best score after saving
          await loadBestScore();
        } catch (error) {
          console.error('Error saving quiz result:', error);
        } finally {
          setSaving(false);
        }
      }
    }
  };

  const handleRetry = () => {
    setCurrentQuestion(0);
    setSelectedAnswer('');
    setScore(0);
    setShowResult(false);
    setAnswers([]);
  };

  if (loading) {
    return (
      <div className="quiz-page">
        <div className="loading-container">
          <p>Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="quiz-page">
        <div className="error-container card">
          <h2>⚠️ {error || 'Quiz not found'}</h2>
          <p>This quiz may have been removed or doesn't exist.</p>
          <button onClick={() => navigate('/')}>Return Home</button>
        </div>
      </div>
    );
  }

  if (!quiz.questions || quiz.questions.length === 0) {
    return (
      <div className="quiz-page">
        <div className="error-container card">
          <h2>⚠️ No Questions Available</h2>
          <p>This quiz doesn't have any questions yet.</p>
          <button onClick={() => navigate('/')}>Return Home</button>
        </div>
      </div>
    );
  }

  const percentage = Math.round((score / quiz.questions.length) * 100);

  if (showResult) {
    const isNewBest = bestScore === null || percentage > bestScore;
    
    return (
      <div className="quiz-page">
        <div className="quiz-result card">
          <h1>Quiz Complete!</h1>
          {saving && <p className="saving-text">Saving your results...</p>}
          <div className={`score-display ${percentage >= 80 ? 'pass' : 'fail'}`}>
            <div className="score-circle">
              <span className="score-number">{percentage}%</span>
            </div>
            <p className="score-text">{score} out of {quiz.questions.length} correct</p>
          </div>
          
          {/* Best Score Comparison */}
          {bestScore !== null && (
            <div className="score-comparison">
              {isNewBest ? (
                <div className="new-best-banner">
                  🏆 <strong>New Best Score!</strong> (Previous: {bestScore}%)
                </div>
              ) : (
                <div className="best-score-info">
                  Your Best: <strong>{bestScore}%</strong>
                </div>
              )}
            </div>
          )}
          
          {percentage >= 80 ? (
            <div className="result-message success">
              <h2>🎉 Great Job!</h2>
              <p>You've mastered this quiz!</p>
              <p className="points-earned">+{score * 10} points earned!</p>
            </div>
          ) : (
            <div className="result-message">
              <h2>Keep Practicing!</h2>
              <p>Review and try again to improve your score.</p>
              <p className="points-earned">+{score * 10} points earned!</p>
            </div>
          )}

          <div className="result-actions">
            <button onClick={handleRetry}>Retry Quiz</button>
            <button className="secondary" onClick={() => navigate('/')}>
              Return Home
            </button>
            <Link to="/profile">
              <button className="secondary">View Profile</button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-page">
      <div className="quiz-header">
        <div className="header-content">
          <h1>{quiz.title || 'Quiz'}</h1>
          {bestScore !== null && (
            <div className="best-score-badge">
              <span className="badge-label">🏆 Best Score:</span>
              <span className="badge-value">{bestScore}%</span>
            </div>
          )}
        </div>
        <div className="quiz-progress">
          <span>Question {currentQuestion + 1} of {quiz.questions.length}</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="quiz-content card">
        <div className="question-display">
          <div className="sign-visual">
            {resolveSignImageUrl(quiz.questions[currentQuestion].imageUrl) ? (
              <div className="sign-image">
                <img 
                  src={resolveSignImageUrl(quiz.questions[currentQuestion].imageUrl)}
                  alt="Sign demonstration" 
                  style={{ maxWidth: '100%', borderRadius: '12px' }}
                />
              </div>
            ) : (
              <div className="sign-placeholder">
                {quiz.questions[currentQuestion].handIcon || (quiz.category === 'alphabet' ? '✋' : '👋')}
                <p>Sign displayed here</p>
              </div>
            )}
          </div>
          <h2>{quiz.questions[currentQuestion].question}</h2>
        </div>

        <div className="options-grid">
          {quiz.questions[currentQuestion].options.map((option, index) => (
            <button
              key={index}
              className={`option-button ${selectedAnswer === option ? 'selected' : ''}`}
              onClick={() => handleAnswer(option)}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="quiz-actions">
          <button 
            onClick={handleNext} 
            disabled={!selectedAnswer}
          >
            {currentQuestion < quiz.questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Quiz;

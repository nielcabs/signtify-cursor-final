import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { saveQuizResult, getUserProfile } from '../auth/firestoreUtils';
import '../styles/pages/Quiz.css';

function MiniQuizAlphabet() {
  const { currentUser } = useAuth();
  const quizId = 'alphabet';
  const questions = [
    { question: 'What letter is this sign?', answer: 'A', options: ['A', 'B', 'C', 'D'] },
    { question: 'What letter is this sign?', answer: 'E', options: ['E', 'F', 'G', 'H'] },
    { question: 'What letter is this sign?', answer: 'L', options: ['I', 'J', 'K', 'L'] },
    { question: 'What letter is this sign?', answer: 'M', options: ['M', 'N', 'O', 'P'] },
    { question: 'What letter is this sign?', answer: 'S', options: ['Q', 'R', 'S', 'T'] },
  ];

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [bestScore, setBestScore] = useState(null);

  useEffect(() => {
    if (currentUser) {
      loadBestScore();
    }
  }, [currentUser]);

  const loadBestScore = async () => {
    try {
      const profile = await getUserProfile(currentUser.uid);
      if (profile?.progress?.quizzesCompleted) {
        const quizAttempts = profile.progress.quizzesCompleted.filter(
          q => q.quizId === quizId
        );
        
        if (quizAttempts.length > 0) {
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
    const isCorrect = selectedAnswer === questions[currentQuestion].answer;
    const newAnswers = [...answers, { question: currentQuestion, correct: isCorrect }];
    setAnswers(newAnswers);
    
    const newScore = isCorrect ? score + 1 : score;
    if (isCorrect) {
      setScore(newScore);
    }

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer('');
    } else {
      setShowResult(true);
      // Save quiz result to Firestore
      if (currentUser) {
        setSaving(true);
        try {
          await saveQuizResult(currentUser.uid, quizId, newScore, questions.length, 'alphabet');
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

  const percentage = Math.round((score / questions.length) * 100);

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
            <p className="score-text">{score} out of {questions.length} correct</p>
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
              <p>You've mastered the alphabet! Ready for the proficiency exam?</p>
              <p className="points-earned">+{score * 10} points earned!</p>
            </div>
          ) : (
            <div className="result-message">
              <h2>Keep Practicing!</h2>
              <p>Review the lesson and try again to improve your score.</p>
              <p className="points-earned">+{score * 10} points earned!</p>
            </div>
          )}

          <div className="result-actions">
            <button onClick={handleRetry}>Retry Quiz</button>
            <Link to="/lessons/alphabet">
              <button className="secondary">Review Lesson</button>
            </Link>
            <Link to="/proficiency-exams">
              <button className="secondary">Take Proficiency Exam</button>
            </Link>
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
        <h1>Mini Quiz: Alphabet</h1>
        <div className="quiz-progress">
          <span>Question {currentQuestion + 1} of {questions.length}</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="quiz-content card">
        <div className="question-display">
          <div className="sign-visual">
            <div className="sign-placeholder">
              ✋
              <p>Sign displayed here</p>
            </div>
          </div>
          <h2>{questions[currentQuestion].question}</h2>
        </div>

        <div className="options-grid">
          {questions[currentQuestion].options.map((option) => (
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
            onClick={handleNext} 
            disabled={!selectedAnswer}
          >
            {currentQuestion < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MiniQuizAlphabet;

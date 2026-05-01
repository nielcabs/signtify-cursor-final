import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { saveQuizResult, getUserProfile } from '../auth/firestoreUtils';
import '../styles/pages/Quiz.css';
import helloImg from '../../ASL pics/Greetings/Hello-removebg-preview.png';
import goodbye1 from '../../ASL pics/Greetings/Goodbye1-removebg-preview.png';
import goodMorningImg from '../../ASL pics/Greetings/Happy Birthday 2.png';
import howAreYouImg from '../../ASL pics/Greetings/Mama-removebg-preview.png';
import thankYou1 from '../../ASL pics/Greetings/TY_1-removebg-preview.png';

function MiniQuizGreetings() {
  const { currentUser } = useAuth();
  const quizId = 'greetings';
  const questions = [
    { question: 'What greeting is this sign?', answer: 'Hello', imageUrl: helloImg, options: ['Hello', 'Goodbye', 'Thank You', 'Please'] },
    { question: 'What greeting is this sign?', answer: 'Thank You', imageUrl: thankYou1, options: ['Sorry', 'Thank You', 'Welcome', 'Excuse me'] },
    { question: 'What greeting is this sign?', answer: 'Good Morning', imageUrl: goodMorningImg, options: ['Good Morning', 'Good Night', 'Good afternoon', 'Goodbye'] },
    { question: 'What greeting is this sign?', answer: 'How are you?', imageUrl: howAreYouImg, options: ['How are you?', 'Nice to meet you', 'See you later', 'Take care'] },
    { question: 'What greeting is this sign?', answer: 'Goodbye', imageUrl: goodbye1, options: ['Hello', 'Goodbye', 'See you later', 'Take care'] },
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
          await saveQuizResult(currentUser.uid, quizId, newScore, questions.length, 'greetings');
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
              <h2>🎉Excellent!</h2>
              <p>You've mastered greetings! Ready for more challenges?</p>
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
            <Link to="/lessons/greetings">
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
        <h1>Mini Quiz: Greetings</h1>
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
            {questions[currentQuestion].imageUrl ? (
              <div className="sign-image">
                <img
                  src={questions[currentQuestion].imageUrl}
                  alt="Sign demonstration"
                  style={{ maxWidth: '100%', borderRadius: '12px' }}
                />
              </div>
            ) : (
              <div className="sign-placeholder">
                👋
                <p>Sign displayed here</p>
              </div>
            )}
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

export default MiniQuizGreetings;

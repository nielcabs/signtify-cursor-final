import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  markLessonCompletedByCategory,
  getUserProfile,
  trackLessonItemProgress,
  getLessonProgress,
  canCompleteLesson
} from '../auth/firestoreUtils';
import { useToast } from '../components/ui/Toast';
import { createNotification, NOTIFICATION_TYPES } from '../notifications/notifications';
import '../styles/pages/Lesson.css';
import yesImg from '../../ASL pics/Daily Conversations/Yes.png';
import no1 from '../../ASL pics/Daily Conversations/No_1.png';
import no2 from '../../ASL pics/Daily Conversations/No_2.png';
import helpImg from '../../ASL pics/Daily Conversations/Help.png';

const NO_IMAGES = [no1, no2];

const DAILY_SIGNS = [
  'Yes', 'No', 'Help', 'Please', 'Sorry', 'Excuse me',
  'My name is', 'What is your name?', 'Friend'
];

const SIGN_DESCRIPTIONS = {
  'Yes': {
    emoji: '👍',
    handshape: 'Closed fist, nodding up and down',
    steps: [
      'Make a fist with your dominant hand.',
      'Hold your fist at about chest or chin height.',
      'Nod your fist up and down — like a head nodding "yes".',
      'Repeat the nod two or three times for emphasis.'
    ],
    tips: ['Think of your fist as a nodding head.', 'Keep the motion small and controlled.'],
    commonMistakes: 'Avoid moving the whole arm — the motion should come from the wrist.'
  },
  'No': {
    emoji: '👎',
    handshape: 'Index and middle fingers extended, tapping thumb',
    steps: [
      'Extend your index and middle fingers together (like a "2" handshape).',
      'Keep your thumb extended as well.',
      'Tap your index and middle fingers down onto your thumb twice.',
      'The motion looks like a mouth opening and closing to say "no".'
    ],
    tips: ['Think of the two fingers as lips snapping shut.', 'The double tap is important — one tap is not enough.'],
    commonMistakes: 'Avoid using just one finger — both the index and middle fingers must tap the thumb together.'
  },
  'Help': {
    emoji: '🤝',
    handshape: 'Thumbs-up hand on flat palm, lifting upward',
    steps: [
      'Hold your non-dominant hand flat, palm facing up.',
      'Make a thumbs-up shape with your dominant hand.',
      'Place your dominant thumbs-up hand on top of your non-dominant flat palm.',
      'Lift both hands upward together in one smooth motion.'
    ],
    tips: ['The flat hand represents a platform; the thumbs-up represents the person being helped.', 'The upward lift shows assistance being given.'],
    commonMistakes: 'Avoid lifting only one hand — both hands should rise together.'
  },
  'Please': {
    emoji: '🙏',
    handshape: 'Flat hand on chest, circular motion',
    steps: [
      'Place your dominant hand flat on your chest, fingers together.',
      'Your palm should face inward toward your body.',
      'Move your hand in a circular motion on your chest.',
      'The motion comes from the heart, showing sincerity.'
    ],
    tips: ['Think of it as rubbing your heart to show you really mean it.', 'Keep the circle smooth and not too large.'],
    commonMistakes: 'Avoid moving the hand away from the chest — it should stay in contact throughout the circular motion.'
  },
  'Sorry': {
    emoji: '😔',
    handshape: 'Closed fist, circular motion on chest',
    steps: [
      'Make a fist with your dominant hand.',
      'Place your fist on your chest over your heart.',
      'Rub your fist in a circular motion on your chest.',
      'The circular motion over the heart expresses regret and remorse.'
    ],
    tips: ['SORRY and PLEASE look similar — SORRY uses a fist, PLEASE uses a flat hand.', 'A sincere facial expression adds meaning to this sign.'],
    commonMistakes: 'Do not use a flat hand for SORRY — the fist is what distinguishes it from PLEASE.'
  },
  'Excuse me': {
    emoji: '🤚',
    handshape: 'Dominant fingertips brushing across non-dominant palm',
    steps: [
      'Hold your non-dominant hand flat, palm facing up.',
      'Hold your dominant hand with fingers together, slightly curved.',
      'Brush the fingertips of your dominant hand across the palm of your non-dominant hand.',
      'Move the brushing motion away from your body (forward).'
    ],
    tips: ['Think of it as wiping something off your palm — clearing the way.', 'The motion is light and quick, not heavy.'],
    commonMistakes: 'Avoid brushing toward yourself — the motion should go forward, away from your body.'
  },
  'My name is': {
    emoji: '🙋',
    handshape: 'H-handshape tapping, then pointing to self',
    steps: [
      'Form an "H" handshape with both hands: index and middle fingers extended side by side.',
      'Tap the fingers of your dominant H hand on the back of your non-dominant H hand twice.',
      'After the taps, point your index finger toward yourself (your chest).',
      'The tapping represents "name" and the pointing represents "my/I".'
    ],
    tips: ['The H-tap is the sign for NAME.', 'Pointing to yourself at the end means "my".'],
    commonMistakes: 'Avoid using just one finger for the tap — both the index and middle fingers should tap together.'
  },
  'What is your name?': {
    emoji: '❓',
    handshape: 'H-handshape tapping, then pointing to other person',
    steps: [
      'Form an "H" handshape with both hands: index and middle fingers extended side by side.',
      'Tap the fingers of your dominant H hand on the back of your non-dominant H hand twice (sign for NAME).',
      'After the taps, point your index finger toward the other person.',
      'Use a questioning facial expression (raised eyebrows, slight head tilt).'
    ],
    tips: ['This is the same as MY NAME IS but you point to the other person instead of yourself.', 'Facial expression is crucial — raised eyebrows signal a question in ASL.'],
    commonMistakes: 'Do not forget the questioning facial expression — in ASL, facial grammar is as important as the hand signs.'
  },
  'Friend': {
    emoji: '🤝',
    handshape: 'Hooked index fingers, one over the other, then reversed',
    steps: [
      'Extend your dominant index finger and hook it (bend it slightly).',
      'Hook your dominant index finger over your non-dominant index finger.',
      'Then reverse — hook your non-dominant index finger over your dominant one.',
      'The interlocking motion represents two people linked together as friends.'
    ],
    tips: ['Think of two people linking arms or fingers together.', 'The reversal (both directions) shows the friendship is mutual.'],
    commonMistakes: 'Avoid just touching the fingers — they should actually hook over each other.'
  }
};

function LessonDailyConversation() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [selectedSign, setSelectedSign] = useState('Yes');
  const [isCompleted, setIsCompleted] = useState(false);
  const [lessonProgress, setLessonProgress] = useState(null);
  const [lockedSigns, setLockedSigns] = useState(new Set());
  const [noIndex, setNoIndex] = useState(0);

  useEffect(() => {
    checkCompletionStatus();
    loadLessonProgress();
  }, [currentUser]);

  // Cycle "No" images every 3 seconds when selected (matches Greetings pattern)
  useEffect(() => {
    if (selectedSign !== 'No') {
      setNoIndex(0);
      return;
    }

    const intervalId = setInterval(() => {
      setNoIndex((prev) => (prev + 1) % NO_IMAGES.length);
    }, 3000);

    return () => clearInterval(intervalId);
  }, [selectedSign]);

  // Hard guard: user must finish Numbers before accessing Daily Conversation
  useEffect(() => {
    const guard = async () => {
      if (!currentUser) return;
      const numbersFinished = await canCompleteLesson(currentUser.uid, 'numbers', 10);
      if (!numbersFinished) {
        navigate('/lessons/numbers');
      }
    };
    guard();
  }, [currentUser, navigate]);

  const checkCompletionStatus = async () => {
    if (currentUser) {
      try {
        const profile = await getUserProfile(currentUser.uid);
        const lessonsCompleted = profile?.progress?.lessonsCompleted || [];
        const hasDailyConversation = lessonsCompleted.some(id =>
          id.includes('daily-conversation') || id.includes('daily_conversation')
        );
        setIsCompleted(hasDailyConversation);
      } catch (error) {
        console.error('Error checking completion status:', error);
      }
    }
  };

  const loadLessonProgress = async () => {
    if (currentUser) {
      try {
        const progress = await getLessonProgress(currentUser.uid, 'daily-conversation');
        setLessonProgress(progress);

        const locked = new Set();
        const lastIndex = progress?.lastViewedIndex ?? -1;
        DAILY_SIGNS.forEach((sign, index) => {
          if (index > lastIndex + 1) {
            locked.add(sign);
          }
        });
        setLockedSigns(locked);
      } catch (error) {
        console.error('Error loading lesson progress:', error);
      }
    }
  };

  const handleSignClick = async (sign, index) => {
    if (!currentUser) return;

    if (lockedSigns.has(sign)) {
      const nextIndex = (lessonProgress?.lastViewedIndex ?? -1) + 1;
      const nextSign = DAILY_SIGNS[nextIndex] || 'the next sign';
      toast.warning(`Please view signs in order. View "${nextSign}" first.`);
      return;
    }

    const result = await trackLessonItemProgress(
      currentUser.uid,
      'daily-conversation',
      sign,
      index,
      DAILY_SIGNS.length
    );

    if (result.success && result.canView) {
      setSelectedSign(sign);
      await loadLessonProgress();
      if (result.allItemsViewed && !isCompleted) {
        try {
          await markLessonCompletedByCategory(currentUser.uid, 'daily-conversation');
          setIsCompleted(true);
          toast.success('🎉 Daily Conversation lesson complete! +50 points earned.', { duration: 5000 });
          createNotification({
            userId: currentUser.uid,
            type: NOTIFICATION_TYPES.LESSON_COMPLETED,
            title: 'Daily Conversation lesson completed',
            message: 'You finished every daily-conversation sign. Keep practicing!',
            link: '/proficiency-exams',
          });
        } catch (error) {
          console.error('Error auto-completing daily conversation lesson:', error);
        }
      }
    } else if (!result.canView) {
      toast.warning(result.message || 'Please view signs in sequential order.');
    }
  };

  return (
    <div className="lesson-page">
      <div className="lesson-header">
        <h1>Lesson: Daily Conversation Signs</h1>
        <p>Learn essential everyday signs for basic communication</p>
      </div>

      <div className="lesson-content">
        {lessonProgress && (
          <div className="lesson-progress-indicator" style={{
            marginBottom: '1rem',
            padding: '1rem',
            background: '#f0f0f0',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <strong>Progress: {lessonProgress.viewedItems?.length || 0} / {DAILY_SIGNS.length} signs viewed</strong>
            {!isCompleted && (
              <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
                View all signs in order — the lesson will complete automatically.
              </p>
            )}
          </div>
        )}

        <div className="greeting-grid">
          {DAILY_SIGNS.map((sign, index) => {
            const isLocked = lockedSigns.has(sign);
            const isViewed = lessonProgress?.viewedItems?.includes(sign);
            return (
              <button
                key={sign}
                className={`greeting-button ${selectedSign === sign ? 'active' : ''} ${isLocked ? 'locked' : ''} ${isViewed ? 'viewed' : ''}`}
                onClick={() => handleSignClick(sign, index)}
                disabled={isLocked}
                title={isLocked ? `View signs in order. Next: ${DAILY_SIGNS[(lessonProgress?.lastViewedIndex ?? -1) + 1] || 'N/A'}` : ''}
              >
                {sign}
                {isLocked && <span className="lock-icon">🔒</span>}
                {isViewed && !isLocked && <span className="check-icon">✓</span>}
              </button>
            );
          })}
        </div>

        <div className="sign-display card">
          <h2>{selectedSign}</h2>
          <div className="sign-visual">
            <div className="sign-placeholder">
              {selectedSign === 'Yes' ? (
                <>
                  <img
                    src={yesImg}
                    alt="ASL sign for Yes"
                    className="sign-letter-svg"
                  />
                  <p>Sign for "Yes"</p>
                </>
              ) : selectedSign === 'No' ? (
                <>
                  <img
                    src={NO_IMAGES[noIndex]}
                    alt="ASL sign for No"
                    className="sign-letter-svg"
                  />
                  <p>Sign for "No"</p>
                </>
              ) : selectedSign === 'Help' ? (
                <>
                  <img
                    src={helpImg}
                    alt="ASL sign for Help"
                    className="sign-letter-svg"
                  />
                  <p>Sign for "Help"</p>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '4rem' }}>{SIGN_DESCRIPTIONS[selectedSign]?.emoji || '✋'}</span>
                  <p>Sign for "{selectedSign}"</p>
                </>
              )}
            </div>
          </div>
          <div className="sign-description">
            <h3>How to sign "{selectedSign}"</h3>
            {(() => {
              const info = SIGN_DESCRIPTIONS[selectedSign];
              if (!info) {
                return <p>Practice this gesture in context to improve your conversational skills.</p>;
              }
              return (
                <div className="letter-instructions">
                  <p className="handshape-summary">
                    <strong>Handshape:</strong> {info.handshape}
                  </p>
                  <div className="instruction-section">
                    <h4>Step-by-step instructions:</h4>
                    <ol className="steps-list">
                      {info.steps.map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                  </div>
                  <div className="instruction-section tips-section">
                    <h4>Helpful tips:</h4>
                    <ul className="tips-list">
                      {info.tips.map((tip, index) => (
                        <li key={index}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="instruction-section mistakes-section">
                    <h4>Common mistakes to avoid:</h4>
                    <p className="common-mistakes">{info.commonMistakes}</p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      <div className="lesson-actions">
        {isCompleted && (
          <div className="completion-badge" style={{
            backgroundColor: '#4CAF50',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '5px',
            marginBottom: '10px',
            fontWeight: 'bold'
          }}>
            ✓ Lesson Completed!
          </div>
        )}
        {!isCompleted && (
          <p style={{ marginBottom: '10px', color: '#666', fontSize: '0.9rem' }}>
            Finish viewing all signs to complete this lesson.
          </p>
        )}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/lessons/numbers">
            <button className="secondary">← Back: Numbers</button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default LessonDailyConversation;

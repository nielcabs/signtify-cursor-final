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
import num1Svg from '../../ASL pics/Numbers_SVG/1.svg';
import num2Svg from '../../ASL pics/Numbers_SVG/2.svg';
import num3Svg from '../../ASL pics/Numbers_SVG/3.svg';
import num4Svg from '../../ASL pics/Numbers_SVG/4.svg';
import num5Svg from '../../ASL pics/Numbers_SVG/5.svg';
import num6Svg from '../../ASL pics/Numbers_SVG/6.svg';
import num7Svg from '../../ASL pics/Numbers_SVG/7.svg';
import num8Svg from '../../ASL pics/Numbers_SVG/8.svg';
import num9Svg from '../../ASL pics/Numbers_SVG/9.svg';
import num10Svg from '../../ASL pics/Numbers_SVG/10.svg';
import '../styles/pages/Lesson.css';

const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const NUMBER_SVGS = {
  1: num1Svg,
  2: num2Svg,
  3: num3Svg,
  4: num4Svg,
  5: num5Svg,
  6: num6Svg,
  7: num7Svg,
  8: num8Svg,
  9: num9Svg,
  10: num10Svg
};
const ROTATE_NUMBERS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);

const numberInstructions = {
  1: {
    title: 'Number 1 in ASL',
    handshape: 'Index finger up, other fingers curled into a fist',
    steps: [
      'Curl your middle, ring, and pinky fingers into your palm to make a fist.',
      'Extend your index finger straight up toward the ceiling.',
      'Place your thumb across the side of your curled fingers or rest it gently on top of them.',
      'Keep your index finger straight, not bent.',
      'Your palm should face inward toward you (toward your chest) in the basic number form.'
    ],
    tips: [
      'Think of this as “pointing up” with one finger.',
      'Only the index finger should be extended – keep the other fingers tucked in.',
      'Use a relaxed but clear handshape so the finger does not wobble.'
    ],
    commonMistakes: 'Avoid extending more than one finger or letting the other fingers stick out.'
  },
  2: {
    title: 'Number 2 in ASL',
    handshape: 'Index and middle fingers up, thumb and other fingers curled',
    steps: [
      'Curl your ring and pinky fingers into your palm.',
      'Extend your index and middle fingers straight up.',
      'Place your thumb across the curled fingers or rest it along the side of your hand.',
      'Keep your two extended fingers together (not spread wide).',
      'Turn your palm inward toward you (toward your chest) for the basic number form.'
    ],
    tips: [
      'Think of a “peace sign” but with the fingers a bit closer together.',
      'Keep the fingers straight and the same height.',
      'This handshape is very similar to the letter U, but here it means the number 2.'
    ],
    commonMistakes: 'Do not spread the two fingers too far apart or let a third finger lift up.'
  },
  3: {
    title: 'Number 3 in ASL',
    handshape: 'Thumb, index, and middle fingers extended, ring and pinky curled',
    steps: [
      'Curl your ring and pinky fingers into your palm.',
      'Extend your thumb, index finger, and middle finger.',
      'Separate the thumb slightly from the index finger so all three are visible.',
      'Keep the three extended digits straight and relaxed.',
      'Angle your palm slightly inward toward you rather than straight out.'
    ],
    tips: [
      'This is different from the “movie-style 3” on the fingers (index–middle–ring). ASL uses thumb–index–middle.',
      'Check that your ring and pinky stay tucked in.',
      'Practice moving from 1 → 2 → 3 smoothly to build muscle memory.'
    ],
    commonMistakes: 'Avoid using index–middle–ring for 3; in ASL the thumb must be part of the 3.'
  },
  4: {
    title: 'Number 4 in ASL',
    handshape: 'Four fingers extended, thumb tucked into palm',
    steps: [
      'Extend your index, middle, ring, and pinky fingers straight up.',
      'Tuck your thumb across your palm so it does not show beside the fingers.',
      'Keep all four fingers close together and straight.',
      'Let your palm angle inward toward you (toward your chest) for the basic number form.',
      'Hold your wrist straight and relaxed.'
    ],
    tips: [
      'Think of “four” as your whole hand up, but with the thumb hidden.',
      'Keep the fingers evenly spaced with no big gaps.',
      'If your thumb peeks out to the side, gently tuck it back in.'
    ],
    commonMistakes: 'Do not let your thumb stick out like the number 5 – it must stay tucked in.'
  },
  5: {
    title: 'Number 5 in ASL',
    handshape: 'All five fingers spread out, palm forward',
    steps: [
      'Extend all five fingers (thumb plus four fingers).',
      'Spread your fingers apart slightly so each one is clearly visible.',
      'Keep your palm generally facing inward toward you for the basic form of the number 5.',
      'Relax your hand so it is open but not stiff.',
      'Hold the hand at about chest height for clear visibility.'
    ],
    tips: [
      'This is the same as an open high–five hand.',
      'Keep a gentle curve in your fingers instead of locking them straight.',
      'Use this shape as the base for higher numbers like 6–9.'
    ],
    commonMistakes: 'Avoid curling the fingers too much or pressing them tightly together; the hand should look open and natural.'
  },
  6: {
    title: 'Number 6 in ASL',
    handshape: 'Thumb touches pinky, other three fingers extended',
    steps: [
      'Start from the number 5 handshape with all fingers extended.',
      'Bend your pinky finger and thumb toward each other until their tips touch to form a circle.',
      'Keep your index, middle, and ring fingers extended and spread slightly.',
      'Face your palm forward.',
      'Hold the circle (thumb–pinky) clearly so it can be seen.'
    ],
    tips: [
      'Remember: for 6, the thumb connects with the smallest finger (pinky).',
      'Keep the three straight fingers relaxed but not floppy.',
      'Practice moving from 5 → 6 smoothly to see the change clearly.'
    ],
    commonMistakes: 'Do not let the other fingers curl in; only the pinky should bend to meet the thumb.'
  },
  7: {
    title: 'Number 7 in ASL',
    handshape: 'Thumb touches ring finger, other fingers extended',
    steps: [
      'Start from the open 5 handshape.',
      'Bend your ring finger down toward your thumb.',
      'Touch the tip of your thumb to the tip of your ring finger to form a small circle.',
      'Keep your index, middle, and pinky fingers extended and visible.',
      'Face your palm forward toward the viewer.'
    ],
    tips: [
      'For 7, think “thumb touches ring finger” – the third finger from the thumb.',
      'Keep the circle small and neat so it is easy to see.',
      'Let the other fingers stay extended and not too stiff.'
    ],
    commonMistakes: 'Avoid touching the wrong finger (like the middle or pinky) – that would change the number.'
  },
  8: {
    title: 'Number 8 in ASL',
    handshape: 'Thumb touches middle finger, other fingers extended',
    steps: [
      'Begin with all fingers extended in the 5 handshape.',
      'Bend your middle finger down toward your thumb.',
      'Touch the tip of your thumb to the tip of your middle finger.',
      'Keep your index, ring, and pinky fingers extended and slightly spread.',
      'Turn your palm forward.'
    ],
    tips: [
      'For 8, the thumb connects to the middle finger – the “tallest” finger.',
      'Use a small, clear circle rather than flattening the fingers together.',
      'Compare your 6, 7, and 8 handshapes in a mirror to see the difference.'
    ],
    commonMistakes: 'Do not let the index or ring finger bend with the middle finger; only the middle finger should meet the thumb.'
  },
  9: {
    title: 'Number 9 in ASL',
    handshape: 'Thumb touches index finger, other fingers extended',
    steps: [
      'Start from the 5 handshape again.',
      'Bend your index finger down toward your thumb.',
      'Touch the tip of your thumb to the tip of your index finger to form a small “OK” circle.',
      'Keep your middle, ring, and pinky fingers extended.',
      'Face your palm forward so the circle is visible.'
    ],
    tips: [
      'This looks like the “OK” sign in many cultures – that is your 9 in ASL.',
      'Keep the other three fingers straight so it does not look like the letter F.',
      'Hold the circle close, not too wide.'
    ],
    commonMistakes: 'Avoid curling the other three fingers or hiding them behind your hand – they must stay extended.'
  },
  10: {
    title: 'Number 10 in ASL',
    handshape: 'Closed fist with thumb extended up, slight shaking movement',
    steps: [
      'Make a fist by curling all four fingers into your palm.',
      'Extend your thumb straight up, like a “thumbs up” gesture.',
      'Keep your wrist relaxed and your knuckles facing sideways.',
      'Give your fist a small side–to–side or up–and–down shake to show it is the number 10.',
      'Hold the movement steady and controlled, not too big.'
    ],
    tips: [
      'Think of a confident “thumbs up” with a gentle shake.',
      'The motion is part of the sign – without movement, it can look like the letter A or S depending on thumb position.',
      'Keep the shake small so it is easy to repeat in counting.'
    ],
    commonMistakes: 'Do not over–exaggerate the movement or let the thumb fold back down into the fist.'
  }
};

function LessonNumbers() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [selectedNumber, setSelectedNumber] = useState(1);
  const [isCompleted, setIsCompleted] = useState(false);
  const [lessonProgress, setLessonProgress] = useState(null);
  const [lockedNumbers, setLockedNumbers] = useState(new Set());

  useEffect(() => {
    checkCompletionStatus();
    loadLessonProgress();
  }, [currentUser]);

  // Guard: user must complete Greetings before accessing Numbers
  useEffect(() => {
    const guard = async () => {
      if (!currentUser) return;
      const greetingsFinished = await canCompleteLesson(currentUser.uid, 'greetings', 12);
      if (!greetingsFinished) {
        navigate('/lessons/greetings');
      }
    };
    guard();
  }, [currentUser, navigate]);

  const checkCompletionStatus = async () => {
    if (currentUser) {
      try {
        const profile = await getUserProfile(currentUser.uid);
        const lessonsCompleted = profile?.progress?.lessonsCompleted || [];
        const hasNumbersLesson = lessonsCompleted.some(id =>
          id.includes('numbers') || id === 'lesson_numbers' || id.toLowerCase().includes('numbers')
        );
        setIsCompleted(hasNumbersLesson);
      } catch (error) {
        console.error('Error checking completion status:', error);
      }
    }
  };

  const loadLessonProgress = async () => {
    if (currentUser) {
      try {
        const progress = await getLessonProgress(currentUser.uid, 'numbers');
        setLessonProgress(progress);
        const locked = new Set();
        const lastIndex = progress?.lastViewedIndex ?? -1;
        NUMBERS.forEach((num, index) => {
          if (index > lastIndex + 1) locked.add(num);
        });
        setLockedNumbers(locked);
      } catch (error) {
        console.error('Error loading lesson progress:', error);
      }
    }
  };

  const handleNumberClick = async (num, index) => {
    if (!currentUser) return;
    if (lockedNumbers.has(num)) {
      const nextNum = NUMBERS[(lessonProgress?.lastViewedIndex ?? -1) + 1];
      toast.warning(`Please view numbers in order. View ${nextNum} first.`);
      return;
    }
    const result = await trackLessonItemProgress(
      currentUser.uid,
      'numbers',
      String(num),
      index,
      NUMBERS.length
    );
    if (result.success && result.canView) {
      setSelectedNumber(num);
      await loadLessonProgress();
      if (result.allItemsViewed && !isCompleted) {
        try {
          await markLessonCompletedByCategory(currentUser.uid, 'numbers');
          setIsCompleted(true);
          toast.success('🎉 Numbers lesson complete! +50 points earned.', { duration: 5000 });
          createNotification({
            userId: currentUser.uid,
            type: NOTIFICATION_TYPES.LESSON_COMPLETED,
            title: 'Numbers lesson completed',
            message: 'Daily Conversation is now unlocked.',
            link: '/lessons/daily-conversation',
          });
        } catch (error) {
          console.error('Error auto-completing numbers lesson:', error);
        }
      }
    } else if (!result.canView) {
      toast.warning(result.message || 'Please view numbers in sequential order.');
    }
  };

  return (
    <div className="lesson-page">
      <div className="lesson-header">
        <h1>Lesson: Numbers</h1>
        <p>Learn to sign numbers 1–10 in ASL</p>
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
            <strong>Progress: {lessonProgress.viewedItems?.length || 0} / {NUMBERS.length} numbers viewed</strong>
            {!isCompleted && (
              <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
                View all numbers 1–10 in order — the lesson will complete automatically.
              </p>
            )}
          </div>
        )}
        <div className="letter-grid">
          {NUMBERS.map((num, index) => {
            const isLocked = lockedNumbers.has(num);
            const isViewed = lessonProgress?.viewedItems?.includes(String(num));
            return (
              <button
                key={num}
                className={`letter-button ${selectedNumber === num ? 'active' : ''} ${isLocked ? 'locked' : ''} ${isViewed ? 'viewed' : ''}`}
                onClick={() => handleNumberClick(num, index)}
                disabled={isLocked}
                title={isLocked ? `View in order. Next: ${NUMBERS[(lessonProgress?.lastViewedIndex ?? -1) + 1]}` : ''}
              >
                {num}
                {isLocked && <span className="lock-icon">🔒</span>}
                {isViewed && !isLocked && <span className="check-icon">✓</span>}
              </button>
            );
          })}
        </div>

        <div className="sign-display card">
          <h2>Number: {selectedNumber}</h2>
          <div className="sign-visual">
            <div className="sign-placeholder">
              <img
                src={NUMBER_SVGS[selectedNumber]}
                alt={`Sign for ${selectedNumber}`}
                className={`sign-letter-svg sign-number-svg ${ROTATE_NUMBERS.has(selectedNumber) ? 'sign-number-rotated' : ''}`}
              />
              <p>Sign for "{selectedNumber}"</p>
            </div>
          </div>
          <div className="sign-description">
            <h3>How to sign "{selectedNumber}"</h3>
            {(() => {
              const instruction = numberInstructions[selectedNumber];
              if (!instruction) {
                return (
                  <p>
                    Practice signing this number with a clear handshape and steady movement.
                  </p>
                );
              }
              return (
                <div className="letter-instructions">
                  <p className="handshape-summary">
                    <strong>Handshape:</strong> {instruction.handshape}
                  </p>
                  <div className="instruction-section">
                    <h4>Step-by-step instructions:</h4>
                    <ol className="steps-list">
                      {instruction.steps.map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                  </div>
                  <div className="instruction-section tips-section">
                    <h4>Helpful tips:</h4>
                    <ul className="tips-list">
                      {instruction.tips.map((tip, index) => (
                        <li key={index}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="instruction-section mistakes-section">
                    <h4>Common mistakes to avoid:</h4>
                    <p className="common-mistakes">{instruction.commonMistakes}</p>
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
            Finish viewing all numbers 1–10 to unlock the Daily Conversation lesson.
          </p>
        )}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/lessons/greetings">
            <button className="secondary">← Back: Greetings</button>
          </Link>
          {isCompleted ? (
            <Link to="/lessons/daily-conversation">
              <button className="secondary">Next: Daily Conversation →</button>
            </Link>
          ) : (
            <button
              className="secondary"
              disabled
              style={{ opacity: 0.7, cursor: 'not-allowed' }}
              title="Finish viewing all numbers to unlock Daily Conversation"
            >
              🔒 Next: Daily Conversation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default LessonNumbers;

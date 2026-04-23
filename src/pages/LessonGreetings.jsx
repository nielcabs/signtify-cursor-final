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
import ty1 from '../../ASL pics/Greetings/TY_1-removebg-preview.png';
import ty2 from '../../ASL pics/Greetings/TY_2-removebg-preview.png';
import gb1 from '../../ASL pics/Greetings/Goodbye1-removebg-preview.png';
import gb2 from '../../ASL pics/Greetings/Goodbye2-removebg-preview.png';
import helloImg from '../../ASL pics/Greetings/Hello-removebg-preview.png';

const THANK_YOU_IMAGES = [ty1, ty2];
const GOODBYE_IMAGES = [gb1, gb2];

const GREETING_DESCRIPTIONS = {
  'Hello': {
    emoji: '👋',
    handshape: 'Open hand, fingers together, palm facing outward',
    steps: [
      'Open your dominant hand with all fingers together and your thumb relaxed.',
      'Place your fingertips near your forehead or temple.',
      'Move your hand outward and slightly downward — like a casual salute.',
      'Your palm faces outward toward the person you are greeting.'
    ],
    tips: ['Think of it as a relaxed military salute.', 'Keep the motion smooth and natural.'],
    commonMistakes: 'Avoid using a stiff or exaggerated motion — keep it casual and friendly.'
  },
  'Goodbye': {
    emoji: '👋',
    handshape: 'Open hand, four fingers extended, palm facing outward',
    steps: [
      'Hold up your dominant hand with all four fingers extended and together.',
      'Face your palm outward toward the person.',
      'Bend your fingers down toward your palm.',
      'Straighten them back up — repeat this motion two or three times, like waving goodbye.'
    ],
    tips: ['This is essentially a standard wave.', 'Keep the wrist relaxed for a natural look.'],
    commonMistakes: 'Avoid waving the whole arm — the motion should come from the fingers and wrist.'
  },
  'Good Morning': {
    emoji: '🌅',
    handshape: 'Flat hand for GOOD; forearm rising for MORNING',
    steps: [
      'Sign GOOD: place your dominant flat hand against your chin, fingers pointing up.',
      'Move your hand forward and down into your non-dominant palm.',
      'Sign MORNING: hold your non-dominant arm horizontally in front of you (the horizon).',
      'Bring your dominant forearm up from below it, like the sun rising.'
    ],
    tips: ['GOOD + MORNING is a two-part sign.', 'The rising forearm motion represents the sunrise.'],
    commonMistakes: 'Do not skip the GOOD part — both signs together make the full greeting.'
  },
  'Good Night': {
    emoji: '🌙',
    handshape: 'Flat hand for GOOD; bent hand over arm for NIGHT',
    steps: [
      'Sign GOOD: place your dominant flat hand against your chin, then move it forward and down.',
      'Sign NIGHT: hold your non-dominant arm horizontally.',
      'Bend your dominant hand at the wrist so the fingertips point downward.',
      'Place the bent hand over the non-dominant arm — like the sun setting below the horizon.'
    ],
    tips: ['NIGHT is the opposite motion of MORNING.', 'The downward bend represents the sun going down.'],
    commonMistakes: 'Avoid pointing the fingers straight down — they should curve gently over the arm.'
  },
  'Good afternoon': {
    emoji: '☀️',
    handshape: 'Flat hand for GOOD; forearm at 45° for AFTERNOON',
    steps: [
      'Sign GOOD: place your dominant flat hand against your chin, then move it forward and down.',
      'Sign AFTERNOON: hold your non-dominant arm horizontally.',
      'Place your dominant forearm on top of it at a 45-degree angle, pointing diagonally upward.',
      'This represents the afternoon sun position in the sky.'
    ],
    tips: ['AFTERNOON is between MORNING (rising) and NIGHT (setting).', 'The 45° angle shows the sun is still up but past noon.'],
    commonMistakes: 'Do not hold the arm too high (that would be MORNING) or too low (that would be NIGHT).'
  },
  'How are you?': {
    emoji: '🤔',
    handshape: 'Both hands bent/curved, palms up, then point to person',
    steps: [
      'Bend both hands with fingers curved (like a loose claw shape), palms facing up.',
      'Place them in front of your chest.',
      'Twist your wrists so the palms face down, then back up.',
      'Point toward the person you are asking.'
    ],
    tips: ['The wrist twist represents asking about someone\'s condition or state.', 'The pointing at the end directs the question to the other person.'],
    commonMistakes: 'Avoid making the claw too tight — keep the fingers relaxed and curved.'
  },
  'Nice to meet you': {
    emoji: '🤝',
    handshape: 'Flat hand on chest for NICE; two index fingers meeting for MEET',
    steps: [
      'Sign NICE/PLEASED: place your dominant flat hand on your chest.',
      'Move it in a small circular motion.',
      'Sign MEET: hold both index fingers pointing up in front of you.',
      'Bring them together so the fingertips touch — representing two people meeting.'
    ],
    tips: ['NICE shows a warm feeling in the chest.', 'MEET shows two people coming together.'],
    commonMistakes: 'For MEET, make sure both index fingers are pointing up before bringing them together.'
  },
  'See you later': {
    emoji: '👀',
    handshape: 'V-shape near eyes for SEE; L-shape rotating for LATER',
    steps: [
      'Sign SEE: hold your dominant hand in a "V" shape (index and middle fingers extended).',
      'Place the V near your eyes, then point it outward.',
      'Sign LATER: hold your dominant hand in an "L" shape (thumb and index finger extended).',
      'Place the thumb on your non-dominant palm and rotate the hand forward.'
    ],
    tips: ['SEE uses the V pointing from your eyes outward.', 'LATER uses the L rotating forward like a clock hand moving.'],
    commonMistakes: 'For LATER, make sure the L shape is clear — thumb up, index finger pointing forward.'
  },
  'Take care': {
    emoji: '🤲',
    handshape: 'Both hands in K-shape, one on top of the other, circular motion',
    steps: [
      'Form a "K" handshape with both hands: index and middle fingers extended, touching the thumb.',
      'Place your dominant K hand on top of your non-dominant K hand.',
      'Move them together in a small circular motion.',
      'The motion represents careful, protective attention.'
    ],
    tips: ['Think of it as "keeping watch" over something carefully.', 'The circular motion shows ongoing care.'],
    commonMistakes: 'Avoid using flat hands — the K handshape (with the thumb touching the fingers) is important.'
  },
  'Thank You': {
    emoji: '🙏',
    handshape: 'Flat hand from chin moving forward and down',
    steps: [
      'Place your dominant flat hand (fingers together, palm facing inward) against your chin or lips.',
      'Move your hand forward and slightly downward, away from your face.',
      'Your palm faces upward at the end of the motion.',
      'The gesture is like blowing a kiss of gratitude toward the person.'
    ],
    tips: ['The motion comes from the mouth/chin area, showing the thanks comes from the heart.', 'Keep the movement smooth and graceful.'],
    commonMistakes: 'Avoid moving the hand sideways — it should go forward and slightly down.'
  },
  'Welcome': {
    emoji: '🤗',
    handshape: 'Flat hand, palm up, sweeping inward',
    steps: [
      'Hold your dominant hand flat with fingers together and palm facing up.',
      'Start with your arm extended to the side.',
      'Swing your arm inward toward your body in a welcoming, sweeping gesture.',
      'The motion is smooth and open, as if ushering someone in.'
    ],
    tips: ['Think of it as physically welcoming someone into a space.', 'Keep the palm facing up throughout the motion.'],
    commonMistakes: 'Avoid a stiff or choppy motion — the sweep should be smooth and inviting.'
  },
  'Happy Birthday': {
    emoji: '🎂',
    handshape: 'Bent hand tapping elbow for HAPPY; then BIRTHDAY sign',
    steps: [
      'Sign HAPPY: place your dominant flat hand on your chest and brush it upward twice in a quick, cheerful motion.',
      'Sign BIRTH: hold both hands flat, palms facing each other, then move your dominant hand downward from your non-dominant hand — like a baby being born.',
      'Sign DAY: hold your non-dominant arm horizontally and bring your dominant index finger (or forearm) down to rest on it at a 45-degree angle, like the sun setting.',
      'Put it together: HAPPY + BIRTH + DAY, signing each part smoothly in sequence.'
    ],
    tips: [
      'HAPPY BIRTHDAY is a three-part compound sign: HAPPY + BIRTH + DAY.',
      'Use an enthusiastic facial expression — happiness is part of the sign.',
      'Practice the three parts separately before combining them.'
    ],
    commonMistakes: 'Avoid signing too slowly or pausing too long between parts — the three signs should flow together naturally.'
  }
};

function LessonGreetings() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const greetings = [
    'Hello', 'Goodbye', 'Good Morning', 'Good Night', 'Good afternoon',
    'How are you?', 'Nice to meet you', 'See you later', 'Take care',
    'Thank You', 'Welcome', 'Happy Birthday'
  ];
  
  const [selectedGreeting, setSelectedGreeting] = useState('Hello');
  const [isCompleted, setIsCompleted] = useState(false);
  const [lessonProgress, setLessonProgress] = useState(null);
  const [lockedGreetings, setLockedGreetings] = useState(new Set());
  const [thankYouIndex, setThankYouIndex] = useState(0);
  const [goodbyeIndex, setGoodbyeIndex] = useState(0);

  useEffect(() => {
    checkCompletionStatus();
    loadLessonProgress();
  }, [currentUser]);

  // Cycle "Thank You" images every 3 seconds when selected
  useEffect(() => {
    if (selectedGreeting !== 'Thank You') {
      setThankYouIndex(0);
      return;
    }

    const intervalId = setInterval(() => {
      setThankYouIndex((prev) => (prev + 1) % THANK_YOU_IMAGES.length);
    }, 3000);

    return () => clearInterval(intervalId);
  }, [selectedGreeting]);

  // Cycle "Goodbye" images every 3 seconds when selected
  useEffect(() => {
    if (selectedGreeting !== 'Goodbye') {
      setGoodbyeIndex(0);
      return;
    }

    const intervalId = setInterval(() => {
      setGoodbyeIndex((prev) => (prev + 1) % GOODBYE_IMAGES.length);
    }, 3000);

    return () => clearInterval(intervalId);
  }, [selectedGreeting]);

  // Hard guard: user must finish Alphabet tiles (A–Z) before accessing Greetings
  useEffect(() => {
    const guard = async () => {
      if (!currentUser) return;
      const alphabetFinished = await canCompleteLesson(currentUser.uid, 'alphabet', 26);
      if (!alphabetFinished) {
        navigate('/lessons/alphabet');
      }
    };
    guard();
  }, [currentUser, navigate]);

  const checkCompletionStatus = async () => {
    if (currentUser) {
      try {
        const profile = await getUserProfile(currentUser.uid);
        const lessonsCompleted = profile?.progress?.lessonsCompleted || [];
        
        // Check if any lesson with 'greetings' category is completed
        const hasGreetingsLesson = lessonsCompleted.some(id => 
          id.includes('greetings') || id === 'lesson_greetings' || id.toLowerCase().includes('greetings')
        );
        setIsCompleted(hasGreetingsLesson);
      } catch (error) {
        console.error('Error checking completion status:', error);
      }
    }
  };

  const loadLessonProgress = async () => {
    if (currentUser) {
      try {
        const progress = await getLessonProgress(currentUser.uid, 'greetings');
        setLessonProgress(progress);
        
        // Determine which greetings are locked
        const locked = new Set();
        const lastIndex = progress?.lastViewedIndex ?? -1;
        greetings.forEach((greeting, index) => {
          if (index > lastIndex + 1) {
            locked.add(greeting);
          }
        });
        setLockedGreetings(locked);
      } catch (error) {
        console.error('Error loading lesson progress:', error);
      }
    }
  };

  const handleGreetingClick = async (greeting, index) => {
    if (!currentUser) return;
    
    // Check if greeting is locked
    if (lockedGreetings.has(greeting)) {
      const nextIndex = (lessonProgress?.lastViewedIndex ?? -1) + 1;
      const nextGreeting = greetings[nextIndex] || 'the next greeting';
      toast.warning(`Please view greetings in order. View "${nextGreeting}" first.`);
      return;
    }
    
    // Track progress
    const result = await trackLessonItemProgress(
      currentUser.uid,
      'greetings',
      greeting,
      index,
      greetings.length
    );
    
    if (result.success && result.canView) {
      setSelectedGreeting(greeting);
      // Reload progress to update locked greetings
      await loadLessonProgress();
      // Auto-complete Greetings when all items have been viewed
      if (result.allItemsViewed && !isCompleted) {
        try {
          await markLessonCompletedByCategory(currentUser.uid, 'greetings');
          setIsCompleted(true);
          toast.success('🎉 Greetings lesson complete! +50 points earned.', { duration: 5000 });
          createNotification({
            userId: currentUser.uid,
            type: NOTIFICATION_TYPES.LESSON_COMPLETED,
            title: 'Greetings lesson completed',
            message: 'Nice work! Numbers is now available.',
            link: '/lessons/numbers',
          });
        } catch (error) {
          console.error('Error auto-completing greetings lesson:', error);
        }
      }
    } else if (!result.canView) {
      toast.warning(result.message || 'Please view greetings in sequential order.');
    }
  };

  return (
    <div className="lesson-page">
      <div className="lesson-header">
        <h1>Lesson: Greetings</h1>
        <p>Learn common sign language greetings and phrases</p>
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
            <strong>Progress: {lessonProgress.viewedItems?.length || 0} / {greetings.length} greetings viewed</strong>
            {!isCompleted && (
              <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
                View all greetings in order — the lesson will complete automatically.
              </p>
            )}
          </div>
        )}
        <div className="greeting-grid">
          {greetings.map((greeting, index) => {
            const isLocked = lockedGreetings.has(greeting);
            const isViewed = lessonProgress?.viewedItems?.includes(greeting);
            return (
              <button
                key={greeting}
                className={`greeting-button ${selectedGreeting === greeting ? 'active' : ''} ${isLocked ? 'locked' : ''} ${isViewed ? 'viewed' : ''}`}
                onClick={() => handleGreetingClick(greeting, index)}
                disabled={isLocked}
                title={isLocked ? `View greetings in order. Next: ${greetings[(lessonProgress?.lastViewedIndex ?? -1) + 1] || 'N/A'}` : ''}
              >
                {greeting}
                {isLocked && <span className="lock-icon">🔒</span>}
                {isViewed && !isLocked && <span className="check-icon">✓</span>}
              </button>
            );
          })}
        </div>

        <div className="sign-display card">
          <h2>{selectedGreeting}</h2>
          <div className="sign-visual">
            <div className="sign-placeholder">
              {selectedGreeting === 'Thank You' ? (
                <>
                  <img
                    src={THANK_YOU_IMAGES[thankYouIndex]}
                    alt="ASL sign for Thank You"
                    className="sign-letter-svg"
                  />
                  <p>Sign for "Thank You"</p>
                </>
              ) : selectedGreeting === 'Goodbye' ? (
                <>
                  <img
                    src={GOODBYE_IMAGES[goodbyeIndex]}
                    alt="ASL sign for Goodbye"
                    className="sign-letter-svg"
                  />
                  <p>Sign for "Goodbye"</p>
                </>
              ) : selectedGreeting === 'Hello' ? (
                <>
                  <img
                    src={helloImg}
                    alt="ASL sign for Hello"
                    className="sign-letter-svg"
                  />
                  <p>Sign for "Hello"</p>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '4rem' }}>{GREETING_DESCRIPTIONS[selectedGreeting]?.emoji || '👋'}</span>
                  <p>Sign for "{selectedGreeting}"</p>
                </>
              )}
            </div>
          </div>
          <div className="sign-description">
            <h3>How to sign "{selectedGreeting}"</h3>
            {(() => {
              const info = GREETING_DESCRIPTIONS[selectedGreeting];
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
              Finish viewing all greetings to unlock the Numbers lesson.
            </p>
          )}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link to="/lessons/alphabet">
              <button className="secondary">← Back: Alphabet</button>
            </Link>
            {isCompleted ? (
              <Link to="/lessons/numbers">
                <button className="secondary">Next: Numbers →</button>
              </Link>
            ) : (
              <button
                className="secondary"
                disabled
                style={{ opacity: 0.7, cursor: 'not-allowed' }}
                title="Finish viewing all greetings to unlock Numbers"
              >
                🔒 Next: Numbers
              </button>
            )}
          </div>
      </div>
    </div>
  );
}

export default LessonGreetings;

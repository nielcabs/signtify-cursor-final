import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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

// Detailed ASL alphabet instructions for beginners
const letterInstructions = {
  A: {
    title: "Letter A in ASL",
    handshape: "Closed fist with thumb positioned alongside",
    steps: [
      "Start with your dominant hand open and fingers relaxed.",
      "Curl all four fingers (index, middle, ring, and pinky) tightly into your palm, creating a closed fist.",
      "Position your thumb against the side of your index finger - it should rest alongside the fist, not tucked inside.",
      "Keep your thumb straight and visible from the side view.",
      "Your palm should face sideways (to the left if right-handed, to the right if left-handed)."
    ],
    tips: [
      "The thumb should NOT be tucked inside your fist - it must be visible on the outside.",
      "Keep your fingers tucked neatly; don't let them stick out.",
      "This handshape appears in other ASL signs as well, so building a clear and consistent 'A' will make later vocabulary easier to learn."
    ],
    commonMistakes: "Avoid tucking your thumb inside your fist or letting your fingers stick out loosely."
  },
  B: {
    title: "Letter B in ASL",
    handshape: "Flat hand with fingers together and thumb tucked",
    steps: [
      "Extend all four fingers (index through pinky) straight up and keep them pressed together.",
      "Fold your thumb across your palm, tucking it underneath your fingers.",
      "Keep your fingers straight and parallel to each other - no gaps between them.",
      "Your palm should face toward the viewer (the person you're signing to).",
      "Hold your hand upright with fingers pointing upward."
    ],
    tips: [
      "Think of your hand as a flat board - all fingers should be straight and together.",
      "The thumb is hidden across the palm, not visible from the back of the hand.",
      "This is one of the easiest letters to form but requires keeping fingers straight."
    ],
    commonMistakes: "Don't let your fingers curl or spread apart. Make sure your thumb is tucked across your palm, not sticking out."
  },
  C: {
    title: "Letter C in ASL",
    handshape: "Curved hand forming a 'C' shape",
    steps: [
      "Start with your hand open and fingers spread slightly apart.",
      "Curve all four fingers (index through pinky) inward to form a semi-circle.",
      "Curve your thumb outward to meet your fingers, creating the shape of the letter 'C'.",
      "Your palm should face sideways, with the opening of the 'C' facing to the side.",
      "Keep your wrist straight and your hand relaxed but curved."
    ],
    tips: [
      "Imagine you're holding a small ball or cup - that's the curve you want.",
      "The space between your thumb and fingers should form a clear 'C' shape.",
      "This handshape appears in many ASL signs, so getting a clear 'C' shape will help you as you learn more vocabulary."
    ],
    commonMistakes: "Don't close your hand too tightly - the 'C' shape should be open and visible. Avoid pointing your palm directly at the viewer."
  },
  D: {
    title: "Letter D in ASL",
    handshape: "Index finger up with other fingers touching thumb",
    steps: [
      "Extend your index finger straight up toward the ceiling.",
      "Touch the tips of your middle, ring, and pinky fingers to the tip of your thumb, forming a circle.",
      "Keep your index finger perfectly straight and pointing upward.",
      "Your palm should face forward (toward the viewer).",
      "The circle formed by your thumb and three fingers should be clearly visible."
    ],
    tips: [
      "Think of this as an 'OK' gesture with your index finger pointing up.",
      "The circle should be round, not flattened.",
      "This handshape appears in many ASL signs, so a precise 'D' shape will support clear fingerspelling and later words."
    ],
    commonMistakes: "Make sure only your index finger is extended - don't let other fingers stick out. Keep the circle formed by your thumb and fingers tight."
  },
  E: {
    title: "Letter E in ASL",
    handshape: "Curved fingers tucked into palm with thumb tucked",
    steps: [
      "Start with your hand open and fingers relaxed.",
      "Curl all four fingers (index through pinky) down toward your palm.",
      "The fingertips should rest on or near the top of your palm, not in a tight fist.",
      "Tuck your thumb underneath your curled fingers.",
      "Your palm should face sideways, with fingers curved like a claw."
    ],
    tips: [
      "This looks similar to 'A' but with the fingers curved down, not in a tight fist.",
      "Your fingers should look like they're gently gripping something small.",
      "Keep your thumb hidden underneath your fingers."
    ],
    commonMistakes: "Don't make a tight fist like 'A' - the fingers should be curved, not flat against the palm. Don't let your thumb stick out."
  },
  F: {
    title: "Letter F in ASL",
    handshape: "Index finger touches thumb, other three fingers extended",
    steps: [
      "Touch the tip of your index finger to the tip of your thumb, forming a small circle.",
      "Extend your middle, ring, and pinky fingers straight up and spread them slightly apart.",
      "Keep the circle between your index finger and thumb tight and visible.",
      "Your palm should face forward (toward the viewer).",
      "The three extended fingers should be straight and relaxed."
    ],
    tips: [
      "This is the opposite of 'D' - instead of one finger up, you have three fingers up.",
      "The circle between index and thumb should be small, like you're making the 'OK' sign.",
      "This handshape appears in many ASL signs; focus on a small, clear circle so it is easy to read."
    ],
    commonMistakes: "Don't let your three extended fingers curl or touch each other. Make sure the circle between index and thumb is clearly visible."
  },
  G: {
    title: "Letter G in ASL",
    handshape: "Index finger and thumb extended parallel, pointing sideways",
    steps: [
      "Extend your index finger straight out to the side (horizontally).",
      "Extend your thumb parallel to your index finger, also pointing sideways.",
      "Curl your middle, ring, and pinky fingers into your palm.",
      "Your index finger and thumb should be about an inch apart, both pointing in the same direction.",
      "Point your hand sideways (to your left if right-handed)."
    ],
    tips: [
      "Think of your index finger and thumb as two legs of a person walking sideways.",
      "Keep your wrist straight and your arm at a comfortable angle.",
      "This handshape is similar to 'H' but with only the index finger extended."
    ],
    commonMistakes: "Don't point your index finger and thumb upward - they must point sideways. Keep your other three fingers tucked in."
  },
  H: {
    title: "Letter H in ASL",
    handshape: "Index and middle fingers extended horizontally, pointing sideways",
    steps: [
      "Extend your index and middle fingers together, pointing sideways (horizontally).",
      "Extend your thumb alongside your other two fingers (ring and pinky) that are curled into your palm.",
      "Keep your index and middle fingers pressed together and straight.",
      "Point your hand sideways (to your left if right-handed).",
      "Your palm should face downward."
    ],
    tips: [
      "This is like 'U' but turned sideways and pointing horizontally.",
      "Think of two people walking in the same direction - your two extended fingers.",
      "Keep your fingers together, not spread apart."
    ],
    commonMistakes: "Don't point your fingers upward - they must point sideways horizontally. Don't spread your index and middle fingers apart."
  },
  I: {
    title: "Letter I in ASL",
    handshape: "Pinky finger extended up, other fingers in fist with thumb",
    steps: [
      "Curl your index, middle, and ring fingers into your palm, making a fist.",
      "Extend your pinky finger straight up toward the ceiling.",
      "Place your thumb across your curled fingers (over the index and middle fingers).",
      "Your palm should face sideways.",
      "Keep your pinky finger straight and pointing upward."
    ],
    tips: [
      "This is the 'pinky promise' finger extended up.",
      "Only your pinky should be extended - all other fingers are in a fist.",
      "This handshape appears in many ASL signs; keeping only the pinky extended makes the letter easy to recognize."
    ],
    commonMistakes: "Don't extend any finger other than your pinky. Make sure your pinky is straight, not curved."
  },
  J: {
    title: "Letter J in ASL",
    handshape: "Pinky extended (like 'I'), with a hooking motion",
    steps: [
      "Start with the same handshape as 'I' - pinky extended up, other fingers in a fist.",
      "Your palm should face sideways.",
      "Draw the letter 'J' in the air with your pinky finger.",
      "Move your pinky down in a straight line, then curve it to the left (like a fishhook).",
      "The motion is like writing a 'J' in cursive with your pinky."
    ],
    tips: [
      "This is the only letter besides 'Z' that requires movement.",
      "Think of dipping a hook into water - that's the motion.",
      "The movement should be smooth and continuous."
    ],
    commonMistakes: "Don't make the motion too large or too small. Remember to start with the 'I' handshape before moving."
  },
  K: {
    title: "Letter K in ASL",
    handshape: "Index and middle fingers extended in a V, thumb between them",
    steps: [
      "Extend your index and middle fingers upward, spread apart in a V shape.",
      "Place your thumb between your index and middle fingers, touching the middle finger.",
      "Curl your ring and pinky fingers into your palm.",
      "Your palm should face forward (toward the viewer).",
      "The thumb should be visible between the two extended fingers."
    ],
    tips: [
      "This is like the 'V' handshape but with your thumb inserted between the fingers.",
      "Your thumb should touch the middle finger, not just float between them.",
      "This handshape appears in many ASL signs, so a neat 'K' shape will make your handshapes look more natural."
    ],
    commonMistakes: "Don't let your thumb stick out to the side - it must be between your index and middle fingers. Keep your ring and pinky fingers tucked in."
  },
  L: {
    title: "Letter L in ASL",
    handshape: "Index finger and thumb extended at right angle, other fingers curled",
    steps: [
      "Extend your index finger straight up toward the ceiling.",
      "Extend your thumb straight out to the side, forming a 90-degree angle with your index finger.",
      "Curl your middle, ring, and pinky fingers into your palm.",
      "Your palm should face forward (toward the viewer).",
      "The shape should clearly resemble the letter 'L'."
    ],
    tips: [
      "This is one of the most recognizable ASL letters - it literally looks like 'L'.",
      "Your index finger and thumb should form a perfect right angle (90 degrees).",
      "This handshape appears in many ASL signs; a clear 'L' shape will make both fingerspelling and vocabulary easier."
    ],
    commonMistakes: "Don't let your thumb curve - keep it straight. Make sure your other three fingers are fully tucked into your palm."
  },
  M: {
    title: "Letter M in ASL",
    handshape: "Three fingers wrapped over thumb",
    steps: [
      "Tuck your thumb across your palm.",
      "Wrap your index, middle, and ring fingers over your thumb.",
      "Your pinky finger can rest alongside your ring finger or be tucked in as well.",
      "The three fingers should lay flat over your thumb, like three legs.",
      "Your palm should face sideways."
    ],
    tips: [
      "Think of 'M' as having three fingers (legs) over the thumb - M has three points.",
      "This is similar to 'N' but with three fingers instead of two.",
      "The fingers should lay flat, not in a tight fist."
    ],
    commonMistakes: "Don't curl your fingers into a fist - they should lay flat over your thumb. Make sure all three fingers are visible."
  },
  N: {
    title: "Letter N in ASL",
    handshape: "Two fingers wrapped over thumb",
    steps: [
      "Tuck your thumb across your palm.",
      "Wrap your index and middle fingers over your thumb.",
      "Your ring and pinky fingers should be curled into your palm.",
      "The two fingers should lay flat over your thumb, like two legs.",
      "Your palm should face sideways."
    ],
    tips: [
      "Think of 'N' as having two fingers (legs) over the thumb - N has two points.",
      "This is similar to 'M' but with two fingers instead of three.",
      "The fingers should lay flat, not in a tight fist."
    ],
    commonMistakes: "Don't use three fingers like 'M' - only index and middle go over the thumb. Keep your ring and pinky tucked in."
  },
  O: {
    title: "Letter O in ASL",
    handshape: "All fingertips touching to form an oval",
    steps: [
      "Bring all four fingertips (index through pinky) together.",
      "Touch all four fingertips to the tip of your thumb, forming an oval or circle.",
      "Your fingers should be curved, not straight.",
      "The shape should look like you're holding a small ball.",
      "Your palm should face sideways."
    ],
    tips: [
      "Think of making the shape of an egg or small ball in your hand.",
      "All five fingertips should meet at the same point.",
      "This handshape appears in many ASL signs, so forming a smooth, rounded 'O' will be useful later."
    ],
    commonMistakes: "Don't flatten your fingers - they should be curved. Make sure all fingertips touch, not just some of them."
  },
  P: {
    title: "Letter P in ASL",
    handshape: "Like 'K' but pointing downward",
    steps: [
      "Extend your index and middle fingers downward, spread apart in a V shape.",
      "Place your thumb between your index and middle fingers, touching the middle finger.",
      "Curl your ring and pinky fingers into your palm.",
      "Point your hand downward (toward the ground).",
      "Your fingers should point down at an angle, not straight down."
    ],
    tips: [
      "This is exactly like 'K' but turned so your fingers point downward.",
      "Think of 'P' as 'K' pointing down (P comes after K in the alphabet).",
      "The angle should be about 45 degrees downward."
    ],
    commonMistakes: "Don't point your fingers straight down - they should angle forward. Don't confuse this with 'K' which points upward."
  },
  Q: {
    title: "Letter Q in ASL",
    handshape: "Like 'G' but pointing downward",
    steps: [
      "Extend your index finger and thumb downward, parallel to each other.",
      "Curl your middle, ring, and pinky fingers into your palm.",
      "Your index finger and thumb should be about an inch apart.",
      "Point your hand downward (toward the ground).",
      "Your fingers should point down at an angle, like 'G' turned downward."
    ],
    tips: [
      "This is exactly like 'G' but turned so your fingers point downward.",
      "Think of 'Q' as 'G' pointing down (Q comes after G in the alphabet).",
      "The angle should be about 45 degrees downward."
    ],
    commonMistakes: "Don't point your fingers straight down - they should angle forward. Don't confuse this with 'G' which points sideways."
  },
  R: {
    title: "Letter R in ASL",
    handshape: "Index and middle fingers crossed",
    steps: [
      "Extend your index and middle fingers upward.",
      "Cross your middle finger over your index finger.",
      "Curl your ring and pinky fingers into your palm.",
      "Your thumb can rest against your curled fingers or tuck across them.",
      "Your palm should face forward (toward the viewer)."
    ],
    tips: [
      "This is the classic 'crossed fingers' gesture for good luck.",
      "The middle finger goes in front of (over) the index finger.",
      "This handshape appears in many ASL signs; keeping the fingers neatly crossed makes the letter easy to see."
    ],
    commonMistakes: "Don't cross your index over your middle - middle goes over index. Keep your ring and pinky fingers tucked in."
  },
  S: {
    title: "Letter S in ASL",
    handshape: "Fist with thumb wrapped over fingers",
    steps: [
      "Curl all four fingers (index through pinky) tightly into your palm.",
      "Wrap your thumb over your curled fingers, across the index and middle fingers.",
      "Your thumb should be visible on the outside of your fist.",
      "Make a tight fist with all fingers secured.",
      "Your palm should face sideways."
    ],
    tips: [
      "This is like 'A' but with your thumb wrapped over your fingers instead of alongside.",
      "Think of making a strong fist - that's the 'S' handshape.",
      "This handshape appears in many ASL signs, so a strong, clear 'S' will help your signing look more confident."
    ],
    commonMistakes: "Don't position your thumb alongside your fingers like 'A' - it must wrap over them. Make sure your fist is tight."
  },
  T: {
    title: "Letter T in ASL",
    handshape: "Fist with thumb inserted between index and middle fingers",
    steps: [
      "Curl your index, middle, ring, and pinky fingers into your palm.",
      "Insert your thumb between your index and middle fingers from underneath.",
      "The pad of your thumb should be visible between the two fingers.",
      "Your fingers should close around your thumb.",
      "Your palm should face sideways."
    ],
    tips: [
      "Think of your thumb poking up between your index and middle fingers.",
      "The thumb comes from underneath, not over the top.",
      "This handshape appears in many ASL signs; keeping the thumb clearly between the fingers is important for accuracy."
    ],
    commonMistakes: "Don't wrap your thumb over your fingers like 'S' - it must be inserted between index and middle. Make sure the thumb pad is visible."
  },
  U: {
    title: "Letter U in ASL",
    handshape: "Index and middle fingers extended together upward",
    steps: [
      "Extend your index and middle fingers straight up, pressed together.",
      "Curl your ring and pinky fingers into your palm.",
      "Rest your thumb across your ring and pinky fingers (or tuck it alongside).",
      "Keep your two extended fingers together, not spread apart.",
      "Your palm should face forward (toward the viewer)."
    ],
    tips: [
      "This is like a peace sign but with fingers together, not spread.",
      "Think of your two fingers as one unit pointing upward.",
      "This handshape appears in many ASL signs; think of it as a building block you will reuse often."
    ],
    commonMistakes: "Don't spread your index and middle fingers apart - they must be together. Don't confuse this with 'V' or 'H'."
  },
  V: {
    title: "Letter V in ASL",
    handshape: "Index and middle fingers extended in a V shape",
    steps: [
      "Extend your index and middle fingers upward, spread apart in a V shape.",
      "Curl your ring and pinky fingers into your palm.",
      "Rest your thumb across your ring and pinky fingers (or tuck it alongside).",
      "Keep your two extended fingers spread apart to form a clear V.",
      "Your palm should face forward (toward the viewer)."
    ],
    tips: [
      "This is the classic 'peace sign' or 'victory sign' handshape.",
      "The spread between your fingers should be visible but not exaggerated.",
      "This handshape appears in many ASL signs, so practice holding a relaxed but clear 'V' shape."
    ],
    commonMistakes: "Don't keep your fingers together like 'U' - they must be spread apart. Don't spread them too wide either."
  },
  W: {
    title: "Letter W in ASL",
    handshape: "Three fingers extended in a W shape",
    steps: [
      "Extend your index, middle, and ring fingers upward, spread apart.",
      "Curl your pinky finger into your palm.",
      "Rest your thumb across your pinky finger (or tuck it alongside).",
      "The three extended fingers should form a 'W' shape (like three spokes).",
      "Your palm should face forward (toward the viewer)."
    ],
    tips: [
      "Think of this as 'V' with an extra finger (ring finger) added.",
      "The three fingers should be evenly spread apart.",
      "This handshape appears in many ASL signs; three clear, evenly spaced fingers make the 'W' easy to read."
    ],
    commonMistakes: "Don't extend your pinky - only three fingers go up. Make sure all three fingers are spread apart, not touching."
  },
  X: {
    title: "Letter X in ASL",
    handshape: "Index finger curved like a hook",
    steps: [
      "Extend your index finger upward, then curve the tip down like a hook.",
      "Curl your middle, ring, and pinky fingers into your palm.",
      "Rest your thumb across your curled fingers or tuck it alongside.",
      "Your index finger should look like a hook or the letter 'X'.",
      "Your palm should face sideways."
    ],
    tips: [
      "Think of your index finger as forming the shape of a hook.",
      "Only the index finger is involved - the tip curves down.",
      "This handshape appears in many ASL signs, so keeping the index finger hooked and the others tucked is important."
    ],
    commonMistakes: "Don't keep your index finger straight - it must curve at the tip. Don't extend any other fingers."
  },
  Y: {
    title: "Letter Y in ASL",
    handshape: "Thumb and pinky extended, other fingers curled",
    steps: [
      "Extend your thumb straight out to the side.",
      "Extend your pinky finger straight up.",
      "Curl your index, middle, and ring fingers into your palm.",
      "Your thumb and pinky should form a 'Y' shape.",
      "Your palm should face forward (toward the viewer)."
    ],
    tips: [
      "This is the 'hang loose' or 'shaka' sign from Hawaiian culture.",
      "Think of your thumb and pinky as the two arms of the letter 'Y'.",
      "This handshape appears in many ASL signs; a relaxed 'Y' will feel more natural over time."
    ],
    commonMistakes: "Don't extend any fingers other than thumb and pinky. Make sure your thumb points to the side, not up."
  },
  Z: {
    title: "Letter Z in ASL",
    handshape: "Index finger extended, drawing a Z in the air",
    steps: [
      "Extend your index finger straight up, like pointing at something.",
      "Curl your middle, ring, and pinky fingers into your palm.",
      "Rest your thumb across your curled fingers or tuck it alongside.",
      "Draw the letter 'Z' in the air with your index finger.",
      "Move: right, left-down diagonal, right (like writing 'Z')."
    ],
    tips: [
      "This is one of only two letters (with 'J') that requires movement.",
      "Draw the 'Z' in front of you, about chest height.",
      "The motion should be smooth and continuous."
    ],
    commonMistakes: "Don't make the 'Z' too small or too large. Remember to use your index finger only, not your whole hand."
  }
};

function LessonAlphabet() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const [selectedLetter, setSelectedLetter] = useState('A');
  const [isCompleted, setIsCompleted] = useState(false);
  const [lessonProgress, setLessonProgress] = useState(null);
  const [lockedLetters, setLockedLetters] = useState(new Set());

  useEffect(() => {
    checkCompletionStatus();
    loadLessonProgress();
  }, [currentUser]);

  const checkCompletionStatus = async () => {
    if (currentUser) {
      try {
        const profile = await getUserProfile(currentUser.uid);
        const lessonsCompleted = profile?.progress?.lessonsCompleted || [];
        
        // Check if any lesson with 'alphabet' category is completed
        const hasAlphabetLesson = lessonsCompleted.some(id => 
          id.includes('alphabet') || id === 'lesson_alphabet' || id.toLowerCase().includes('alphabet')
        );
        setIsCompleted(hasAlphabetLesson);
      } catch (error) {
        console.error('Error checking completion status:', error);
      }
    }
  };

  const loadLessonProgress = async () => {
    if (currentUser) {
      try {
        const progress = await getLessonProgress(currentUser.uid, 'alphabet');
        setLessonProgress(progress);
        
        // Determine which letters are locked
        const locked = new Set();
        const lastIndex = progress?.lastViewedIndex ?? -1;
        alphabet.forEach((letter, index) => {
          if (index > lastIndex + 1) {
            locked.add(letter);
          }
        });
        setLockedLetters(locked);
      } catch (error) {
        console.error('Error loading lesson progress:', error);
      }
    }
  };

  const handleLetterClick = async (letter, index) => {
    if (!currentUser) return;
    
    // Check if letter is locked
    if (lockedLetters.has(letter)) {
      toast.warning(`Please view letters in order. View A–${String.fromCharCode(letter.charCodeAt(0) - 1)} first.`);
      return;
    }
    
    // Track progress
    const result = await trackLessonItemProgress(
      currentUser.uid,
      'alphabet',
      letter,
      index,
      alphabet.length
    );
    
    if (result.success && result.canView) {
      setSelectedLetter(letter);
      // Reload progress to update locked letters
      await loadLessonProgress();

      // If all letters have been viewed, auto-complete the lesson (first time only)
      if (result.allItemsViewed && !isCompleted) {
        try {
          await markLessonCompletedByCategory(currentUser.uid, 'alphabet');
          setIsCompleted(true);
          toast.success('🎉 Alphabet lesson complete! Mini Quiz & Proficiency Exam unlocked. +50 points', { duration: 6000 });
          createNotification({
            userId: currentUser.uid,
            type: NOTIFICATION_TYPES.LESSON_COMPLETED,
            title: 'Alphabet lesson completed',
            message: 'Great job! You unlocked the Alphabet Mini Quiz and Proficiency Exam.',
            link: '/quizzes',
          });
        } catch (error) {
          console.error('Error auto-completing alphabet lesson:', error);
        }
      }
    } else if (!result.canView) {
      toast.warning(result.message || 'Please view letters in sequential order.');
    }
  };

  return (
    <div className="lesson-page">
      <div className="lesson-header">
        <h1>Lesson: Alphabet</h1>
        <p>Learn the sign language alphabet from A to Z</p>
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
            <strong>Progress: {lessonProgress.viewedItems?.length || 0} / {alphabet.length} letters viewed</strong>
            {!isCompleted && (
              <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
                View all letters from A to Z in order — the lesson will complete automatically.
              </p>
            )}
          </div>
        )}
        <div className="letter-grid">
          {alphabet.map((letter, index) => {
            const isLocked = lockedLetters.has(letter);
            const isViewed = lessonProgress?.viewedItems?.includes(letter);
            return (
              <button
                key={letter}
                className={`letter-button ${selectedLetter === letter ? 'active' : ''} ${isLocked ? 'locked' : ''} ${isViewed ? 'viewed' : ''}`}
                onClick={() => handleLetterClick(letter, index)}
                disabled={isLocked}
                title={isLocked ? `View letters in order. Next: ${String.fromCharCode(65 + (lessonProgress?.lastViewedIndex ?? -1) + 1)}` : ''}
              >
                {letter}
                {isLocked && <span className="lock-icon">🔒</span>}
                {isViewed && !isLocked && <span className="check-icon">✓</span>}
              </button>
            );
          })}
        </div>

        <div className="sign-display card">
          <h2>Letter: {selectedLetter}</h2>
          <div className="sign-visual">
            <div className="sign-placeholder">
              <img src={`/asl/${selectedLetter}.svg`} alt={`Sign for ${selectedLetter}`} className={`sign-letter-svg ${selectedLetter === 'I' ? 'sign-letter-i' : ''} ${selectedLetter === 'H' ? 'sign-letter-h' : ''}`} />
              <p>Sign for "{selectedLetter}"</p>
            </div>
          </div>
          <div className="sign-description">
            <h3>How to sign "{selectedLetter}"</h3>
            {(() => {
              const instruction = letterInstructions[selectedLetter];
              return (
                <div className="letter-instructions">
                  <p className="handshape-summary">
                    <strong>Handshape:</strong> {instruction.handshape}
                  </p>
                  
                  <div className="instruction-section">
                    <h4>Step-by-Step Instructions:</h4>
                    <ol className="steps-list">
                      {instruction.steps.map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                  </div>
                  
                  <div className="instruction-section tips-section">
                    <h4>💡 Helpful Tips:</h4>
                    <ul className="tips-list">
                      {instruction.tips.map((tip, index) => (
                        <li key={index}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="instruction-section mistakes-section">
                    <h4>⚠️ Common Mistakes to Avoid:</h4>
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
            Finish viewing all letters A–Z to unlock the next lesson.
          </p>
        )}
        {isCompleted ? (
          <Link to="/lessons/greetings">
          <button className="secondary">Next: Greetings →</button>
          </Link>
        ) : (
          <button
            className="secondary"
            disabled
            style={{ opacity: 0.7, cursor: 'not-allowed' }}
            title="Finish viewing all letters A–Z to unlock the next lesson"
          >
            🔒 Next: Greetings
          </button>
        )}
      </div>
    </div>
  );
}

export default LessonAlphabet;

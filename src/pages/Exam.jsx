import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../auth/firebase';
import { useAuth } from '../auth/AuthContext';
import { saveExamResult, getUserProfile } from '../auth/firestoreUtils';
import { resolveSignImageUrl } from '../assets/signImageMap';
import { getValidExamQuestions } from '../utils/examQuestions';
import { useToast } from '../components/ui/Toast';
import ExamCameraVerifier from '../components/ExamCameraVerifier';
import '../styles/pages/Quiz.css';

const DEFAULT_PASSING_SCORE = 80;
const DEFAULT_TIME_LIMIT_MIN = 30;

/** Fisher-Yates shuffle (non-mutating). */
const shuffled = (array) => {
  const out = Array.from(array);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** Format seconds as MM:SS. */
const formatTime = (totalSeconds) => {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const normalizeText = (value) => String(value || '').toLowerCase().trim().replace(/\s+/g, ' ');

const inferCameraExpectedSign = (question, category) => {
  const directAnswer = String(question?.answer || '').trim();
  const questionText = String(question?.question || '');
  const options = Array.isArray(question?.options) ? question.options : [];

  const qLower = questionText.toLowerCase();
  const dCompact = directAnswer.toLowerCase().replace(/\s+/g, ' ').trim();
  const answerIsCommaIly = /^i\s*,\s*l\s*,\s*y\.?$/.test(dCompact) || dCompact.replace(/\s/g, '') === 'i,l,y';
  const answerIsILoveYou = /i\s*love\s*you/i.test(directAnswer);

  const ilyOption = options.find((o) => /i\s*love\s*you/i.test(String(o).trim()));
  if (ilyOption) {
    if (
      answerIsCommaIly ||
      answerIsILoveYou ||
      /i\s*,\s*l\s*,\s*y/.test(qLower) ||
      (/converted to/i.test(qLower) && (answerIsCommaIly || answerIsILoveYou || /i\s*,\s*l\s*,\s*y/.test(qLower)))
    ) {
      return ilyOption;
    }
  }

  /** Bad Firestore rows sometimes omit "I love you" in options — camera still needs this phrase for ILY detection. */
  if (
    answerIsCommaIly ||
    answerIsILoveYou ||
    (/converted to/i.test(qLower) && (/i\s*,\s*l\s*,\s*y/.test(qLower) || answerIsCommaIly || answerIsILoveYou))
  ) {
    return 'I love you';
  }

  const mode = normalizeText(category) === 'alphabet'
    ? 'letters'
    : (normalizeText(category) === 'numbers' ? 'numbers' : 'words');

  const isModeShapedAnswer = mode === 'letters'
    ? /^[a-z]$/i.test(directAnswer)
    : mode === 'numbers'
      ? /^(?:[0-9]|10)$/.test(directAnswer)
      : directAnswer.length > 0 && directAnswer.length <= 24;

  if (isModeShapedAnswer) return directAnswer;

  const m = questionText.match(/for\s+(.+?)\??$/i);
  if (m?.[1]) {
    const extracted = m[1].trim().replace(/\?+$/, '');
    const optionMatch = options.find((opt) => normalizeText(opt) === normalizeText(extracted));
    return optionMatch || extracted;
  }

  const how = questionText.match(/do\s+a\s+(.+?)\s+sign\s+language/i);
  if (how?.[1]) {
    const extracted = how[1].trim().replace(/\?+$/, '');
    const optionMatch = options.find((opt) => normalizeText(opt) === normalizeText(extracted));
    return optionMatch || extracted;
  }

  if (mode === 'letters') {
    const aslQuoted = questionText.match(/\basl\s*['`]([a-z])['`]/i);
    if (aslQuoted?.[1]) {
      const ch = aslQuoted[1].toUpperCase();
      const optionMatch = options.find((opt) => normalizeText(opt) === normalizeText(ch));
      return optionMatch || ch;
    }
  }

  const optionFromQuestion = options.find((opt) => questionText.toLowerCase().includes(String(opt).toLowerCase()));
  if (optionFromQuestion) return optionFromQuestion;

  if (/i\s*,\s*l\s*,\s*y/i.test(questionText)) {
    const ilyOpt = options.find((opt) => /i\s*love\s*you/i.test(String(opt)));
    if (ilyOpt) return ilyOpt;
  }

  return directAnswer;
};

/**
 * ILY uses word-mode detection. Alphabet-category exams that include an ILY trivia row must not use letter-only mode.
 */
const resolveCameraDetectionCategory = (question, examCategory) => {
  const cat = normalizeText(examCategory || '');
  if (cat !== 'alphabet') return examCategory;
  const cam = inferCameraExpectedSign(question, examCategory);
  const exp = normalizeText(cam);
  const qt = normalizeText(String(question?.question || ''));
  const opts = Array.isArray(question?.options) ? question.options : [];
  const hasIlyOption = opts.some((o) => /i\s*love\s*you/i.test(String(o)));
  if (
    exp.includes('i love you') ||
    /i\s*,\s*l\s*,\s*y/.test(exp) ||
    /i\s*,\s*l\s*,\s*y/.test(qt) ||
    (/converted to/.test(qt) && (hasIlyOption || exp.includes('i love you')))
  ) {
    return 'daily-conversation';
  }
  return examCategory;
};

function Exam() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const toast = useToast();

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bestScore, setBestScore] = useState(null);

  // Randomized per-attempt question list. Each item has { ...question, options: shuffledOptions }.
  const [attempt, setAttempt] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  // answers[i] = user's selected string for question i (null if not answered)
  const [answers, setAnswers] = useState([]);
  const [showResult, setShowResult] = useState(false);
  const [saving, setSaving] = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(null);
  const timerRef = useRef(null);
  // Prevent double-submit when finishing manually at the same moment the timer ticks to 0
  const finishingRef = useRef(false);
  const advancingRef = useRef(false);
  const currentIndexRef = useRef(0);
  const attemptLengthRef = useRef(0);
  /** Always read latest rows in finishExam (avoids stale closure from setTimeout after camera submit). */
  const attemptRef = useRef(null);
  const answersRef = useRef([]);

  // ---- Data loading ----

  useEffect(() => {
    const loadExam = async () => {
      try {
        setLoading(true);
        const examRef = doc(db, 'exams', examId);
        const examDoc = await getDoc(examRef);
        if (examDoc.exists()) {
          const data = examDoc.data();
          const questions = getValidExamQuestions(data.questions);
          setExam({ id: examDoc.id, ...data, questions });
        } else {
          setError('Exam not found');
        }
      } catch (err) {
        console.error('Error loading exam:', err);
        setError('Failed to load exam');
      } finally {
        setLoading(false);
      }
    };
    loadExam();
  }, [examId]);

  useEffect(() => {
    const loadBestScore = async () => {
      if (!currentUser) return;
      try {
        const profile = await getUserProfile(currentUser.uid);
        const examAttempts = (profile?.progress?.examsPassed || []).filter(
          (e) => String(e.examId) === String(examId)
        );
        if (examAttempts.length > 0) {
          setBestScore(Math.max(...examAttempts.map((e) => e.percentage)));
        }
      } catch (err) {
        console.error('Error loading best score:', err);
      }
    };
    loadBestScore();
  }, [currentUser, examId]);

  // ---- Build randomized attempt once the exam is loaded ----

  useEffect(() => {
    if (!exam || !Array.isArray(exam.questions) || exam.questions.length === 0) return;
    const randomized = shuffled(exam.questions).map((q) => ({
      ...q,
      options: Array.isArray(q.options) ? shuffled(q.options) : [],
    }));
    setAttempt(randomized);
    setAnswers(new Array(randomized.length).fill(null));
    setCurrentIndex(0);
    setShowResult(false);
    setTimeExpired(false);

    const minutes = Number.isFinite(exam.timeLimit) && exam.timeLimit > 0
      ? exam.timeLimit
      : DEFAULT_TIME_LIMIT_MIN;
    setTimeRemaining(minutes * 60);
  }, [exam]);

  useEffect(() => {
    attemptRef.current = attempt;
  }, [attempt]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // ---- Score computation ----

  const { correctCount, percentage, passingScore } = useMemo(() => {
    if (!attempt) return { correctCount: 0, percentage: 0, passingScore: DEFAULT_PASSING_SCORE };
    let correct = 0;
    for (let i = 0; i < attempt.length; i++) {
      if (answers[i] !== null && answers[i] === attempt[i].answer) correct += 1;
    }
    const pct = attempt.length > 0 ? Math.round((correct / attempt.length) * 100) : 0;
    const pass = Number.isFinite(exam?.passingScore) ? exam.passingScore : DEFAULT_PASSING_SCORE;
    return { correctCount: correct, percentage: pct, passingScore: pass };
  }, [attempt, answers, exam]);

  // ---- Finishing ----

  const finishExam = useCallback(async ({ auto = false } = {}) => {
    const att = attemptRef.current;
    if (finishingRef.current || !att?.length) return;
    finishingRef.current = true;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setShowResult(true);
    if (auto) setTimeExpired(true);

    if (currentUser && exam) {
      setSaving(true);
      try {
        const ans = answersRef.current;
        let correct = 0;
        for (let i = 0; i < att.length; i++) {
          if (ans[i] !== null && ans[i] === att[i].answer) correct += 1;
        }
        await saveExamResult(
          currentUser.uid,
          examId,
          correct,
          att.length,
          exam.category,
        );

        const newBest = Math.round((correct / att.length) * 100);
        setBestScore((prev) => (prev === null ? newBest : Math.max(prev, newBest)));
      } catch (err) {
        console.error('Error saving exam result:', err);
        toast.error('Saved locally but failed to sync exam result.');
      } finally {
        setSaving(false);
      }
    }
  }, [currentUser, exam, examId, toast]);

  // ---- Timer ----

  useEffect(() => {
    // Don't start timer until an attempt exists and we haven't finished yet.
    if (!attempt || showResult || timeRemaining === null) return undefined;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null) return prev;
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          // Defer finish so we don't setState during another setState
          setTimeout(() => {
            toast.warning("Time's up — your exam was submitted automatically.");
            finishExam({ auto: true });
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [attempt, showResult, finishExam, toast, timeRemaining === null]);

  // ---- Handlers ----

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    attemptLengthRef.current = attempt?.length || 0;
  }, [attempt]);

  const handleCameraCorrect = useCallback(() => {
    if (!attempt || showResult || advancingRef.current) return;
    const idx = currentIndexRef.current;
    const q = attempt[idx];
    if (!q) return;

    advancingRef.current = true;
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = q.answer;
      answersRef.current = next;
      return next;
    });

    setTimeout(() => {
      if (idx < attemptLengthRef.current - 1) {
        setCurrentIndex((prev) => Math.min(prev + 1, attemptLengthRef.current - 1));
      } else {
        finishExam({ auto: false });
      }
      advancingRef.current = false;
    }, 700);
  }, [attempt, finishExam, showResult]);

  // ---- Rendering ----

  if (loading) {
    return (
      <div className="quiz-page">
        <div className="loading-container"><p>Loading exam...</p></div>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="quiz-page">
        <div className="error-container card">
          <h2>⚠️ {error || 'Exam not found'}</h2>
          <p>This exam may have been removed or doesn't exist.</p>
          <button onClick={() => navigate('/proficiency-exams')}>Return to Exams</button>
        </div>
      </div>
    );
  }

  if (!attempt || attempt.length === 0) {
    return (
      <div className="quiz-page">
        <div className="error-container card">
          <h2>⚠️ No Questions Available</h2>
          <p>
            This exam has no playable questions yet. Each question needs a correct answer and at least two
            options. Ask a teacher to open <strong>Teacher Dashboard → Exams</strong> and edit this exam.
          </p>
          <button onClick={() => navigate('/proficiency-exams')}>Return to Exams</button>
        </div>
      </div>
    );
  }

  // ---- Result screen ----
  if (showResult) {
    const isNewBest = bestScore !== null && percentage === bestScore && percentage > 0;
    const passed = percentage >= passingScore;

    return (
      <div className="quiz-page">
        <div className="quiz-result card">
          <h1>Proficiency Exam Complete!</h1>
          {timeExpired && (
            <p className="exam-time-expired-banner">
              ⏱️ Time expired — your exam was submitted automatically.
            </p>
          )}
          {saving && <p className="saving-text">Saving your results…</p>}

          <div className={`score-display ${passed ? 'pass' : 'fail'}`}>
            <div className="score-circle">
              <span className="score-number">{percentage}%</span>
            </div>
            <p className="score-text">{correctCount} out of {attempt.length} correct</p>
          </div>

          {bestScore !== null && (
            <div className="score-comparison">
              {isNewBest ? (
                <div className="new-best-banner">
                  🏆 <strong>New Best Score!</strong>
                </div>
              ) : (
                <div className="best-score-info">
                  Your Best: <strong>{bestScore}%</strong>
                </div>
              )}
            </div>
          )}

          {passed ? (
            <div className="result-message success">
              <h2>🎉 Excellent Performance!</h2>
              <p>Congratulations! You passed the proficiency exam.</p>
            </div>
          ) : (
            <div className="result-message">
              <h2>Keep Trying!</h2>
              <p>You need {passingScore}% to pass. Review your answers below and try again.</p>
            </div>
          )}

          {/* ---- Question-by-question review ---- */}
          <div className="exam-review">
            <h2 className="exam-review-title">Review your answers</h2>
            <ul className="exam-review-list">
              {attempt.map((q, i) => {
                const userAnswer = answers[i];
                const isCorrect = userAnswer === q.answer;
                const unanswered = userAnswer === null;
                return (
                  <li
                    key={`review-${i}`}
                    className={`exam-review-item ${isCorrect ? 'exam-review-item-correct' : 'exam-review-item-incorrect'}`}
                  >
                    <div className="exam-review-head">
                      <span className="exam-review-index">Q{i + 1}</span>
                      <span className="exam-review-status" aria-hidden="true">
                        {isCorrect ? '✓' : '✗'}
                      </span>
                      <span className="exam-review-prompt">{q.question}</span>
                    </div>
                    {resolveSignImageUrl(q.imageUrl) && (
                      <div className="exam-review-image">
                        <img src={resolveSignImageUrl(q.imageUrl)} alt="Sign" />
                      </div>
                    )}
                    <div className="exam-review-answers">
                      <div className="exam-review-answer-row">
                        <span className="exam-review-answer-label">Your answer:</span>
                        <span className={`exam-review-answer-value ${unanswered ? 'exam-review-answer-missing' : (isCorrect ? 'exam-review-answer-correct' : 'exam-review-answer-wrong')}`}>
                          {unanswered ? 'No answer' : userAnswer}
                        </span>
                      </div>
                      {!isCorrect && (
                        <div className="exam-review-answer-row">
                          <span className="exam-review-answer-label">Correct answer:</span>
                          <span className="exam-review-answer-value exam-review-answer-correct">
                            {q.answer}
                          </span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="result-actions">
            <button onClick={() => navigate('/proficiency-exams')}>Return to Exams</button>
            <button onClick={() => navigate('/profile')} className="secondary">View Profile</button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Active exam screen ----
  const question = attempt[currentIndex];
  const cameraExpectedSign = inferCameraExpectedSign(question, exam.category);
  const cameraDetectionCategory = resolveCameraDetectionCategory(question, exam.category);
  const answeredCount = answers.filter((a) => a !== null).length;
  const timerDanger = timeRemaining !== null && timeRemaining <= 60;

  return (
    <div className="quiz-page">
      <div className="quiz-header">
        <h1>{exam.title || 'Proficiency Exam'}</h1>
        {(exam.instructor || exam.instructorName) && (
          <p className="exam-instructor-sub">
            Instructor: <strong>{exam.instructor || exam.instructorName}</strong>
          </p>
        )}
        <div className="exam-header-badges">
          {bestScore !== null && (
            <div className="best-score-badge">
              <span className="badge-label">Best:</span>
              <span className="badge-value">{bestScore}%</span>
            </div>
          )}
          {timeRemaining !== null && (
            <div className={`exam-timer ${timerDanger ? 'exam-timer-danger' : ''}`} aria-live="polite">
              <span className="exam-timer-icon" aria-hidden="true">⏱️</span>
              <span className="exam-timer-value">{formatTime(timeRemaining)}</span>
            </div>
          )}
        </div>
        <div className="quiz-progress">
          <span>
            Question {currentIndex + 1} of {attempt.length}
            <span className="quiz-answered-count"> · {answeredCount} answered</span>
          </span>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${((currentIndex + 1) / attempt.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="quiz-content card">
        <div className="question-display">
          <div className="sign-visual">
            {resolveSignImageUrl(question.imageUrl) ? (
              <div className="sign-image">
                <img
                  src={resolveSignImageUrl(question.imageUrl)}
                  alt="Sign demonstration"
                  style={{ maxWidth: '100%', borderRadius: '12px' }}
                />
              </div>
            ) : (
              <div className="sign-placeholder">
                {question.handIcon || (exam.category === 'alphabet' ? '✋' : '👋')}
                <p>Sign displayed here</p>
              </div>
            )}
          </div>
          <h2>{question.question}</h2>
        </div>

        <ExamCameraVerifier
          expectedSign={cameraExpectedSign}
          questionText={question.question}
          candidateOptions={question.options}
          category={cameraDetectionCategory}
          onCorrectDetected={handleCameraCorrect}
          disabled={showResult}
        />

        <div className="quiz-actions">
          <p style={{ margin: 0, color: '#666', textAlign: 'center', width: '100%' }}>
            Camera-only mode: perform the correct sign to continue automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Exam;

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as fp from 'fingerpose';
import Handsigns from '../../handsign-tensorflow-master/components/handsigns/index.js';
import { getFoldedHandScore, getLocalLetterHeuristic } from '../utils/liveLetterHeuristics.js';
import { inferLocalDetectionMode } from '../utils/inferLocalDetectionMode.js';
import { useToast } from './ui/Toast';

const SEQUENCE_LENGTH = 30;

/** Same Fingerpose letter thresholds as `LiveTranslate.jsx`. */
const FINGERPOSE_MATCH_SCORE = 3.8;
const FINGERPOSE_MIN_CONFIDENCE = 0.16;
const FINGERPOSE_FOLDED_MIN_CONFIDENCE = 0.1;
const FOLDED_FINGER_LETTERS = new Set(['a', 's', 't', 'm', 'n', 'e']);
const EXAM_FP_LETTER_VOTE_WINDOW = 8;
const EXAM_FP_LETTER_MIN_VOTES = 2;
const EXAM_FP_LETTER_VOTE_MAX_AGE_MS = 1400;
/** Combined letter / number / word pipelines vote together toward the expected label */
const UNIFIED_VOTE_WINDOW = 10;
const UNIFIED_MIN_VOTES = 2;
const UNIFIED_VOTE_MAX_AGE_MS = 1600;
const FINGERPOSE_PREVIEW_MIN = 0.06;

function mirrorHandLandmarks(hand) {
  return hand.map(([x, y, z]) => [1 - x, y, z]);
}

const normalize = (value) => String(value || '').toLowerCase().trim().replace(/\s+/g, ' ');

function ExamCameraVerifier({
  expectedSign,
  questionText = '',
  onCorrectDetected,
  disabled = false
}) {
  const toast = useToast();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);
  const predictionIntervalRef = useRef(null);
  const frameSendInFlightRef = useRef(false);
  const sequenceRef = useRef([]);
  const primaryHandRef = useRef(null);
  const gestureEstimatorRef = useRef(null);
  const fingerposeHandsRef = useRef([]);
  const examFpLetterVoteQueueRef = useRef([]);
  const unifiedVoteQueueRef = useRef([]);
  const scriptsLoadedRef = useRef(false);
  const correctLockRef = useRef(false);
  const detectedRef = useRef('');
  const expectedRef = useRef(normalize(expectedSign));

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [detectionStatus, setDetectionStatus] = useState('Camera ready');
  const [detectedSign, setDetectedSign] = useState('');
  const [confidence, setConfidence] = useState(0);
  /** Letters / numbers / words pipelines — driven by expected sign, not exam category. */
  const mode = useMemo(
    () => inferLocalDetectionMode(expectedSign, questionText),
    [expectedSign, questionText]
  );

  const normalizePrediction = useCallback((value) => {
    const v = normalize(value);
    if (v === 'thanks' || v === 'thank_you' || v === 'ty') return 'thank you';
    if (v === 'ily' || v === 'ilu') return 'i love you';
    return v;
  }, []);

  const expectedAliases = useMemo(() => {
    const aliases = new Set();
    const add = (v) => {
      const n = normalizePrediction(v);
      if (n) aliases.add(n);
    };

    add(expectedSign);
    const match = String(questionText || '').match(/for\s+(.+?)\??$/i);
    if (match?.[1]) add(match[1]);

    /** Only the expected sign (+ question cues / synonyms below)—not MC “options”. Wrong labels must not count as correct. */

    const qt = String(questionText || '').toLowerCase();
    if (qt.includes('i love you') || qt.includes('i, l, y') || qt.includes("'i, l, y'") || qt.includes('"i, l, y"')) {
      add('I love you');
      add('ily');
    }
    if (normalize(expectedSign) === 'i love you') {
      add('ily');
      add('ilu');
    }
    return aliases;
  }, [expectedSign, normalizePrediction, questionText]);

  useEffect(() => {
    expectedRef.current = normalize(expectedSign);
    correctLockRef.current = false;
    unifiedVoteQueueRef.current = [];
    examFpLetterVoteQueueRef.current = [];
    setCameraError(null);
    setDetectedSign('');
    setConfidence(0);
  }, [expectedSign]);

  useEffect(() => {
    const gestures = [
      Handsigns.aSign, Handsigns.bSign, Handsigns.cSign, Handsigns.dSign, Handsigns.eSign, Handsigns.fSign,
      Handsigns.gSign, Handsigns.hSign, Handsigns.iSign, Handsigns.jSign, Handsigns.kSign, Handsigns.lSign,
      Handsigns.mSign, Handsigns.nSign, Handsigns.oSign, Handsigns.pSign, Handsigns.qSign, Handsigns.rSign,
      Handsigns.sSign, Handsigns.tSign, Handsigns.uSign, Handsigns.vSign, Handsigns.wSign, Handsigns.xSign,
      Handsigns.ySign, Handsigns.zSign
    ].filter(Boolean);

    if (gestures.length) {
      gestureEstimatorRef.current = new fp.GestureEstimator(gestures);
    } else {
      gestureEstimatorRef.current = null;
      console.warn('Handsign definitions are missing; exam Fingerpose is disabled.');
    }
  }, []);

  const dist2D = (a, b) => Math.hypot((a?.[0] ?? 0) - (b?.[0] ?? 0), (a?.[1] ?? 0) - (b?.[1] ?? 0));

  const getLocalNumberPrediction = useCallback((hand) => {
    if (!hand || hand.length < 21) return null;
    const isUp = (tip, pip, margin = 0.02) => hand[tip][1] < (hand[pip][1] - margin);
    const indexUp = isUp(8, 6);
    const middleUp = isUp(12, 10);
    const ringUp = isUp(16, 14);
    const pinkyUp = isUp(20, 18);
    const thumbSpread = Math.abs(hand[4][0] - hand[2][0]);
    const thumbRaised = hand[4][1] < (hand[3][1] - 0.015);
    const thumbOpen = thumbSpread > 0.08 || thumbRaised;
    const palmWidth = dist2D(hand[5], hand[17]) + 1e-6;
    const thumbTouches = (tipIdx, ratio = 0.40) => dist2D(hand[4], hand[tipIdx]) <= (palmWidth * ratio);

    if (indexUp && middleUp && ringUp && thumbTouches(20, 0.42)) return { sign: '6', confidence: 0.84 };
    if (indexUp && middleUp && pinkyUp && thumbTouches(16, 0.40)) return { sign: '7', confidence: 0.84 };
    if (indexUp && ringUp && pinkyUp && thumbTouches(12, 0.38)) return { sign: '8', confidence: 0.84 };
    if (middleUp && ringUp && pinkyUp && thumbTouches(8, 0.36)) return { sign: '9', confidence: 0.84 };
    if (thumbRaised && !indexUp && !middleUp && !ringUp && !pinkyUp) return { sign: '10', confidence: 0.80 };
    if (!indexUp && !middleUp && !ringUp && !pinkyUp && thumbTouches(8, 0.36) && thumbTouches(12, 0.38)) return { sign: '0', confidence: 0.72 };
    if (indexUp && !middleUp && !ringUp && !pinkyUp) return { sign: '1', confidence: 0.78 };
    if (indexUp && middleUp && !ringUp && !pinkyUp) return { sign: '2', confidence: 0.80 };
    if (indexUp && middleUp && ringUp && !pinkyUp) return { sign: '3', confidence: 0.80 };
    if (indexUp && middleUp && ringUp && pinkyUp && thumbOpen) return { sign: '5', confidence: 0.82 };
    if (indexUp && middleUp && ringUp && pinkyUp) return { sign: '4', confidence: 0.80 };
    return null;
  }, []);

  const estimateFingerposeFromLandmarks = useCallback((landmarks) => {
    if (!gestureEstimatorRef.current) return null;
    const estimated = gestureEstimatorRef.current.estimate(landmarks, FINGERPOSE_MATCH_SCORE);
    if (!estimated?.gestures?.length) return null;

    const best = estimated.gestures.reduce((max, gesture) => (
      gesture.confidence > max.confidence ? gesture : max
    ));

    const rawConfidence = Number(best?.confidence ?? 0);
    const normalizedConfidence = rawConfidence > 1 ? (rawConfidence / 10) : rawConfidence;
    const sign = String(best?.name || '').toLowerCase();
    if (!sign) return null;

    return {
      sign,
      confidence: Math.max(0, Math.min(1, normalizedConfidence))
    };
  }, []);

  const getExamFingerposePrediction = useCallback(() => {
    if (!gestureEstimatorRef.current) return null;
    const hands = fingerposeHandsRef.current;
    if (!hands?.length) return null;

    let bestCandidate = null;
    for (const h of hands) {
      const candidates = [
        estimateFingerposeFromLandmarks(h),
        estimateFingerposeFromLandmarks(mirrorHandLandmarks(h))
      ].filter(Boolean);

      for (const candidate of candidates) {
        if (!bestCandidate || candidate.confidence > bestCandidate.confidence) {
          bestCandidate = { ...candidate, hand: h };
        }
      }
    }
    return bestCandidate;
  }, [estimateFingerposeFromLandmarks]);

  const getExamSmoothedLetterPrediction = useCallback((sign, confidence) => {
    const now = Date.now();
    const queue = [...examFpLetterVoteQueueRef.current, { sign, confidence, at: now }]
      .filter((item) => now - item.at <= EXAM_FP_LETTER_VOTE_MAX_AGE_MS)
      .slice(-EXAM_FP_LETTER_VOTE_WINDOW);
    examFpLetterVoteQueueRef.current = queue;

    const grouped = queue.reduce((acc, item) => {
      if (!acc[item.sign]) acc[item.sign] = { count: 0, confSum: 0 };
      acc[item.sign].count += 1;
      acc[item.sign].confSum += item.confidence;
      return acc;
    }, {});

    const ranked = Object.entries(grouped)
      .map(([candidateSign, stats]) => ({
        sign: candidateSign,
        count: stats.count,
        avgConfidence: stats.confSum / stats.count
      }))
      .sort((a, b) => (b.count - a.count) || (b.avgConfidence - a.avgConfidence));

    const best = ranked[0];
    if (!best || best.count < EXAM_FP_LETTER_MIN_VOTES) return null;

    return {
      sign: best.sign,
      confidence: Math.max(confidence, best.avgConfidence),
      votes: best.count
    };
  }, []);

  /** Same motion + shape heuristics as `LiveTranslate` words mode (local-first). */
  const getLocalWordHeuristicExam = useCallback((hand) => {
    if (!hand || hand.length < 21) return null;

    const isUp = (tip, pip, margin = 0.02) => hand[tip][1] < (hand[pip][1] - margin);
    const indexUp = isUp(8, 6, 0.02);
    const middleUp = isUp(12, 10, 0.02);
    const ringUp = isUp(16, 14, 0.02);
    const pinkyUp = isUp(20, 18, 0.02);
    const thumbOpen = Math.abs(hand[4][0] - hand[2][0]) > 0.08 || hand[4][1] < (hand[3][1] - 0.015);
    const palmWidth = dist2D(hand[5], hand[17]) + 1e-6;
    const thumbIndexDist = dist2D(hand[4], hand[8]);
    const thumbMiddleDist = dist2D(hand[4], hand[12]);

    const allOpen = indexUp && middleUp && ringUp && pinkyUp;
    const fistLike = !indexUp && !middleUp && !ringUp && !pinkyUp;
    const noShape = indexUp && middleUp && !ringUp && !pinkyUp &&
      thumbIndexDist < (palmWidth * 0.34) && thumbMiddleDist < (palmWidth * 0.36);

    const handEnergy = (frame63) => {
      let s = 0;
      for (let i = 0; i < 63; i += 1) s += Math.abs(frame63[i] || 0);
      return s;
    };

    const lastFrame = sequenceRef.current.length
      ? sequenceRef.current[sequenceRef.current.length - 1]
      : null;
    let twoHandsActive = false;
    if (lastFrame && lastFrame.length >= 126) {
      const le = handEnergy(lastFrame.slice(0, 63));
      const re = handEnergy(lastFrame.slice(63, 126));
      twoHandsActive = le > 2.2 && re > 2.2;
    }

    const recent = sequenceRef.current.slice(-8);
    let motionX = 0;
    let motionY = 0;
    if (recent.length >= 2) {
      const wristXs = recent.map((frame) => {
        const leftEnergy = Math.abs(frame[0]) + Math.abs(frame[1]) + Math.abs(frame[2]);
        const rightEnergy = Math.abs(frame[63]) + Math.abs(frame[64]) + Math.abs(frame[65]);
        return leftEnergy >= rightEnergy ? frame[0] : frame[63];
      });
      const wristYs = recent.map((frame) => {
        const leftEnergy = Math.abs(frame[0]) + Math.abs(frame[1]) + Math.abs(frame[2]);
        const rightEnergy = Math.abs(frame[63]) + Math.abs(frame[64]) + Math.abs(frame[65]);
        return leftEnergy >= rightEnergy ? frame[1] : frame[64];
      });
      for (let i = 1; i < wristXs.length; i += 1) motionX += Math.abs(wristXs[i] - wristXs[i - 1]);
      for (let i = 1; i < wristYs.length; i += 1) motionY += Math.abs(wristYs[i] - wristYs[i - 1]);
      motionX /= (wristXs.length - 1);
      motionY /= (wristYs.length - 1);
    }

    const motionSum = motionX + motionY;
    const wristY = hand[0][1];

    // ASL "I love you" — thumb + index + pinky up, middle + ring down (distinct from open-palm waves).
    if (thumbOpen && indexUp && !middleUp && !ringUp && pinkyUp) {
      return { sign: 'i love you', confidence: 0.74 };
    }

    if (noShape) return { sign: 'no', confidence: 0.70 };
    if (fistLike && thumbOpen && motionY > 0.02) return { sign: 'help', confidence: 0.67 };
    if (fistLike && thumbOpen) return { sign: 'yes', confidence: 0.68 };
    if (twoHandsActive && allOpen && motionSum > 0.045) return { sign: 'happy birthday', confidence: 0.64 };
    if (allOpen && wristY < 0.40 && motionSum < 0.022) return { sign: 'mama', confidence: 0.60 };
    if (allOpen && motionX > 0.035) return { sign: 'goodbye', confidence: 0.68 };
    if (allOpen && motionX > 0.02 && motionX >= motionY * 0.85) return { sign: 'hello', confidence: 0.66 };
    if (allOpen && motionY > 0.012 && motionX < 0.028 && motionSum < 0.04) return { sign: 'thank you', confidence: 0.62 };
    if (allOpen) return { sign: 'thank you', confidence: 0.58 };
    return null;
  }, []);

  const applyDetected = useCallback((sign, conf, status = 'Sign detected') => {
    const predicted = normalizePrediction(sign);
    setDetectedSign(predicted);
    detectedRef.current = predicted;
    setConfidence(Math.round(Math.min(1, conf) * 100));
    setDetectionStatus(status);
    const isExpected =
      predicted === expectedRef.current ||
      expectedAliases.has(predicted);

    if (!correctLockRef.current && isExpected) {
      correctLockRef.current = true;
      setDetectionStatus('Correct sign! Moving to next question...');
      onCorrectDetected?.(predicted, conf);
    }
    return true;
  }, [expectedAliases, normalizePrediction, onCorrectDetected]);

  /**
   * Run number + letter + word + Fingerpose locals together; accept whichever hypothesis matches the target sign.
   * Avoids brittle "category → single pipeline" routing and surfaces live preview from the strongest raw guess.
   */
  const tryUnifiedExpectedDetection = useCallback(() => {
    const hand = primaryHandRef.current;
    if (!hand?.length || correctLockRef.current) return false;

    const exp = expectedRef.current;
    const matches = (rawSign) => {
      const s = normalizePrediction(rawSign);
      return s === exp || expectedAliases.has(s);
    };

    const num = getLocalNumberPrediction(hand);
    const letter = getLocalLetterHeuristic(hand, exp);
    const word = getLocalWordHeuristicExam(hand);
    const fp = getExamFingerposePrediction();

    const previewPool = [];
    if (num) previewPool.push(num);
    if (letter) previewPool.push(letter);
    if (word) previewPool.push(word);
    if (fp && fp.confidence >= FINGERPOSE_PREVIEW_MIN) {
      previewPool.push({ sign: fp.sign, confidence: fp.confidence });
    }

    if (previewPool.length && !correctLockRef.current) {
      const top = previewPool.reduce((a, b) => (b.confidence > a.confidence ? b : a));
      const pv = normalizePrediction(top.sign);
      setDetectedSign(pv);
      setConfidence(Math.round(Math.min(1, top.confidence) * 100));
    }

    const matching = [];
    if (num && matches(num.sign)) matching.push(num);
    if (letter && matches(letter.sign)) matching.push(letter);
    if (word && matches(word.sign)) matching.push(word);

    if (fp) {
      let eff = fp.confidence;
      const foldedScore = getFoldedHandScore(fp.hand);
      const foldedBoost = foldedScore >= 0.45 && FOLDED_FINGER_LETTERS.has(fp.sign);
      if (foldedBoost) eff = Math.min(1, eff + 0.18);
      const minFp = foldedBoost ? FINGERPOSE_FOLDED_MIN_CONFIDENCE : FINGERPOSE_MIN_CONFIDENCE;
      const relaxedMin = /^[a-z]$/.test(exp) ? Math.min(minFp, 0.12) : minFp;

      if (/^[a-z]$/.test(exp)) {
        if (eff >= relaxedMin) {
          const smoothed = getExamSmoothedLetterPrediction(fp.sign, eff);
          if (smoothed && matches(smoothed.sign)) {
            matching.push({ sign: smoothed.sign, confidence: smoothed.confidence });
          }
        }
      } else if (eff >= minFp && matches(fp.sign)) {
        matching.push({ sign: fp.sign, confidence: eff });
      }
    }

    if (!matching.length) {
      setDetectionStatus(
        previewPool.length
          ? `Auto — hold "${exp}" (seeing "${normalizePrediction(previewPool.reduce((a, b) => (b.confidence > a.confidence ? b : a)).sign)}")`
          : `Auto — hold "${exp}" (no match yet)`
      );
      return false;
    }

    const best = matching.reduce((a, b) => (b.confidence > a.confidence ? b : a));
    const bestSign = normalizePrediction(best.sign);
    const now = Date.now();
    const queue = [...unifiedVoteQueueRef.current, { sign: bestSign, confidence: best.confidence, at: now }]
      .filter((item) => now - item.at <= UNIFIED_VOTE_MAX_AGE_MS)
      .slice(-UNIFIED_VOTE_WINDOW);
    unifiedVoteQueueRef.current = queue;

    const grouped = queue.reduce((acc, item) => {
      if (!acc[item.sign]) acc[item.sign] = { count: 0, confSum: 0 };
      acc[item.sign].count += 1;
      acc[item.sign].confSum += item.confidence;
      return acc;
    }, {});

    const ranked = Object.entries(grouped)
      .map(([k, stats]) => ({ sign: k, count: stats.count, avgConfidence: stats.confSum / stats.count }))
      .sort((a, b) => (b.count - a.count) || (b.avgConfidence - a.avgConfidence));

    const winner = ranked[0];
    if (!winner || winner.count < UNIFIED_MIN_VOTES) {
      setDetectionStatus(`Auto — stabilizing "${bestSign}" (${winner?.count || 1}/${UNIFIED_MIN_VOTES})`);
      return false;
    }

    return applyDetected(winner.sign, winner.avgConfidence, 'Matched (auto)');
  }, [
    applyDetected,
    expectedAliases,
    getExamFingerposePrediction,
    getExamSmoothedLetterPrediction,
    getLocalLetterHeuristic,
    getLocalNumberPrediction,
    getLocalWordHeuristicExam,
    normalizePrediction,
  ]);

  const tryLocalFallback = useCallback(() => tryUnifiedExpectedDetection(), [tryUnifiedExpectedDetection]);

  const loadMediaPipeScripts = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (scriptsLoadedRef.current) {
        resolve();
        return;
      }

      const loadScript = (src) => new Promise((res, rej) => {
        const script = document.createElement('script');
        script.src = src;
        script.crossOrigin = 'anonymous';
        script.onload = res;
        script.onerror = () => rej(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
      });

      loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js')
        .then(() => loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js'))
        .then(() => loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js'))
        .then(() => {
          scriptsLoadedRef.current = true;
          resolve();
        })
        .catch(reject);
    });
  }, []);

  const normalizeHandsResults = (results) => {
    const mapped = { leftHandLandmarks: null, rightHandLandmarks: null };
    const landmarks = results?.multiHandLandmarks || [];
    const handedness = results?.multiHandedness || [];

    landmarks.forEach((handLandmarks, index) => {
      const side = handedness[index]?.label?.toLowerCase?.() || '';
      if (side === 'left') mapped.leftHandLandmarks = handLandmarks;
      else if (side === 'right') mapped.rightHandLandmarks = handLandmarks;
      else if (!mapped.leftHandLandmarks) mapped.leftHandLandmarks = handLandmarks;
      else if (!mapped.rightHandLandmarks) mapped.rightHandLandmarks = handLandmarks;
    });

    return mapped;
  };

  const extractKeypoints = (results) => {
    const lh = results.leftHandLandmarks
      ? results.leftHandLandmarks.map((p) => [p.x, p.y, p.z]).flat()
      : new Array(63).fill(0);
    const rh = results.rightHandLandmarks
      ? results.rightHandLandmarks.map((p) => [p.x, p.y, p.z]).flat()
      : new Array(63).fill(0);
    return [...lh, ...rh];
  };

  const stopCamera = useCallback(() => {
    if (cameraRef.current) {
      try {
        cameraRef.current.stop();
      } catch (e) {
        console.warn('Exam camera stop:', e);
      }
      cameraRef.current = null;
    }
    const video = videoRef.current;
    if (video?.srcObject) {
      try {
        video.srcObject.getTracks().forEach((t) => t.stop());
      } catch (e) {
        console.warn('Exam video tracks stop:', e);
      }
      video.srcObject = null;
    }
    if (predictionIntervalRef.current) {
      clearInterval(predictionIntervalRef.current);
      predictionIntervalRef.current = null;
    }
    if (handsRef.current) {
      try {
        handsRef.current.close();
      } catch (e) {
        console.warn('Exam Hands close:', e);
      }
      handsRef.current = null;
    }
    setIsCameraActive(false);
    setDetectionStatus('Camera stopped');
    sequenceRef.current = [];
    fingerposeHandsRef.current = [];
    examFpLetterVoteQueueRef.current = [];
    unifiedVoteQueueRef.current = [];
    frameSendInFlightRef.current = false;
  }, []);

  const runPrediction = useCallback(async () => {
    if (frameSendInFlightRef.current) return;
    if (tryLocalFallback()) {
      return;
    }
    // All exam modes use local palm heuristics + voting (same idea as Live Translate). No Render /predict.
    const minFrames = mode === 'words' ? 8 : 2;
    if (sequenceRef.current.length < minFrames) {
      setDetectionStatus(`Collecting frames ${sequenceRef.current.length}/${minFrames}`);
      return;
    }
    if (mode === 'words') {
      setDetectionStatus('Local detection — hold the handshape steady (small side-to-side motion helps for hello/goodbye)');
    } else if (mode === 'letters') {
      setDetectionStatus('Local detection — hold the letter shape steady');
    } else {
      setDetectionStatus('Local detection — hold the number shape steady');
    }
  }, [mode, tryLocalFallback]);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      setDetectionStatus('Initializing camera...');
      await loadMediaPipeScripts();

      handsRef.current = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });
      handsRef.current.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.35,
        minTrackingConfidence: 0.35
      });

      handsRef.current.onResults((results) => {
        if (!canvasRef.current || !videoRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const handResults = normalizeHandsResults(results);

        const frameWidth = videoRef.current.videoWidth || 640;
        const frameHeight = videoRef.current.videoHeight || 480;
        canvas.width = frameWidth;
        canvas.height = frameHeight;

        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
        if (window.drawConnectors && window.drawLandmarks) {
          [handResults.leftHandLandmarks, handResults.rightHandLandmarks]
            .filter(Boolean)
            .forEach((handLandmarks, i) => {
              const connectorColor = i === 0 ? '#00CC66' : '#3366FF';
              const landmarkColor = i === 0 ? '#00FF88' : '#33AAFF';
              window.drawConnectors(ctx, handLandmarks, window.HAND_CONNECTIONS, { color: connectorColor, lineWidth: 3 });
              window.drawLandmarks(ctx, handLandmarks, { color: landmarkColor, lineWidth: 2 });
            });
        }
        ctx.restore();

        const keypoints = extractKeypoints(handResults);
        sequenceRef.current = [...sequenceRef.current, keypoints].slice(-SEQUENCE_LENGTH);
        const candidateHands = [handResults.rightHandLandmarks, handResults.leftHandLandmarks]
          .filter(Boolean)
          .map((hand) => hand.map((point) => [point.x, point.y, point.z]));
        primaryHandRef.current = candidateHands[0] || null;
        fingerposeHandsRef.current = candidateHands;
      });

      cameraRef.current = new window.Camera(videoRef.current, {
        onFrame: async () => {
          const video = videoRef.current;
          if (!handsRef.current || !video) return;
          const hasFrameData = video.readyState >= 2 || (video.srcObject && video.srcObject.active);
          if (!hasFrameData) return;
          await handsRef.current.send({ image: video });
        },
        width: 960,
        height: 720
      });

      await cameraRef.current.start();
      setIsCameraActive(true);
      setDetectionStatus('Camera active');

      if (predictionIntervalRef.current) clearInterval(predictionIntervalRef.current);
      predictionIntervalRef.current = setInterval(runPrediction, 550);
    } catch (error) {
      console.error('Exam camera error:', error);
      setCameraError(`Unable to start camera: ${error.message}`);
      setIsCameraActive(false);
      toast.error('Could not access camera for exam detection.');
    }
  }, [loadMediaPipeScripts, runPrediction, toast]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (disabled && isCameraActive) {
      stopCamera();
    }
  }, [disabled, isCameraActive, stopCamera]);

  return (
    <div className="exam-camera-verifier">
      <h3 style={{ marginBottom: '0.5rem' }}>Live Camera Check</h3>
      <p style={{ marginTop: 0, color: '#666' }}>
        Show this sign: <strong>{expectedSign}</strong>
      </p>

      <div style={{ position: 'relative', background: '#111', borderRadius: '10px', overflow: 'hidden', minHeight: '220px' }}>
        {!isCameraActive && (
          <div style={{ minHeight: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.75rem', color: '#fff' }}>
            <span style={{ fontSize: '2rem' }}>📷</span>
            <button type="button" onClick={startCamera} disabled={disabled}>
              Start Camera
            </button>
          </div>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            minHeight: '220px',
            objectFit: 'cover',
            display: isCameraActive ? 'block' : 'none',
            transform: 'scaleX(-1)'
          }}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            display: isCameraActive ? 'block' : 'none',
            pointerEvents: 'none'
          }}
        />
        {isCameraActive && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              padding: '10px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.65))',
              zIndex: 4,
              pointerEvents: 'none'
            }}
          >
            <button
              type="button"
              className="secondary"
              onClick={stopCamera}
              style={{ pointerEvents: 'auto', minWidth: '140px', fontWeight: 600 }}
            >
              Stop Camera
            </button>
          </div>
        )}
      </div>

      {cameraError && <p style={{ color: '#c0392b' }}>{cameraError}</p>}

      <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.35rem' }}>
        <span><strong>Status:</strong> {detectionStatus}</span>
        <span><strong>Detected:</strong> {detectedSign || '-'}</span>
        <span><strong>Confidence:</strong> {confidence}%</span>
      </div>

    </div>
  );
}

export default ExamCameraVerifier;

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from './ui/Toast';

const FLASK_SERVER_URL = (import.meta.env.VITE_FLASK_PREDICT_URL || 'http://127.0.0.1:5000/predict').trim();
const BACKEND_TIMEOUT_MS = 12000;
const SEQUENCE_LENGTH = 30;
const LOCAL_WORD_VOTE_WINDOW = 6;
const LOCAL_WORD_MIN_VOTES = 2;
const LOCAL_WORD_VOTE_MAX_AGE_MS = 1600;

const normalize = (value) => String(value || '').toLowerCase().trim().replace(/\s+/g, ' ');

const modeFromCategory = (category) => {
  const c = normalize(category);
  if (c === 'alphabet') return 'letters';
  if (c === 'numbers') return 'numbers';
  return 'words';
};

const isLocalPredictUrl = (url) => /127\.0\.0\.1|localhost/i.test(String(url || ''));

function ExamCameraVerifier({
  expectedSign,
  questionText = '',
  candidateOptions = [],
  category,
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
  const localWordVoteQueueRef = useRef([]);
  const scriptsLoadedRef = useRef(false);
  const correctLockRef = useRef(false);
  const detectedRef = useRef('');
  const expectedRef = useRef(normalize(expectedSign));

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [detectionStatus, setDetectionStatus] = useState('Camera ready');
  const [detectedSign, setDetectedSign] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [consecutiveTimeouts, setConsecutiveTimeouts] = useState(0);

  const mode = useMemo(() => modeFromCategory(category), [category]);

  const normalizePrediction = useCallback((value) => {
    const v = normalize(value);
    if (v === 'thanks' || v === 'thank_you' || v === 'ty') return 'thank you';
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

    (Array.isArray(candidateOptions) ? candidateOptions : []).forEach(add);
    return aliases;
  }, [candidateOptions, expectedSign, normalizePrediction, questionText]);

  useEffect(() => {
    expectedRef.current = normalize(expectedSign);
    correctLockRef.current = false;
    localWordVoteQueueRef.current = [];
    setConsecutiveTimeouts(0);
    setCameraError(null);
    setDetectedSign('');
    setConfidence(0);
  }, [expectedSign]);

  const isAllowedForMode = useCallback((value) => {
    const v = normalize(value);
    if (!v) return false;
    if (mode === 'letters') return /^[a-z]$/.test(v);
    if (mode === 'numbers') return /^(?:[0-9]|10)$/.test(v);
    return true;
  }, [mode]);

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

  const getLocalLetterPrediction = useCallback((hand) => {
    if (!hand || hand.length < 21) return null;
    const isUp = (tip, pip, margin = 0.02) => hand[tip][1] < (hand[pip][1] - margin);
    const indexUp = isUp(8, 6);
    const middleUp = isUp(12, 10);
    const ringUp = isUp(16, 14);
    const pinkyUp = isUp(20, 18);
    const thumbOpen = Math.abs(hand[4][0] - hand[2][0]) > 0.08;
    const palmWidth = dist2D(hand[5], hand[17]) + 1e-6;
    const indexMiddleDist = dist2D(hand[8], hand[12]);
    const thumbIndexDist = dist2D(hand[4], hand[8]);

    if (thumbOpen && !indexUp && !middleUp && !ringUp && !pinkyUp) return { sign: 'a', confidence: 0.62 };
    if (!thumbOpen && indexUp && middleUp && ringUp && pinkyUp) return { sign: 'b', confidence: 0.64 };
    if (thumbOpen && indexUp && !middleUp && !ringUp && !pinkyUp) return { sign: 'l', confidence: 0.66 };
    if (!thumbOpen && !indexUp && !middleUp && !ringUp && !pinkyUp && thumbIndexDist < palmWidth * 0.18) return { sign: 'o', confidence: 0.57 };
    if (!thumbOpen && indexUp && middleUp && !ringUp && !pinkyUp && indexMiddleDist < (palmWidth * 0.26)) return { sign: 'u', confidence: 0.63 };
    if (!thumbOpen && indexUp && middleUp && !ringUp && !pinkyUp && indexMiddleDist >= (palmWidth * 0.26)) return { sign: 'v', confidence: 0.63 };
    if (thumbOpen && !indexUp && !middleUp && !ringUp && pinkyUp) return { sign: 'y', confidence: 0.64 };
    if (indexUp && !middleUp && !ringUp && !pinkyUp) return { sign: 'd', confidence: 0.56 };
    return null;
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
    if (!isAllowedForMode(predicted)) return false;
    setDetectedSign(predicted);
    detectedRef.current = predicted;
    setConfidence(Math.round(conf * 100));
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
  }, [expectedAliases, isAllowedForMode, normalizePrediction, onCorrectDetected]);

  const tryExamLocalWordVoted = useCallback(() => {
    const hand = primaryHandRef.current;
    const localWord = getLocalWordHeuristicExam(hand);
    if (!localWord) return false;

    const sign = normalizePrediction(localWord.sign);
    if (!isAllowedForMode(sign)) return false;

    const matchesExpected = sign === expectedRef.current || expectedAliases.has(sign);
    if (!matchesExpected) {
      setDetectionStatus(`Hold steady — need "${expectedRef.current}"`);
      return false;
    }

    const now = Date.now();
    const queue = [...localWordVoteQueueRef.current, { sign, confidence: localWord.confidence, at: now }]
      .filter((item) => now - item.at <= LOCAL_WORD_VOTE_MAX_AGE_MS)
      .slice(-LOCAL_WORD_VOTE_WINDOW);
    localWordVoteQueueRef.current = queue;

    const grouped = queue.reduce((acc, item) => {
      if (!acc[item.sign]) acc[item.sign] = { count: 0, confSum: 0 };
      acc[item.sign].count += 1;
      acc[item.sign].confSum += item.confidence;
      return acc;
    }, {});

    const ranked = Object.entries(grouped)
      .map(([k, stats]) => ({ sign: k, count: stats.count, avgConfidence: stats.confSum / stats.count }))
      .sort((a, b) => (b.count - a.count) || (b.avgConfidence - a.avgConfidence));

    const best = ranked[0];
    if (!best || best.count < LOCAL_WORD_MIN_VOTES) {
      setDetectionStatus(`Stabilizing… (${best?.count || 1}/${LOCAL_WORD_MIN_VOTES})`);
      return false;
    }

    if (best.sign !== expectedRef.current && !expectedAliases.has(best.sign)) return false;

    return applyDetected(best.sign, best.avgConfidence, 'Detected (local)');
  }, [applyDetected, expectedAliases, getLocalWordHeuristicExam, isAllowedForMode, normalizePrediction]);

  const tryLocalFallback = useCallback(() => {
    const hand = primaryHandRef.current;
    if (mode === 'numbers') {
      const local = getLocalNumberPrediction(hand);
      if (!local) return false;
      return applyDetected(local.sign, local.confidence, 'Detected (local)');
    }
    if (mode === 'letters') {
      const local = getLocalLetterPrediction(hand);
      if (!local) return false;
      return applyDetected(local.sign, local.confidence, 'Detected (local)');
    }
    return tryExamLocalWordVoted();
  }, [applyDetected, getLocalLetterPrediction, getLocalNumberPrediction, mode, tryExamLocalWordVoted]);

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
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    if (predictionIntervalRef.current) {
      clearInterval(predictionIntervalRef.current);
      predictionIntervalRef.current = null;
    }
    if (handsRef.current) {
      handsRef.current.close();
      handsRef.current = null;
    }
    setIsCameraActive(false);
    setDetectionStatus('Camera stopped');
    sequenceRef.current = [];
    localWordVoteQueueRef.current = [];
    frameSendInFlightRef.current = false;
  }, []);

  const runPrediction = useCallback(async () => {
    if (frameSendInFlightRef.current) return;
    if (tryLocalFallback()) {
      setConsecutiveTimeouts(0);
      return;
    }
    // Words mode matches Live Translate: local heuristics + voting only (no Render cold starts).
    if (mode === 'words') {
      setConsecutiveTimeouts(0);
      if (sequenceRef.current.length < 8) {
        setDetectionStatus(`Collecting motion ${sequenceRef.current.length}/8`);
      } else {
        setDetectionStatus('Local detection — wave or move clearly if stuck');
      }
      return;
    }
    if (sequenceRef.current.length < SEQUENCE_LENGTH) {
      setDetectionStatus(`Collecting frames ${sequenceRef.current.length}/${SEQUENCE_LENGTH}`);
      return;
    }

    frameSendInFlightRef.current = true;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

      const response = await fetch(FLASK_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequence: sequenceRef.current, mode }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const data = await response.json();
      setConsecutiveTimeouts(0);
      const predicted = normalizePrediction(data?.prediction);
      const conf = Number(data?.confidence || 0);

      if (!isAllowedForMode(predicted) || conf < 0.5 || predicted === 'nothing') {
        if (!tryLocalFallback()) {
          setDetectionStatus('Show the sign clearly to the camera');
        }
        return;
      }
      applyDetected(predicted, conf);
    } catch (error) {
      const isAbort = error?.name === 'AbortError';
      if (isAbort) {
        setConsecutiveTimeouts((prev) => prev + 1);
        if (!tryLocalFallback()) {
          setDetectionStatus('Backend slow, retrying...');
        }
      } else {
        if (!tryLocalFallback()) {
          setDetectionStatus('Detection unavailable');
        }
      }
    } finally {
      frameSendInFlightRef.current = false;
    }
  }, [applyDetected, isAllowedForMode, mode, normalizePrediction, tryLocalFallback]);

  const startCamera = useCallback(async () => {
    try {
      const host = window?.location?.hostname || '';
      const isProductionHost = host && host !== 'localhost' && host !== '127.0.0.1';
      const examMode = modeFromCategory(category);
      if (isProductionHost && isLocalPredictUrl(FLASK_SERVER_URL) && examMode !== 'words') {
        setCameraError(
          'Prediction backend is misconfigured. Set VITE_FLASK_PREDICT_URL in Vercel to your Render /predict endpoint.'
        );
        toast.error('Backend URL is set to localhost in production.');
        return;
      }

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
  }, [category, loadMediaPipeScripts, runPrediction, toast]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (disabled && isCameraActive) {
      stopCamera();
    }
  }, [disabled, isCameraActive, stopCamera]);

  useEffect(() => {
    if (consecutiveTimeouts >= 3) {
      setCameraError(
        'Prediction server is slow or sleeping. If this is Vercel, confirm VITE_FLASK_PREDICT_URL points to your Render /predict URL.'
      );
    }
  }, [consecutiveTimeouts]);

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
            display: isCameraActive ? 'block' : 'none'
          }}
        />
      </div>

      {cameraError && <p style={{ color: '#c0392b' }}>{cameraError}</p>}

      <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.35rem' }}>
        <span><strong>Status:</strong> {detectionStatus}</span>
        <span><strong>Detected:</strong> {detectedSign || '-'}</span>
        <span><strong>Confidence:</strong> {confidence}%</span>
      </div>

      {isCameraActive && (
        <div style={{ marginTop: '0.75rem' }}>
          <button type="button" className="secondary" onClick={stopCamera}>
            Stop Camera
          </button>
        </div>
      )}
    </div>
  );
}

export default ExamCameraVerifier;

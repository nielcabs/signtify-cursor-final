import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from './ui/Toast';

const FLASK_SERVER_URL = (import.meta.env.VITE_FLASK_PREDICT_URL || 'http://127.0.0.1:5000/predict').trim();
const BACKEND_TIMEOUT_MS = 5000;
const SEQUENCE_LENGTH = 30;

const normalize = (value) => String(value || '').toLowerCase().trim().replace(/\s+/g, ' ');

const modeFromCategory = (category) => {
  const c = normalize(category);
  if (c === 'alphabet') return 'letters';
  if (c === 'numbers') return 'numbers';
  return 'words';
};

function ExamCameraVerifier({
  expectedSign,
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
  const scriptsLoadedRef = useRef(false);
  const correctLockRef = useRef(false);
  const detectedRef = useRef('');
  const expectedRef = useRef(normalize(expectedSign));

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [detectionStatus, setDetectionStatus] = useState('Camera ready');
  const [detectedSign, setDetectedSign] = useState('');
  const [confidence, setConfidence] = useState(0);

  const mode = useMemo(() => modeFromCategory(category), [category]);

  useEffect(() => {
    expectedRef.current = normalize(expectedSign);
    correctLockRef.current = false;
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

  const normalizePrediction = useCallback((value) => {
    const v = normalize(value);
    if (v === 'thanks' || v === 'thank_you' || v === 'ty') return 'thank you';
    return v;
  }, []);

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
    frameSendInFlightRef.current = false;
  }, []);

  const runPrediction = useCallback(async () => {
    if (frameSendInFlightRef.current) return;
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
      const predicted = normalizePrediction(data?.prediction);
      const conf = Number(data?.confidence || 0);

      if (!isAllowedForMode(predicted) || conf < 0.5 || predicted === 'nothing') {
        setDetectionStatus('Show the sign clearly to the camera');
        return;
      }

      setDetectedSign(predicted);
      detectedRef.current = predicted;
      setConfidence(Math.round(conf * 100));
      setDetectionStatus('Sign detected');

      if (!correctLockRef.current && predicted === expectedRef.current) {
        correctLockRef.current = true;
        setDetectionStatus('Correct sign! Moving to next question...');
        onCorrectDetected?.(predicted, conf);
      }
    } catch (error) {
      const isAbort = error?.name === 'AbortError';
      setDetectionStatus(isAbort ? 'Backend slow, retrying...' : 'Detection unavailable');
    } finally {
      frameSendInFlightRef.current = false;
    }
  }, [isAllowedForMode, mode, normalizePrediction, onCorrectDetected]);

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

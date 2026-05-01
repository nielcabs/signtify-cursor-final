import { useState, useRef, useEffect } from 'react';
import * as fp from 'fingerpose';
import Handsigns from '../../handsign-tensorflow-master/components/handsigns/index.js';

function LiveTranslate() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [detectedSign, setDetectedSign] = useState(null);
  const [translationHistory, setTranslationHistory] = useState([]);
  const [confidence, setConfidence] = useState(0);
  const [cameraError, setCameraError] = useState(null);
  const [detectionStatus, setDetectionStatus] = useState('Camera Ready');
  const [allProbabilities, setAllProbabilities] = useState({});
  const [showMediaPipeOverlay, setShowMediaPipeOverlay] = useState(true);
  const [selectedMode, setSelectedMode] = useState('letters');
  
  const handsRef = useRef(null);
  const showMediaPipeOverlayRef = useRef(true);
  const cameraRef = useRef(null);
  const drawingUtilsLoadedRef = useRef(false);
  const sequenceRef = useRef([]);
  const isProcessingRef = useRef(false);
  const lastPredictionRef = useRef({ sign: null, count: 0 });
  const gestureEstimatorRef = useRef(null);
  const fingerposeHandRef = useRef(null);
  const fingerposeHandsRef = useRef([]);
  const letterVoteQueueRef = useRef([]);
  const frameSendInFlightRef = useRef(false);
  const webglFailureCountRef = useRef(0);
  const webglDisabledRef = useRef(false);
  const selectedModeRef = useRef('letters');
  
  const sequenceLength = 30;
  const predictionIntervalRef = useRef(null);
  const FLASK_SERVER_URL = (import.meta.env.VITE_FLASK_PREDICT_URL || 'http://127.0.0.1:5000/predict').trim();
  const CONFIDENCE_THRESHOLD_BY_MODE = {
    // Letters: allow slightly lower scores when lighting is poor (fingerpose + model fusion).
    letters: 0.2,
    numbers: 0.5,
    words: 0.5
  };
  const STABILITY_FRAMES_BY_MODE = {
    letters: 1,
    numbers: 3,
    words: 3
  };
  const FINGERPOSE_MATCH_SCORE = 3.8;
  const FINGERPOSE_MIN_CONFIDENCE = 0.16;
  const FINGERPOSE_FOLDED_MIN_CONFIDENCE = 0.10;
  const BACKEND_TIMEOUT_MS = 5000;
  const LETTER_ONLY_INTERVAL_MS = 180;
  const DEFAULT_INTERVAL_MS = 500;
  const LETTER_VOTE_WINDOW = 8;
  const LETTER_MIN_VOTES = 1;
  const LETTER_VOTE_MAX_AGE_MS = 1400;
  // Keep fingerpose-first for letters, but allow backend fallback by default when local match is uncertain.
  const LETTER_BACKEND_FALLBACK_ENABLED = (import.meta.env.VITE_ENABLE_LETTER_BACKEND_FALLBACK ?? 'true') === 'true';
  const FOLDED_FINGER_LETTERS = new Set(['a', 's', 't', 'm', 'n', 'e']);
  const isLetter = (value) => /^[a-z]$/i.test(String(value || ''));
  const isNumber = (value) => /^(?:[0-9]|10)$/.test(String(value || ''));
  const isWord = (value) => ['hello', 'thanks', 'yes', 'no'].includes(String(value || '').toLowerCase());

  const isAllowedForMode = (value, mode) => {
    if (mode === 'letters') return isLetter(value);
    if (mode === 'numbers') return isNumber(value);
    if (mode === 'words') return isWord(value);
    return false;
  };

  const getModeConfidenceThreshold = (mode) => CONFIDENCE_THRESHOLD_BY_MODE[mode] ?? 0.5;
  const getModeStabilityFrames = (mode) => STABILITY_FRAMES_BY_MODE[mode] ?? 3;
  const getPredictionIntervalMs = (mode) => (mode === 'letters' ? LETTER_ONLY_INTERVAL_MS : DEFAULT_INTERVAL_MS);

  const applyPrediction = (predictedSign, conf, detectedStatusLabel = 'Detected') => {
    const mode = selectedModeRef.current;
    const confidenceThreshold = getModeConfidenceThreshold(mode);
    const requiredStabilityFrames = getModeStabilityFrames(mode);

    if (conf >= confidenceThreshold) {
      if (lastPredictionRef.current.sign === predictedSign) {
        lastPredictionRef.current.count++;
      } else {
        lastPredictionRef.current = { sign: predictedSign, count: 1 };
      }

      if (lastPredictionRef.current.count >= requiredStabilityFrames) {
        const roundedConfidence = Math.round(conf * 100);
        setDetectedSign(predictedSign);
        setConfidence(roundedConfidence);
        setDetectionStatus(detectedStatusLabel);

        setTranslationHistory(prev => {
          const lastEntry = prev[0];
          if (lastEntry && lastEntry.sign === predictedSign) {
            return prev;
          }
          return [{
            sign: predictedSign,
            confidence: roundedConfidence,
            time: new Date().toLocaleTimeString()
          }, ...prev].slice(0, 10);
        });

        lastPredictionRef.current = { sign: null, count: 0 };
      } else {
        setDetectionStatus(`Stabilizing... (${lastPredictionRef.current.count}/${requiredStabilityFrames})`);
      }
    } else {
      setDetectionStatus(`Low confidence: ${Math.round(conf * 100)}%`);
      setDetectedSign(null);
      setConfidence(Math.round(conf * 100));
      lastPredictionRef.current = { sign: null, count: 0 };
    }
  };

  const mirrorHandLandmarks = (hand) => hand.map(([x, y, z]) => [1 - x, y, z]);

  const estimateFingerposeFromLandmarks = (landmarks) => {
    const estimated = gestureEstimatorRef.current.estimate(landmarks, FINGERPOSE_MATCH_SCORE);
    if (!estimated?.gestures?.length) {
      return null;
    }

    const best = estimated.gestures.reduce((max, gesture) => (
      gesture.confidence > max.confidence ? gesture : max
    ));

    const rawConfidence = Number(best?.confidence ?? 0);
    const normalizedConfidence = rawConfidence > 1 ? (rawConfidence / 10) : rawConfidence;
    const sign = String(best?.name || '').toLowerCase();
    if (!sign) {
      return null;
    }

    return {
      sign,
      confidence: Math.max(0, Math.min(1, normalizedConfidence))
    };
  };

  const getFingerposePrediction = () => {
    if (selectedModeRef.current !== 'letters') {
      return null;
    }

    if (!gestureEstimatorRef.current) {
      return null;
    }
    const hands = fingerposeHandsRef.current;
    if (!hands?.length) {
      return null;
    }

    let bestCandidate = null;
    for (const hand of hands) {
      const candidates = [
        estimateFingerposeFromLandmarks(hand),
        estimateFingerposeFromLandmarks(mirrorHandLandmarks(hand))
      ].filter(Boolean);

      for (const candidate of candidates) {
        if (!bestCandidate || candidate.confidence > bestCandidate.confidence) {
          bestCandidate = { ...candidate, hand };
        }
      }
    }

    return bestCandidate;
  };

  const getFoldedHandScore = (handInput = fingerposeHandRef.current) => {
    const hand = handInput;
    if (!hand || hand.length < 21) return 0;

    const dist2D = (a, b) => {
      const dx = (a?.[0] ?? 0) - (b?.[0] ?? 0);
      const dy = (a?.[1] ?? 0) - (b?.[1] ?? 0);
      return Math.hypot(dx, dy);
    };

    const wrist = hand[0];
    const tipIdx = [8, 12, 16, 20];
    const mcpIdx = [5, 9, 13, 17];

    // If tip is much closer to wrist than MCP, finger is likely folded.
    const foldScores = tipIdx.map((tipI, idx) => {
      const tipDist = dist2D(hand[tipI], wrist);
      const mcpDist = dist2D(hand[mcpIdx[idx]], wrist) + 1e-6;
      const ratio = tipDist / mcpDist;
      return Math.max(0, Math.min(1, (0.95 - ratio) / 0.45));
    });

    const thumbTip = hand[4];
    const thumbMcp = hand[2];
    const thumbDist = dist2D(thumbTip, wrist);
    const thumbBaseDist = dist2D(thumbMcp, wrist) + 1e-6;
    const thumbRatio = thumbDist / thumbBaseDist;
    const thumbFoldScore = Math.max(0, Math.min(1, (0.95 - thumbRatio) / 0.45));

    const fingerAvg = foldScores.reduce((a, b) => a + b, 0) / foldScores.length;
    return (fingerAvg * 0.8) + (thumbFoldScore * 0.2);
  };

  const getSmoothedLetterPrediction = (sign, confidence) => {
    const now = Date.now();
    const queue = [...letterVoteQueueRef.current, { sign, confidence, at: now }]
      .filter(item => now - item.at <= LETTER_VOTE_MAX_AGE_MS)
      .slice(-LETTER_VOTE_WINDOW);
    letterVoteQueueRef.current = queue;

    const grouped = queue.reduce((acc, item) => {
      if (!acc[item.sign]) {
        acc[item.sign] = { count: 0, confSum: 0 };
      }
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
    if (!best || best.count < LETTER_MIN_VOTES) {
      return null;
    }

    return {
      sign: best.sign,
      confidence: Math.max(confidence, best.avgConfidence),
      votes: best.count
    };
  };

  const getLocalNumberPrediction = (handInput = fingerposeHandRef.current) => {
    const hand = handInput;
    if (!hand || hand.length < 21) return null;

    // Simple local fallback: estimate 1-5 from raised fingers.
    const isUp = (tip, pip, margin = 0.02) => hand[tip][1] < (hand[pip][1] - margin);
    const indexUp = isUp(8, 6, 0.02);
    const middleUp = isUp(12, 10, 0.02);
    const ringUp = isUp(16, 14, 0.02);
    const pinkyUp = isUp(20, 18, 0.02);
    const thumbOpen = Math.abs(hand[4][0] - hand[2][0]) > 0.08;

    const raised = [thumbOpen, indexUp, middleUp, ringUp, pinkyUp].filter(Boolean).length;
    if (raised < 1) return null;

    const sign = String(Math.min(raised, 5));
    const confidence = 0.58 + (Math.min(raised, 5) * 0.05);
    return { sign, confidence: Math.min(confidence, 0.82) };
  };

  const tryLocalNumberFallback = (statusLabel = 'Detected (local fallback)') => {
    const localNumber = getLocalNumberPrediction();
    if (!localNumber) return false;
    applyPrediction(localNumber.sign, localNumber.confidence, statusLabel);
    return true;
  };

  const normalizeHandsResults = (results) => {
    const mapped = {
      leftHandLandmarks: null,
      rightHandLandmarks: null
    };

    const landmarks = results?.multiHandLandmarks || [];
    const handedness = results?.multiHandedness || [];

    landmarks.forEach((handLandmarks, index) => {
      const sideLabel = handedness[index]?.label?.toLowerCase?.() || '';
      if (sideLabel === 'left') {
        mapped.leftHandLandmarks = handLandmarks;
      } else if (sideLabel === 'right') {
        mapped.rightHandLandmarks = handLandmarks;
      } else if (!mapped.leftHandLandmarks) {
        // Fallback if handedness is missing: fill left first, then right.
        mapped.leftHandLandmarks = handLandmarks;
      } else if (!mapped.rightHandLandmarks) {
        mapped.rightHandLandmarks = handLandmarks;
      }
    });

    return mapped;
  };

  // Extract only hand keypoints (21*3 per hand = 126) to match Flask backend.
  const extractKeypoints = (results) => {
    // Left hand: 21 landmarks * 3 values = 63 values
    const lh = results.leftHandLandmarks 
      ? results.leftHandLandmarks.map(res => [res.x, res.y, res.z]).flat() 
      : new Array(21 * 3).fill(0);
    
    // Right hand: 21 landmarks * 3 values = 63 values
    const rh = results.rightHandLandmarks 
      ? results.rightHandLandmarks.map(res => [res.x, res.y, res.z]).flat() 
      : new Array(21 * 3).fill(0);
    
    // Total: 63 + 63 = 126 values
    return [...lh, ...rh];
  };

  // Check if hands are detected in LAST frame (more reliable)
  const hasHandsDetected = (results) => {
    return !!(results.leftHandLandmarks || results.rightHandLandmarks);
  };

  // Prediction loop with stability check
  const predictLoop = async () => {
    const mode = selectedModeRef.current;
    const currentSequence = sequenceRef.current;

    // In production, this keeps numbers usable even when backend confidence is unstable.
    if (mode === 'numbers' && tryLocalNumberFallback('Detected (local)')) {
      return;
    }

    if (mode === 'letters') {
      const fingerposePrediction = getFingerposePrediction();
      if (fingerposePrediction) {
        let effectiveConfidence = fingerposePrediction.confidence;
        const foldedScore = getFoldedHandScore(fingerposePrediction.hand);
        const foldedLetterBoost =
          foldedScore >= 0.45 && FOLDED_FINGER_LETTERS.has(fingerposePrediction.sign);

        if (foldedLetterBoost) {
          // Folded letters are naturally harder; boost instead of rejecting.
          effectiveConfidence = Math.min(1, effectiveConfidence + 0.18);
        }

        const minFingerposeConfidence = foldedLetterBoost
          ? FINGERPOSE_FOLDED_MIN_CONFIDENCE
          : FINGERPOSE_MIN_CONFIDENCE;

        if (effectiveConfidence >= minFingerposeConfidence) {
          const smoothed = getSmoothedLetterPrediction(fingerposePrediction.sign, effectiveConfidence);
          if (smoothed) {
            applyPrediction(
              smoothed.sign,
              smoothed.confidence,
              `Detected (${smoothed.votes}/${LETTER_VOTE_WINDOW})`
            );
            return;
          }
          setDetectionStatus('Stabilizing letters...');
          // If we don't have enough sequence yet, wait for more frames.
          if (currentSequence.length !== sequenceLength) {
            return;
          }
        }
      }

      // Fingerpose uncertain: fall back to backend letter model if sequence is ready.
      if (currentSequence.length !== sequenceLength) {
        setDetectionStatus(`Collecting frames: ${currentSequence.length}/${sequenceLength}`);
        return;
      }
      if (!LETTER_BACKEND_FALLBACK_ENABLED) {
        setDetectionStatus('Stabilizing letter shape...');
        return;
      }
      setDetectionStatus('Analyzing letter model...');
    } else {
      // Don't predict if already processing
      if (isProcessingRef.current) {
        return;
      }

      // Need exactly 30 frames
      if (currentSequence.length !== sequenceLength) {
        setDetectionStatus(`Collecting frames: ${currentSequence.length}/${sequenceLength}`);
        return;
      }
      setDetectionStatus('Analyzing...');
    }

    if (isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
      const response = await fetch(FLASK_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequence: currentSequence, mode: selectedModeRef.current }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Store all probabilities for debugging
      if (data.all_probabilities) {
        setAllProbabilities(data.all_probabilities);
      }

      // Filter out "nothing" if confidence is low
      const predictedSign = data.prediction;
      const conf = data.confidence;
      let finalSign = predictedSign;
      let finalConfidence = conf;
      let usedFingerposeFallback = false;
      const fingerposePrediction = getFingerposePrediction();

      if (!isAllowedForMode(finalSign, mode) && mode === 'letters' && fingerposePrediction) {
        finalSign = fingerposePrediction.sign;
        finalConfidence = Math.max(finalConfidence, fingerposePrediction.confidence);
        usedFingerposeFallback = true;
      }

      // Don't suppress too aggressively; backend already applies quality gates.
      const nothingMinConf = mode === 'letters' ? 0.48 : 0.70;
      if (finalSign === 'nothing' && finalConfidence < nothingMinConf) {
        if (mode === 'numbers' && tryLocalNumberFallback()) {
          return;
        }
        setDetectionStatus('Show gesture clearly — add light if score stays low');
        setDetectedSign(null);
        setConfidence(0);
        return;
      }

      // Extra frontend safety: never show out-of-mode labels.
      if (!isAllowedForMode(finalSign, selectedModeRef.current)) {
        if (mode === 'numbers' && tryLocalNumberFallback()) {
          return;
        }
        setDetectionStatus(`Filtered non-${selectedModeRef.current} prediction`);
        setDetectedSign(null);
        setConfidence(0);
        return;
      }

      applyPrediction(
        finalSign,
        finalConfidence,
        usedFingerposeFallback ? 'Detected' : 'Detected'
      );

    } catch (error) {
      const isAbort = error?.name === 'AbortError';
      if (!isAbort) {
        console.error("Prediction error:", error);
      }
      const fingerposePrediction = getFingerposePrediction();
      if (fingerposePrediction && fingerposePrediction.confidence >= (FINGERPOSE_MIN_CONFIDENCE * 0.8)) {
        applyPrediction(fingerposePrediction.sign, fingerposePrediction.confidence, 'Detected');
      } else if (selectedModeRef.current === 'numbers') {
        if (!tryLocalNumberFallback()) {
          setDetectionStatus('⚠️ Backend unreachable — check VITE_FLASK_PREDICT_URL');
          setDetectedSign(null);
          setConfidence(0);
        }
      } else {
        setDetectionStatus(isAbort ? 'Backend slow, retrying...' : '⚠️ Backend unreachable — check VITE_FLASK_PREDICT_URL');
        setDetectedSign(null);
        setConfidence(0);
      }
    } finally {
      isProcessingRef.current = false;
    }
  };

  // Load MediaPipe scripts (Hands-focused for better hand landmark stability).
  const loadMediaPipeScripts = () => {
    return new Promise((resolve, reject) => {
      if (drawingUtilsLoadedRef.current) {
        resolve();
        return;
      }

      const drawingScript = document.createElement('script');
      drawingScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js';
      drawingScript.crossOrigin = 'anonymous';
      
      drawingScript.onload = () => {
        const cameraScript = document.createElement('script');
        cameraScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
        cameraScript.crossOrigin = 'anonymous';
        
        cameraScript.onload = () => {
          const handsScript = document.createElement('script');
          handsScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
          handsScript.crossOrigin = 'anonymous';
          
          handsScript.onload = () => {
            drawingUtilsLoadedRef.current = true;
            resolve();
          };
          
          handsScript.onerror = () => reject(new Error('Failed to load hands'));
          document.head.appendChild(handsScript);
        };
        
        cameraScript.onerror = () => reject(new Error('Failed to load camera'));
        document.head.appendChild(cameraScript);
      };
      
      drawingScript.onerror = () => reject(new Error('Failed to load drawing utils'));
      document.head.appendChild(drawingScript);
    });
  };

  // Start camera
  const startCamera = async () => {
    try {
      setCameraError(null);
      setDetectionStatus('Initializing hand tracker...');
      
      await loadMediaPipeScripts();
      webglFailureCountRef.current = 0;
      webglDisabledRef.current = false;

      handsRef.current = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      // Lower thresholds than default 0.7 so dim rooms still get usable landmarks.
      // Trade-off: slightly noisier skeleton; letter voting + backend still gate output.
      handsRef.current.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.35,
        minTrackingConfidence: 0.35
      });

      // On results callback
      handsRef.current.onResults((results) => {
        if (!canvasRef.current || !videoRef.current) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const handResults = normalizeHandsResults(results);
        
        const frameWidth = videoRef.current.videoWidth || 640;
        const frameHeight = videoRef.current.videoHeight || 480;
        canvas.width = frameWidth;
        canvas.height = frameHeight;
        
        // Draw mirrored video
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
        
        // Draw hand landmarks only when overlay is enabled
        if (showMediaPipeOverlayRef.current && window.drawConnectors && window.drawLandmarks) {
          // Left hand
          if (handResults.leftHandLandmarks) {
            window.drawConnectors(ctx, handResults.leftHandLandmarks, window.HAND_CONNECTIONS, 
              {color: '#00CC66', lineWidth: 4});
            window.drawLandmarks(ctx, handResults.leftHandLandmarks, 
              {color: '#00FF88', lineWidth: 2});
          }
          
          // Right hand
          if (handResults.rightHandLandmarks) {
            window.drawConnectors(ctx, handResults.rightHandLandmarks, window.HAND_CONNECTIONS, 
              {color: '#3366FF', lineWidth: 4});
            window.drawLandmarks(ctx, handResults.rightHandLandmarks, 
              {color: '#33AAFF', lineWidth: 2});
          }
        }
        
        ctx.restore();
        
        // Extract keypoints and update sequence
        const keypoints = extractKeypoints(handResults);
        sequenceRef.current = [...sequenceRef.current, keypoints].slice(-sequenceLength);

        // Keep a single-hand landmark array ready for Fingerpose fallback.
        const candidateHands = [handResults.rightHandLandmarks, handResults.leftHandLandmarks]
          .filter(Boolean)
          .map(hand => hand.map(point => [point.x, point.y, point.z]));
        fingerposeHandsRef.current = candidateHands;
        fingerposeHandRef.current = candidateHands[0] || null;
        
        // Visual feedback for hands
        if (!hasHandsDetected(handResults) && sequenceRef.current.length >= sequenceLength) {
          setDetectionStatus('⚠️ No hands detected');
        }
      });

      // Start camera (higher resolution helps hand landmarks in dim lighting)
      cameraRef.current = new window.Camera(videoRef.current, {
        onFrame: async () => {
          const video = videoRef.current;
          if (!handsRef.current || !video || webglDisabledRef.current) return;
          const streamActive = !!video.srcObject && video.srcObject.active;
          const hasFrameData = video.readyState >= 2 || streamActive;
          if (!hasFrameData) return;
          if (frameSendInFlightRef.current) return;

          frameSendInFlightRef.current = true;
          try {
            await handsRef.current.send({ image: video });
            webglFailureCountRef.current = 0;
          } catch (error) {
            const msg = String(error?.message || error || '');
            const isWebglError =
              msg.toLowerCase().includes('webgl') ||
              msg.toLowerCase().includes('failed to create webgl canvas context');

            if (isWebglError) {
              webglFailureCountRef.current += 1;
              setDetectionStatus('⚠️ WebGL issue detected');
              if (webglFailureCountRef.current >= 2) {
                webglDisabledRef.current = true;
                setCameraError('WebGL is unavailable. Close extra browser tabs/apps using GPU, then Start Camera again.');
                setTimeout(() => stopCamera(), 0);
              }
            } else {
              console.error('Frame processing error:', error);
            }
          } finally {
            frameSendInFlightRef.current = false;
          }
        },
        width: 1280,
        height: 720
      });
      
      await cameraRef.current.start();
      setIsCameraActive(true);
      setDetectionStatus('Collecting frames...');
      
      // Start prediction loop.
      if (predictionIntervalRef.current) clearInterval(predictionIntervalRef.current);
      predictionIntervalRef.current = setInterval(predictLoop, getPredictionIntervalMs(selectedModeRef.current));
      
    } catch (error) {
      console.error('Camera error:', error);
      setCameraError(`Unable to start camera: ${error.message}`);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
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
    setDetectedSign(null);
    setConfidence(0);
    sequenceRef.current = [];
    fingerposeHandRef.current = null;
    fingerposeHandsRef.current = [];
    letterVoteQueueRef.current = [];
    frameSendInFlightRef.current = false;
    webglFailureCountRef.current = 0;
    webglDisabledRef.current = false;
    isProcessingRef.current = false;
    lastPredictionRef.current = { sign: null, count: 0 };
  };

  const clearHistory = () => setTranslationHistory([]);

  const toggleMediaPipeOverlay = () => {
    setShowMediaPipeOverlay(prev => {
      const next = !prev;
      showMediaPipeOverlayRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    showMediaPipeOverlayRef.current = showMediaPipeOverlay;
  }, [showMediaPipeOverlay]);

  useEffect(() => {
    selectedModeRef.current = selectedMode;
    lastPredictionRef.current = { sign: null, count: 0 };
    letterVoteQueueRef.current = [];
    setDetectedSign(null);
    setConfidence(0);
    setTranslationHistory([]);
    setAllProbabilities({});
    if (predictionIntervalRef.current) {
      clearInterval(predictionIntervalRef.current);
      predictionIntervalRef.current = setInterval(predictLoop, getPredictionIntervalMs(selectedModeRef.current));
    }
    if (isCameraActive) {
      setDetectionStatus(`Mode: ${selectedModeRef.current} • collecting...`);
    }
  }, [selectedMode]);

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
      // Keep app running even when transferred without local handsign definitions.
      gestureEstimatorRef.current = null;
      console.warn('Handsign definitions are missing; Fingerpose fallback is disabled.');
    }

    return () => stopCamera();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '10px', color: '#2c3e50' }}>
          Live Hand Gesture Translation
        </h1>
        <p style={{ color: '#7f8c8d', fontSize: '1.1rem' }}>
          Show your hand gestures to the camera for real-time translation
        </p>
        <div style={{ marginTop: '14px', display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'white', borderRadius: '8px', padding: '8px 12px', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
          <label htmlFor="translation-mode" style={{ fontWeight: 'bold', color: '#2c3e50' }}>Translate:</label>
          <select
            id="translation-mode"
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cfd8dc', fontSize: '0.95rem' }}
          >
            <option value="letters">Letters Only</option>
            <option value="numbers">Numbers Only</option>
            <option value="words">Words Only</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Camera Section */}
        <div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
            <div style={{ position: 'relative', background: '#000', borderRadius: '8px', overflow: 'hidden', aspectRatio: '4/3' }}>
              {!isCameraActive && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a' }}>
                  <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📷</div>
                  <p style={{ color: 'white', marginBottom: '20px' }}>Camera is off</p>
                  <button onClick={startCamera} style={{ padding: '12px 24px', fontSize: '1rem', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                    Start Camera
                  </button>
                  {cameraError && (
                    <div style={{ color: '#e74c3c', marginTop: '20px', padding: '10px', background: 'rgba(231, 76, 60, 0.1)', borderRadius: '6px' }}>
                      <p>{cameraError}</p>
                    </div>
                  )}
                </div>
              )}
              
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover', 
                  display: isCameraActive ? 'block' : 'none', 
                  transform: 'scaleX(-1)' 
                }} 
              />
              <canvas 
                ref={canvasRef} 
                style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  width: '100%', 
                  height: '100%', 
                  display: isCameraActive ? 'block' : 'none' 
                }} 
              />
              
              {isCameraActive && (
                <div style={{ position: 'absolute', top: '15px', left: '15px', background: 'rgba(0,0,0,0.8)', padding: '8px 15px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2ecc71', animation: 'pulse 2s infinite' }}></span>
                  <span style={{ color: 'white', fontSize: '0.9rem', fontWeight: 'bold' }}>{detectionStatus}</span>
                </div>
              )}
            </div>

            {isCameraActive && (
              <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={toggleMediaPipeOverlay}
                  style={{
                    padding: '10px 20px',
                    fontSize: '1rem',
                    background: showMediaPipeOverlay ? '#95a5a6' : '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  {showMediaPipeOverlay ? 'Hide skeleton overlay' : 'Show skeleton overlay'}
                </button>
                <button onClick={stopCamera} style={{ padding: '10px 20px', fontSize: '1rem', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Stop Camera
                </button>
              </div>
            )}
          </div>

          {/* Current Detection */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#2c3e50' }}>Current Detection</h3>
            {detectedSign ? (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <span style={{ fontSize: '3rem' }}>✋</span>
                  <h2 style={{ fontSize: '2rem', margin: '10px 0', color: '#27ae60', textTransform: 'uppercase' }}>
                    {detectedSign}
                  </h2>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#7f8c8d', fontWeight: 'bold' }}>
                    Confidence: {confidence}%
                  </label>
                  <div style={{ background: '#ecf0f1', borderRadius: '10px', height: '30px', overflow: 'hidden' }}>
                    <div style={{ 
                      background: confidence >= 80 ? 'linear-gradient(90deg, #2ecc71, #27ae60)' : 
                                  confidence >= 60 ? 'linear-gradient(90deg, #f39c12, #e67e22)' :
                                  'linear-gradient(90deg, #e74c3c, #c0392b)',
                      height: '100%', 
                      width: `${confidence}%`, 
                      transition: 'width 0.3s' 
                    }}></div>
                  </div>
                </div>
                
                {/* Show all probabilities for debugging */}
                {Object.keys(allProbabilities).length > 0 && (
                  <details style={{ marginTop: '15px', fontSize: '0.9rem' }}>
                    <summary style={{ cursor: 'pointer', color: '#7f8c8d' }}>All Probabilities</summary>
                    <div style={{ marginTop: '10px' }}>
                      {Object.entries(allProbabilities).map(([sign, prob]) => (
                        <div key={sign} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #ecf0f1' }}>
                          <span>{sign}</span>
                          <span style={{ fontWeight: 'bold' }}>{(prob * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#95a5a6' }}>
                <p style={{ fontSize: '1.1rem', marginBottom: '5px' }}>No hand gesture detected</p>
                <span style={{ fontSize: '0.9rem' }}>Show your hand to the camera and hold steady</span>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Translation History */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: '#2c3e50' }}>Translation History</h3>
              {translationHistory.length > 0 && (
                <button onClick={clearHistory} style={{ padding: '5px 12px', fontSize: '0.9rem', background: '#95a5a6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  Clear
                </button>
              )}
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {translationHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#95a5a6' }}>
                  <p style={{ marginBottom: '5px' }}>No translations yet</p>
                  <span style={{ fontSize: '0.9rem' }}>Start showing gestures</span>
                </div>
              ) : (
                translationHistory.map((item, index) => (
                  <div 
                    key={index} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '10px', 
                      background: index % 2 === 0 ? '#f8f9fa' : 'white', 
                      borderRadius: '6px', 
                      marginBottom: '5px' 
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#2c3e50', textTransform: 'uppercase' }}>
                        {item.sign}
                      </span>
                      <span style={{ marginLeft: '10px', fontSize: '0.85rem', color: '#27ae60' }}>
                        {item.confidence}%
                      </span>
                    </div>
                    <span style={{ color: '#7f8c8d', fontSize: '0.85rem' }}>{item.time}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tips */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#2c3e50' }}>💡 Tips</h3>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#555', lineHeight: '1.8', fontSize: '0.95rem' }}>
              <li>Ensure <strong>good lighting</strong></li>
              <li>Position hand <strong>clearly in frame</strong></li>
              <li>Keep hand <strong>steady for 2-3 seconds</strong></li>
              <li>Avoid cluttered backgrounds</li>
              <li>Wait for "Detected" status</li>
              <li>Letter mode accepts roughly <strong>28%+</strong> when shapes stabilize; numbers/words need higher scores</li>
              <li>If it stays red: add light in front of you (toward your hand/face), not only screen brightness</li>
            </ul>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default LiveTranslate;
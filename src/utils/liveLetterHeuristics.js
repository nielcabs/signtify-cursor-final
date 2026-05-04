/**
 * Shared ASL letter heuristics (same rules as Live Translate) plus optional
 * "I love you" (ILY) disambiguation when the exam expects a single letter i/l/y.
 */

export function getFoldedHandScore(hand) {
  if (!hand || hand.length < 21) return 0;

  const dist2D = (a, b) => {
    const dx = (a?.[0] ?? 0) - (b?.[0] ?? 0);
    const dy = (a?.[1] ?? 0) - (b?.[1] ?? 0);
    return Math.hypot(dx, dy);
  };

  const wrist = hand[0];
  const tipIdx = [8, 12, 16, 20];
  const mcpIdx = [5, 9, 13, 17];

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
}

/**
 * @param {number[][]} hand - MediaPipe-style landmarks [x,y,z] x21
 * @param {string|null|undefined} ilyHint - single-letter hint for ILY shape: 'i' | 'l' | 'y'
 */
export function getLocalLetterHeuristic(hand, ilyHint = null) {
  if (!hand || hand.length < 21) return null;

  const dist2D = (a, b) => Math.hypot((a?.[0] ?? 0) - (b?.[0] ?? 0), (a?.[1] ?? 0) - (b?.[1] ?? 0));
  const isUp = (tip, pip, margin = 0.02) => hand[tip][1] < (hand[pip][1] - margin);
  const indexUp = isUp(8, 6, 0.02);
  const middleUp = isUp(12, 10, 0.02);
  const ringUp = isUp(16, 14, 0.02);
  const pinkyUp = isUp(20, 18, 0.02);
  const thumbOpen = Math.abs(hand[4][0] - hand[2][0]) > 0.08;
  const palmWidth = dist2D(hand[5], hand[17]) + 1e-6;
  const indexMiddleDist = dist2D(hand[8], hand[12]);
  const thumbIndexDist = dist2D(hand[4], hand[8]);
  const thumbMiddleDist = dist2D(hand[4], hand[12]);
  const thumbRingDist = dist2D(hand[4], hand[16]);
  const indexOnlyUp = indexUp && !middleUp && !ringUp && !pinkyUp;

  const hint = String(ilyHint || '').toLowerCase().trim();
  // I love you: thumb + index + pinky up, middle/ring down (exam prompts like "I, L, Y").
  if (thumbOpen && indexUp && !middleUp && !ringUp && pinkyUp) {
    if (hint === 'i' || hint === 'l' || hint === 'y') {
      return { sign: hint, confidence: 0.64 };
    }
    return null;
  }

  if (thumbOpen && !indexUp && !middleUp && !ringUp && !pinkyUp) {
    return { sign: 'a', confidence: 0.62 };
  }

  if (!thumbOpen && indexUp && middleUp && ringUp && pinkyUp) {
    return { sign: 'b', confidence: 0.64 };
  }

  if (indexOnlyUp && thumbMiddleDist < (palmWidth * 0.35)) {
    return { sign: 'd', confidence: 0.60 };
  }

  if (
    !thumbOpen && !indexUp && !middleUp && !ringUp && !pinkyUp &&
    thumbIndexDist < (palmWidth * 0.28) &&
    thumbMiddleDist < (palmWidth * 0.32)
  ) {
    return { sign: 'e', confidence: 0.58 };
  }

  if (
    thumbIndexDist < (palmWidth * 0.22) &&
    middleUp && ringUp && pinkyUp
  ) {
    return { sign: 'f', confidence: 0.61 };
  }

  if (indexOnlyUp && thumbOpen && thumbIndexDist > (palmWidth * 0.42)) {
    return { sign: 'g', confidence: 0.55 };
  }

  if (!thumbOpen && indexUp && middleUp && !ringUp && !pinkyUp && indexMiddleDist >= (palmWidth * 0.30)) {
    return { sign: 'h', confidence: 0.57 };
  }

  if (
    !indexUp && !middleUp && !ringUp && !pinkyUp &&
    thumbIndexDist > (palmWidth * 0.45) &&
    indexMiddleDist > (palmWidth * 0.16)
  ) {
    return { sign: 'c', confidence: 0.58 };
  }

  if (!thumbOpen && !indexUp && !middleUp && !ringUp && pinkyUp) {
    return { sign: 'i', confidence: 0.62 };
  }

  if (thumbOpen && !indexUp && !middleUp && !ringUp && pinkyUp) {
    return { sign: 'j', confidence: 0.53 };
  }

  if (
    thumbOpen && indexUp && middleUp && !ringUp && !pinkyUp &&
    thumbIndexDist < (palmWidth * 0.40) && thumbMiddleDist < (palmWidth * 0.40)
  ) {
    return { sign: 'k', confidence: 0.58 };
  }

  if (thumbOpen && indexUp && !middleUp && !ringUp && !pinkyUp) {
    return { sign: 'l', confidence: 0.66 };
  }

  if (
    !indexUp && !middleUp && !ringUp && !pinkyUp &&
    thumbIndexDist < (palmWidth * 0.24) &&
    thumbMiddleDist < (palmWidth * 0.24) &&
    thumbRingDist < (palmWidth * 0.24)
  ) {
    return { sign: 'm', confidence: 0.57 };
  }

  if (
    !indexUp && !middleUp && !ringUp && !pinkyUp &&
    thumbIndexDist < (palmWidth * 0.26) &&
    thumbMiddleDist < (palmWidth * 0.26)
  ) {
    return { sign: 'n', confidence: 0.56 };
  }

  if (!thumbOpen && indexUp && middleUp && !ringUp && !pinkyUp && indexMiddleDist < (palmWidth * 0.26)) {
    return { sign: 'u', confidence: 0.63 };
  }

  if (!thumbOpen && indexUp && middleUp && !ringUp && !pinkyUp && indexMiddleDist >= (palmWidth * 0.26)) {
    return { sign: 'v', confidence: 0.63 };
  }

  if (!thumbOpen && indexUp && middleUp && ringUp && !pinkyUp) {
    return { sign: 'w', confidence: 0.64 };
  }

  if (!thumbOpen && indexUp && middleUp && !ringUp && !pinkyUp && indexMiddleDist < (palmWidth * 0.18)) {
    return { sign: 'r', confidence: 0.56 };
  }

  if (
    !indexUp && !middleUp && !ringUp && !pinkyUp &&
    thumbOpen &&
    thumbIndexDist < (palmWidth * 0.30)
  ) {
    return { sign: 's', confidence: 0.57 };
  }

  if (
    !indexUp && !middleUp && !ringUp && !pinkyUp &&
    !thumbOpen &&
    thumbIndexDist < (palmWidth * 0.22) &&
    thumbMiddleDist < (palmWidth * 0.30)
  ) {
    return { sign: 't', confidence: 0.56 };
  }

  if (!thumbOpen && indexUp && !middleUp && !ringUp && !pinkyUp && dist2D(hand[8], hand[7]) < (palmWidth * 0.10)) {
    return { sign: 'x', confidence: 0.56 };
  }

  if (!indexUp && !middleUp && !ringUp && !pinkyUp && thumbIndexDist < (palmWidth * 0.18)) {
    return { sign: 'o', confidence: 0.57 };
  }

  if (thumbOpen && !ringUp && !pinkyUp && !indexUp && middleUp) {
    return { sign: 'p', confidence: 0.52 };
  }
  if (thumbOpen && !ringUp && !pinkyUp && !middleUp && indexUp) {
    return { sign: 'q', confidence: 0.52 };
  }

  if (thumbOpen && !indexUp && !middleUp && !ringUp && pinkyUp) {
    return { sign: 'y', confidence: 0.64 };
  }

  if (indexOnlyUp) {
    return { sign: 'z', confidence: 0.50 };
  }

  return null;
}

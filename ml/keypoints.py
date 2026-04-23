"""Keypoint conversion helpers for training and inference."""

from __future__ import annotations

import numpy as np

HAND_KEYPOINTS = 21
HAND_DIM = HAND_KEYPOINTS * 3
FEATURE_DIM = HAND_DIM * 2  # left + right = 126

HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12),
    (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (17, 18), (18, 19), (19, 20), (0, 17),
]


def sequence_from_static_keypoints(keypoints: np.ndarray, seq_len: int = 30, noise_std: float = 0.012) -> np.ndarray:
    """Turn one static pose into a pseudo-sequence (for illustration/image training)."""
    if keypoints.shape != (FEATURE_DIM,):
        raise ValueError(f"Expected keypoints shape ({FEATURE_DIM},), got {keypoints.shape}")
    jitter = np.random.normal(0, noise_std, size=(seq_len, FEATURE_DIM)).astype(np.float32)
    base = keypoints.astype(np.float32)
    return base + jitter


def _flat_hand(landmarks) -> np.ndarray:
    if not landmarks:
        return np.zeros(HAND_DIM, dtype=np.float32)
    raw = []
    for lm in landmarks:
        raw.extend([float(lm.x or 0.0), float(lm.y or 0.0), float(lm.z or 0.0)])
    arr = np.asarray(raw, dtype=np.float32)
    if arr.size < HAND_DIM:
        arr = np.pad(arr, (0, HAND_DIM - arr.size))
    return arr[:HAND_DIM]


def task_hand_result_to_vector(result) -> np.ndarray:
    """Convert HandLandmarkerResult to fixed [left(63), right(63)] vector."""
    left = np.zeros(HAND_DIM, dtype=np.float32)
    right = np.zeros(HAND_DIM, dtype=np.float32)

    handedness = getattr(result, "handedness", None) or []
    landmarks = getattr(result, "hand_landmarks", None) or []
    for i, hand in enumerate(landmarks):
        hand_name = ""
        if i < len(handedness) and handedness[i]:
            hand_name = (handedness[i][0].category_name or "").lower()
        if hand_name == "left":
            left = _flat_hand(hand)
        elif hand_name == "right":
            right = _flat_hand(hand)
        else:
            # fallback: fill first empty slot
            if np.all(left == 0):
                left = _flat_hand(hand)
            else:
                right = _flat_hand(hand)

    vec = np.concatenate([left, right]).astype(np.float32)
    if vec.shape[0] != FEATURE_DIM:
        raise ValueError(f"Expected {FEATURE_DIM} features, got {vec.shape[0]}")
    return vec

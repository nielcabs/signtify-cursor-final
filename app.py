import json
import os
import sys
import time
import threading
from collections import Counter, deque
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

# Windows consoles often use cp1252; enforce UTF-8 console output.
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except (OSError, ValueError):
        pass

from ml.model_definition import build_sequence_gru_model

# --- Setup the Server ---
app = Flask(__name__)
CORS(app)

# --- Load Model from Separate Files ---
print(" * Loading Keras model... Please wait.")

DEFAULT_LABELS = ["nothing", "hello", "thanks", "iloveyou", "yes", "no"]
model = None
letter_model = None
SEQ_LEN = 30
FEATURE_DIM = 126

# Pretrained (no-record) ASL alphabet CNN model (expects single-hand 63 features).
LETTER_MODEL_PATH = os.path.join("ml", "pretrained", "cnn_asl_model_final.h5")
LETTER_LABELS = [
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
    "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
    "del", "space", "nothing",
]
WORD_PRIORITY = {"hello", "thanks", "yes", "no"}
LETTER_CONF_THRESHOLD = 0.54
LETTER_K_CONF_THRESHOLD = 0.48
LETTER_MIN_MARGIN = 0.06
WORD_CONF_THRESHOLD = 0.50
WORD_FALLBACK_CONF_THRESHOLD = 0.35
NUMBER_CONF_THRESHOLD = 0.68
MOTION_WORD_THRESHOLD = 0.012
MOTION_NUMBER_MAX = 0.020
LETTER_TEMPORAL_WINDOW = 7
NUMBER_TEMPORAL_WINDOW = 7
NUMBER_MIN_SUPPORT = 0.45
MIRROR_BLEND_RATIO = 0.40
B_SHAPE_SCORE_THRESHOLD = 0.74
B_LETTER_PROB_THRESHOLD = 0.34
LETTER_SOFT_CONF_THRESHOLD = 0.32
NUMBER_SOFT_CONF_THRESHOLD = 0.55
NUMBER_SOFT_MIN_SUPPORT = 0.35

# Final anti-hallucination gates.
FINAL_MIN_CONF = {
    "words_gru": 0.52,
    "words_gru_fallback": 0.45,
    "letters_cnn": 0.56,
    "letters_cnn_rule_b": 0.52,
    "letters_cnn_soft": 0.42,
    "rule_b_shape_soft": 0.54,
    "numbers_heuristic": 0.72,
    "numbers_heuristic_soft": 0.55,
}
FINAL_MIN_MARGIN = {
    "words_gru": 0.10,
    "words_gru_fallback": 0.08,
    "letters_cnn": 0.08,
    "letters_cnn_rule_b": 0.07,
    "letters_cnn_soft": 0.04,
    "rule_b_shape_soft": 0.0,
    "numbers_heuristic": 0.0,
    "numbers_heuristic_soft": 0.0,
}
FINAL_MAX_NORM_ENTROPY = {
    "words_gru": 0.78,
    "words_gru_fallback": 0.84,
    "letters_cnn": 0.82,
    "letters_cnn_rule_b": 0.84,
    "letters_cnn_soft": 0.92,
    "rule_b_shape_soft": 0.2,
    "numbers_heuristic": 0.05,
    "numbers_heuristic_soft": 0.12,
}
AMBIGUOUS_GROUPS = [
    {"a", "e", "s", "m", "n", "t"},
    {"u", "v", "w", "r"},
    {"i", "j"},
    {"p", "q"},
    {"c", "o"},
    {"2", "v"},
]
AMBIGUOUS_MIN_MARGIN = 0.22
AMBIGUOUS_LETTER_MIN_CONF = 0.62
STABILITY_WINDOW = 6
STABILITY_MIN_COUNT = 2
STABILITY_BYPASS_CONF = 0.90
ASSISTANT_EVENT_WINDOW = 240
ASSISTANT_ANALYZE_DEFAULT_LIMIT = 120
ASSISTANT_MIN_EVENTS_FOR_ADVICE = 20


def _pick_primary_hand(frame126: np.ndarray) -> tuple[np.ndarray, str, float]:
    left = frame126[:63]
    right = frame126[63:]
    left_energy = float(np.sum(np.abs(left)))
    right_energy = float(np.sum(np.abs(right)))
    if left_energy >= right_energy:
        return left, "left", left_energy
    return right, "right", right_energy


def _pick_primary_hand_from_sequence(sequence_array: np.ndarray) -> tuple[np.ndarray, str, float, np.ndarray]:
    """
    Picks a stable primary side across the full sequence and returns:
    (hand_sequence_63, hand_side, latest_frame_energy, latest_frame_63).
    """
    left_seq = sequence_array[:, :63]
    right_seq = sequence_array[:, 63:]
    left_energy_total = float(np.sum(np.abs(left_seq)))
    right_energy_total = float(np.sum(np.abs(right_seq)))

    if left_energy_total >= right_energy_total:
        latest = left_seq[-1]
        return left_seq, "left", float(np.sum(np.abs(latest))), latest
    latest = right_seq[-1]
    return right_seq, "right", float(np.sum(np.abs(latest))), latest


def _flip_hand63(hand63: np.ndarray) -> np.ndarray:
    pts = hand63.reshape(21, 3).copy()
    pts[:, 0] = 1.0 - pts[:, 0]
    return pts.reshape(63)


def _mirror_and_swap_sequence(sequence_array: np.ndarray) -> np.ndarray:
    """
    Mirrors x-coordinates and swaps left/right channels.
    Helps when capture orientation differs from training orientation.
    """
    left = sequence_array[:, :63]
    right = sequence_array[:, 63:]

    left_pts = left.reshape(-1, 21, 3).copy()
    right_pts = right.reshape(-1, 21, 3).copy()
    left_pts[:, :, 0] = 1.0 - left_pts[:, :, 0]
    right_pts[:, :, 0] = 1.0 - right_pts[:, :, 0]

    # Swap sides after mirroring.
    mirrored_left = right_pts.reshape(-1, 63)
    mirrored_right = left_pts.reshape(-1, 63)
    return np.concatenate([mirrored_left, mirrored_right], axis=1)


def _motion_score(sequence_array: np.ndarray, hand_side: str) -> float:
    if sequence_array.shape[0] < 2:
        return 0.0
    if hand_side == "left":
        seq = sequence_array[:, :63]
    else:
        seq = sequence_array[:, 63:]
    return float(np.mean(np.abs(np.diff(seq, axis=0))))


def _predict_number_sign(hand63: np.ndarray, hand_energy: float) -> tuple[str, float] | None:
    """Heuristic number recognizer for 0-10 from one hand landmarks."""
    if hand_energy < 2.5:
        return None

    pts = hand63.reshape(21, 3)
    tip_ids = {"thumb": 4, "index": 8, "middle": 12, "ring": 16, "pinky": 20}
    pip_ids = {"thumb": 3, "index": 6, "middle": 10, "ring": 14, "pinky": 18}
    mcp_ids = {"thumb": 2}

    # Non-thumb: extended means tip is significantly above PIP in image space.
    index_up = pts[tip_ids["index"], 1] < (pts[pip_ids["index"], 1] - 0.03)
    middle_up = pts[tip_ids["middle"], 1] < (pts[pip_ids["middle"], 1] - 0.03)
    ring_up = pts[tip_ids["ring"], 1] < (pts[pip_ids["ring"], 1] - 0.025)
    pinky_up = pts[tip_ids["pinky"], 1] < (pts[pip_ids["pinky"], 1] - 0.02)

    # Thumb is orientation-dependent; use x spread and y rise as combined cue.
    thumb_dx = abs(float(pts[tip_ids["thumb"], 0] - pts[mcp_ids["thumb"], 0]))
    thumb_dy = float(pts[pip_ids["thumb"], 1] - pts[tip_ids["thumb"], 1])
    thumb_up = thumb_dx > 0.08 or thumb_dy > 0.025

    # Use palm width for scale-invariant fingertip touch checks (6-9).
    palm_width = float(np.linalg.norm(pts[5, :2] - pts[17, :2])) + 1e-6

    def _thumb_touches(finger_name: str, threshold_ratio: float = 0.42) -> bool:
        d = float(np.linalg.norm(pts[tip_ids["thumb"], :2] - pts[tip_ids[finger_name], :2]))
        return d <= (palm_width * threshold_ratio)

    thumb_touch_index = _thumb_touches("index")
    thumb_touch_middle = _thumb_touches("middle")
    thumb_touch_ring = _thumb_touches("ring")
    thumb_touch_pinky = _thumb_touches("pinky")

    flags = [thumb_up, index_up, middle_up, ring_up, pinky_up]
    count = int(sum(1 for f in flags if f))

    # 6-9: thumb touches specific fingertip.
    if index_up and middle_up and ring_up and thumb_touch_pinky:
        return "6", 0.86
    if index_up and middle_up and pinky_up and thumb_touch_ring:
        return "7", 0.86
    if index_up and ring_up and pinky_up and thumb_touch_middle:
        return "8", 0.86
    if middle_up and ring_up and pinky_up and thumb_touch_index:
        return "9", 0.86

    # 10 (static approximation): thumb up, other fingers mostly curled.
    if thumb_up and not index_up and not middle_up and not ring_up and not pinky_up:
        return "10", 0.82

    # Canonical patterns to reduce false positives on letters.
    if count == 0:
        return "0", 0.72
    if index_up and not any([thumb_up, middle_up, ring_up, pinky_up]):
        return "1", 0.86
    if index_up and middle_up and not any([thumb_up, ring_up, pinky_up]):
        return "2", 0.88
    if index_up and middle_up and ring_up and not pinky_up:
        return "3", 0.82
    if index_up and middle_up and ring_up and pinky_up and not thumb_up:
        return "4", 0.86
    if all(flags):
        return "5", 0.9

    return None


def _predict_number_temporal(hand_seq63: np.ndarray) -> tuple[str, float, float] | None:
    """Temporal vote for numbers using recent frames."""
    if hand_seq63.size == 0:
        return None

    recent = hand_seq63[-NUMBER_TEMPORAL_WINDOW:]
    votes: dict[str, dict[str, float]] = {}

    for frame in recent:
        energy = float(np.sum(np.abs(frame)))
        pred = _predict_number_sign(frame, energy)
        if pred is None:
            continue
        label, conf = pred
        if label not in votes:
            votes[label] = {"count": 0.0, "conf_sum": 0.0}
        votes[label]["count"] += 1.0
        votes[label]["conf_sum"] += float(conf)

    if not votes:
        return None

    best_label, best_stats = max(
        votes.items(),
        key=lambda kv: (kv[1]["count"], kv[1]["conf_sum"] / max(kv[1]["count"], 1.0)),
    )
    count = float(best_stats["count"])
    avg_conf = float(best_stats["conf_sum"] / max(count, 1.0))
    support = float(count / max(float(recent.shape[0]), 1.0))
    return best_label, avg_conf, support


def _predict_letter_temporal(hand_seq63: np.ndarray) -> tuple[str, float, dict[str, float], float] | None:
    """Runs CNN on recent frames and averages probabilities for stability."""
    if letter_model is None or hand_seq63.size == 0:
        return None

    recent = hand_seq63[-LETTER_TEMPORAL_WINDOW:]
    energies = np.sum(np.abs(recent), axis=1)
    valid = recent[energies > 2.0]
    if valid.shape[0] == 0:
        return None

    x = valid.reshape(valid.shape[0], 63, 1).astype(np.float32)
    x_flip = np.array([_flip_hand63(frame) for frame in valid], dtype=np.float32).reshape(valid.shape[0], 63, 1)

    probs_batch = letter_model.predict(x, verbose=0)  # (N, 29)
    probs_batch_flip = letter_model.predict(x_flip, verbose=0)
    avg_probs = np.mean(probs_batch, axis=0)
    avg_probs_flip = np.mean(probs_batch_flip, axis=0)

    # Blend original with mirrored inference to reduce orientation sensitivity.
    avg_probs = ((1.0 - MIRROR_BLEND_RATIO) * avg_probs) + (MIRROR_BLEND_RATIO * avg_probs_flip)

    idx = int(np.argmax(avg_probs))
    letter = LETTER_LABELS[idx] if idx < len(LETTER_LABELS) else str(idx)
    conf = float(avg_probs[idx])
    sorted_probs = np.sort(avg_probs)[::-1]
    second = float(sorted_probs[1]) if sorted_probs.shape[0] > 1 else 0.0
    margin = conf - second
    all_probs = {
        LETTER_LABELS[i]: float(avg_probs[i]) for i in range(min(len(LETTER_LABELS), avg_probs.shape[0]))
    }
    return letter, conf, all_probs, margin


def _k_shape_score(hand63: np.ndarray, hand_energy: float) -> float:
    """
    Returns a score in [0, 1] for how much the hand resembles ASL 'K'.
    This is used only as a tie-breaker for low-confidence K predictions.
    """
    if hand_energy < 2.5:
        return 0.0

    pts = hand63.reshape(21, 3)

    # Finger posture cues.
    index_up = pts[8, 1] < (pts[6, 1] - 0.03)
    middle_up = pts[12, 1] < (pts[10, 1] - 0.03)
    ring_folded = pts[16, 1] > (pts[14, 1] - 0.005)
    pinky_folded = pts[20, 1] > (pts[18, 1] - 0.005)

    # K usually has index + middle split (not touching).
    index_middle_spread = abs(float(pts[8, 0] - pts[12, 0])) > 0.03

    # Thumb tends to sit between index and middle bases.
    mid_x = float((pts[5, 0] + pts[9, 0]) / 2.0)
    mid_y = float((pts[5, 1] + pts[9, 1]) / 2.0)
    thumb_near_between = np.hypot(float(pts[4, 0] - mid_x), float(pts[4, 1] - mid_y)) < 0.12

    # Weighted score to avoid strict all-or-nothing behavior.
    score = 0.0
    score += 0.2 if index_up else 0.0
    score += 0.2 if middle_up else 0.0
    score += 0.2 if ring_folded else 0.0
    score += 0.2 if pinky_folded else 0.0
    score += 0.1 if index_middle_spread else 0.0
    score += 0.1 if thumb_near_between else 0.0
    return float(score)


def _b_shape_score(hand63: np.ndarray, hand_energy: float) -> float:
    """
    Returns a score in [0, 1] for how much the hand resembles ASL 'B'.
    Focuses on: four fingers up, fingers close together, and folded thumb.
    """
    if hand_energy < 2.5:
        return 0.0

    pts = hand63.reshape(21, 3)

    # Finger posture cues.
    index_up = pts[8, 1] < (pts[6, 1] - 0.03)
    middle_up = pts[12, 1] < (pts[10, 1] - 0.03)
    ring_up = pts[16, 1] < (pts[14, 1] - 0.025)
    pinky_up = pts[20, 1] < (pts[18, 1] - 0.02)
    all_four_up = index_up and middle_up and ring_up and pinky_up

    # Thumb folded cue (opposite of number-5 style extension).
    thumb_dx = abs(float(pts[4, 0] - pts[2, 0]))
    thumb_dy = float(pts[3, 1] - pts[4, 1])
    thumb_folded = (thumb_dx < 0.075) and (thumb_dy < 0.02)

    # Fingers-together cue: B tends to be less spread than "4".
    palm_width = float(np.linalg.norm(pts[5, :2] - pts[17, :2])) + 1e-6
    spread_raw = (
        abs(float(pts[8, 0] - pts[12, 0]))
        + abs(float(pts[12, 0] - pts[16, 0]))
        + abs(float(pts[16, 0] - pts[20, 0]))
    ) / 3.0
    spread_norm = float(spread_raw / palm_width)
    fingers_together = spread_norm < 0.26

    # Vertical alignment cue: fingertips roughly aligned for "B".
    tip_ys = np.array([pts[8, 1], pts[12, 1], pts[16, 1], pts[20, 1]], dtype=np.float32)
    y_std_norm = float(np.std(tip_ys) / max(palm_width, 1e-6))
    aligned_tips = y_std_norm < 0.12

    score = 0.0
    score += 0.35 if all_four_up else 0.0
    score += 0.25 if thumb_folded else 0.0
    score += 0.25 if fingers_together else 0.0
    score += 0.15 if aligned_tips else 0.0
    return float(score)


def _prob_stats(all_probs: dict[str, float]) -> dict[str, float | str]:
    if not all_probs:
        return {
            "top_label": "nothing",
            "top_conf": 0.0,
            "second_label": "nothing",
            "second_conf": 0.0,
            "margin": 0.0,
            "norm_entropy": 1.0,
        }

    items = sorted(((str(k), float(v)) for k, v in all_probs.items()), key=lambda kv: kv[1], reverse=True)
    top_label, top_conf = items[0]
    second_label = items[1][0] if len(items) > 1 else top_label
    second_conf = items[1][1] if len(items) > 1 else 0.0
    margin = float(top_conf - second_conf)

    p = np.asarray([max(0.0, float(v)) for _, v in items], dtype=np.float64)
    s = float(np.sum(p))
    if s <= 1e-12:
        norm_entropy = 1.0
    else:
        p = p / s
        entropy = float(-np.sum(p * np.log(np.clip(p, 1e-12, 1.0))))
        entropy_max = float(np.log(max(len(p), 2)))
        norm_entropy = float(entropy / entropy_max)

    return {
        "top_label": top_label,
        "top_conf": float(top_conf),
        "second_label": str(second_label),
        "second_conf": float(second_conf),
        "margin": margin,
        "norm_entropy": norm_entropy,
    }


def _in_same_ambiguous_group(label_a: str, label_b: str) -> bool:
    la = str(label_a).lower()
    lb = str(label_b).lower()
    for group in AMBIGUOUS_GROUPS:
        if la in group and lb in group:
            return True
    return False


def _apply_final_quality_gate(
    prediction_sign: str,
    confidence: float,
    all_probs: dict[str, float],
    source: str,
) -> tuple[str, float, dict[str, float], str, dict[str, float | str]]:
    stats = _prob_stats(all_probs)

    if prediction_sign == "nothing":
        return prediction_sign, confidence, all_probs, source, stats

    min_conf = FINAL_MIN_CONF.get(source, 0.62)
    min_margin = FINAL_MIN_MARGIN.get(source, 0.12)
    max_entropy = FINAL_MAX_NORM_ENTROPY.get(source, 0.68)

    reject_reason = None
    if float(confidence) < min_conf:
        reject_reason = "low_confidence"
    elif float(stats["margin"]) < min_margin:
        reject_reason = "low_margin"
    elif float(stats["norm_entropy"]) > max_entropy:
        reject_reason = "high_entropy"
    elif _in_same_ambiguous_group(str(stats["top_label"]), str(prediction_sign)) and float(stats["margin"]) < AMBIGUOUS_MIN_MARGIN:
        reject_reason = "ambiguous_pair"

    if reject_reason:
        gated_source = f"{source}_rejected_{reject_reason}"
        return "nothing", max(float(confidence), float(stats["top_conf"])), {"nothing": 1.0}, gated_source, stats

    return prediction_sign, float(confidence), all_probs, source, stats


def _extract_rejection_reason(source: str) -> str:
    s = str(source or "")
    marker = "_rejected_"
    if marker in s:
        return s.split(marker, 1)[1]
    if s == "low_confidence":
        return "low_confidence"
    return "none"


def _assistant_recommendation(reason: str) -> str:
    if reason in {"low_confidence", "high_entropy"}:
        return "Hold the sign steady, improve lighting, and keep the hand centered."
    if reason in {"low_margin", "ambiguous_pair"}:
        return "Use a more exaggerated hand shape and keep fingers clearly separated."
    return "Prediction accepted."


ASSISTANT_EVENTS = deque(maxlen=ASSISTANT_EVENT_WINDOW)
ASSISTANT_LOCK = threading.Lock()
RECENT_PREDICTIONS = deque(maxlen=STABILITY_WINDOW)
RECENT_LOCK = threading.Lock()


def _register_assistant_event(event: dict) -> None:
    with ASSISTANT_LOCK:
        ASSISTANT_EVENTS.append(event)


def _assistant_analysis(limit: int) -> dict:
    lim = max(1, int(limit))
    with ASSISTANT_LOCK:
        events = list(ASSISTANT_EVENTS)[-lim:]

    if not events:
        return {
            "events_analyzed": 0,
            "accepted": 0,
            "rejected": 0,
            "rejection_rate": 0.0,
            "message": "No prediction events yet.",
            "top_predictions": [],
            "rejection_reasons": {},
            "confusion_pairs": [],
            "recommendations": [],
        }

    accepted = [e for e in events if not e.get("rejected", False)]
    rejected = [e for e in events if e.get("rejected", False)]
    rejection_reasons = Counter(str(e.get("rejection_reason", "none")) for e in rejected)
    accepted_labels = Counter(str(e.get("prediction", "nothing")) for e in accepted)
    confusion_pairs = Counter(
        f"{e.get('top_label')}->{e.get('second_label')}"
        for e in rejected
        if e.get("top_label") and e.get("second_label")
    )

    avg_conf = float(np.mean([float(e.get("confidence", 0.0)) for e in events]))
    avg_margin = float(np.mean([float(e.get("margin", 0.0)) for e in events]))
    avg_entropy = float(np.mean([float(e.get("norm_entropy", 1.0)) for e in events]))
    rejection_rate = float(len(rejected) / max(len(events), 1))

    recommendations = []
    if len(events) >= ASSISTANT_MIN_EVENTS_FOR_ADVICE:
        if rejection_rate > 0.45:
            recommendations.append(
                "High rejection rate: collect more real recordings for signs that are frequently attempted."
            )
        if rejection_reasons.get("ambiguous_pair", 0) >= 3:
            recommendations.append(
                "Frequent ambiguous-pair rejections: retrain confusing classes together (e.g., a/e/s, m/n, u/v/w)."
            )
        if rejection_reasons.get("high_entropy", 0) >= 3:
            recommendations.append(
                "Predictions are diffuse: improve camera framing and add more varied clips (distance, angle, lighting)."
            )
        if rejection_reasons.get("low_confidence", 0) >= 3:
            recommendations.append(
                "Low confidence is common: increase sample count per target sign (at least 30+ real clips each)."
            )
        if not recommendations:
            recommendations.append("System looks stable in recent events.")

    return {
        "events_analyzed": len(events),
        "accepted": len(accepted),
        "rejected": len(rejected),
        "rejection_rate": rejection_rate,
        "avg_confidence": avg_conf,
        "avg_margin": avg_margin,
        "avg_norm_entropy": avg_entropy,
        "top_predictions": accepted_labels.most_common(8),
        "rejection_reasons": dict(rejection_reasons),
        "confusion_pairs": confusion_pairs.most_common(8),
        "recommendations": recommendations,
    }


def _in_any_ambiguous_group(label: str) -> bool:
    ll = str(label).lower()
    for group in AMBIGUOUS_GROUPS:
        if ll in group:
            return True
    return False


def _apply_temporal_stability_gate(
    prediction_sign: str,
    confidence: float,
    source: str,
) -> tuple[str, float, dict[str, float], str]:
    """
    Reject one-off flickers: require repeated votes in a short window,
    unless confidence is very high.
    """
    with RECENT_LOCK:
        RECENT_PREDICTIONS.append(str(prediction_sign))
        recent = list(RECENT_PREDICTIONS)

    if prediction_sign == "nothing":
        return prediction_sign, confidence, {"nothing": 1.0}, source

    if confidence >= STABILITY_BYPASS_CONF:
        return prediction_sign, confidence, {}, source

    same_count = sum(1 for x in recent if x == prediction_sign)
    if same_count < STABILITY_MIN_COUNT:
        return "nothing", confidence, {"nothing": 1.0}, f"{source}_rejected_unstable"

    return prediction_sign, confidence, {}, source


def load_action_labels():
    """Class names in softmax order. Training writes model_labels.json next to weights."""
    path = "model_labels.json"
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        labels = data.get("labels")
        if labels and isinstance(labels, list):
            return np.array([str(x) for x in labels])
    return np.array(DEFAULT_LABELS)


actions = load_action_labels()

if os.path.exists("model_metadata.json"):
    with open("model_metadata.json", encoding="utf-8") as f:
        metadata = json.load(f)
    SEQ_LEN = int(metadata.get("seq_len", SEQ_LEN))
    FEATURE_DIM = int(metadata.get("feature_dim", FEATURE_DIM))

try:
    weights_file = next(
        (p for p in ("model_weights_only.weights.h5", "model_weights_only.h5") if os.path.exists(p)),
        None,
    )
    if weights_file:
        print(" * Building architecture for", len(actions), "classes...")
        model = build_sequence_gru_model(
            num_classes=len(actions),
            seq_len=SEQ_LEN,
            feature_dim=FEATURE_DIM,
        )
        print(f" * Loading weights from {weights_file}...")
        model.load_weights(weights_file)
        print(" * Weights loaded")

    elif os.path.exists("best_sign_language_model.h5"):
        print(" * Loading legacy full model (6 classes): best_sign_language_model.h5")
        actions = np.array(DEFAULT_LABELS)
        from tensorflow.keras.models import load_model
        from tensorflow.keras.layers import GRU, Dense, Dropout, BatchNormalization

        custom_objects = {
            "GRU": GRU,
            "BatchNormalization": BatchNormalization,
            "Dropout": Dropout,
            "Dense": Dense,
        }

        model = load_model(
            "best_sign_language_model.h5",
            compile=False,
            custom_objects=custom_objects,
        )
        print(" * Legacy model loaded")

    else:
        raise FileNotFoundError(
            "No model_weights_only.weights.h5, model_weights_only.h5, or best_sign_language_model.h5 found!"
        )

    print(" * Model ready. Server is running at http://127.0.0.1:5000/")
    print(f" * Model expects input shape: (None, {SEQ_LEN}, {FEATURE_DIM})")
    print(f" * Actions ({len(actions)}): {actions}")

    # Load pretrained letter model (optional but recommended).
    try:
        if os.path.exists(LETTER_MODEL_PATH):
            from tensorflow.keras.models import load_model as load_letter_model

            letter_model = load_letter_model(LETTER_MODEL_PATH, compile=False)
            print(f" * Pretrained letter model loaded: {LETTER_MODEL_PATH}")
        else:
            print(f" * [warn] Pretrained letter model not found at {LETTER_MODEL_PATH}")
    except Exception as e:
        print(f" * [warn] Failed to load pretrained letter model: {e}")

except Exception as e:
    print(f" * Error loading model: {e}")
    print(f" * Error type: {type(e).__name__}")

    print("\n" + "=" * 60)
    print("Troubleshooting:")
    print("=" * 60)

    if "Mismatch between model" in str(e) or " shapes " in str(e).lower():
        print("Weight shape mismatch: model_labels.json class count must match the trained .h5.")
        print("Retrain after changing labels: python training/train.py")
    elif "time_major" in str(e) or "keyword" in str(e):
        print("TensorFlow version compatibility issue detected.")
        print("Save compatible weights: model.save_weights('model_weights_only.h5')")
    else:
        print("\nExpected setup:")
        print("   • model_weights_only.weights.h5 or model_weights_only.h5 (from training/train.py)")
        print("   • model_labels.json (optional; defaults to 6 classes if missing)")
        print("   Or legacy: best_sign_language_model.h5 (6 classes only)")

    print("\n" + "=" * 60)
    exit(1)


# --- Create the API Endpoint ---
@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.json

        if not data or "sequence" not in data:
            return jsonify({"error": "No sequence data provided"}), 400

        sequence = data["sequence"]
        translation_mode = str(data.get("mode", "letters")).strip().lower()
        if translation_mode == "hybrid":
            translation_mode = "letters"
        if translation_mode not in {"letters", "numbers", "words"}:
            translation_mode = "letters"
        wants_letters = translation_mode == "letters"
        wants_numbers = translation_mode == "numbers"
        wants_words = translation_mode == "words"

        if len(sequence) != SEQ_LEN:
            return jsonify({"error": f"Expected {SEQ_LEN} frames, got {len(sequence)}"}), 400

        if len(sequence[0]) != FEATURE_DIM:
            return jsonify({"error": f"Expected {FEATURE_DIM} features per frame, got {len(sequence[0])}"}), 400

        sequence_array = np.array(sequence, dtype=np.float32)

        # Use a stable primary side across the sequence for letter/number recognition.
        hand_seq63, hand_side, hand_energy, hand63 = _pick_primary_hand_from_sequence(sequence_array)
        motion = _motion_score(sequence_array, hand_side)

        # --- Letter model path (single-hand, temporal smoothing) ---
        letter_pred = _predict_letter_temporal(hand_seq63)
        k_shape_score = max(
            _k_shape_score(frame, float(np.sum(np.abs(frame))))
            for frame in hand_seq63[-3:]
        )
        b_shape_score = max(
            _b_shape_score(frame, float(np.sum(np.abs(frame))))
            for frame in hand_seq63[-3:]
        )
        b_prob = float(letter_pred[2].get("b", 0.0)) if letter_pred is not None else 0.0

        # --- Word model path (sequence-based) ---
        sequence_input = np.expand_dims(sequence_array, axis=0)
        sequence_mirror = _mirror_and_swap_sequence(sequence_array)
        sequence_mirror_input = np.expand_dims(sequence_mirror, axis=0)

        res_orig = model.predict(sequence_input, verbose=0)[0]
        res_mirror = model.predict(sequence_mirror_input, verbose=0)[0]
        res = ((1.0 - MIRROR_BLEND_RATIO) * res_orig) + (MIRROR_BLEND_RATIO * res_mirror)
        word_idx = int(np.argmax(res))
        word = str(actions[word_idx])
        word_conf = float(res[word_idx])
        word_probs = {str(actions[i]): float(res[i]) for i in range(len(actions))}

        # --- Number path (heuristic 0-5) ---
        number_pred = _predict_number_temporal(hand_seq63)

        # --- Rule-based tie-breaker for B vs 4/5 ---
        # Helps reduce the common confusion between ASL "B" and open-hand numbers.
        b_override = (
            b_shape_score >= B_SHAPE_SCORE_THRESHOLD
            and b_prob >= B_LETTER_PROB_THRESHOLD
            and motion <= MOTION_NUMBER_MAX
            and number_pred is not None
            and number_pred[0] in {"4", "5"}
        )

        # --- Merge decision ---
        if wants_words and motion >= MOTION_WORD_THRESHOLD and word in WORD_PRIORITY and word_conf >= WORD_CONF_THRESHOLD:
            prediction_sign = word
            confidence = word_conf
            all_probs = word_probs
            source = "words_gru"
        elif wants_letters and b_override:
            prediction_sign = "b"
            confidence = max(b_prob, (letter_pred[1] if letter_pred is not None else 0.0))
            all_probs = (letter_pred[2] if letter_pred is not None else {"b": confidence})
            source = "letters_cnn_rule_b"
        elif (
            wants_numbers
            and
            number_pred is not None
            and number_pred[1] >= NUMBER_CONF_THRESHOLD
            and number_pred[2] >= NUMBER_MIN_SUPPORT
            and motion <= MOTION_NUMBER_MAX
            and (letter_pred is None or letter_pred[1] < 0.65)
        ):
            prediction_sign = number_pred[0]
            confidence = number_pred[1]
            all_probs = {number_pred[0]: number_pred[1]}
            source = "numbers_heuristic"
        elif (
            wants_numbers
            and
            number_pred is not None
            and number_pred[1] >= NUMBER_SOFT_CONF_THRESHOLD
            and number_pred[2] >= NUMBER_SOFT_MIN_SUPPORT
            and motion <= (MOTION_NUMBER_MAX * 1.8)
        ):
            # Softer number fallback to avoid "stuck at analyzing" UX in live mode.
            prediction_sign = number_pred[0]
            confidence = number_pred[1]
            all_probs = {number_pred[0]: number_pred[1]}
            source = "numbers_heuristic_soft"
        elif (
            wants_letters
            and
            letter_pred is not None
            and (
                (letter_pred[1] >= LETTER_CONF_THRESHOLD and letter_pred[3] >= LETTER_MIN_MARGIN)
                or (
                    letter_pred[0] == "k"
                    and letter_pred[1] >= LETTER_K_CONF_THRESHOLD
                    and k_shape_score >= 0.75
                )
            )
            and letter_pred[0] not in ("nothing", "space", "del")
        ):
            prediction_sign = letter_pred[0]
            confidence = letter_pred[1]
            all_probs = letter_pred[2]
            source = "letters_cnn"
        elif (
            wants_letters
            and
            letter_pred is not None
            and letter_pred[0] not in ("nothing", "space", "del")
            and letter_pred[1] >= LETTER_SOFT_CONF_THRESHOLD
        ):
            # Softer fallback for realtime UX: prefer a plausible letter over always "nothing".
            prediction_sign = letter_pred[0]
            confidence = letter_pred[1]
            all_probs = letter_pred[2]
            source = "letters_cnn_soft"
        elif wants_letters and b_shape_score >= (B_SHAPE_SCORE_THRESHOLD + 0.06) and motion <= (MOTION_NUMBER_MAX * 1.6):
            # Last-resort rule for clear static "B" handshape.
            prediction_sign = "b"
            confidence = max(0.58, b_prob)
            all_probs = {"b": float(confidence)}
            source = "rule_b_shape_soft"
        elif wants_words and word in WORD_PRIORITY and word_conf >= WORD_FALLBACK_CONF_THRESHOLD:
            prediction_sign = word
            confidence = word_conf
            all_probs = word_probs
            source = "words_gru_fallback"
        else:
            # Prefer "no decision" over forcing a wrong class.
            prediction_sign = "nothing"
            confidence = max(word_conf, (letter_pred[1] if letter_pred else 0.0))
            all_probs = {"nothing": 1.0}
            source = "low_confidence"

        # Final anti-hallucination gate: reject ambiguous/uncertain outputs.
        prediction_sign, confidence, all_probs, source, quality_stats = _apply_final_quality_gate(
            prediction_sign=prediction_sign,
            confidence=confidence,
            all_probs=all_probs,
            source=source,
        )

        # Extra strictness for commonly confused letter groups.
        if (
            prediction_sign != "nothing"
            and source.startswith("letters_cnn")
            and _in_any_ambiguous_group(prediction_sign)
            and float(confidence) < AMBIGUOUS_LETTER_MIN_CONF
        ):
            source = f"{source}_rejected_ambiguous_low_conf"
            prediction_sign = "nothing"
            all_probs = {"nothing": 1.0}

        # Temporal assistant gate: avoid one-frame hallucinations.
        prediction_sign, confidence, forced_probs, source = _apply_temporal_stability_gate(
            prediction_sign=prediction_sign,
            confidence=float(confidence),
            source=source,
        )
        if forced_probs:
            all_probs = forced_probs

        rejection_reason = _extract_rejection_reason(source)
        rejected = prediction_sign == "nothing" and rejection_reason != "none"

        assistant_meta = {
            "decision": "rejected" if rejected else "accepted",
            "rejected": rejected,
            "rejection_reason": rejection_reason,
            "recommendation": _assistant_recommendation(rejection_reason),
        }

        _register_assistant_event(
            {
                "ts": time.time(),
                "prediction": prediction_sign,
                "confidence": float(confidence),
                "source": source,
                "rejected": rejected,
                "rejection_reason": rejection_reason,
                "top_label": str(quality_stats["top_label"]),
                "second_label": str(quality_stats["second_label"]),
                "margin": float(quality_stats["margin"]),
                "norm_entropy": float(quality_stats["norm_entropy"]),
            }
        )

        response = {
            "mode": translation_mode,
            "prediction": prediction_sign,
            "confidence": confidence,
            "source": source,
            "motion": motion,
            "all_probabilities": all_probs,
            "diagnostics": {
                "hand_side": hand_side,
                "hand_energy": hand_energy,
                "b_shape_score": float(b_shape_score),
                "b_prob": float(b_prob),
                "letter_margin": (float(letter_pred[3]) if letter_pred is not None else 0.0),
                "number_support": (float(number_pred[2]) if number_pred is not None else 0.0),
                "top_label": str(quality_stats["top_label"]),
                "top_conf": float(quality_stats["top_conf"]),
                "second_label": str(quality_stats["second_label"]),
                "second_conf": float(quality_stats["second_conf"]),
                "final_margin": float(quality_stats["margin"]),
                "norm_entropy": float(quality_stats["norm_entropy"]),
            },
            "assistant": assistant_meta,
        }

        print(f"Prediction: {prediction_sign} ({confidence*100:.1f}%)")

        return jsonify(response)

    except Exception as e:
        print(f"Error during prediction: {e}")
        import traceback

        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify(
        {
            "status": "ok",
            "model_loaded": model is not None,
            "letter_model_loaded": letter_model is not None,
            "actions": actions.tolist(),
            "extra_actions": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
            "categories": {
                "letters": [x for x in LETTER_LABELS if len(x) == 1 and x.isalpha()],
                "greetings_daily": sorted([x for x in actions.tolist() if x in WORD_PRIORITY]),
                "numbers": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
            },
            "seq_len": SEQ_LEN,
            "feature_dim": FEATURE_DIM,
            "assistant": {"enabled": True, "analyze_endpoint": "/assistant/analyze"},
        }
    )


@app.route("/assistant/analyze", methods=["GET"])
def assistant_analyze():
    try:
        limit = int(request.args.get("limit", ASSISTANT_ANALYZE_DEFAULT_LIMIT))
    except ValueError:
        return jsonify({"error": "limit must be an integer"}), 400
    return jsonify(_assistant_analysis(limit))


@app.route("/record", methods=["POST"])
def record():
    """Save a labeled (SEQ_LEN, FEATURE_DIM) sequence into training/processed/<label>/."""
    try:
        data = request.json or {}
        label = str(data.get("label") or "").strip().lower()
        sequence = data.get("sequence")

        if not label:
            return jsonify({"error": "Missing label"}), 400
        if not isinstance(sequence, list) or not sequence:
            return jsonify({"error": "Missing sequence"}), 400
        if len(sequence) != SEQ_LEN:
            return jsonify({"error": f"Expected {SEQ_LEN} frames, got {len(sequence)}"}), 400
        if not isinstance(sequence[0], list) or len(sequence[0]) != FEATURE_DIM:
            return jsonify({"error": f"Expected {FEATURE_DIM} features per frame"}), 400

        arr = np.asarray(sequence, dtype=np.float32)
        out_dir = os.path.join("training", "processed", label)
        os.makedirs(out_dir, exist_ok=True)
        fname = f"recorded_{int(time.time() * 1000)}.npy"
        out_path = os.path.join(out_dir, fname)
        np.save(out_path, arr)

        return jsonify({"ok": True, "saved": out_path})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Flask server starting...")
    print("=" * 60)
    print("Endpoints:")
    print("   POST http://127.0.0.1:5000/predict")
    print("   POST http://127.0.0.1:5000/record")
    print("   GET  http://127.0.0.1:5000/health")
    print("   GET  http://127.0.0.1:5000/assistant/analyze")
    print("=" * 60 + "\n")

    app.run(debug=True, port=5000, use_reloader=False)

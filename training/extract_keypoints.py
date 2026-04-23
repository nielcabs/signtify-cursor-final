"""
Extract (seq_len, 126) hand-only sequences from training/raw/<label>/.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from mediapipe.tasks.python.vision.core.image import Image, ImageFormat

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ml.hand_model import create_image_hand_landmarker, ensure_hand_model
from ml.keypoints import FEATURE_DIM, sequence_from_static_keypoints, task_hand_result_to_vector

VIDEO_EXT = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".bmp", ".webp"}


def load_labels(path: Path) -> list[str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    labels = data.get("labels")
    if not labels or not isinstance(labels, list):
        raise ValueError("label_map.json must contain a non-empty 'labels' array")
    return [str(x) for x in labels]


def bgr_to_mp_image(bgr: np.ndarray) -> Image:
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    return Image(image_format=ImageFormat.SRGB, data=np.ascontiguousarray(rgb))


def sample_video_frames(cap: cv2.VideoCapture, num_frames: int) -> list[np.ndarray]:
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    frames: list[np.ndarray] = []
    if total <= 0:
        while True:
            ok, frame = cap.read()
            if not ok or frame is None:
                break
            frames.append(frame)
    else:
        indices = np.linspace(0, max(total - 1, 0), num_frames, dtype=int)
        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            ok, frame = cap.read()
            if ok and frame is not None:
                frames.append(frame)

    if not frames:
        return []
    if len(frames) < num_frames:
        while len(frames) < num_frames:
            frames.append(frames[-1].copy())
    elif len(frames) > num_frames:
        pick = np.linspace(0, len(frames) - 1, num_frames, dtype=int)
        frames = [frames[i] for i in pick]
    return frames


def process_video(path: Path, landmarker, seq_len: int) -> np.ndarray:
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {path}")
    try:
        bgr_frames = sample_video_frames(cap, seq_len)
    finally:
        cap.release()
    if len(bgr_frames) != seq_len:
        raise RuntimeError(f"Expected {seq_len} frames from {path}, got {len(bgr_frames)}")

    rows = []
    for frame in bgr_frames:
        result = landmarker.detect(bgr_to_mp_image(frame))
        rows.append(task_hand_result_to_vector(result))
    arr = np.stack(rows, axis=0).astype(np.float32)
    if arr.shape != (seq_len, FEATURE_DIM):
        raise RuntimeError(f"Unexpected sequence shape {arr.shape}")
    return arr


def process_image(path: Path, landmarker, seq_len: int, noise: float, copies: int) -> list[np.ndarray]:
    bgr = cv2.imread(str(path))
    if bgr is None:
        raise RuntimeError(f"Could not read image: {path}")
    result = landmarker.detect(bgr_to_mp_image(bgr))
    keypoints = task_hand_result_to_vector(result)
    return [
        sequence_from_static_keypoints(keypoints, seq_len=seq_len, noise_std=noise)
        for _ in range(max(1, copies))
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract hand keypoint sequences for training")
    parser.add_argument("--raw", type=Path, default=ROOT / "training" / "raw")
    parser.add_argument("--processed", type=Path, default=ROOT / "training" / "processed")
    parser.add_argument("--labels", type=Path, default=ROOT / "training" / "label_map.json")
    parser.add_argument("--seq-len", type=int, default=30)
    parser.add_argument("--noise", type=float, default=0.01, help="Jitter std for single-image clips")
    parser.add_argument(
        "--image-augments",
        type=int,
        default=6,
        help="How many synthetic sequences to generate per image",
    )
    parser.add_argument("--model", type=Path, default=None, help="Path to hand_landmarker.task")
    args = parser.parse_args()

    labels = load_labels(args.labels)
    args.processed.mkdir(parents=True, exist_ok=True)

    model_path = ensure_hand_model(args.model)
    landmarker = create_image_hand_landmarker(model_path)

    total_saved = 0
    try:
        for label in labels:
            in_dir = args.raw / label
            out_dir = args.processed / label
            out_dir.mkdir(parents=True, exist_ok=True)
            if not in_dir.is_dir():
                print(f"[skip] no folder for label '{label}' at {in_dir}")
                continue

            for fp in sorted(in_dir.iterdir()):
                if not fp.is_file():
                    continue
                ext = fp.suffix.lower()
                try:
                    if ext in VIDEO_EXT:
                        seq = process_video(fp, landmarker, args.seq_len)
                        out_path = out_dir / f"{fp.stem}.npy"
                        np.save(out_path, seq)
                        total_saved += 1
                        print(f"[ok] {label} <- {fp.name} -> {out_path.relative_to(ROOT)}")
                    elif ext in IMAGE_EXT:
                        seq_list = process_image(
                            fp,
                            landmarker,
                            args.seq_len,
                            args.noise,
                            args.image_augments,
                        )
                        for i, seq in enumerate(seq_list):
                            out_name = f"{fp.stem}_aug{i + 1}.npy"
                            out_path = out_dir / out_name
                            np.save(out_path, seq)
                            total_saved += 1
                        print(
                            f"[ok] {label} <- {fp.name} -> {len(seq_list)} augments in "
                            f"{out_dir.relative_to(ROOT)}"
                        )
                    else:
                        continue
                except Exception as e:
                    print(f"[err] {label} {fp.name}: {e}", file=sys.stderr)
    finally:
        landmarker.close()

    print(f"Done. Saved {total_saved} sequence files under {args.processed}")


if __name__ == "__main__":
    main()

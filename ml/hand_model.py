"""Download and build MediaPipe HandLandmarker (Tasks API)."""

from __future__ import annotations

import urllib.request
from pathlib import Path

from mediapipe.tasks.python.core import base_options as base_options_module
from mediapipe.tasks.python.vision import hand_landmarker as hand_landmarker_module
from mediapipe.tasks.python.vision.core import vision_task_running_mode as running_mode_module

_HAND_TASK_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
)


def ensure_hand_model(model_path: Path | None = None) -> Path:
    path = model_path or (
        Path(__file__).resolve().parent.parent / "training" / "models" / "hand_landmarker.task"
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_file() and path.stat().st_size > 1_000_000:
        return path
    print(f"Downloading HandLandmarker model to {path} ...")
    urllib.request.urlretrieve(_HAND_TASK_URL, path)
    return path


def create_image_hand_landmarker(model_path: Path):
    base_options = base_options_module.BaseOptions(model_asset_path=str(model_path))
    options = hand_landmarker_module.HandLandmarkerOptions(
        base_options=base_options,
        running_mode=running_mode_module.VisionTaskRunningMode.IMAGE,
        num_hands=2,
        min_hand_detection_confidence=0.5,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    return hand_landmarker_module.HandLandmarker.create_from_options(options)

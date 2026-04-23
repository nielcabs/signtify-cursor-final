"""Train GRU classifier on hand sequences and export weights + labels + metadata."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.utils import class_weight
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from tensorflow.keras.utils import to_categorical

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ml.keypoints import FEATURE_DIM
from ml.model_definition import build_sequence_gru_model


def load_labels(path: Path) -> list[str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    labels = data.get("labels")
    if not labels or not isinstance(labels, list):
        raise ValueError("label_map.json must contain a non-empty 'labels' array")
    return [str(x) for x in labels]


def load_dataset(
    processed_dir: Path, labels: list[str], seq_len: int, feature_dim: int
) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Load samples only for labels that have at least one .npy (order follows label_map)."""
    active = []
    for label in labels:
        folder = processed_dir / label
        if folder.is_dir() and any(folder.glob("*.npy")):
            active.append(label)

    if len(active) < 2:
        raise RuntimeError(
            f"Need at least 2 classes with samples under {processed_dir}. "
            f"Run rasterize/extract first. Found: {active}"
        )

    missing = [lb for lb in labels if lb not in active]
    if missing:
        print(f"[info] Skipping {len(missing)} labels with no processed data (add raw + extract): {missing[:12]}{'...' if len(missing) > 12 else ''}")

    label_to_idx = {lb: i for i, lb in enumerate(active)}
    xs_list = []
    ys_list = []
    for label in active:
        idx = label_to_idx[label]
        for fp in sorted((processed_dir / label).glob("*.npy")):
            arr = np.load(fp)
            if arr.shape != (seq_len, feature_dim):
                print(f"[skip] bad shape {arr.shape} in {fp}")
                continue
            xs_list.append(arr.astype(np.float32))
            ys_list.append(idx)

    if len(xs_list) < 2:
        raise RuntimeError("Not enough valid .npy sequences after filtering.")

    return np.stack(xs_list, axis=0), np.asarray(ys_list, dtype=np.int32), active


def mirror_and_swap_batch(x: np.ndarray) -> np.ndarray:
    """Mirror x-coordinate and swap [left,right] channels."""
    left = x[:, :, :63]
    right = x[:, :, 63:]

    left_pts = left.reshape(-1, x.shape[1], 21, 3).copy()
    right_pts = right.reshape(-1, x.shape[1], 21, 3).copy()

    left_pts[:, :, :, 0] = 1.0 - left_pts[:, :, :, 0]
    right_pts[:, :, :, 0] = 1.0 - right_pts[:, :, :, 0]

    mirrored_left = right_pts.reshape(-1, x.shape[1], 63)
    mirrored_right = left_pts.reshape(-1, x.shape[1], 63)
    return np.concatenate([mirrored_left, mirrored_right], axis=2).astype(np.float32)


def jitter_nonzero_keypoints(x: np.ndarray, std: float, rng: np.random.Generator) -> np.ndarray:
    """Add Gaussian noise only to present (non-zero) keypoints."""
    if std <= 0:
        return x.copy().astype(np.float32)
    noise = rng.normal(loc=0.0, scale=std, size=x.shape).astype(np.float32)
    mask = (np.abs(x) > 1e-9).astype(np.float32)
    return (x + noise * mask).astype(np.float32)


def build_augmented_training_split(
    x_train: np.ndarray,
    y_train: np.ndarray,
    seed: int,
    augment_mirror: bool,
    augment_jitter_std: float,
    augment_copies: int,
) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    xs = [x_train.astype(np.float32)]
    ys = [y_train.astype(np.float32)]

    if augment_mirror:
        xs.append(mirror_and_swap_batch(x_train))
        ys.append(y_train)

    for _ in range(max(0, augment_copies)):
        jittered = jitter_nonzero_keypoints(x_train, std=augment_jitter_std, rng=rng)
        xs.append(jittered)
        ys.append(y_train)
        if augment_mirror:
            xs.append(mirror_and_swap_batch(jittered))
            ys.append(y_train)

    x_aug = np.concatenate(xs, axis=0)
    y_aug = np.concatenate(ys, axis=0)
    idx = rng.permutation(x_aug.shape[0])
    return x_aug[idx], y_aug[idx]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--labels", type=Path, default=ROOT / "training" / "label_map.json")
    parser.add_argument("--processed", type=Path, default=ROOT / "training" / "processed")
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--val-split", type=float, default=0.15)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--seq-len", type=int, default=30)
    parser.add_argument("--feature-dim", type=int, default=FEATURE_DIM)
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    parser.add_argument("--min-learning-rate", type=float, default=1e-5)
    parser.add_argument("--label-smoothing", type=float, default=0.05)
    parser.add_argument("--augment-mirror", action="store_true", default=True)
    parser.add_argument("--no-augment-mirror", dest="augment_mirror", action="store_false")
    parser.add_argument("--augment-jitter-std", type=float, default=0.01)
    parser.add_argument("--augment-copies", type=int, default=1)
    args = parser.parse_args()

    np.random.seed(args.seed)
    tf.random.set_seed(args.seed)

    labels_full = load_labels(args.labels)
    X, y_int, active_labels = load_dataset(args.processed, labels_full, args.seq_len, args.feature_dim)
    num_classes = len(active_labels)
    y = to_categorical(y_int, num_classes=num_classes)

    class_counts = np.bincount(y_int, minlength=num_classes)
    stratify = y_int if class_counts.min() >= 2 else None
    if stratify is None:
        print("[info] Some classes have only 1 sample — validation split is random (not stratified).")

    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=args.val_split, random_state=args.seed, stratify=stratify
    )
    X_train, y_train = build_augmented_training_split(
        X_train,
        y_train,
        seed=args.seed,
        augment_mirror=args.augment_mirror,
        augment_jitter_std=args.augment_jitter_std,
        augment_copies=args.augment_copies,
    )

    y_train_int = np.argmax(y_train, axis=1)
    uniq = np.unique(y_train_int)
    cw = class_weight.compute_class_weight("balanced", classes=uniq, y=y_train_int)
    class_weights = {int(c): float(w) for c, w in zip(uniq, cw)}

    model = build_sequence_gru_model(num_classes, seq_len=args.seq_len, feature_dim=args.feature_dim)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=args.learning_rate),
        loss=tf.keras.losses.CategoricalCrossentropy(label_smoothing=args.label_smoothing),
        metrics=["accuracy"],
    )

    # Keras 3+: save_weights_only checkpoints must use a .weights.h5 suffix
    weights_path = ROOT / "model_weights_only.weights.h5"
    checkpoint = ModelCheckpoint(
        filepath=str(weights_path),
        monitor="val_accuracy",
        save_best_only=True,
        save_weights_only=True,
        mode="max",
    )
    early = EarlyStopping(monitor="val_accuracy", patience=14, restore_best_weights=True, mode="max")
    reduce_lr = ReduceLROnPlateau(
        monitor="val_accuracy",
        factor=0.5,
        patience=5,
        min_lr=args.min_learning_rate,
        mode="max",
        verbose=1,
    )

    model.fit(
        X_train,
        y_train,
        validation_data=(X_val, y_val),
        epochs=args.epochs,
        batch_size=args.batch_size,
        callbacks=[checkpoint, early, reduce_lr],
        class_weight=class_weights,
        verbose=1,
    )

    model.load_weights(str(weights_path))
    _, acc = model.evaluate(X_val, y_val, verbose=0)
    print(f"Validation accuracy (best checkpoint): {acc:.4f}")

    labels_out = {"labels": active_labels}
    out_json = ROOT / "model_labels.json"
    out_json.write_text(json.dumps(labels_out, indent=2), encoding="utf-8")
    metadata = {
        "seq_len": args.seq_len,
        "feature_dim": args.feature_dim,
        "label_smoothing": args.label_smoothing,
        "augment_mirror": args.augment_mirror,
        "augment_jitter_std": args.augment_jitter_std,
        "augment_copies": args.augment_copies,
    }
    metadata_json = ROOT / "model_metadata.json"
    metadata_json.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    backup_h5 = ROOT / "training" / "artifacts" / "model_weights_only.weights.h5"
    backup_h5.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(weights_path, backup_h5)
    shutil.copy2(out_json, ROOT / "training" / "artifacts" / "model_labels.json")
    shutil.copy2(metadata_json, ROOT / "training" / "artifacts" / "model_metadata.json")

    print(f"Wrote {weights_path}")
    print(f"Wrote {out_json}")
    print(f"Wrote {metadata_json}")
    print("Restart Flask: python app.py")


if __name__ == "__main__":
    main()

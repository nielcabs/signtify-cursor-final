"""
Run multiple training trials and keep the best checkpoint automatically.

Example:
  python training/auto_train.py --trials 6 --epochs 90
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TRAIN_SCRIPT = ROOT / "training" / "train.py"
ARTIFACTS_DIR = ROOT / "training" / "artifacts"
AUTO_DIR = ARTIFACTS_DIR / "auto_train"

VAL_ACC_PATTERN = re.compile(r"Validation accuracy \(best checkpoint\):\s*([0-9]*\.?[0-9]+)")


@dataclass
class TrialConfig:
    learning_rate: float
    augment_copies: int
    augment_jitter_std: float
    label_smoothing: float
    seed: int


def parse_validation_accuracy(output: str) -> float:
    match = VAL_ACC_PATTERN.search(output)
    if not match:
        raise RuntimeError("Could not find validation accuracy in training output.")
    return float(match.group(1))


def build_trials(count: int, base_seed: int) -> list[TrialConfig]:
    # Small, practical sweep tuned for this project without exploding runtime.
    presets = [
        (1e-3, 1, 0.01, 0.05),
        (8e-4, 2, 0.01, 0.05),
        (1.2e-3, 1, 0.015, 0.03),
        (6e-4, 2, 0.008, 0.08),
        (9e-4, 3, 0.012, 0.04),
        (7e-4, 1, 0.006, 0.10),
    ]
    configs: list[TrialConfig] = []
    for i in range(count):
        lr, copies, jitter, smooth = presets[i % len(presets)]
        configs.append(
            TrialConfig(
                learning_rate=lr,
                augment_copies=copies,
                augment_jitter_std=jitter,
                label_smoothing=smooth,
                seed=base_seed + i,
            )
        )
    return configs


def run_python_script(path: Path, args: list[str]) -> None:
    cmd = [sys.executable, str(path), *args]
    subprocess.run(cmd, cwd=str(ROOT), check=True)


def copy_if_exists(src: Path, dst: Path) -> None:
    if src.is_file():
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)


def save_trial_artifacts(trial_dir: Path, output: str) -> None:
    trial_dir.mkdir(parents=True, exist_ok=True)
    (trial_dir / "train_stdout.log").write_text(output, encoding="utf-8")
    copy_if_exists(ROOT / "model_weights_only.weights.h5", trial_dir / "model_weights_only.weights.h5")
    copy_if_exists(ROOT / "model_labels.json", trial_dir / "model_labels.json")
    copy_if_exists(ROOT / "model_metadata.json", trial_dir / "model_metadata.json")


def restore_best_to_root(best_dir: Path) -> None:
    required = [
        ("model_weights_only.weights.h5", ROOT / "model_weights_only.weights.h5"),
        ("model_labels.json", ROOT / "model_labels.json"),
        ("model_metadata.json", ROOT / "model_metadata.json"),
    ]
    for name, dst in required:
        src = best_dir / name
        if not src.is_file():
            raise RuntimeError(f"Best trial is missing required artifact: {src}")
        shutil.copy2(src, dst)

    # Keep the existing backup location in sync with best run.
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / "model_weights_only.weights.h5", ARTIFACTS_DIR / "model_weights_only.weights.h5")
    shutil.copy2(ROOT / "model_labels.json", ARTIFACTS_DIR / "model_labels.json")
    shutil.copy2(ROOT / "model_metadata.json", ARTIFACTS_DIR / "model_metadata.json")


def main() -> None:
    parser = argparse.ArgumentParser(description="Auto-train ASL model and keep best checkpoint.")
    parser.add_argument("--trials", type=int, default=4, help="How many training trials to run")
    parser.add_argument("--epochs", type=int, default=90)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--val-split", type=float, default=0.15)
    parser.add_argument("--seq-len", type=int, default=30)
    parser.add_argument("--feature-dim", type=int, default=126)
    parser.add_argument("--min-learning-rate", type=float, default=1e-5)
    parser.add_argument("--base-seed", type=int, default=42)
    parser.add_argument("--prepare-data", action="store_true", help="Run rasterize/bootstrap/extract before trials")
    parser.add_argument("--image-augments", type=int, default=6, help="Used with --prepare-data")
    parser.add_argument("--extract-noise", type=float, default=0.01, help="Used with --prepare-data")
    args = parser.parse_args()

    if args.trials < 1:
        raise ValueError("--trials must be >= 1")

    if args.prepare_data:
        print("[prep] Rasterizing alphabet SVGs...")
        run_python_script(ROOT / "training" / "rasterize_alphabet_svgs.py", [])
        print("[prep] Bootstrapping word images...")
        run_python_script(ROOT / "training" / "bootstrap_word_images.py", [])
        print("[prep] Extracting keypoints...")
        run_python_script(
            ROOT / "training" / "extract_keypoints.py",
            ["--image-augments", str(args.image_augments), "--noise", str(args.extract_noise)],
        )

    AUTO_DIR.mkdir(parents=True, exist_ok=True)
    run_stamp = time.strftime("%Y%m%d-%H%M%S")
    run_dir = AUTO_DIR / run_stamp
    run_dir.mkdir(parents=True, exist_ok=True)

    trial_configs = build_trials(args.trials, args.base_seed)
    results: list[dict[str, object]] = []
    best_acc = -1.0
    best_trial_dir: Path | None = None

    for idx, cfg in enumerate(trial_configs, start=1):
        print("\n" + "=" * 68)
        print(
            f"[trial {idx}/{len(trial_configs)}] lr={cfg.learning_rate} "
            f"copies={cfg.augment_copies} jitter={cfg.augment_jitter_std} "
            f"smoothing={cfg.label_smoothing} seed={cfg.seed}"
        )
        print("=" * 68)

        cmd = [
            sys.executable,
            str(TRAIN_SCRIPT),
            "--epochs",
            str(args.epochs),
            "--batch-size",
            str(args.batch_size),
            "--val-split",
            str(args.val_split),
            "--seq-len",
            str(args.seq_len),
            "--feature-dim",
            str(args.feature_dim),
            "--seed",
            str(cfg.seed),
            "--learning-rate",
            str(cfg.learning_rate),
            "--min-learning-rate",
            str(args.min_learning_rate),
            "--label-smoothing",
            str(cfg.label_smoothing),
            "--augment-copies",
            str(cfg.augment_copies),
            "--augment-jitter-std",
            str(cfg.augment_jitter_std),
            "--augment-mirror",
        ]

        proc = subprocess.run(
            cmd,
            cwd=str(ROOT),
            capture_output=True,
            text=True,
        )
        combined_out = (proc.stdout or "") + "\n" + (proc.stderr or "")
        trial_dir = run_dir / f"trial_{idx:02d}"
        save_trial_artifacts(trial_dir, combined_out)

        if proc.returncode != 0:
            print(f"[warn] trial {idx} failed (exit={proc.returncode}). See {trial_dir / 'train_stdout.log'}")
            results.append(
                {
                    "trial": idx,
                    "status": "failed",
                    "return_code": proc.returncode,
                    "config": cfg.__dict__,
                }
            )
            continue

        try:
            val_acc = parse_validation_accuracy(combined_out)
        except Exception as exc:
            print(f"[warn] trial {idx} missing accuracy parse: {exc}")
            results.append(
                {
                    "trial": idx,
                    "status": "failed",
                    "error": str(exc),
                    "config": cfg.__dict__,
                }
            )
            continue

        print(f"[ok] trial {idx} val_accuracy={val_acc:.4f}")
        result = {
            "trial": idx,
            "status": "ok",
            "val_accuracy": val_acc,
            "config": cfg.__dict__,
            "trial_dir": str(trial_dir),
        }
        results.append(result)

        if val_acc > best_acc:
            best_acc = val_acc
            best_trial_dir = trial_dir

    if best_trial_dir is None:
        raise RuntimeError("All auto-train trials failed. Check logs in training/artifacts/auto_train.")

    restore_best_to_root(best_trial_dir)

    summary = {
        "run_dir": str(run_dir),
        "best_val_accuracy": best_acc,
        "best_trial_dir": str(best_trial_dir),
        "results": results,
    }
    summary_path = run_dir / "summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print("\nAuto-train complete.")
    print(f"Best validation accuracy: {best_acc:.4f}")
    print(f"Best trial: {best_trial_dir}")
    print(f"Summary: {summary_path}")
    print("Updated root artifacts:")
    print("  - model_weights_only.weights.h5")
    print("  - model_labels.json")
    print("  - model_metadata.json")
    print("Restart backend to load the best model: python app.py")


if __name__ == "__main__":
    main()

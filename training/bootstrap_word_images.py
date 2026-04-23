"""
Copy bundled ASL PNGs into training/raw/<label>/ so extract_keypoints can see word classes.

  python training/bootstrap_word_images.py
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> None:
    pairs = [
        (ROOT / "ASL pics" / "Greetings" / "Hello-removebg-preview.png", "hello"),
        (ROOT / "ASL pics" / "Greetings" / "TY_1-removebg-preview.png", "thanks"),
        (ROOT / "ASL pics" / "Greetings" / "TY_2-removebg-preview.png", "thanks"),
        (ROOT / "ASL pics" / "Daily Conversations" / "No_1.png", "no"),
        (ROOT / "ASL pics" / "Daily Conversations" / "No_2.png", "no"),
        (ROOT / "ASL pics" / "Daily Conversations" / "Yes.png", "yes"),
    ]
    n = 0
    for src, label in pairs:
        if not src.is_file():
            print(f"[skip] missing {src}")
            continue
        dest_dir = ROOT / "training" / "raw" / label
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / src.name
        shutil.copy2(src, dest)
        n += 1
        print(f"[ok] {label} <- {src.name}")
    print(f"Done. Copied {n} files. Add training/raw/nothing/ and training/raw/iloveyou/ yourself if needed.")
    print("Then: python training/extract_keypoints.py && python training/train.py")


if __name__ == "__main__":
    main()

"""
Rasterize ASL alphabet SVGs into training/raw/<letter>/ for extract_keypoints.py.

Uses PyMuPDF (no Cairo / Inkscape required on Windows).

  pip install pymupdf
  python training/rasterize_alphabet_svgs.py
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def letter_from_filename(path: Path) -> str | None:
    name = path.name
    while ".svg" in name.lower():
        name = Path(name).stem
    name = name.replace(" ", "").replace(".", "")
    if len(name) >= 1 and name[0].isalpha():
        ch = name[0].lower()
        if "a" <= ch <= "z":
            return ch
    return None


def svg_to_png_bytes(svg_path: Path, out_size: int) -> bytes:
    import fitz

    doc = fitz.open(str(svg_path))
    try:
        page = doc[0]
        rect = page.rect
        scale = out_size / max(rect.width, rect.height, 1)
        mat = fitz.Matrix(scale, scale)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        return pix.tobytes("png")
    finally:
        doc.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--svg-dir",
        type=Path,
        default=ROOT / "ASL pics" / "Alphabets_SVG",
    )
    parser.add_argument("--raw", type=Path, default=ROOT / "training" / "raw")
    parser.add_argument("--size", type=int, default=640, help="Max width/height in pixels")
    args = parser.parse_args()

    if not args.svg_dir.is_dir():
        print(f"SVG folder not found: {args.svg_dir}", file=sys.stderr)
        sys.exit(1)

    png_written = 0
    for svg in sorted(args.svg_dir.iterdir()):
        if not svg.is_file():
            continue
        if not svg.name.lower().endswith(".svg"):
            continue
        letter = letter_from_filename(svg)
        if not letter:
            print(f"[skip] cannot parse letter from {svg.name}")
            continue
        try:
            png_bytes = svg_to_png_bytes(svg, args.size)
        except Exception as e:
            print(f"[err] {svg.name}: {e}", file=sys.stderr)
            continue
        out_dir = args.raw / letter
        out_dir.mkdir(parents=True, exist_ok=True)
        safe_stem = re.sub(r"[^a-zA-Z0-9_-]+", "_", svg.stem)[:80]
        out_path = out_dir / f"{safe_stem}.png"
        out_path.write_bytes(png_bytes)
        png_written += 1
        print(f"[ok] {svg.name} -> {out_path.relative_to(ROOT)}")

    print(f"Done. Wrote {png_written} PNG files under {args.raw}/<letter>/")
    print("Next: python training/extract_keypoints.py && python training/train.py")


if __name__ == "__main__":
    main()

"""
Real-photo calibration harness for the gap-aware text-assembly join
(see assemble_text() / _SPACE_GAP_RATIO in ocr_engine.py).

Runs every image in a folder through the actual production pipeline
(preprocessing.preprocess() -> the real EasyOCR reader) and writes a CSV
with, for every detected box in reading order: its text, confidence, and
(for boxes that aren't first in their line) the gap to the previous box on
that line, the line's estimated char width, the resulting gap/char_width
ratio, and whether the current _SPACE_GAP_RATIO threshold would insert a
space before it. A human can then eyeball the ratio column against the
actual photo to sort detections into "real word boundary" vs "suspicious
detector split," the same way the earlier rendered-font calibration did,
but against real capture conditions (blur, angle, lighting) instead.

Usage:
    backend/venv/bin/python backend/calibrate_gaps.py /path/to/photos \\
        [--source camera|upload] [--out gap_calibration.csv] [--recursive]

Also prints a per-image summary (final assembled text + overall confidence)
to stdout, and a compact per-box table for quick eyeballing without opening
the CSV.
"""

import argparse
import csv
import sys
from pathlib import Path

from ocr_engine import (
    _SPACE_GAP_RATIO,
    _bbox_to_rect,
    _group_into_lines,
    _line_char_width,
    assemble_text,
    get_reader,
)
from preprocessing import preprocess

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"}

CSV_FIELDS = [
    "image",
    "line",
    "position_in_line",
    "text",
    "confidence",
    "gap_before_px",
    "char_width_px",
    "gap_ratio",
    "space_inserted_before",
    "x0",
    "y0",
    "x1",
    "y1",
]


def find_images(folder: Path, recursive: bool) -> list:
    pattern = "**/*" if recursive else "*"
    paths = [p for p in folder.glob(pattern) if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS]
    return sorted(paths)


def run_one_image(reader, image_path: Path, source: str) -> tuple:
    """Returns (rows, final_text, overall_confidence, error_or_None)."""
    try:
        image_bytes = image_path.read_bytes()
        processed, scale = preprocess(image_bytes, document_source=source)
    except Exception as exc:
        return [], "", 0.0, f"preprocessing failed: {exc}"

    try:
        raw_results = reader.readtext(processed, decoder="beamsearch", paragraph=False)
    except Exception as exc:
        return [], "", 0.0, f"OCR failed: {exc}"

    words = []
    for bbox_points, text, confidence in raw_results:
        text = text.strip()
        if not text:
            continue
        words.append({
            "text": text,
            "bbox": _bbox_to_rect(bbox_points, scale),
            "confidence": float(confidence) * 100.0,
        })

    if not words:
        return [], "", 0.0, None

    lines = _group_into_lines(words)
    rows = []
    for line_idx, line in enumerate(lines):
        char_width = _line_char_width(line)
        for pos, box in enumerate(line):
            row = {
                "line": line_idx,
                "position_in_line": pos,
                "text": box["text"],
                "confidence": round(box["confidence"], 1),
                "gap_before_px": "",
                "char_width_px": round(char_width, 2) if char_width > 0 else "",
                "gap_ratio": "",
                "space_inserted_before": "line-start",
                "x0": round(box["bbox"]["x0"], 1),
                "y0": round(box["bbox"]["y0"], 1),
                "x1": round(box["bbox"]["x1"], 1),
                "y1": round(box["bbox"]["y1"], 1),
            }
            if pos > 0:
                prev = line[pos - 1]
                gap = box["bbox"]["x0"] - prev["bbox"]["x1"]
                ratio = gap / char_width if char_width > 0 else None
                space_inserted = char_width > 0 and gap > _SPACE_GAP_RATIO * char_width
                row["gap_before_px"] = round(gap, 2)
                row["gap_ratio"] = round(ratio, 3) if ratio is not None else ""
                row["space_inserted_before"] = space_inserted
            rows.append(row)

    confidences = [w["confidence"] for w in words]
    overall_confidence = sum(confidences) / len(confidences)
    final_text = assemble_text(words)
    return rows, final_text, overall_confidence, None


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("folder", type=Path, help="Folder containing photo files to run through the pipeline")
    parser.add_argument("--source", choices=["camera", "upload"], default="camera",
                         help="documentSource passed to preprocess() (default: camera)")
    parser.add_argument("--out", type=Path, default=Path("gap_calibration.csv"),
                         help="Output CSV path (default: gap_calibration.csv in the current directory)")
    parser.add_argument("--recursive", action="store_true", help="Recurse into subfolders")
    args = parser.parse_args()

    if not args.folder.is_dir():
        print(f"error: {args.folder} is not a directory", file=sys.stderr)
        sys.exit(1)

    images = find_images(args.folder, args.recursive)
    if not images:
        print(f"error: no images found in {args.folder} (looked for {sorted(IMAGE_EXTENSIONS)})", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(images)} image(s) in {args.folder}. Loading EasyOCR reader...")
    reader = get_reader()
    print(f"Using _SPACE_GAP_RATIO = {_SPACE_GAP_RATIO} (source=backend/ocr_engine.py)\n")

    all_rows = []
    summary = []

    for image_path in images:
        rel = image_path.relative_to(args.folder) if args.recursive else image_path.name
        rows, final_text, overall_confidence, error = run_one_image(reader, image_path, args.source)

        if error:
            print(f"[{rel}] ERROR: {error}")
            summary.append((str(rel), "", 0.0, f"ERROR: {error}"))
            continue

        if not rows:
            print(f"[{rel}] no text detected")
            summary.append((str(rel), "", 0.0, "no text detected"))
            continue

        print(f"[{rel}]  final_text={final_text!r}  overall_confidence={overall_confidence:.1f}")
        print(f"  {'line':>4} {'pos':>3} {'text':<20} {'conf':>6} {'gap_px':>8} {'char_w':>7} {'ratio':>7} space_before")
        for row in rows:
            print(f"  {row['line']:>4} {row['position_in_line']:>3} {row['text']:<20} "
                  f"{row['confidence']:>6} {str(row['gap_before_px']):>8} {str(row['char_width_px']):>7} "
                  f"{str(row['gap_ratio']):>7} {row['space_inserted_before']}")
        print()

        for row in rows:
            all_rows.append({"image": str(rel), **row})
        summary.append((str(rel), final_text, overall_confidence, ""))

    with args.out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(all_rows)

    summary_path = args.out.with_name(args.out.stem + "_summary" + args.out.suffix)
    with summary_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["image", "final_text", "overall_confidence", "note"])
        for row in summary:
            writer.writerow(row)

    print(f"Wrote {len(all_rows)} row(s) to {args.out}")
    print(f"Wrote {len(summary)} row(s) to {summary_path}")


if __name__ == "__main__":
    main()

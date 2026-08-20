"""
Plain-assert regression tests pinning end-to-end OCR accuracy on two real
photos, at the current preprocessing.py resize/interpolation settings. Run
directly (no pytest needed; loads the real EasyOCR reader, so this takes a
few seconds):

    backend/venv/bin/python backend/test_ocr_accuracy_regression.py

Background: PR #7 (commit 1cdc74a) silently regressed accuracy on small/
cropped photos by capping resize_min_side()'s upscale factor at 2.0x
(`if scale > 2.2: scale = 2.0`) and swapping cv2.INTER_CUBIC for
cv2.INTER_LINEAR. Both test-photos/ images below are small crops (68-88px
short side) that need a 7-9x upscale to reach the pipeline's 640px target;
capped at 2x with softer interpolation, EasyOCR misread them badly
("พัชรี" -> ". ๘ พชร" at 38% confidence; "จิตพร" -> "ชตพรว" at 52%). Verified
against a 20-fresh-process-launch sweep per image both before and after the
fix (0/20 correct before, 20/20 correct after, zero confidence variance
either way -- this is a deterministic code bug, not OCR non-determinism).
Pinned here so a future change to resize_min_side() can't reintroduce an
accuracy-destroying cap/interpolation swap without a test failing loudly.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from ocr_engine import run_ocr
from preprocessing import preprocess

TEST_PHOTOS_DIR = os.path.join(os.path.dirname(__file__), "..", "test-photos")

passed = 0
failed = 0


def check_text(label, image_filename, expected_text, min_confidence, document_source="upload"):
    global passed, failed
    path = os.path.join(TEST_PHOTOS_DIR, image_filename)
    with open(path, "rb") as f:
        image_bytes = f.read()
    processed, scale = preprocess(image_bytes, document_source=document_source)
    result = run_ocr(processed, scale=scale)
    actual_text = result["text"]
    actual_confidence = result["confidence"]

    if actual_text == expected_text and actual_confidence >= min_confidence:
        passed += 1
        print(f"PASS  {label}: {actual_text!r} ({actual_confidence:.1f}%)")
    else:
        failed += 1
        print(
            f"FAIL  {label}: expected {expected_text!r} (>= {min_confidence}%), "
            f"got {actual_text!r} ({actual_confidence:.1f}%)"
        )


# ---------------------------------------------------------------------------
# Both images are small crops (short side 68-88px) that resize_min_side()
# must upscale ~7-9x to reach MIN_SHORT_SIDE=640. Expected values pinned
# from gap_calibration.csv (generated pre-PR#7) and reconfirmed via a
# 20-fresh-process-launch sweep against the current, fixed pipeline.
# ---------------------------------------------------------------------------
check_text(
    "small-crop upscale accuracy (พัชรี)",
    "Screenshot 2569-08-20 at 00.38.44.png",
    "พัชรี",
    min_confidence=70.0,  # correct reading measures ~77.4%; regression measured 38.0%
)

check_text(
    "small-crop upscale accuracy (ฐิติพร photo)",
    "Screenshot 2569-08-20 at 00.38.40.png",
    "จิตพร",
    min_confidence=55.0,  # correct reading measures ~62.3%; regression measured 52.3%
)

print()
print(f"{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)

"""
Plain-assert regression tests for the gap-aware text assembly in
ocr_engine.py. Run directly (no pytest needed):

    backend/venv/bin/python backend/test_ocr_text_assembly.py

Exercises assemble_text() (and its helpers) against synthetic detection
boxes shaped like real EasyOCR output for Thai text, so no model load is
required. Coordinates are chosen to mimic the geometry described in the bug
report: a single Thai word split across two boxes by the detector (small
gap, no real space in the source) vs. two distinct Thai words that really
do have a printed space between them (gap close to/exceeding one glyph
width). See the module docstring in ocr_engine.py for the rationale.
"""

import sys

from ocr_engine import assemble_text, _line_char_width, _group_into_lines


def word(text, x0, y0, x1, y1):
    return {"text": text, "bbox": {"x0": x0, "y0": y0, "x1": x1, "y1": y1}, "confidence": 95.0}


passed = 0
failed = 0


def check(label, actual, expected):
    global passed, failed
    if actual == expected:
        passed += 1
        print(f"PASS  {label}: {actual!r}")
    else:
        failed += 1
        print(f"FAIL  {label}: expected {expected!r}, got {actual!r}")


# ---------------------------------------------------------------------------
# Case 1: "ภานุวัฒน์" split by the detector into "ภา" + "นุวัฒน์" (the bug
# report's exact example). Char advance ~22px on this line; the gap between
# the two boxes (5px) is a small fraction of that -- well under the 0.6x
# threshold -- so no space should be inserted.
# ---------------------------------------------------------------------------
case1 = [
    word("ภา", 100, 200, 144, 238),          # 2 chars, width 44 -> 22px/char
    word("นุวัฒน์", 149, 190, 303, 245),      # 7 chars, width 154 -> 22px/char, taller (stacked marks)
]
check("split-word rejoined (no false space)", assemble_text(case1), "ภานุวัฒน์")

# ---------------------------------------------------------------------------
# Case 2: two genuinely distinct Thai words ("สวัสดี" + "ครับ") with a real
# printed space between them. Gap (30px) exceeds 0.6x the ~24px char width,
# so the space must be preserved.
# ---------------------------------------------------------------------------
case2 = [
    word("สวัสดี", 100, 200, 244, 240),   # 6 chars, width 144 -> 24px/char
    word("ครับ", 274, 200, 370, 240),     # 4 chars, width 96  -> 24px/char
]
check("real inter-word space preserved", assemble_text(case2), "สวัสดี ครับ")

# ---------------------------------------------------------------------------
# Case 3: mixed line -- a real word boundary followed by a detector-split
# word, three boxes on one line: "ชื่อ" <space> "ภา" <no space> "นุวัฒน์".
# Verifies the decision is made per adjacent pair, not per whole line.
# ---------------------------------------------------------------------------
case3 = [
    word("ชื่อ", 50, 200, 138, 240),          # 4 chars, width 88 -> 22px/char
    word("ภา", 164, 200, 208, 238),           # 2 chars, width 44 -> 22px/char, gap from prev = 26px (real space)
    word("นุวัฒน์", 213, 190, 367, 245),       # 7 chars, width 154 -> 22px/char, gap from prev = 5px (split word)
]
check("per-pair decision within a mixed line", assemble_text(case3), "ชื่อ ภานุวัฒน์")

# ---------------------------------------------------------------------------
# Case 4: two-line page. Confirms lines are grouped by vertical overlap
# (not confused by x-position) and boxes within each line are ordered
# left-to-right regardless of input order.
# ---------------------------------------------------------------------------
case4 = [
    word("World", 300, 400, 380, 430),   # line 2, given out of x-order
    word("Hello", 100, 400, 180, 430),   # line 2
    word("บรรทัดแรก", 100, 100, 260, 140),  # line 1 (single detector box, own line)
]
check("multi-line grouping + left-to-right order", assemble_text(case4), "บรรทัดแรก Hello World")

# ---------------------------------------------------------------------------
# Case 5: borderline gap (near the threshold) defaults to NO space, per the
# stated bias -- gluing is the safer failure mode for Braille output.
# ---------------------------------------------------------------------------
char_w = 22.0
threshold_gap = 0.35 * char_w  # 7.7
gap5 = threshold_gap - 0.5  # just under threshold
box5_x0 = 144 + gap5
case5 = [
    word("ภา", 100, 200, 144, 238),
    # width kept at 7 * char_w so the aggregate char-width estimate stays
    # 22px/char and only the gap varies -- isolates the threshold check.
    word("นุวัฒน์", box5_x0, 190, box5_x0 + 7 * char_w, 245),
]
check("borderline gap defaults to no space", assemble_text(case5), "ภานุวัฒน์")

# ---------------------------------------------------------------------------
# Case 6a/6b: calibration-floor regression guard. These ratios (0.365,
# 0.444) are the two genuine inter-word gaps measured by running the real
# EasyOCR reader against rendered Thai text ("คุณสมชาย และ คุณสมหญิง";
# see the calibration notes in ocr_engine.py next to _SPACE_GAP_RATIO). If
# _SPACE_GAP_RATIO ever creeps back up past this floor, real sentence
# spaces start getting eaten again -- pin it here so that regresses loudly.
# ---------------------------------------------------------------------------
gap6a = 0.365 * char_w + 0.5  # just above the measured floor
case6a = [
    word("คณสมชาย", 62, 63, 62 + 7 * char_w, 111),
    word("และ", 62 + 7 * char_w + gap6a, 69, 62 + 7 * char_w + gap6a + 3 * char_w, 109),
]
check("measured real gap (0.365x) still triggers a space", assemble_text(case6a), "คณสมชาย และ")

gap6b = 0.444 * char_w + 0.5
case6b = [
    word("และ", 320, 69, 320 + 3 * char_w, 109),
    word("คุณสมหญิง", 320 + 3 * char_w + gap6b, 58, 320 + 3 * char_w + gap6b + 9 * char_w, 123),
]
check("measured real gap (0.444x) still triggers a space", assemble_text(case6b), "และ คุณสมหญิง")

# ---------------------------------------------------------------------------
# Case 7: median-height fallback isn't thrown off by a tall tone-mark box
# when there's no text to measure char width from (degenerate, but
# exercises the fallback path in _line_char_width directly).
# ---------------------------------------------------------------------------
degenerate_line = [
    {"text": "", "bbox": {"x0": 0, "y0": 0, "x1": 10, "y1": 20}},   # height 20
    {"text": "", "bbox": {"x0": 0, "y0": 0, "x1": 10, "y1": 55}},   # height 55 (tone-mark outlier)
    {"text": "", "bbox": {"x0": 0, "y0": 0, "x1": 10, "y1": 22}},   # height 22
]
check("char-width fallback uses median height, not outlier", _line_char_width(degenerate_line), 22.0)

print()
print(f"{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)

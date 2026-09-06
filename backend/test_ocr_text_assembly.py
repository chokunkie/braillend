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

import cv2
import numpy as np

from ocr_engine import (
    assemble_text, _line_char_width, _group_into_lines, filter_confident_words,
    _MIN_WORD_CONFIDENCE, _looks_like_text, _filter_layout_noise, _letter_ratio,
    _median_glyph_height, _text_volume, _mean_conf,
    _TARGET_GLYPH_PX, _GLYPH_PX_LO, _GLYPH_PX_HI, _RETRY_TOO_BIG, _RETRY_TOO_SMALL,
    _has_suspicious_script_mix, _has_separate_latin_token,
    _is_plausible_thai_extension, _recover_missing_thai_marks,
    _rescue_suspicious_thai_lines, _raw_words,
)
from preprocessing import (
    resize_min_side, _is_clean_bilevel, remove_colored_spellcheck_underlines,
    MIN_SHORT_SIDE, MAX_LONG_SIDE,
)


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

# ---------------------------------------------------------------------------
# Case 8: confidence-based noise filtering. Regression guard for the exact
# bug report -- a real label ("รับเหมาก่อเรื่อง") photographed on a PCB came
# back as "เขา . ืุe j02 รับเหมาก่อเรื่อง": EasyOCR misread solder pads /
# silkscreen above the label as low-confidence junk boxes, glued onto the
# correctly-read label text by assemble_text(). filter_confident_words()
# must drop the junk before assembly without touching the real line.
# ---------------------------------------------------------------------------
def word_conf(text, x0, y0, x1, y1, confidence):
    w = word(text, x0, y0, x1, y1)
    w["confidence"] = confidence
    return w


noisy_case = [
    word_conf("เขา", 40, 20, 90, 45, 22.0),      # misread PCB silkscreen
    word_conf(".", 100, 30, 108, 38, 15.0),       # stray solder-pad dot
    word_conf("ืุe", 120, 25, 150, 50, 18.0),     # misread component marking
    word_conf("j02", 160, 25, 200, 50, 61.0),     # partial label text, lower conf
    word_conf("รับเหมาก่อเรื่อง", 40, 300, 400, 360, 94.0),  # the real label
]
kept = filter_confident_words(noisy_case)
check(
    "confidence filter drops PCB noise, keeps the real label + partial text",
    sorted(w["text"] for w in kept),
    sorted(["j02", "รับเหมาก่อเรื่อง"]),
)
check(
    "assembled text after filtering has no junk prefix",
    assemble_text(kept),
    "j02 รับเหมาก่อเรื่อง",
)
check(
    "all-noise input filters down to nothing",
    filter_confident_words([word_conf("xx", 0, 0, 5, 5, 5.0)]),
    [],
)
check(
    "a word exactly at the threshold is kept (>=, not >)",
    len(filter_confident_words([word_conf("ok", 0, 0, 5, 5, _MIN_WORD_CONFIDENCE)])),
    1,
)

# ---------------------------------------------------------------------------
# Case 9: digit/symbol-heavy hallucination is rejected, real text survives.
# Regression guard for the "AIS wooden letters on wood grain -> '1 , 111
# โ ) 1'" screenshot. Once the detector thresholds were loosened to keep
# faint Thai diacritics, that same wood-grain noise started reading at 90%+,
# so the low-letter branch no longer trusts confidence alone - it needs a
# real run of digits (phone / id / account number).
# ---------------------------------------------------------------------------
check("hallucinated digit soup at 54% -> rejected", _looks_like_text("1 , 111โ ) 1", 54.0), False)
check("same digit soup now reading at 91% -> still rejected", _looks_like_text("1 111 ) 1", 91.0), False)
check("mixed alnum word 'hackathon2026' -> kept", _looks_like_text("hackathon2026", 76.0), True)
check("real Thai line -> kept", _looks_like_text("ภารกิจ คิดเผือ ขับเคลือนอนาคต", 80.0), True)
check("clearly-read phone number -> kept (long digit run)", _looks_like_text("081-234-5678", 88.0), True)
check("short scattered digits read 'confidently' -> rejected", _looks_like_text(") ) 1 1 (", 90.0), False)
check("empty text -> not text", _looks_like_text("   ", 99.0), False)
check("letter ratio of pure digits", round(_letter_ratio("2568"), 2), 0.0)

# ---------------------------------------------------------------------------
# Case 10: a small logo/caption strip at the bottom of a sign is dropped,
# the headline is kept. Regression guard for "MAMO" coming back as
# "mamo als academy ni okmd".
# ---------------------------------------------------------------------------
layout_case = [
    word("MAMO", 60, 200, 500, 320),        # headline, height 120
    word("AIS", 40, 560, 92, 578),          # sponsor logo strip, height 18, bottom 3.7%
    word("Academy", 96, 560, 170, 578),
    word("NIA", 210, 560, 250, 578),
    word("okmd", 290, 560, 350, 578),
]
kept_layout = _filter_layout_noise(layout_case, img_height=600.0)
check("layout filter keeps the headline, drops the logo strip",
      sorted(w["text"] for w in kept_layout), ["MAMO"])

# ...but a caption ON the same line as the headline is kept.
same_line_case = [
    word("HEADLINE", 60, 200, 400, 320),
    word("*", 410, 250, 424, 270),          # small mark riding the headline line
    word("tiny", 40, 900, 70, 912),         # ...but this stray one still goes
]
kept_same = _filter_layout_noise(same_line_case, img_height=1000.0)
check("small box on the headline's own line survives",
      "HEADLINE" in [w["text"] for w in kept_same] and "*" in [w["text"] for w in kept_same],
      True)

check("layout filter is a no-op below 3 boxes",
      len(_filter_layout_noise([word("a", 0, 0, 10, 10), word("b", 0, 0, 5, 5)], 100.0)), 2)

# ---------------------------------------------------------------------------
# Case 11: glyph-size retry helpers. EasyOCR fragments words once glyphs get
# well past ~46px; run_ocr measures the pass-1 text height and only re-reads
# when it's clearly too small/big, then keeps the re-read only if it didn't
# lose text or confidence.
# ---------------------------------------------------------------------------
def det(text, x0, y0, x1, y1, conf=0.9):
    """EasyOCR-shaped detection tuple: (4-point box, text, confidence)."""
    return ([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], text, conf)


big = [det("โชกุน", 40, 40, 400, 240), det("ภารกิจ", 40, 300, 500, 500)]  # both 200px tall
check("median glyph height of an over-large read", _median_glyph_height(big), 200.0)
in_band = [det("สวัสดี", 10, 10, 130, 58)]  # 48px
check("in-band read reports ~48px", _median_glyph_height(in_band), 48.0)
check("empty read -> 0 height", _median_glyph_height([]), 0.0)
check("empty/whitespace boxes ignored", _median_glyph_height([det("  ", 0, 0, 10, 40)]), 0.0)
check("text volume counts stripped chars", _text_volume(big), len("โชกุน") + len("ภารกิจ"))
check("mean confidence over non-empty boxes",
      round(_mean_conf([det("a", 0, 0, 1, 1, 0.4), det("b", 0, 0, 1, 1, 0.8), det(" ", 0, 0, 1, 1, 0.0)]), 2), 0.6)
# Band the retry is gated on: ~46px target never retries; clearly-large does.
check("46px target sits inside the no-retry band", _GLYPH_PX_LO <= _TARGET_GLYPH_PX <= _GLYPH_PX_HI, True)
check("200px would trigger a retry", 200.0 > _RETRY_TOO_BIG, True)
check("12px would trigger a retry", 12.0 < _RETRY_TOO_SMALL, True)
check("a 78px paragraph is left alone (retry margin is wider than the band)",
      not (78.0 < _RETRY_TOO_SMALL or 78.0 > _RETRY_TOO_BIG), True)

# ---------------------------------------------------------------------------
# Case 12: preprocessing gates.
#   - resize_min_side clamps into coarse bounds (no fixed 1100 upscale)
#   - _is_clean_bilevel spots a crisp black-on-white image so CLAHE / adaptive
#     threshold get skipped (they only erode thin Thai diacritic strokes)
# ---------------------------------------------------------------------------
_, s_small = resize_min_side(np.full((300, 400, 3), 255, np.uint8))
check("tiny image is upscaled toward the short-side floor", s_small > 1.0, True)
_, s_huge = resize_min_side(np.full((4000, 6000, 3), 255, np.uint8))
check("huge image is downscaled under the long-side cap", s_huge < 1.0, True)
_, s_ok = resize_min_side(np.full((900, 1400, 3), 255, np.uint8))
check("already-bounded image is left alone", s_ok, 1.0)
check("MIN_SHORT_SIDE lowered from the old fixed 1100", MIN_SHORT_SIDE < 1100, True)

crisp = np.full((200, 600), 255, np.uint8)
crisp[80:130, 40:560] = 0  # solid black text band on white
check("crisp black-on-white -> clean bilevel", _is_clean_bilevel(crisp), True)
noisy = np.random.RandomState(0).randint(60, 190, (200, 600), dtype=np.uint8)  # all mid-grey
check("mid-grey photo -> not clean bilevel", _is_clean_bilevel(noisy), False)
check("empty array -> not clean bilevel", _is_clean_bilevel(np.zeros((0, 0), np.uint8)), False)

# ---------------------------------------------------------------------------
# Case 13: mixed-language anomaly detection and Thai line rescue. Separate
# Thai + English words are legitimate; a Latin island embedded inside a Thai
# token or a repeated Latin hallucination is not. The rescue uses a padded
# line crop and a Thai allowlist, then replaces only that suspicious line.
# ---------------------------------------------------------------------------
check("normal separated Thai + English is not suspicious",
      _has_suspicious_script_mix("เรียน OpenAI 2026"), False)
check("mixed-script product token is left alone",
      _has_suspicious_script_mix("รุ่นiPhone"), False)
check("Latin lookalike embedded in Thai token is suspicious",
      _has_suspicious_script_mix("wตตา"), True)
check("repeated Latin detector hallucination is suspicious",
      _has_suspicious_script_mix("wnnnnnnส. e"), True)
check("ordinary pure Thai text is not suspicious",
      _has_suspicious_script_mix("พิตต้า"), False)
check("standalone English word protects a genuinely mixed line",
      _has_separate_latin_token("ชื่อ Pete"), True)
check("embedded lookalike remains eligible for Thai rescue",
      _has_separate_latin_token("wตตา"), False)


class FakeThaiRescueReader:
    def __init__(self):
        self.allowlist_seen = False

    def readtext(self, image, **kwargs):
        self.allowlist_seen = bool(kwargs.get("allowlist"))
        return [det("พิตต้า", 20, 25, 150, 80, 0.84)]


fake_reader = FakeThaiRescueReader()
bad_line = [det("wตตา", 100, 90, 250, 145, 0.95)]
rescued_raw, rescued_count = _rescue_suspicious_thai_lines(
    bad_line, np.full((260, 420), 255, np.uint8), fake_reader
)
rescued_text = assemble_text(filter_confident_words(_raw_words(rescued_raw)))
check("suspicious mixed token is re-read as Thai", rescued_text, "พิตต้า")
check("Thai rescue reports one replaced line", rescued_count, 1)
check("Thai rescue passes an explicit allowlist", fake_reader.allowlist_seen, True)

fake_reader_mixed = FakeThaiRescueReader()
mixed_line = [
    det("ชื่อ", 20, 90, 110, 145, 0.91),
    det("Pete", 150, 90, 270, 145, 0.92),
    det("wตตา", 310, 90, 430, 145, 0.95),
]
untouched_mixed, mixed_rescue_count = _rescue_suspicious_thai_lines(
    mixed_line, np.full((260, 500), 255, np.uint8), fake_reader_mixed
)
check("Thai rescue never overwrites a real English word on the same line",
      mixed_rescue_count, 0)
check("protected mixed line remains unchanged", untouched_mixed, mixed_line)

check("padded Thai reread may restore combining marks",
      _is_plausible_thai_extension("คม", "คิม"), True)
check("padded Thai reread may restore marks plus one spacing vowel",
      _is_plausible_thai_extension("พตต", "พิตต้า"), True)
check("same-length spelling rewrite is never auto-accepted",
      _is_plausible_thai_extension("สกาย", "สบาย"), False)
check("unrelated longer Thai guess is never auto-accepted",
      _is_plausible_thai_extension("คม", "คอมพิวเตอร์"), False)
check("new leading Thai glyph is never auto-accepted",
      _is_plausible_thai_extension("พชร", "ไพัชรี"), False)


class FakeThaiMarkReader:
    def recognize(self, image, **kwargs):
        x0, x1, y0, y1 = kwargs["horizontal_list"][0]
        return [det("คิม", x0, y0, x1, y1, 0.72)]


missing_mark = [det("คม", 100, 100, 240, 180, 0.99)]
recovered_raw, recovered_count = _recover_missing_thai_marks(
    missing_mark, np.full((300, 420), 255, np.uint8), FakeThaiMarkReader()
)
recovered_text = assemble_text(filter_confident_words(_raw_words(recovered_raw)))
check("direct padded recognition restores omitted Thai vowel", recovered_text, "คิม")
check("direct padded recognition reports recovered line", recovered_count, 1)

# ---------------------------------------------------------------------------
# Case 14: remove the saturated-red spell-check wave seen in the two failed
# nickname screenshots without touching broad red document content.
# ---------------------------------------------------------------------------
spellcheck = np.full((180, 600, 3), 255, np.uint8)
points = np.array([[x, 125 + (x // 6) % 2 * 3] for x in range(80, 520, 3)], np.int32)
cv2.polylines(spellcheck, [points], False, (0, 0, 255), 3)
cleaned_spellcheck, removed_count = remove_colored_spellcheck_underlines(spellcheck)
check("long thin red spell-check component is detected", removed_count > 0, True)
check("red underline pixels are inpainted",
      int(((cleaned_spellcheck[:, :, 2] > 180) & (cleaned_spellcheck[:, :, 1] < 100)).sum()) < 20,
      True)

red_heading = np.full((180, 600, 3), 255, np.uint8)
cv2.rectangle(red_heading, (80, 40), (520, 105), (0, 0, 255), -1)
untouched_heading, heading_removed = remove_colored_spellcheck_underlines(red_heading)
check("broad red content is not mistaken for an underline", heading_removed, 0)
check("broad red content remains unchanged", np.array_equal(untouched_heading, red_heading), True)

print()
print(f"{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)

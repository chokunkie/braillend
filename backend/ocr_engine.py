"""
EasyOCR wrapper. The reader is initialized once (module import) and reused
across requests, since loading the Thai+English recognition models is
expensive.
"""

import re
import statistics
from typing import Any, Dict, List

import cv2
import easyocr

# One EasyOCR reader per language set, built lazily and reused (loading the
# recognition models is expensive). "th+en" is the default; "th" is offered
# for Thai-only documents, where dropping the English character set removes a
# whole class of confusions (e.g. ก/n, ล/a, ธ/6) and measurably lifts
# accuracy on pure-Thai pages.
_readers: Dict[str, "easyocr.Reader"] = {}

_LANG_SETS = {
    "th": ["th"],
    "tha": ["th"],
    "th+en": ["th", "en"],
    "tha+eng": ["th", "en"],
}


def get_reader(lang: str = "th+en") -> "easyocr.Reader":
    key = lang if lang in _LANG_SETS else "th+en"
    if key not in _readers:
        langs = _LANG_SETS[key]
        # NOTE: default path is still easyocr.Reader(["th", "en"], ...).
        _readers[key] = easyocr.Reader(langs, gpu=False, verbose=False)
    return _readers[key]


def _bbox_to_rect(points: List[List[float]], scale: float) -> Dict[str, float]:
    """scale maps the (possibly resized) image the OCR ran on back to the
    original upload dimensions the frontend inspector draws on."""
    xs = [p[0] / scale for p in points]
    ys = [p[1] / scale for p in points]
    return {
        "x0": float(min(xs)),
        "y0": float(min(ys)),
        "x1": float(max(xs)),
        "y1": float(max(ys)),
    }


# Detections below this per-word confidence are treated as detector noise
# (stray marks on cluttered backgrounds -- solder pads, silkscreen, glare --
# misread as text) and excluded from the assembled text, though they're
# still returned in `words` so the inspector UI can show what was seen and
# rejected. Text run through a real camera/PCB shot regularly produces a
# handful of these alongside a correctly-read line; averaging them into the
# one overall-confidence gate let a good line get diluted by attached noise
# instead of being isolated and dropped on its own.
_MIN_WORD_CONFIDENCE = 35.0


def filter_confident_words(words: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Drops detections below _MIN_WORD_CONFIDENCE - the noise this filters
    out never reaches assemble_text() or the overall-confidence average."""
    return [w for w in words if w["confidence"] >= _MIN_WORD_CONFIDENCE]


# A detection box shorter than this fraction of the tallest box on the page
# is treated as fine print / a logo caption rather than the subject text -
# e.g. photographing a sign whose headline reads fine but whose bottom strip
# of sponsor logos ("AIS Academy", "NIA", "okmd") gets misread and glued on
# as "als academy ni okmd". Only applied when there IS a clear headline to
# compare against, and small boxes that sit on the same line as a kept box
# are still kept.
_SMALL_BOX_HEIGHT_RATIO = 0.45
_BOTTOM_STRIP_FRAC = 0.12  # boxes whose centre is in the bottom 12% of the frame...
_BOTTOM_STRIP_MIN_ABOVE = 2  # ...are dropped only when this many boxes sit above them

_LETTER_RE = re.compile(r"[A-Za-zก-๏]")


def _letter_ratio(text: str) -> float:
    stripped = text.replace(" ", "")
    if not stripped:
        return 0.0
    return len(_LETTER_RE.findall(stripped)) / len(stripped)


def _looks_like_text(text: str, overall_confidence: float) -> bool:
    """Rejects results that are mostly digits/symbols with barely any real
    letters - i.e. OCR hallucinating '1 , 111 โ ) 1' out of wood grain.

    The confidence-only escape hatch is gone: once the detector thresholds
    were loosened to keep faint Thai diacritics, faint background noise
    started reading "confidently" too. A genuine pure-number OCR target -
    a phone number, an ID, an account number - is instead LONG, so the
    low-letter branch only lets through a string with a real run of digits.
    """
    if not text.strip():
        return False
    if _letter_ratio(text) >= 0.35:
        return True
    digits = sum(c.isdigit() for c in text)
    return digits >= 7 and overall_confidence >= 65.0


def _filter_layout_noise(words: List[Dict[str, Any]], img_height: float) -> List[Dict[str, Any]]:
    if len(words) < 3:
        return words

    heights = [w["bbox"]["y1"] - w["bbox"]["y0"] for w in words]
    max_h = max(heights) if heights else 0.0
    if max_h <= 0:
        return words

    big = [w for w in words if (w["bbox"]["y1"] - w["bbox"]["y0"]) >= _SMALL_BOX_HEIGHT_RATIO * max_h]
    if not big:
        return words

    def on_a_big_line(w: Dict[str, Any]) -> bool:
        return any(_vertical_overlap_ratio(w["bbox"], b["bbox"]) >= _LINE_OVERLAP_THRESHOLD for b in big)

    kept: List[Dict[str, Any]] = []
    for w in words:
        h = w["bbox"]["y1"] - w["bbox"]["y0"]
        y_centre = (w["bbox"]["y0"] + w["bbox"]["y1"]) / 2.0

        # tiny box that isn't riding along a headline line -> fine print
        if h < _SMALL_BOX_HEIGHT_RATIO * max_h and not on_a_big_line(w):
            continue
        # box parked in the bottom strip while real content sits above -> logo row
        if img_height > 0 and y_centre > img_height * (1.0 - _BOTTOM_STRIP_FRAC):
            above = sum(1 for o in words if o is not w and
                        ((o["bbox"]["y0"] + o["bbox"]["y1"]) / 2.0) < img_height * 0.80)
            if above >= _BOTTOM_STRIP_MIN_ABOVE and not on_a_big_line(w):
                continue
        kept.append(w)

    return kept if kept else words


# EasyOCR's recognizer has a sweet spot around 30-70px per glyph. Push text
# much bigger and the *detector* fragments a word into pieces and the
# recognizer drops characters - this is where "โชกุน -> เชกน", "พิตต้า ->
# พตตา", "สกาย -> สาย" came from (a clean upload whose ~90px glyphs got
# upscaled to ~180px by the old fixed resize). run_ocr() reads once, measures
# the text height it actually found, and if it's WELL outside the band,
# resizes toward ~46px/glyph and reads again - keeping the re-read only if it
# didn't lose text or confidence (multi-line pages with lots of context read
# fine at larger sizes and a downscale-then-reread can only hurt them).
_TARGET_GLYPH_PX = 46.0
_GLYPH_PX_LO = 30.0            # no-retry band (measured pass-1 median height)
_GLYPH_PX_HI = 70.0
_RETRY_TOO_SMALL = 22.0       # ...but only actually retry outside this wider margin
_RETRY_TOO_BIG = 92.0
_RESIZE_MIN = 0.12
_RESIZE_MAX = 2.8
# Only relevant when preprocess UPSCALED a small image (scale > 1): don't then
# crush it back down past ~35% of the original - that up-then-down round trip
# smears the thin Thai strokes worse than a slightly-too-large read. When
# preprocess downscaled a big photo (scale < 1) there's no round trip, so a
# further clean single downscale toward the sweet spot is fine.
_EFF_SCALE_FLOOR = 0.35


def _readtext(reader: "easyocr.Reader", image):
    """One detection+recognition pass with Thai-tuned detector knobs: a
    slightly lower text_threshold so faint diacritic strokes stay in their
    box, a higher y_ths so an above/below vowel merges into its line instead
    of orphaning, a small add_margin so tone marks aren't clipped off the
    top. text_threshold isn't dropped hard - that also makes faint background
    noise read 'confidently'."""
    try:
        return reader.readtext(
            image, paragraph=False,
            text_threshold=0.6,
            y_ths=1.5, x_ths=1.0, add_margin=0.1,
        )
    except Exception:
        return reader.readtext(image, decoder="beamsearch", paragraph=False)


def _median_glyph_height(raw_results) -> float:
    heights = []
    for box, text, _conf in raw_results:
        if not str(text).strip():
            continue
        ys = [p[1] for p in box]
        heights.append(max(ys) - min(ys))
    return float(statistics.median(heights)) if heights else 0.0


def _text_volume(raw_results) -> int:
    return sum(len(str(t).strip()) for _b, t, _c in raw_results)


def _mean_conf(raw_results) -> float:
    cs = [float(c) for _b, t, c in raw_results if str(t).strip()]
    return sum(cs) / len(cs) if cs else 0.0


def _confident_volume(raw_results) -> int:
    """Characters that would survive the downstream confidence filter. A
    re-read that keeps every box but drops one line's confidence through the
    floor loses volume HERE even though _text_volume() looks unchanged."""
    floor = _MIN_WORD_CONFIDENCE / 100.0
    return sum(len(str(t).strip()) for _b, t, c in raw_results
              if str(t).strip() and float(c) >= floor)


def run_ocr(image, scale: float = 1.0, lang: str = "th+en") -> Dict[str, Any]:
    reader = get_reader(lang)
    raw_results = _readtext(reader, image)

    factor = 1.0
    med_h = _median_glyph_height(raw_results)
    if med_h > 0.0 and (med_h < _RETRY_TOO_SMALL or med_h > _RETRY_TOO_BIG):
        f = max(_RESIZE_MIN, min(_RESIZE_MAX, _TARGET_GLYPH_PX / med_h))
        if f < 1.0 and scale > 1.0:
            # preprocess upscaled - don't undo that and then some
            f = max(f, _EFF_SCALE_FLOOR / scale)
        if abs(f - 1.0) >= 0.15:
            try:
                interp = cv2.INTER_AREA if f < 1.0 else cv2.INTER_CUBIC
                resized = cv2.resize(image, None, fx=f, fy=f, interpolation=interp)
                retry = _readtext(reader, resized)
                # Accept the re-read only if it held onto the text that would
                # actually survive the downstream confidence filter. That
                # single check is what protects a multi-line page (a lossy
                # downscale-then-reread dropped one line to 0.2 confidence -
                # its characters stop counting here) WITHOUT also blocking the
                # far more common win: a single word that pass 1 read
                # confidently-but-WRONG at a huge size, replaced by a correct
                # re-read at the sweet spot (which often reads less
                # "confidently" than the wrong-but-sure original). The mean
                # confidence check is only a catastrophe backstop.
                if (_median_glyph_height(retry) > 0.0
                        and _confident_volume(retry) >= 0.7 * _confident_volume(raw_results)
                        and _mean_conf(retry) >= _mean_conf(raw_results) - 0.35):
                    raw_results, factor = retry, f
            except Exception:
                pass

    eff_scale = scale * factor

    words = []
    for bbox_points, text, confidence in raw_results:
        text = text.strip()
        if not text:
            continue
        words.append(
            {
                "text": text,
                "bbox": _bbox_to_rect(bbox_points, eff_scale),
                "confidence": float(confidence) * 100.0,
            }
        )

    try:
        img_height = float(image.shape[0]) / scale if scale else float(image.shape[0])
    except Exception:
        img_height = 0.0

    kept_words = _filter_layout_noise(filter_confident_words(words), img_height)
    overall_confidence = (
        (sum(w["confidence"] for w in kept_words) / len(kept_words)) if kept_words else 0.0
    )

    text = assemble_text(kept_words)
    if not _looks_like_text(text, overall_confidence):
        text = ""

    return {
        "text": text,
        "confidence": overall_confidence,
        "words": words,
    }


# --- gap-aware text assembly ------------------------------------------------
#
# EasyOCR's detector (paragraph=False) returns one box per visually-grouped
# text region, not one box per linguistic word. Thai has no inter-word
# spacing, so a single word can get split across two detection boxes when
# stacked tone marks/vowels create an irregular horizontal gap that the
# detector reads as a region break. Blindly joining every box with " "
# turns that false split into a literal space (e.g. "ภานุวัฒน์" splits into
# "ภา" + "นุวัฒน์" and comes out as "ภา นุวัฒน์"). For a Braille reader a
# space is significant -- a blank cell means "separate word" -- so a false
# positive space is worse than two real words left glued together (which
# Thai text is routinely written/read without spaces anyway). So: group
# boxes into lines, then only insert a space between two adjacent boxes on
# a line when the horizontal gap between them clearly exceeds one
# character's width for that line. Anything borderline defaults to no
# space.

_LINE_OVERLAP_THRESHOLD = 0.4  # vertical-overlap fraction (of the shorter box) to call two boxes "same line"

# INTERIM value, calibrated against rendered-font text run through the real
# EasyOCR reader, not real photographs (see backend/test_ocr_text_assembly.py
# for the calibration harness). Two genuine inter-word gaps measured 0.365
# and 0.444x char width; this sits just below that floor so real sentence
# spaces survive, with a small margin. No genuine false-split-within-a-word
# case was reproducible in that calibration run (single Thai words, even
# heavily stacked ones, came back as one detection box every time), so the
# upper boundary of this value is still unvalidated against real data.
# Re-calibrate with actual camera-captured photos before trusting this near
# a production deploy -- real capture conditions (blur, angle, lighting)
# may shift the gap distribution in either direction.
_SPACE_GAP_RATIO = 0.35  # gap must exceed this multiple of the line's avg char width to count as a real space


def _vertical_overlap_ratio(a: Dict[str, float], b: Dict[str, float]) -> float:
    top = max(a["y0"], b["y0"])
    bottom = min(a["y1"], b["y1"])
    overlap = max(0.0, bottom - top)
    shorter = min(a["y1"] - a["y0"], b["y1"] - b["y0"])
    if shorter <= 0:
        return 0.0
    return overlap / shorter


def _group_into_lines(words: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
    """Clusters detection boxes into text lines by vertical overlap.

    Union-find so a box that transitively overlaps two others already
    judged to be on the same line joins that line too, even if it doesn't
    directly overlap both of them.
    """
    n = len(words)
    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i: int, j: int) -> None:
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[ri] = rj

    for i in range(n):
        for j in range(i + 1, n):
            if _vertical_overlap_ratio(words[i]["bbox"], words[j]["bbox"]) >= _LINE_OVERLAP_THRESHOLD:
                union(i, j)

    clusters: Dict[int, List[Dict[str, Any]]] = {}
    for i in range(n):
        clusters.setdefault(find(i), []).append(words[i])

    lines = list(clusters.values())
    for line in lines:
        line.sort(key=lambda w: w["bbox"]["x0"])
    lines.sort(key=lambda line: sum((w["bbox"]["y0"] + w["bbox"]["y1"]) / 2 for w in line) / len(line))
    return lines


def _line_char_width(line: List[Dict[str, Any]]) -> float:
    """Estimates a typical glyph width for a line, as the unit gaps are
    judged against. Aggregated across the whole line (total box width /
    total character count) rather than per-box, since a single- or
    two-character box gives a noisy per-box estimate.

    Falls back to the line's *median* box height (not any one box's own
    height) if there's no text to measure width from. Median, not per-box,
    because stacked Thai tone marks/vowels (่ ้ ๊ ๋ ั ิ ี ึ ื ุ ู) make some
    boxes taller than others for the same logical text size -- using a
    single box's height would misjudge what "one character" looks like on
    this line.
    """
    total_width = 0.0
    total_chars = 0
    for w in line:
        bbox = w["bbox"]
        total_width += bbox["x1"] - bbox["x0"]
        total_chars += len(w["text"])

    if total_chars > 0:
        return total_width / total_chars

    heights = [w["bbox"]["y1"] - w["bbox"]["y0"] for w in line]
    return statistics.median(heights) if heights else 0.0


def _join_line(line: List[Dict[str, Any]]) -> str:
    if not line:
        return ""

    char_width = _line_char_width(line)
    parts = [line[0]["text"]]

    for prev, cur in zip(line, line[1:]):
        gap = cur["bbox"]["x0"] - prev["bbox"]["x1"]
        # Ties/borderline gaps default to NOT inserting a space (see module
        # docstring above): a missed space degrades gracefully, a spurious
        # one doesn't.
        if char_width > 0 and gap > _SPACE_GAP_RATIO * char_width:
            parts.append(" ")
        parts.append(cur["text"])

    return "".join(parts)


def assemble_text(words: List[Dict[str, Any]]) -> str:
    """Reassembles detection boxes into a single string, inserting spaces
    only where the horizontal gap between same-line boxes indicates a real
    word boundary rather than a detector split."""
    lines = _group_into_lines(words)
    return " ".join(_join_line(line) for line in lines)
